import {
  PLAN_A_DEADLINE_LOCAL,
  fail,
  isScenarioInfeasible,
  ok,
  type ActionType,
  type P5ErrorCode,
  type ApprovalRecord,
  type DemoRole,
  type RecoveryScenarioWithActions,
  type Result,
  type ScenarioPrediction,
  type ScenarioSelection,
  type SnapshotRef,
} from '../recovery/governance/p5Contracts';
import { isLocalTimeAfter, isScenarioStale } from '../recovery/governance/staleness';
import { approvalIdFromKey, approvalKey } from './idempotency';
import { canApproveAll } from './permissions';
import type { P5Deps } from '../recovery/governance/p5Deps';

/** Unique action types in first-seen order. */
export function approvedActionTypesOf(scenario: RecoveryScenarioWithActions): ActionType[] {
  const seen: ActionType[] = [];
  for (const a of scenario.proposedActions) if (!seen.includes(a.actionType)) seen.push(a.actionType);
  return seen;
}

export function predictionOf(s: RecoveryScenarioWithActions): ScenarioPrediction {
  return {
    feasibility: s.feasibility,
    newPurchaseKgMilli: s.newPurchaseKgMilli,
    additionalCostSen: s.additionalCostSen,
    forecastChickenPortionsServed: s.forecastChickenPortionsServed,
    forecastChickenPortionsUnmet: s.forecastChickenPortionsUnmet,
    confirmedChickenPortionsProtected: s.confirmedChickenPortionsProtected,
  };
}

export function hasPlanBPurchase(s: RecoveryScenarioWithActions): boolean {
  return s.strategy === 'B' && s.proposedActions.some((a) => a.actionType === 'PO_DRAFT');
}

export function expiresAtFor(strategy: 'A' | 'B', demoBusinessDate: string): string | null {
  return strategy === 'A' ? `${demoBusinessDate}T${PLAN_A_DEADLINE_LOCAL}:00+08:00` : null;
}

/** Expired when the demo clock ('HH:mm', MYT) is past the expiry's local time. Never real time. */
export function isApprovalExpired(approval: Pick<ApprovalRecord, 'expiresAtIso'>, demoClockLocal: string): boolean {
  if (!approval.expiresAtIso) return false;
  const expiryLocal = approval.expiresAtIso.slice(11, 16);
  return isLocalTimeAfter(demoClockLocal, expiryLocal);
}

export interface ApproveInput {
  selection: ScenarioSelection | null;
  scenario: RecoveryScenarioWithActions | null;
  snapshot: SnapshotRef;
  reason: string;
  expectedVersion: number;
  expectedFingerprint: string;
  role: DemoRole;
  actorId: string;
  usedApprovalKeys: readonly string[];
  demoClockLocal: string;
  nowIso: string;
}

/** Validates in the mandated order and builds the record. Pure. */
export function buildApproval(input: ApproveInput): Result<ApprovalRecord> {
  const { selection, scenario, snapshot } = input;
  if (!selection) return fail('NO_SELECTION', 'No scenario selected.');
  const reason = input.reason.trim();
  if (!reason) return fail('MISSING_REASON', 'An approval reason is required.');
  if (
    !scenario ||
    scenario.id !== selection.scenarioId ||
    scenario.version !== input.expectedVersion ||
    scenario.snapshotFingerprint !== input.expectedFingerprint ||
    selection.version !== input.expectedVersion ||
    selection.fingerprint !== input.expectedFingerprint ||
    isScenarioStale(scenario, snapshot)
  ) {
    return fail('STALE_SCENARIO', 'Scenario version or fingerprint no longer matches the current snapshot.');
  }
  if (isScenarioInfeasible(scenario.feasibility)) {
    return fail('SCENARIO_INFEASIBLE', `Scenario is not feasible (${scenario.feasibility}).`);
  }
  if (hasPlanBPurchase(scenario)) {
    return fail('PLAN_B_PURCHASE_FORBIDDEN', 'Plan B must not contain a purchase (PO_DRAFT).');
  }
  const approvedActionTypes = approvedActionTypesOf(scenario);
  if (!canApproveAll(input.role, approvedActionTypes)) {
    const blocked = approvedActionTypes.filter((t) => !canApproveAll(input.role, [t]));
    return fail('DEMO_FORBIDDEN', `${input.role} cannot approve ${blocked.join(', ')}.`);
  }
  const key = approvalKey(scenario.id, scenario.version, scenario.snapshotFingerprint);
  if (input.usedApprovalKeys.includes(key)) {
    return fail('DUPLICATE_REQUEST', `Approval already recorded for ${key}.`);
  }
  const expiresAtIso = expiresAtFor(scenario.strategy, snapshot.demoBusinessDate ?? '2026-11-14');
  if (expiresAtIso !== null && isApprovalExpired({ expiresAtIso }, input.demoClockLocal)) {
    return fail('APPROVAL_EXPIRED', `Demo clock ${input.demoClockLocal} is past the Plan A deadline ${PLAN_A_DEADLINE_LOCAL}.`);
  }
  return ok({
    id: approvalIdFromKey(key),
    incidentId: scenario.incidentId,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    snapshotFingerprint: scenario.snapshotFingerprint,
    selectedStrategy: scenario.strategy,
    actorId: input.actorId,
    actorRole: input.role,
    reason,
    approvedActionTypes,
    createdAtIso: input.nowIso,
    expiresAtIso,
    consumed: false,
    simulationOnly: true,
    state: 'APPROVED',
    idempotencyKey: key,
    predicted: predictionOf(scenario),
  });
}

/** Placeholder reason used by preflight so the reason check never masks a real blocker. */
const PREFLIGHT_REASON = 'preflight';

export interface PreflightBlocker {
  error: Exclude<P5ErrorCode, 'MISSING_REASON'>;
  detail: string;
}

/**
 * Pure, non-mutating dry run of approveDemoScenario. Returns the first blocker in the same
 * order (reason excluded — the UI validates it inline), or null when approval would succeed.
 * It delegates to buildApproval, so the two can never disagree.
 */
export function preflightApproval(
  data: { selection: ScenarioSelection | null; usedApprovalKeys: readonly string[] },
  deps: Pick<P5Deps, 'getScenario' | 'getSnapshot' | 'getCurrentRole' | 'getDemoClockLocal' | 'nowIso'>,
): PreflightBlocker | null {
  const sel = data.selection;
  const scenario = sel ? deps.getScenario(sel.strategy) : null;
  const { role, actorId } = deps.getCurrentRole();
  const res = buildApproval({
    selection: sel,
    scenario,
    snapshot: deps.getSnapshot(),
    reason: PREFLIGHT_REASON,
    expectedVersion: sel?.version ?? -1,
    expectedFingerprint: sel?.fingerprint ?? '',
    role,
    actorId,
    usedApprovalKeys: data.usedApprovalKeys,
    demoClockLocal: deps.getDemoClockLocal(),
    nowIso: '',
  });
  if (res.ok || res.error === 'MISSING_REASON') return null;
  return { error: res.error, detail: res.detail };
}
