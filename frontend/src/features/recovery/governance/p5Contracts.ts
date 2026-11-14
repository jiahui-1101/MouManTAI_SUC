/**
 * P5 local contract types.
 *
 * The shared contract (docs/00_SHARED §TypeScript sketches) is not yet implemented in
 * `src/types/` or `src/shared/contracts/`. Until it is, the shared shapes P5 depends on are
 * mirrored here (marked SHARED-MIRROR) and must be replaced by imports once the Integrator
 * publishes them. P5-specific extensions are marked `TODO(G0)`.
 */

// ---------------------------------------------------------------------------
// SHARED-MIRROR — replace with imports from the shared contract when it lands.
// TODO(G0): propose to shared contract (shared types not yet present in repo)
// ---------------------------------------------------------------------------
export type Feasibility = 'FEASIBLE' | 'CONDITIONAL' | 'INFEASIBLE' | 'UNKNOWN';
export type ScenarioStrategy = 'A' | 'B';
export type OutcomeStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'UNVERIFIED';

export interface RecoveryScenario {
  id: string;
  incidentId: string;
  strategy: ScenarioStrategy;
  snapshotFingerprint: string;
  version: number;
  feasibility: Feasibility;
  newPurchaseKgMilli: number;
  additionalCostSen: number;
  forecastChickenPortionsServed: number;
  forecastChickenPortionsUnmet: number;
  confirmedChickenPortionsProtected: number;
  assumptions: string[];
  evidenceRefs: string[];
  actionIds: string[];
  simulatedCalculation: true;
}

// ---------------------------------------------------------------------------
// P5 extensions
// ---------------------------------------------------------------------------

export type DemoRole = 'Owner' | 'OperationsManager' | 'ProcurementOfficer' | 'KitchenLead' | 'ViewerAuditor';

/** TODO(G0): propose to shared contract — RECEIPT_CHECK is not in the shared ActionType. */
export type ActionType = 'PO_DRAFT' | 'RECEIPT_CHECK' | 'MENU_LIMIT_TASK' | 'PREP_BATCH_TASK';

export type EvidenceKind = 'RECEIPT' | 'PREP' | 'MENU_UPDATE' | 'ORDER_FULFILMENT';

/** TODO(G0): propose to shared contract — ExecutionAction.externalSyncStatus. Never a "synced" value. */
export type ExternalSyncStatus = 'AWAITING_MANUAL_UPDATE' | 'MANUALLY_CONFIRMED_DEMO' | 'SIMULATED_LOCAL_ONLY';

/** TODO(G0): propose to shared contract — distinguishes unknown from a measured zero. */
export type Measured = { status: 'UNKNOWN' } | { status: 'MEASURED'; valueMilli: number };

/** TODO(G0): propose to shared contract — RecoveryScenario.proposedActions item. */
export interface ProposedAction {
  actionType: ActionType;
  /** menuId for MENU_LIMIT_TASK, batchId for PREP_BATCH_TASK. Always sourced from the scenario. */
  targetId?: string;
  /** Planned portions for PREP_BATCH_TASK, as published by P4. TODO(G0) */
  plannedPortions?: number;
}

/** TODO(G0): propose to shared contract — RecoveryScenario + proposedActions. */
export interface RecoveryScenarioWithActions extends RecoveryScenario {
  proposedActions: ProposedAction[];
}

export type P5ErrorCode =
  | 'SCENARIO_NOT_READY'
  | 'FINGERPRINT_MISMATCH'
  | 'STALE_SCENARIO'
  | 'DEMO_FORBIDDEN'
  | 'DUPLICATE_REQUEST'
  | 'APPROVAL_EXPIRED'
  | 'NO_SELECTION'
  | 'MISSING_REASON'
  | 'INVALID_TRANSITION'
  | 'PLAN_B_PURCHASE_FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_EVIDENCE';

