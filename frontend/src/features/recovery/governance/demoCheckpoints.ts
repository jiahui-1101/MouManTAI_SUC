/**
 * Demo checkpoints: fast, refresh-free recovery to a known point in the P5 story.
 *
 * Every checkpoint resets P5 and then replays REAL slice actions as the correct demo roles
 * (no direct state writes), so all governance checks still run. Values come from the published
 * scenario / approval record, never from literals here.
 * TODO(G0): true refresh persistence belongs to the Integrator's root store.
 */
import type { StoreApi } from 'zustand';
import { isApprovalExpired } from '../../approvals/approvalLogic';
import { advanceMyTasks } from '../../approvals/executionLogic';
import {
  fail,
  isScenarioInfeasible,
  ok,
  type ApprovalRecord,
  type DemoRole,
  type ExecutionAction,
  type Result,
} from './p5Contracts';
import type { P5Deps } from './p5Deps';
import type { P5Data, P5State } from './p5Slice';
import { isScenarioStale } from './staleness';

export type CheckpointId =
  | 'PLANS_READY'
  | 'B_CHOSEN'
  | 'B_APPROVED'
  | 'ALL_AWAITING_EVIDENCE'
  | 'EVIDENCE_COMPLETE'
  | 'A_LATE_FAILED';

export const CHECKPOINTS: readonly { id: CheckpointId; label: string }[] = [
  { id: 'PLANS_READY', label: 'Plans ready' },
  { id: 'B_CHOSEN', label: 'Plan B chosen' },
  { id: 'B_APPROVED', label: 'Plan B approved' },
  { id: 'ALL_AWAITING_EVIDENCE', label: 'All tasks awaiting evidence' },
  { id: 'EVIDENCE_COMPLETE', label: 'Evidence complete (not yet verified)' },
  { id: 'A_LATE_FAILED', label: 'Plan A late delivery (FAILED)' },
];

export interface CheckpointRuntime {
  store: StoreApi<P5State>;
  adapter: { deps: P5Deps; setRole(role: DemoRole): void };
}

export interface CheckpointOutcome {
  id: CheckpointId;
  path: 'continued' | 'fresh';
  statusLine: string;
}

const TARGET_STRATEGY: Partial<Record<CheckpointId, 'A' | 'B'>> = {
  ALL_AWAITING_EVIDENCE: 'B',
  EVIDENCE_COMPLETE: 'B',
  A_LATE_FAILED: 'A',
};

function getValidApproval(
  p5Data: P5Data,
  deps: P5Deps,
  targetStrategy: 'A' | 'B',
): ApprovalRecord | null {
  const appr = [...p5Data.approvals].reverse().find((a) => a.state === 'APPROVED');
  if (!appr || appr.selectedStrategy !== targetStrategy) return null;

  const scenario = deps.getScenario(targetStrategy);
  if (
    !scenario ||
    scenario.id !== appr.scenarioId ||
    scenario.version !== appr.scenarioVersion ||
    scenario.snapshotFingerprint !== appr.snapshotFingerprint
  ) {
    return null;
  }

  const snapshot = deps.getSnapshot();
  if (isScenarioStale(scenario, snapshot) || appr.snapshotFingerprint !== snapshot.fingerprint) {
    return null;
  }

  if (isApprovalExpired(appr, deps.getDemoClockLocal())) {
    return null;
  }

  if (isScenarioInfeasible(scenario.feasibility)) {
    return null;
  }

  return appr;
}

/** Which non-Owner role normally does each task (the Owner could do all of them). */
const DOER: Record<ExecutionAction['actionType'], DemoRole> = {
  PO_DRAFT: 'ProcurementOfficer',
  RECEIPT_CHECK: 'ProcurementOfficer',
  MENU_LIMIT_TASK: 'OperationsManager',
  PREP_BATCH_TASK: 'KitchenLead',
};

const step = <T>(label: string, r: Result<T>): Result<T> =>
  r.ok ? r : fail(r.error, `${label}: ${r.detail}`);

