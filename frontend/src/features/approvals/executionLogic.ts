import { isApprovalExpired } from './approvalLogic';
import { hasCapability } from './permissions';
import {
  fail,
  ok,
  type ApprovalRecord,
  type DemoRole,
  type ExecutionAction,
  type ExecutionAuditEntry,
  type ExecutionState,
  type P5ErrorCode,
  type Result,
} from '../recovery/governance/p5Contracts';
import type { P5Deps } from '../recovery/governance/p5Deps';
import { isScenarioStale } from '../recovery/governance/staleness';

/** APPROVED → SIMULATED_EXECUTION → AWAITING_EVIDENCE. Simulation never reaches VERIFIED. */
const NEXT: Partial<Record<ExecutionState, ExecutionState>> = {
  APPROVED: 'SIMULATED_EXECUTION',
  SIMULATED_EXECUTION: 'AWAITING_EVIDENCE',
};

export function nextExecutionState(state: ExecutionState): ExecutionState | null {
  return NEXT[state] ?? null;
}

/** Advances exactly one step. Menu tasks keep their externalSyncStatus untouched. */
export function advanceAction(
  action: ExecutionAction,
  audit: Omit<ExecutionAuditEntry, 'actionId' | 'from' | 'to'>,
): Result<{ action: ExecutionAction; entry: ExecutionAuditEntry }> {
  const to = nextExecutionState(action.state);
  if (!to) return fail('INVALID_TRANSITION', `Cannot simulate from ${action.state}.`);
  return ok({
    action: { ...action, state: to },
    entry: { actionId: action.id, from: action.state, to, ...audit },
  });
}

export interface ExecutionPreflightBlocker {
  error: P5ErrorCode;
  detail: string;
  allowedRoles?: DemoRole[];
}

const ALL_ROLES: readonly DemoRole[] = [
  'Owner',
  'OperationsManager',
  'ProcurementOfficer',
  'KitchenLead',
  'ViewerAuditor',
];

/**
 * Pure, non-mutating preflight for simulateExecutionAction.
 * Returns the first blocking P5ErrorCode or null, in exactly the same order as simulateExecutionAction:
 * (NOT_FOUND, APPROVAL_MISMATCH/NOT_FOUND, MISSING_REASON excluded, DEMO_FORBIDDEN, STALE_SCENARIO, APPROVAL_EXPIRED, INVALID_TRANSITION).
 * For DEMO_FORBIDDEN it also returns which roles CAN execute that action type.
 */
export function preflightExecution(
  state: { actions: readonly ExecutionAction[]; approvals: readonly ApprovalRecord[] },
  deps: Pick<P5Deps, 'getSnapshot' | 'getScenario' | 'getCurrentRole' | 'getDemoClockLocal'>,
  actionId: string,
): ExecutionPreflightBlocker | null {
  const action = state.actions.find((a) => a.id === actionId);
  if (!action) {
    return { error: 'NOT_FOUND', detail: `Action ${actionId} not found.` };
  }
  const approval = state.approvals.find((a) => a.id === action.approvalId);
  if (!approval) {
    return { error: 'NOT_FOUND', detail: 'Approval does not match this action.' };
  }
  const { role } = deps.getCurrentRole();
  const allowedRoles = ALL_ROLES.filter((r) => hasCapability(r, { kind: 'EXECUTE', actionType: action.actionType }));
  if (!hasCapability(role, { kind: 'EXECUTE', actionType: action.actionType })) {
    return {
      error: 'DEMO_FORBIDDEN',
      detail: `${role} cannot execute ${action.actionType} — allowed: ${allowedRoles.join(', ')}.`,
      allowedRoles,
    };
  }
  const snapshot = deps.getSnapshot();
  const scenario = deps.getScenario(approval.selectedStrategy);
  if (
    approval.snapshotFingerprint !== snapshot.fingerprint ||
    !scenario ||
    scenario.id !== approval.scenarioId ||
    isScenarioStale(scenario, snapshot)
  ) {
    return { error: 'STALE_SCENARIO', detail: 'Snapshot changed since approval; recalculate before executing.' };
  }
  if (isApprovalExpired(approval, deps.getDemoClockLocal())) {
    return { error: 'APPROVAL_EXPIRED', detail: `Approval expired at ${approval.expiresAtIso ?? ''}.` };
  }
  if (!nextExecutionState(action.state)) {
    return { error: 'INVALID_TRANSITION', detail: `Cannot simulate from ${action.state}.` };
  }
  return null;
}
