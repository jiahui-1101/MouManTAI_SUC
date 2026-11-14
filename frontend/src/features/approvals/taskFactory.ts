import {
  fail,
  ok,
  type ApprovalRecord,
  type ExecutionAction,
  type RecoveryScenarioWithActions,
  type Result,
} from '../recovery/governance/p5Contracts';
import { hasPlanBPurchase } from './approvalLogic';
import { actionIdFromKey, taskKey } from './idempotency';

/**
 * Builds the execution actions for an approval. Pure and idempotent: keys already in
 * `existingKeys` are skipped. Returns only the NEW actions.
 */
export function createExecutionTasks(
  approval: ApprovalRecord,
  scenario: RecoveryScenarioWithActions,
  existingKeys: ReadonlySet<string>,
): Result<ExecutionAction[]> {
  if (approval.state !== 'APPROVED') return fail('INVALID_TRANSITION', `Approval is ${approval.state}.`);
  if (scenario.id !== approval.scenarioId || scenario.version !== approval.scenarioVersion) {
    return fail('STALE_SCENARIO', 'Scenario no longer matches the approved version.');
  }
  if (hasPlanBPurchase(scenario)) return fail('PLAN_B_PURCHASE_FORBIDDEN', 'Plan B must not contain a purchase.');

  const created: ExecutionAction[] = [];
  const seen = new Set(existingKeys);
  for (const p of scenario.proposedActions) {
    const key = taskKey(approval.id, p.actionType, p.targetId);
    if (seen.has(key)) continue;
    seen.add(key);
    const action: ExecutionAction = {
      id: actionIdFromKey(key),
      idempotencyKey: key,
      approvalId: approval.id,
      incidentId: approval.incidentId,
      scenarioId: approval.scenarioId,
      actionType: p.actionType,
      state: 'APPROVED',
      simulated: true,
      externalSyncStatus: p.actionType === 'MENU_LIMIT_TASK' ? 'AWAITING_MANUAL_UPDATE' : 'SIMULATED_LOCAL_ONLY',
    };
    if (p.targetId !== undefined) action.targetId = p.targetId;
    if (p.plannedPortions !== undefined) action.plannedPortions = p.plannedPortions;
    created.push(action);
  }
  return ok(created);
}
