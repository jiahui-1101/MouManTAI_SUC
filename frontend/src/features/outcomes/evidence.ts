import { evidenceId } from '../approvals/idempotency';
import {
  fail,
  ok,
  type ActionType,
  type DemoRole,
  type EvidenceKind,
  type EvidencePayloadByKind,
  type ExecutionAction,
  type Measured,
  type Result,
  type VerificationEvidence,
} from '../recovery/governance/p5Contracts';
import { HH_MM } from '../recovery/governance/staleness';

const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isHHmm = (v: unknown): v is string => typeof v === 'string' && HH_MM.test(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isMeasured(v: unknown): v is Measured {
  if (!isObj(v)) return false;
  if (v.status === 'UNKNOWN') return true;
  return v.status === 'MEASURED' && isNonNegInt(v.valueMilli);
}

/** Which action types each evidence kind may attach to. ORDER_FULFILMENT is incident-level. */
const KIND_ACTIONS: Record<EvidenceKind, readonly ActionType[] | 'ANY'> = {
  RECEIPT: ['RECEIPT_CHECK', 'PO_DRAFT'],
  PREP: ['PREP_BATCH_TASK'],
  MENU_UPDATE: ['MENU_LIMIT_TASK'],
  ORDER_FULFILMENT: 'ANY',
};

export function validateEvidencePayload<K extends EvidenceKind>(
  kind: K,
  payload: unknown,
  action: ExecutionAction,
): Result<EvidencePayloadByKind[K]> {
  const allowed = KIND_ACTIONS[kind];
  if (allowed !== 'ANY' && !allowed.includes(action.actionType)) {
    return fail('INVALID_EVIDENCE', `${kind} evidence cannot attach to ${action.actionType}.`);
  }
  if (!isObj(payload)) return fail('INVALID_EVIDENCE', 'Payload must be an object.');
  const p = payload;
  switch (kind) {
    case 'RECEIPT':
      if (!isNonNegInt(p.receivedKgMilli) || typeof p.accepted !== 'boolean' || !isHHmm(p.arrivalLocal) || !isNonNegInt(p.landedCostSen)) {
        return fail('INVALID_EVIDENCE', 'RECEIPT needs integer receivedKgMilli, boolean accepted, HH:mm arrivalLocal, integer landedCostSen.');
      }
      break;
    case 'PREP':
      if (
        typeof p.batchId !== 'string' || !p.batchId ||
        !isNonNegInt(p.producedPortions) || !isNonNegInt(p.plannedPortions) ||
        !isMeasured(p.waste) || !isHHmm(p.completedLocal)
      ) {
        return fail('INVALID_EVIDENCE', 'PREP needs batchId, integer portions, Measured waste, HH:mm completedLocal.');
      }
      if (action.targetId !== undefined && p.batchId !== action.targetId) {
        return fail('INVALID_EVIDENCE', `PREP batch ${String(p.batchId)} does not match task ${action.targetId}.`);
      }
      break;
    case 'MENU_UPDATE':
      if (typeof p.menuId !== 'string' || !p.menuId || typeof p.applied !== 'boolean') {
        return fail('INVALID_EVIDENCE', 'MENU_UPDATE needs menuId and boolean applied.');
      }
      if (action.targetId !== undefined && p.menuId !== action.targetId) {
        return fail('INVALID_EVIDENCE', `Menu ${String(p.menuId)} does not match task ${action.targetId}.`);
      }
      break;
    case 'ORDER_FULFILMENT':
      if (!isNonNegInt(p.confirmedFulfilled) || !isNonNegInt(p.confirmedRequired)) {
        return fail('INVALID_EVIDENCE', 'ORDER_FULFILMENT needs integer confirmedFulfilled and confirmedRequired.');
      }
      break;
  }
  // Copy so later caller mutation cannot alter the append-only log.
  return ok(structuredClone(payload) as unknown as EvidencePayloadByKind[K]);
}

export function nextRevision(log: readonly VerificationEvidence[], actionId: string, kind: EvidenceKind): number {
  let max = 0;
  for (const e of log) if (e.actionId === actionId && e.kind === kind && e.revision > max) max = e.revision;
  return max + 1;
}

export interface BuildEvidenceInput<K extends EvidenceKind> {
  log: readonly VerificationEvidence[];
  action: ExecutionAction;
  kind: K;
  payload: EvidencePayloadByKind[K];
  role: DemoRole;
  actorId: string;
  nowIso: string;
}

export function buildEvidenceRecord<K extends EvidenceKind>(input: BuildEvidenceInput<K>): VerificationEvidence {
  const revision = nextRevision(input.log, input.action.id, input.kind);
  return {
    id: evidenceId(input.action.id, input.kind, revision),
    actionId: input.action.id,
    incidentId: input.action.incidentId,
    kind: input.kind,
    revision,
    source: 'SIMULATED_EVIDENCE',
    observedAtIso: input.nowIso,
    recordedByRole: input.role,
    recordedById: input.actorId,
    payload: input.payload,
  } as VerificationEvidence;
}

/** Latest revision per (actionId, kind), in first-recorded order. */
export function latestEvidence(log: readonly VerificationEvidence[]): VerificationEvidence[] {
  const byKey = new Map<string, VerificationEvidence>();
  for (const e of log) {
    const k = `${e.actionId}|${e.kind}`;
    const cur = byKey.get(k);
    if (!cur || e.revision > cur.revision) byKey.set(k, e);
  }
  return [...byKey.values()];
}