/** Adds minutes to 'HH:mm' (used to place a late arrival just after the plan's own deadline). */
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function runCheckpoint(id: CheckpointId, rt: CheckpointRuntime): Result<CheckpointOutcome> {
  const { store, adapter } = rt;
  const deps = adapter.deps;
  const p5 = () => store.getState().p5;
  const as = (role: DemoRole) => adapter.setRole(role);

  const choose = (strategy: 'A' | 'B') => {
    as('Owner');
    const scenario = deps.getScenario(strategy);
    if (!scenario) return fail('SCENARIO_NOT_READY', `Plan ${strategy} has not been published by its owner yet.`);
    return step(`Choose Plan ${strategy}`, p5().chooseRecoveryScenario(strategy));
  };

  const approve = (strategy: 'A' | 'B') => {
    const c = choose(strategy);
    if (!c.ok) return c;
    as('Owner');
    return step(
      `Approve Plan ${strategy}`,
      p5().approveDemoScenario('Demo checkpoint: owner sign-off', c.value.version, c.value.fingerprint),
    );
  };

  /** Each task type is advanced by its usual role, one step per call, twice (→ awaiting evidence). */
  const runAllTasks = (): Result<true> => {
    // Narrowest roles first, so e.g. the Kitchen Lead (not the Operations Manager) runs prep.
    const ORDER: DemoRole[] = ['KitchenLead', 'ProcurementOfficer', 'OperationsManager'];
    const needed = new Set(p5().actions.map((a) => DOER[a.actionType]));
    const roles = ORDER.filter((r) => needed.has(r));
    for (const role of roles) {
      as(role);
      for (let i = 0; i < 2; i++) {
        const r = advanceMyTasks(p5(), deps, `Demo checkpoint: ${role} completed the task`);
        if (!r.ok) return step(`Advance tasks as ${role}`, r);
      }
    }
    const pending = p5().actions.filter((a) => a.state !== 'AWAITING_EVIDENCE');
    return pending.length === 0 ? ok(true) : fail('INVALID_TRANSITION', `${pending.length} task(s) could not be advanced.`);
  };

  const approval = () => [...p5().approvals].reverse().find((a) => a.state === 'APPROVED');

  const recordPlanBEvidence = (): Result<true> => {
    const appr = approval();
    if (!appr) return fail('NOT_FOUND', 'No approved plan.');
    const tasks = p5().actions.filter((a) => a.approvalId === appr.id);
    for (const t of tasks.filter((x) => x.actionType === 'MENU_LIMIT_TASK')) {
      const already = p5().evidence.some((e) => e.actionId === t.id && e.kind === 'MENU_UPDATE');
      if (already) continue;
      as('OperationsManager');
      const r = p5().recordSimulatedEvidence(t.id, 'MENU_UPDATE', { menuId: t.targetId ?? '', applied: true });
      if (!r.ok) return step('Menu limit confirmation', r);
    }
    for (const t of tasks.filter((x) => x.actionType === 'PREP_BATCH_TASK')) {
      const already = p5().evidence.some((e) => e.actionId === t.id && e.kind === 'PREP');
      if (already) continue;
      as('KitchenLead');
      const planned = t.plannedPortions;
      if (planned === undefined) return fail('INVALID_EVIDENCE', `No planned portions published for ${t.targetId ?? t.id}.`);
      const r = p5().recordSimulatedEvidence(t.id, 'PREP', {
        batchId: t.targetId ?? '',
        producedPortions: planned,
        plannedPortions: planned,
        waste: { status: 'UNKNOWN' },
        completedLocal: deps.getDemoClockLocal(),
      });
      if (!r.ok) return step('Prep batch result', r);
    }
    const alreadyFulfilment = p5().evidence.some((e) => e.kind === 'ORDER_FULFILMENT');
    if (!alreadyFulfilment) {
      const anchor = tasks[0];
      if (!anchor) return fail('NOT_FOUND', 'No tasks.');
      as('OperationsManager');
      const required = appr.predicted.confirmedChickenPortionsProtected;
      const f = p5().recordSimulatedEvidence(anchor.id, 'ORDER_FULFILMENT', { confirmedFulfilled: required, confirmedRequired: required });
      if (!f.ok) return step('Confirmed orders fulfilled', f);
    }
    return ok(true);
  };

  const recordPlanALateEvidence = (): Result<true> => {
    const appr = approval();
    if (!appr) return fail('NOT_FOUND', 'No approved plan.');
    const tasks = p5().actions.filter((a) => a.approvalId === appr.id);
    const receiptTask = tasks.find((t) => t.actionType === 'RECEIPT_CHECK') ?? tasks.find((t) => t.actionType === 'PO_DRAFT');
    if (!receiptTask || !appr.expiresAtIso) return fail('NOT_FOUND', 'Plan A has no delivery check or deadline.');
    const alreadyReceipt = p5().evidence.some((e) => e.actionId === receiptTask.id && e.kind === 'RECEIPT');
    if (!alreadyReceipt) {
      as('ProcurementOfficer');
      const r = p5().recordSimulatedEvidence(receiptTask.id, 'RECEIPT', {
        receivedKgMilli: appr.predicted.newPurchaseKgMilli,
        accepted: true,
        arrivalLocal: addMinutes(appr.expiresAtIso.slice(11, 16), 15),
        landedCostSen: appr.predicted.additionalCostSen,
      });
      if (!r.ok) return step('Delivery receipt', r);
    }
    const alreadyFulfilment = p5().evidence.some((e) => e.kind === 'ORDER_FULFILMENT');
    if (!alreadyFulfilment) {
      as('Owner');
      const required = appr.predicted.confirmedChickenPortionsProtected;
      const f = p5().recordSimulatedEvidence(receiptTask.id, 'ORDER_FULFILMENT', { confirmedFulfilled: required, confirmedRequired: required });
      if (!f.ok) return step('Confirmed orders fulfilled', f);
    }
    return ok(true);
  };

  const targetStrategy = TARGET_STRATEGY[id];
  const existingValidApproval = targetStrategy ? getValidApproval(p5(), deps, targetStrategy) : null;
  const isIncremental = Boolean(existingValidApproval);
  const path: 'continued' | 'fresh' = isIncremental ? 'continued' : 'fresh';

  const run = (): Result<unknown> => {
    as('Owner');
    if (!isIncremental) {
      p5().resetP5();
    }
    switch (id) {
      case 'PLANS_READY':
        return deps.getScenario('A') || deps.getScenario('B')
          ? ok(true)
          : fail('SCENARIO_NOT_READY', 'No plan has been published yet — run the Plan A / Plan B steps first.');
      case 'B_CHOSEN':
        return choose('B');
      case 'B_APPROVED':
        return approve('B');
      case 'ALL_AWAITING_EVIDENCE': {
        if (!isIncremental) {
          const a = approve('B');
          if (!a.ok) return a;
        }
        return runAllTasks();
      }
      case 'EVIDENCE_COMPLETE': {
        if (!isIncremental) {
          const a = approve('B');
          if (!a.ok) return a;
          const t = runAllTasks();
          if (!t.ok) return t;
        } else {
          const t = runAllTasks();
          if (!t.ok) return t;
        }
        return recordPlanBEvidence();
      }
      case 'A_LATE_FAILED': {
        if (!isIncremental) {
          const a = approve('A');
          if (!a.ok) return a;
          const t = runAllTasks();
          if (!t.ok) return t;
          const e = recordPlanALateEvidence();
          if (!e.ok) return e;
        } else {
          const t = runAllTasks();
          if (!t.ok) return t;
          const e = recordPlanALateEvidence();
          if (!e.ok) return e;
        }
        as('Owner');
        return step('Verify outcome', p5().verifyDemoOutcome(approval()!.incidentId));
      }
    }
  };

  const res = run();
  as('Owner');
  if (!res.ok) return res;
  const cp = CHECKPOINTS.find((c) => c.id === id);
  const statusLine = `Demo state: ${cp?.label ?? id} — ${path === 'continued' ? 'Continued from your approval' : 'Started fresh'}`;
  return ok({ id, path, statusLine });
}