export type Result<T> = { ok: true; value: T } | { ok: false; error: P5ErrorCode; detail: string };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: P5ErrorCode, detail: string): Result<T> => ({ ok: false, error, detail });

export interface SnapshotRef {
  id: string;
  revision: number;
  fingerprint: string;
  demoBusinessDate: string;
}

/**
 * TODO(G0): propose to shared contract — the subset of P2's ImpactSummary that P5 displays.
 * P5 never computes these; it only renders what P2 publishes.
 */
export interface ImpactSummaryLike {
  incidentId: string;
  poId: string;
  poExpectedKgMilli: number;
  poClaimedKgMilli: number;
  poShortfallKgMilli: number;
  forecastGapKgMilli: number;
}

export interface ScenarioSelection {
  incidentId: string;
  scenarioId: string;
  strategy: ScenarioStrategy;
  version: number;
  fingerprint: string;
}

export interface ApprovalRequest {
  incidentId: string;
  scenarioId: string;
  strategy: ScenarioStrategy;
  version: number;
  fingerprint: string;
  requestedByRole: DemoRole;
  requestedById: string;
  requestedAtIso: string;
}

/** Values copied verbatim from the approved scenario. P5 never recomputes them. */
export interface ScenarioPrediction {
  feasibility: Feasibility;
  newPurchaseKgMilli: number;
  additionalCostSen: number;
  forecastChickenPortionsServed: number;
  forecastChickenPortionsUnmet: number;
  confirmedChickenPortionsProtected: number;
}

/**
 * TODO(G0): propose to shared contract — shared ApprovalRecord lacks incidentId, selectedStrategy,
 * actorId, approvedActionTypes, createdAtIso, expiresAtIso, simulationOnly, idempotencyKey.
 * `predicted` is a P5-local addition so outcomes compare against the approved version.
 */
export interface ApprovalRecord {
  id: string;
  incidentId: string;
  scenarioId: string;
  scenarioVersion: number;
  snapshotFingerprint: string;
  selectedStrategy: ScenarioStrategy;
  actorId: string;
  actorRole: DemoRole;
  reason: string;
  approvedActionTypes: ActionType[];
  createdAtIso: string;
  expiresAtIso: string | null;
  consumed: boolean;
  simulationOnly: true;
  state: 'APPROVED' | 'REJECTED' | 'EXPIRED';
  idempotencyKey: string;
  predicted: ScenarioPrediction;
}

export type ExecutionState = 'DRAFT' | 'APPROVED' | 'SIMULATED_EXECUTION' | 'AWAITING_EVIDENCE' | 'VERIFIED';

/** Shared ExecutionAction + TODO(G0) fields (approvalId, incidentId, targetId, plannedPortions, externalSyncStatus, idempotencyKey). */
export interface ExecutionAction {
  id: string;
  idempotencyKey: string;
  approvalId: string;
  incidentId: string;
  scenarioId: string;
  actionType: ActionType;
  targetId?: string;
  plannedPortions?: number;
  state: ExecutionState;
  simulated: true;
  externalSyncStatus: ExternalSyncStatus;
}

export interface ExecutionAuditEntry {
  actionId: string;
  from: ExecutionState;
  to: ExecutionState;
  actorRole: DemoRole;
  actorId: string;
  reason: string;
  atIso: string;
}

export interface ReceiptPayload {
  receivedKgMilli: number;
  accepted: boolean;
  arrivalLocal: string;
  landedCostSen: number;
}
export interface PrepPayload {
  batchId: string;
  producedPortions: number;
  plannedPortions: number;
  waste: Measured;
  completedLocal: string;
}
export interface MenuUpdatePayload {
  menuId: string;
  applied: boolean;
}
export interface OrderFulfilmentPayload {
  confirmedFulfilled: number;
  confirmedRequired: number;
}
export interface EvidencePayloadByKind {
  RECEIPT: ReceiptPayload;
  PREP: PrepPayload;
  MENU_UPDATE: MenuUpdatePayload;
  ORDER_FULFILMENT: OrderFulfilmentPayload;
}

