import {
  PLAN_A_DEADLINE_LOCAL,
  type ApprovalRecord,
  type ExecutionAction,
  type OutcomeActual,
  type OutcomeStatus,
  type RecoveryOutcome,
  type VerificationEvidence,
} from '../recovery/governance/p5Contracts';
import { isLocalTimeAfter } from '../recovery/governance/staleness';
import { latestEvidence } from './evidence';

type Ev<K extends VerificationEvidence['kind']> = Extract<VerificationEvidence, { kind: K }>;
const ofKind = <K extends VerificationEvidence['kind']>(list: VerificationEvidence[], kind: K): Ev<K>[] =>
  list.filter((e): e is Ev<K> => e.kind === kind);

/**
 * Exclusive evaluation over the LATEST revision per (actionId, kind):
 * 1 no evidence → UNVERIFIED; 2 any hard failure → FAILED; 3 all required passing → SUCCESS; 4 else PARTIAL.
 */
export function evaluateOutcome(
  approval: ApprovalRecord,
  actions: readonly ExecutionAction[],
  log: readonly VerificationEvidence[],
): RecoveryOutcome {
  const actionIds = new Set(actions.filter((a) => a.approvalId === approval.id).map((a) => a.id));
  const ownActions = actions.filter((a) => actionIds.has(a.id));
  const latest = latestEvidence(log.filter((e) => actionIds.has(e.actionId)));

  const receipts = ofKind(latest, 'RECEIPT');
  const preps = ofKind(latest, 'PREP');
  const menus = ofKind(latest, 'MENU_UPDATE');
  const fulfil = ofKind(latest, 'ORDER_FULFILMENT');

  // Hard failures
  const failures: string[] = [];
  for (const r of receipts) {
    if (!r.payload.accepted) failures.push('RECEIPT_REJECTED');
    if (isLocalTimeAfter(r.payload.arrivalLocal, PLAN_A_DEADLINE_LOCAL)) failures.push(`RECEIPT_LATE:${r.payload.arrivalLocal}`);
  }
  for (const f of fulfil) {
    if (f.payload.confirmedFulfilled < f.payload.confirmedRequired) {
      failures.push(`CONFIRMED_ORDERS_UNMET:${f.payload.confirmedFulfilled}/${f.payload.confirmedRequired}`);
    }
  }

  // Required evidence
  const missing: string[] = [];
  let allPass = true;
  if (approval.selectedStrategy === 'A') {
    if (receipts.length === 0) missing.push('RECEIPT');
  } else {
    for (const a of ownActions.filter((x) => x.actionType === 'PREP_BATCH_TASK')) {
      const p = preps.find((e) => e.actionId === a.id);
      if (!p) missing.push(`PREP:${a.targetId ?? a.id}`);
      else if (p.payload.producedPortions < p.payload.plannedPortions) allPass = false;
    }
    for (const a of ownActions.filter((x) => x.actionType === 'MENU_LIMIT_TASK')) {
      const m = menus.find((e) => e.actionId === a.id);
      if (!m) missing.push(`MENU_UPDATE:${a.targetId ?? a.id}`);
      else if (!m.payload.applied) allPass = false;
    }
  }
  if (fulfil.length === 0) missing.push('ORDER_FULFILMENT');

  let status: OutcomeStatus;
  if (latest.length === 0) status = 'UNVERIFIED';
  else if (failures.length > 0) status = 'FAILED';
  else if (missing.length === 0 && allPass) status = 'SUCCESS';
  else status = 'PARTIAL';

  return {
    incidentId: approval.incidentId,
    scenarioId: approval.scenarioId,
    strategy: approval.selectedStrategy,
    status,
    predicted: { ...approval.predicted },
    actual: latest.length === 0 ? null : buildActual(receipts, preps, menus, fulfil),
    evidenceIds: latest.map((e) => e.id),
    missingEvidence: missing,
    failures,
    simulated: true,
  };
}

function buildActual(receipts: Ev<'RECEIPT'>[], preps: Ev<'PREP'>[], menus: Ev<'MENU_UPDATE'>[], fulfil: Ev<'ORDER_FULFILMENT'>[]): OutcomeActual {
  const actual: OutcomeActual = {};
  const r = receipts[0];
  if (r) {
    actual.receivedKgMilli = r.payload.receivedKgMilli;
    actual.receiptAccepted = r.payload.accepted;
    actual.arrivalLocal = r.payload.arrivalLocal;
    actual.landedCostSen = r.payload.landedCostSen;
  }
  const f = fulfil[0];
  if (f) {
    actual.confirmedFulfilled = f.payload.confirmedFulfilled;
    actual.confirmedRequired = f.payload.confirmedRequired;
  }
  if (preps.length) {
    actual.producedPortions = preps.reduce((s, p) => s + p.payload.producedPortions, 0);
    actual.plannedPortions = preps.reduce((s, p) => s + p.payload.plannedPortions, 0);
    actual.waste = preps.map((p) => ({ batchId: p.payload.batchId, waste: p.payload.waste }));
  }
  if (menus.length) actual.menuUpdatesApplied = menus.filter((m) => m.payload.applied).length;
  return actual;
}

export function formatOutcomeLabel(status: OutcomeStatus): string {
  return `Simulated Outcome: ${status}`;
}
