import {
  PLAN_A_DEADLINE_LOCAL,
  type ApprovalRecord,
  type ExecutionAction,
  type OutcomeActual,
  type OutcomeReason,
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
  verifiedAtIso?: string,
): RecoveryOutcome {
  const actionIds = new Set(actions.filter((a) => a.approvalId === approval.id).map((a) => a.id));
  const ownActions = actions.filter((a) => actionIds.has(a.id));
  const latest = latestEvidence(log.filter((e) => actionIds.has(e.actionId)));

  const receipts = ofKind(latest, 'RECEIPT');
  const preps = ofKind(latest, 'PREP');
  const menus = ofKind(latest, 'MENU_UPDATE');
  const fulfil = ofKind(latest, 'ORDER_FULFILMENT');

  const reasons: OutcomeReason[] = [];

  // Hard failures
  const failures: string[] = [];
  for (const r of receipts) {
    if (!r.payload.accepted) {
      failures.push('RECEIPT_REJECTED');
      reasons.push({ code: 'RECEIPT_REJECTED', text: 'RECEIPT_REJECTED: simulated receipt was rejected', kind: 'HARD_FAILURE' });
    }
    if (isLocalTimeAfter(r.payload.arrivalLocal, PLAN_A_DEADLINE_LOCAL)) {
      failures.push(`RECEIPT_LATE:${r.payload.arrivalLocal}`);
      reasons.push({
        code: `RECEIPT_LATE:${r.payload.arrivalLocal}`,
        text: `RECEIPT_LATE: arrival ${r.payload.arrivalLocal} after ${PLAN_A_DEADLINE_LOCAL} cutoff`,
        kind: 'HARD_FAILURE',
      });
    }
    if (r.payload.accepted && !isLocalTimeAfter(r.payload.arrivalLocal, PLAN_A_DEADLINE_LOCAL)) {
      reasons.push({
        code: 'PASS_RECEIPT',
        text: `PASS_RECEIPT: received ${r.payload.receivedKgMilli / 1000}kg accepted at ${r.payload.arrivalLocal}`,
        kind: 'PASS',
      });
    }
  }

  for (const f of fulfil) {
    if (f.payload.confirmedFulfilled < f.payload.confirmedRequired) {
      const code = `CONFIRMED_ORDERS_UNMET:${f.payload.confirmedFulfilled}/${f.payload.confirmedRequired}`;
      failures.push(code);
      reasons.push({
        code,
        text: `CONFIRMED_ORDERS_UNMET: confirmed fulfilment ${f.payload.confirmedFulfilled} of ${f.payload.confirmedRequired}`,
        kind: 'HARD_FAILURE',
      });
    } else {
      reasons.push({
        code: 'PASS_FULFILMENT',
        text: `PASS_FULFILMENT: ${f.payload.confirmedFulfilled} of ${f.payload.confirmedRequired} confirmed portions fulfilled`,
        kind: 'PASS',
      });
    }
  }

  // Required evidence
  const missing: string[] = [];
  let allPass = true;
  if (approval.selectedStrategy === 'A') {
    if (receipts.length === 0) {
      missing.push('RECEIPT');
      reasons.push({ code: 'MISSING_RECEIPT', text: 'MISSING_RECEIPT: no simulated receipt recorded', kind: 'MISSING' });
    }
  } else {
    for (const a of ownActions.filter((x) => x.actionType === 'PREP_BATCH_TASK')) {
      const targetId = a.targetId ?? a.id;
      const p = preps.find((e) => e.actionId === a.id);
      if (!p) {
        missing.push(`PREP:${targetId}`);
        reasons.push({ code: `MISSING_PREP:${targetId}`, text: `MISSING_PREP: ${targetId}`, kind: 'MISSING' });
      } else if (p.payload.producedPortions < p.payload.plannedPortions) {
        allPass = false;
        reasons.push({
          code: `SHORTFALL_PREP:${targetId}`,
          text: `SHORTFALL_PREP: ${targetId} produced ${p.payload.producedPortions} of ${p.payload.plannedPortions}`,
          kind: 'SHORTFALL',
        });
      } else {
        reasons.push({
          code: `PASS_PREP:${targetId}`,
          text: `PASS_PREP: ${targetId} produced ${p.payload.producedPortions} of ${p.payload.plannedPortions}`,
          kind: 'PASS',
        });
      }
    }
    for (const a of ownActions.filter((x) => x.actionType === 'MENU_LIMIT_TASK')) {
      const targetId = a.targetId ?? a.id;
      const m = menus.find((e) => e.actionId === a.id);
      if (!m) {
        missing.push(`MENU_UPDATE:${targetId}`);
        reasons.push({ code: `MISSING_MENU_UPDATE:${targetId}`, text: `MISSING_MENU_UPDATE: ${targetId}`, kind: 'MISSING' });
      } else if (!m.payload.applied) {
        allPass = false;
        reasons.push({
          code: `MENU_NOT_APPLIED:${targetId}`,
          text: `MENU_NOT_APPLIED: ${targetId} not applied`,
          kind: 'SHORTFALL',
        });
      } else {
        reasons.push({
          code: `PASS_MENU_UPDATE:${targetId}`,
          text: `PASS_MENU_UPDATE: ${targetId} applied`,
          kind: 'PASS',
        });
      }
    }
  }
  if (fulfil.length === 0) {
    missing.push('ORDER_FULFILMENT');
    reasons.push({
      code: 'MISSING_ORDER_FULFILMENT',
      text: 'MISSING_ORDER_FULFILMENT: confirmed order fulfilment not recorded',
      kind: 'MISSING',
    });
  }

  let status: OutcomeStatus;
  if (latest.length === 0) {
    status = 'UNVERIFIED';
    reasons.unshift({
      code: 'NO_EVIDENCE',
      text: 'Outcome stayed UNVERIFIED because no evidence was recorded',
      kind: 'MISSING',
    });
  } else if (failures.length > 0) {
    status = 'FAILED';
  } else if (missing.length === 0 && allPass) {
    status = 'SUCCESS';
  } else {
    status = 'PARTIAL';
  }

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
    reasons,
    simulated: true,
    verifiedAtIso,
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