/** Shared VerificationEvidence + TODO(G0) fields (incidentId, revision, recordedBy*). */
export type VerificationEvidence = {
  [K in EvidenceKind]: {
    id: string;
    actionId: string;
    incidentId: string;
    kind: K;
    revision: number;
    source: 'SIMULATED_EVIDENCE';
    observedAtIso: string;
    recordedByRole: DemoRole;
    recordedById: string;
    payload: EvidencePayloadByKind[K];
  };
}[EvidenceKind];

export interface OutcomeActual {
  receivedKgMilli?: number;
  receiptAccepted?: boolean;
  arrivalLocal?: string;
  landedCostSen?: number;
  confirmedFulfilled?: number;
  confirmedRequired?: number;
  producedPortions?: number;
  plannedPortions?: number;
  waste?: { batchId: string; waste: Measured }[];
  menuUpdatesApplied?: number;
}

export type OutcomeReasonKind = 'HARD_FAILURE' | 'MISSING' | 'SHORTFALL' | 'PASS';

export interface OutcomeReason {
  code: string;
  text: string;
  kind: OutcomeReasonKind;
}

export interface RecoveryOutcome {
  incidentId: string;
  scenarioId: string;
  strategy: ScenarioStrategy;
  status: OutcomeStatus;
  predicted: ScenarioPrediction;
  actual: OutcomeActual | null;
  evidenceIds: string[];
  missingEvidence: string[];
  failures: string[];
  reasons: OutcomeReason[];
  simulated: true;
  verifiedAtIso?: string;
}

/** TODO(G0): propose to shared contract — ESCALATED state for Reject Both. */
export type EscalationState = 'NONE' | 'ESCALATED';

export interface EscalationRecord {
  incidentId: string;
  reason: string;
  scenarioRefs: { scenarioId: string; strategy: ScenarioStrategy; version: number; fingerprint: string }[];
  snapshotFingerprint: string;
  actorRole: DemoRole;
  actorId: string;
  atIso: string;
}

export interface RecalculationRequest {
  seq: number;
  incidentId: string;
  reason: string;
  fromState: EscalationState;
  atIso: string;
}

export type EvidenceQuality = 'NONE' | 'PARTIAL' | 'COMPLETE';
export type VerificationLevel = 'SIMULATED_VERIFIED' | 'PARTIAL_EVIDENCE' | 'NO_EVIDENCE' | 'ESCALATED';

export interface Lesson {
  text: string;
  kind: 'DETERMINISTIC_FACT' | 'DEMO_INTERPRETATION';
}
export interface DecisionMemoryEntry {
  id: string;
  incidentId: string;
  incidentType: string;
  ingredientId: string;
  strategy: ScenarioStrategy | 'ESCALATED';
  scenarioId: string;
  version: number;
  fingerprint: string;
  outcomeStatus: OutcomeStatus;
  verificationLevel: VerificationLevel;
  evidenceQuality: EvidenceQuality;
  lessons: Lesson[];
  savedAtIso: string;
  predicted?: ScenarioPrediction;
  actual?: OutcomeActual | null;
  evidenceIds?: string[];
}

/** TODO(G0): propose to shared event registry. */
export type P5EventType =
  | 'SCENARIO_SELECTED'
  | 'APPROVAL_REQUESTED'
  | 'PLAN_APPROVED'
  | 'EXECUTION_TASKS_CREATED'
  | 'ACTION_SIMULATED'
  | 'EVIDENCE_RECORDED'
  | 'OUTCOME_VERIFIED'
  | 'PLAN_REJECTED'
  | 'ESCALATED'
  | 'RECALCULATION_REQUESTED'
  | 'DECISION_MEMORY_SAVED';

export interface P5Event {
  type: P5EventType;
  payload: unknown;
}

/** Hard deadline for Plan A on the MYT demo clock. */
export const PLAN_A_DEADLINE_LOCAL = '10:45';
