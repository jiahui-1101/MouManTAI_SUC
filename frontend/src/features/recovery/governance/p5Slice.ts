import type { StateCreator } from 'zustand';
import { approvedActionTypesOf, buildApproval, isApprovalExpired, predictionOf } from '../../approvals/approvalLogic';
import { approvalIdFromKey, rejectionKey } from '../../approvals/idempotency';
import { canApproveAll } from '../../approvals/permissions';
import { advanceAction } from '../../approvals/executionLogic';
import { hasCapability } from '../../approvals/permissions';
import { createExecutionTasks as buildTasks } from '../../approvals/taskFactory';
import { buildApprovedMemory, buildEscalatedMemory } from '../../outcomes/decisionMemory';
import { buildEvidenceRecord, validateEvidencePayload } from '../../outcomes/evidence';
import { evaluateOutcome } from '../../outcomes/verifyOutcome';
import { buildEscalation } from './escalation';
import {
  fail,
  ok,
  type ApprovalRecord,
  type ApprovalRequest,
  type DecisionMemoryEntry,
  type EscalationRecord,
  type EscalationState,
  type EvidenceKind,
  type EvidencePayloadByKind,
  type ExecutionAction,
  type ExecutionAuditEntry,
  type RecalculationRequest,
  type RecoveryOutcome,
  type Result,
  type ScenarioSelection,
  type ScenarioStrategy,
  type VerificationEvidence,
} from './p5Contracts';
import type { P5Deps } from './p5Deps';
import { isScenarioStale } from './staleness';

export interface P5Data {
  selection: ScenarioSelection | null;
  approvalRequest: ApprovalRequest | null;
  escalationState: EscalationState;
  /** True once Revise Constraints was requested after the latest escalation (choosing re-opens). */
  recalculationRequestedSinceEscalation: boolean;
  escalations: EscalationRecord[];
  recalculationRequests: RecalculationRequest[];
  /** Ordered by creation. */
  approvals: ApprovalRecord[];
  usedApprovalKeys: string[];
  /** Ordered by creation. */
  actions: ExecutionAction[];
  auditLog: ExecutionAuditEntry[];
  /** Append-only. */
  evidence: VerificationEvidence[];
  outcomes: Record<string, RecoveryOutcome>;
  decisionMemory: DecisionMemoryEntry[];
}

export interface P5Actions {
  chooseRecoveryScenario(strategy: ScenarioStrategy): Result<ScenarioSelection>;
  rejectBothAndEscalate(reason: string): Result<EscalationRecord>;
  requestRecalculation(reason: string): Result<RecalculationRequest>;
  requestDemoApproval(): Result<ApprovalRequest>;
  /** Records a REJECTED approval for the selected scenario version and clears the selection. */
  rejectSelectedScenario(reason: string): Result<ApprovalRecord>;
  approveDemoScenario(reason: string, expectedVersion: number, expectedFingerprint: string): Result<{ approval: ApprovalRecord; actions: ExecutionAction[] }>;
  createExecutionTasks(approvalId: string): Result<ExecutionAction[]>;
  simulateExecutionAction(actionId: string, expectedApprovalId: string, reason: string): Result<ExecutionAction>;
  /** The single shared evidence write path (also used by P4 /prep-planning). */
  recordSimulatedEvidence<K extends EvidenceKind>(actionId: string, kind: K, payload: EvidencePayloadByKind[K]): Result<VerificationEvidence>;
  verifyDemoOutcome(incidentId: string): Result<RecoveryOutcome>;
  saveDemoDecisionMemory(incidentId: string): Result<DecisionMemoryEntry>;
  /** DEMO_RESET: clears P5 state only. */
  resetP5(): void;
}

export type P5Slice = P5Data & P5Actions;
export interface P5State {
  p5: P5Slice;
}

export const initialP5Data = (): P5Data => ({
  selection: null,
  approvalRequest: null,
  escalationState: 'NONE',
  recalculationRequestedSinceEscalation: false,
  escalations: [],
  recalculationRequests: [],
  approvals: [],
  usedApprovalKeys: [],
  actions: [],
  auditLog: [],
  evidence: [],
  outcomes: {},
  decisionMemory: [],
});

const STRATEGIES: readonly ScenarioStrategy[] = ['A', 'B'];

