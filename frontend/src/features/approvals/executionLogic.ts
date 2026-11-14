import { fail, ok, type ExecutionAuditEntry, type ExecutionAction, type ExecutionState, type Result } from '../recovery/governance/p5Contracts';

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