export function createP5Slice<T extends P5State = P5State>(deps: P5Deps): StateCreator<T, [], [], P5State> {
  return (set, get) => {
    const data = (): P5Data => get().p5;
    const patch = (partial: Partial<P5Data>): void =>
      set((s) => ({ ...s, p5: { ...s.p5, ...partial } }) as T);

    const findApprovalForIncident = (incidentId: string): ApprovalRecord | undefined =>
      [...data().approvals].reverse().find((a) => a.incidentId === incidentId && a.state === 'APPROVED');

    const actions: P5Actions = {
      chooseRecoveryScenario(strategy) {
        const { role } = deps.getCurrentRole();
        if (role === 'ViewerAuditor') return fail('DEMO_FORBIDDEN', 'ViewerAuditor is read-only.');
        const scenario = deps.getScenario(strategy);
        if (!scenario) return fail('SCENARIO_NOT_READY', `Plan ${strategy} has not been published.`);
        const snapshot = deps.getSnapshot();
        if (isScenarioStale(scenario, snapshot)) return fail('STALE_SCENARIO', `Plan ${strategy} is stale.`);
        const a = deps.getScenario('A');
        const b = deps.getScenario('B');
        if (a && b && a.snapshotFingerprint !== b.snapshotFingerprint) {
          return fail('FINGERPRINT_MISMATCH', 'Plan A and Plan B were computed on different snapshots.');
        }
        const selection: ScenarioSelection = {
          incidentId: scenario.incidentId,
          scenarioId: scenario.id,
          strategy,
          version: scenario.version,
          fingerprint: scenario.snapshotFingerprint,
        };
        patch({ selection, approvalRequest: null, escalationState: 'NONE' });
        deps.emit({ type: 'SCENARIO_SELECTED', payload: selection });
        return ok(selection);
      },

      rejectBothAndEscalate(reason) {
        const { role, actorId } = deps.getCurrentRole();
        if (role === 'ViewerAuditor') return fail('DEMO_FORBIDDEN', 'ViewerAuditor is read-only.');
        const r = reason.trim();
        if (!r) return fail('MISSING_REASON', 'An escalation reason is required.');
        const incidentId = deps.getActiveIncidentId();
        if (!incidentId) return fail('NOT_FOUND', 'No active incident.');
        const record = buildEscalation({
          incidentId,
          reason: r,
          scenarios: STRATEGIES.map((s) => deps.getScenario(s)),
          snapshot: deps.getSnapshot(),
          role,
          actorId,
          nowIso: deps.nowIso(),
        });
        patch({ escalationState: 'ESCALATED', recalculationRequestedSinceEscalation: false, selection: null, approvalRequest: null, escalations: [...data().escalations, record] });
        deps.emit({ type: 'ESCALATED', payload: record });
        return ok(record);
      },

      requestRecalculation(reason) {
        const { role } = deps.getCurrentRole();
        if (role === 'ViewerAuditor') return fail('DEMO_FORBIDDEN', 'ViewerAuditor is read-only.');
        const r = reason.trim();
        if (!r) return fail('MISSING_REASON', 'A recalculation reason is required.');
        const incidentId = deps.getActiveIncidentId();
        if (!incidentId) return fail('NOT_FOUND', 'No active incident.');
        const req: RecalculationRequest = {
          seq: data().recalculationRequests.length + 1,
          incidentId,
          reason: r,
          fromState: data().escalationState,
          atIso: deps.nowIso(),
        };
        patch({
          selection: null,
          approvalRequest: null,
          recalculationRequests: [...data().recalculationRequests, req],
          recalculationRequestedSinceEscalation: data().escalationState === 'ESCALATED',
        });
        deps.emit({ type: 'RECALCULATION_REQUESTED', payload: req });
        return ok(req);
      },

      requestDemoApproval() {
        const sel = data().selection;
        if (!sel) return fail('NO_SELECTION', 'No scenario selected.');
        const { role, actorId } = deps.getCurrentRole();
        if (role === 'ViewerAuditor') return fail('DEMO_FORBIDDEN', 'ViewerAuditor is read-only.');
        const scenario = deps.getScenario(sel.strategy);
        if (!scenario || scenario.id !== sel.scenarioId || scenario.version !== sel.version || isScenarioStale(scenario, deps.getSnapshot())) {
          return fail('STALE_SCENARIO', 'Selected scenario is stale.');
        }
        const req: ApprovalRequest = { ...sel, requestedByRole: role, requestedById: actorId, requestedAtIso: deps.nowIso() };
        patch({ approvalRequest: req });
        deps.emit({ type: 'APPROVAL_REQUESTED', payload: req });
        return ok(req);
      },

      rejectSelectedScenario(reason) {
        const sel = data().selection;
        if (!sel) return fail('NO_SELECTION', 'No scenario selected.');
        const r = reason.trim();
        if (!r) return fail('MISSING_REASON', 'A rejection reason is required.');
        const scenario = deps.getScenario(sel.strategy);
        if (!scenario || scenario.id !== sel.scenarioId || scenario.version !== sel.version || isScenarioStale(scenario, deps.getSnapshot())) {
          return fail('STALE_SCENARIO', 'Selected scenario is stale.');
        }
        const { role, actorId } = deps.getCurrentRole();
        const types = approvedActionTypesOf(scenario);
        if (!canApproveAll(role, types)) {
          const blocked = types.filter((t) => !canApproveAll(role, [t]));
          return fail('DEMO_FORBIDDEN', `${role} cannot decide on ${blocked.join(', ')}.`);
        }
        const key = rejectionKey(scenario.id, scenario.version, scenario.snapshotFingerprint);
        if (data().usedApprovalKeys.includes(key)) return fail('DUPLICATE_REQUEST', `Already rejected: ${key}.`);
        const record: ApprovalRecord = {
          id: approvalIdFromKey(key),
          incidentId: scenario.incidentId,
          scenarioId: scenario.id,
          scenarioVersion: scenario.version,
          snapshotFingerprint: scenario.snapshotFingerprint,
          selectedStrategy: scenario.strategy,
          actorId,
          actorRole: role,
          reason: r,
          approvedActionTypes: types,
          createdAtIso: deps.nowIso(),
          expiresAtIso: null,
          consumed: false,
          simulationOnly: true,
          state: 'REJECTED',
          idempotencyKey: key,
          predicted: predictionOf(scenario),
        };
        patch({
          approvals: [...data().approvals, record],
          usedApprovalKeys: [...data().usedApprovalKeys, key],
          selection: null,
          approvalRequest: null,
        });
        deps.emit({ type: 'PLAN_REJECTED', payload: record });
        return ok(record);
      },

      approveDemoScenario(reason, expectedVersion, expectedFingerprint) {
        const sel = data().selection;
        const { role, actorId } = deps.getCurrentRole();
        const built = buildApproval({
          selection: sel,
          scenario: sel ? deps.getScenario(sel.strategy) : null,
          snapshot: deps.getSnapshot(),
          reason,
          expectedVersion,
          expectedFingerprint,
          role,
          actorId,
          usedApprovalKeys: data().usedApprovalKeys,
          demoClockLocal: deps.getDemoClockLocal(),
          nowIso: deps.nowIso(),
        });
        if (!built.ok) return built;
        const approval = built.value;
        patch({
          approvals: [...data().approvals, approval],
          usedApprovalKeys: [...data().usedApprovalKeys, approval.idempotencyKey],
          approvalRequest: null,
        });
        deps.emit({ type: 'PLAN_APPROVED', payload: approval });
        const tasks = actions.createExecutionTasks(approval.id);
        if (!tasks.ok) return tasks;
        return ok({ approval: data().approvals.find((a) => a.id === approval.id) ?? approval, actions: tasks.value });
      },

      createExecutionTasks(approvalId) {
        const approval = data().approvals.find((a) => a.id === approvalId);
        if (!approval) return fail('NOT_FOUND', `Approval ${approvalId} not found.`);
        const scenario = deps.getScenario(approval.selectedStrategy);
        if (!scenario) return fail('SCENARIO_NOT_READY', 'Approved scenario is no longer published.');
        const existing = new Set(data().actions.map((a) => a.idempotencyKey));
        const res = buildTasks(approval, scenario, existing);
        if (!res.ok) return res;
        if (res.value.length === 0) return fail('DUPLICATE_REQUEST', `Tasks for ${approvalId} already exist.`);
        patch({
          actions: [...data().actions, ...res.value],
          approvals: data().approvals.map((a) => (a.id === approvalId ? { ...a, consumed: true } : a)),
        });
        deps.emit({ type: 'EXECUTION_TASKS_CREATED', payload: { approvalId, actionIds: res.value.map((a) => a.id) } });
        return ok(res.value);
      },

      simulateExecutionAction(actionId, expectedApprovalId, reason) {
        const action = data().actions.find((a) => a.id === actionId);
        if (!action) return fail('NOT_FOUND', `Action ${actionId} not found.`);
        const r = reason.trim();
        if (!r) return fail('MISSING_REASON', 'An execution reason is required.');
        const { role, actorId } = deps.getCurrentRole();
        if (!hasCapability(role, { kind: 'EXECUTE', actionType: action.actionType })) {
          return fail('DEMO_FORBIDDEN', `${role} cannot execute ${action.actionType}.`);
        }
        const approval = data().approvals.find((a) => a.id === action.approvalId);
        if (!approval || approval.id !== expectedApprovalId) return fail('NOT_FOUND', 'Approval does not match this action.');
        const snapshot = deps.getSnapshot();
        const scenario = deps.getScenario(approval.selectedStrategy);
        if (approval.snapshotFingerprint !== snapshot.fingerprint || !scenario || scenario.id !== approval.scenarioId || isScenarioStale(scenario, snapshot)) {
          return fail('STALE_SCENARIO', 'Snapshot changed since approval; recalculate before executing.');
        }
        if (isApprovalExpired(approval, deps.getDemoClockLocal())) {
          return fail('APPROVAL_EXPIRED', `Approval expired at ${approval.expiresAtIso ?? ''}.`);
        }
        const adv = advanceAction(action, { actorRole: role, actorId, reason: r, atIso: deps.nowIso() });
        if (!adv.ok) return adv;
        patch({
          actions: data().actions.map((a) => (a.id === actionId ? adv.value.action : a)),
          auditLog: [...data().auditLog, adv.value.entry],
        });
        deps.emit({ type: 'ACTION_SIMULATED', payload: adv.value.entry });
        return ok(adv.value.action);
      },

      recordSimulatedEvidence(actionId, kind, payload) {
        const { role, actorId } = deps.getCurrentRole();
        if (!hasCapability(role, { kind: 'RECORD_EVIDENCE', evidenceKind: kind })) {
          return fail('DEMO_FORBIDDEN', `${role} cannot record ${kind} evidence.`);
        }
        const action = data().actions.find((a) => a.id === actionId);
        if (!action) return fail('NOT_FOUND', `Action ${actionId} not found.`);
        const valid = validateEvidencePayload(kind, payload, action);
        if (!valid.ok) return valid;
        const record = buildEvidenceRecord({ log: data().evidence, action, kind, payload: valid.value, role, actorId, nowIso: deps.nowIso() });
        const update: Partial<P5Data> = { evidence: [...data().evidence, record] };
        if (record.kind === 'MENU_UPDATE' && record.payload.applied) {
          update.actions = data().actions.map((a) =>
            a.id === actionId ? { ...a, externalSyncStatus: 'MANUALLY_CONFIRMED_DEMO' as const } : a,
          );
        }
        patch(update);
        deps.emit({ type: 'EVIDENCE_RECORDED', payload: record });
        return ok(record);
      },

      verifyDemoOutcome(incidentId) {
        const approval = findApprovalForIncident(incidentId);
        if (!approval) return fail('NOT_FOUND', `No approved plan for ${incidentId}.`);
        const outcome = evaluateOutcome(approval, data().actions, data().evidence);
        patch({ outcomes: { ...data().outcomes, [incidentId]: outcome } });
        deps.emit({ type: 'OUTCOME_VERIFIED', payload: outcome });
        return ok(outcome);
      },

      saveDemoDecisionMemory(incidentId) {
        const approval = findApprovalForIncident(incidentId);
        let entry: DecisionMemoryEntry;
        if (approval) {
          entry = buildApprovedMemory(approval, data().outcomes[incidentId] ?? null, deps.nowIso());
        } else {
          const esc = [...data().escalations].reverse().find((e) => e.incidentId === incidentId);
          if (!esc) return fail('NOT_FOUND', `Nothing to save for ${incidentId}.`);
          entry = buildEscalatedMemory(esc, deps.nowIso());
        }
        if (data().decisionMemory.some((m) => m.id === entry.id)) {
          return fail('DUPLICATE_REQUEST', `Decision memory already saved for ${entry.scenarioId} v${entry.version}.`);
        }
        patch({ decisionMemory: [...data().decisionMemory, entry] });
        deps.emit({ type: 'DECISION_MEMORY_SAVED', payload: entry });
        return ok(entry);
      },

      resetP5() {
        patch(initialP5Data());
      },
    };

    return { p5: { ...initialP5Data(), ...actions } };
  };
}
