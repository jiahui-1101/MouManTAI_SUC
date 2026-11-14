import { ERROR_LABELS } from './labels';
import { isApprovalExpired, preflightApproval } from '../../approvals/approvalLogic';
import { approvalKey } from '../../approvals/idempotency';
import { latestEvidence } from '../../outcomes/evidence';
import { evaluateOutcome } from '../../outcomes/verifyOutcome';
import { isScenarioInfeasible } from './p5Contracts';
import type {
  ApprovalRecord,
  DecisionMemoryEntry,
  ExecutionAction,
  OutcomeStatus,
  RecoveryOutcome,
  RecoveryScenario,
  ScenarioSelection,
  ScenarioStrategy,
  SnapshotRef,
  VerificationEvidence,
} from './p5Contracts';
import type { P5Deps } from './p5Deps';
import type { P5Data, P5State } from './p5Slice';
import { isScenarioStale } from './staleness';

/**
 * Selectors are referentially stable: derived arrays are memoized on their inputs
 * (state slices by reference, scalar args by value). Selectors that need cross-team data
 * (scenarios, snapshot, demo clock) take it as arguments.
 */
function memoLast<A extends readonly unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | null = null;
  let lastResult: R;
  return (...args: A) => {
    if (lastArgs && lastArgs.length === args.length && lastArgs.every((v, i) => Object.is(v, args[i]))) return lastResult;
    lastArgs = args;
    lastResult = fn(...args);
    return lastResult;
  };
}

/** Per-key memo so multiple components with different args don't thrash one cache. */
function memoByKey<A extends readonly unknown[], R>(fn: (...args: A) => R): (key: string, ...args: A) => R {
  const caches = new Map<string, (...args: A) => R>();
  return (key, ...args) => {
    let m = caches.get(key);
    if (!m) {
      m = memoLast(fn);
      caches.set(key, m);
    }
    return m(...args);
  };
}

export const selectSelection = (s: P5State): ScenarioSelection | null => s.p5.selection;

export const selectIsScenarioStale = (
  scenario: Pick<RecoveryScenario, 'snapshotFingerprint'> | null,
  snapshot: Pick<SnapshotRef, 'fingerprint'>,
): boolean => (scenario ? isScenarioStale(scenario, snapshot) : false);

export type ComparisonReadiness = 'WAITING_BOTH' | 'ONLY_A' | 'ONLY_B' | 'READY' | 'FINGERPRINT_MISMATCH';

export function selectComparisonReadiness(
  a: Pick<RecoveryScenario, 'snapshotFingerprint'> | null,
  b: Pick<RecoveryScenario, 'snapshotFingerprint'> | null,
): ComparisonReadiness {
  if (!a && !b) return 'WAITING_BOTH';
  if (a && !b) return 'ONLY_A';
  if (!a && b) return 'ONLY_B';
  return a!.snapshotFingerprint === b!.snapshotFingerprint ? 'READY' : 'FINGERPRINT_MISMATCH';
}

const pendingApprovals = memoLast(
  (approvals: ApprovalRecord[], fingerprint: string, demoClockLocal: string): ApprovalRecord[] =>
    approvals.filter(
      (a) => a.state === 'APPROVED' && a.snapshotFingerprint === fingerprint && !isApprovalExpired(a, demoClockLocal),
    ),
);
/** Approvals still valid (not stale by fingerprint, not expired by the demo clock). */
export const selectPendingApprovals = (s: P5State, ctx: { fingerprint: string; demoClockLocal: string }): ApprovalRecord[] =>
  pendingApprovals(s.p5.approvals, ctx.fingerprint, ctx.demoClockLocal);

const tasksFor = memoByKey((actions: ExecutionAction[], approvalId: string | undefined): ExecutionAction[] =>
  approvalId === undefined ? actions : actions.filter((a) => a.approvalId === approvalId),
);
export const selectExecutionTasks = (s: P5State, approvalId?: string): ExecutionAction[] =>
  approvalId === undefined ? s.p5.actions : tasksFor(approvalId, s.p5.actions, approvalId);

const evidenceFor = memoByKey((log: VerificationEvidence[], actionId: string) => {
  const all = log.filter((e) => e.actionId === actionId);
  return { all, latest: latestEvidence(all) };
});
/** All revisions (audit history) plus the latest per kind. */
export const selectEvidenceForAction = (s: P5State, actionId: string): { all: VerificationEvidence[]; latest: VerificationEvidence[] } =>
  evidenceFor(actionId, s.p5.evidence, actionId);

export type OutcomeFreshness = 'NOT_VERIFIED' | 'CURRENT' | 'OUT_OF_DATE';

export function selectOutcomeFreshness(s: P5State, incidentId?: string): OutcomeFreshness {
  const incId =
    incidentId ??
    s.p5.selection?.incidentId ??
    Object.keys(s.p5.outcomes)[0] ??
    s.p5.approvals[s.p5.approvals.length - 1]?.incidentId;
  const outcome = incId ? s.p5.outcomes[incId] : Object.values(s.p5.outcomes)[0];
  if (!outcome) return 'NOT_VERIFIED';

  const actionIds = new Set(s.p5.actions.filter((a) => a.incidentId === outcome.incidentId).map((a) => a.id));
  const currentLatest = latestEvidence(s.p5.evidence.filter((e) => actionIds.has(e.actionId)));
  const outcomeEvIds = new Set(outcome.evidenceIds);
  const same =
    currentLatest.length === outcome.evidenceIds.length &&
    currentLatest.every((e) => outcomeEvIds.has(e.id));
  if (!same) return 'OUT_OF_DATE';
  return 'CURRENT';
}

export const selectOutcome = (s: P5State, incidentId: string): RecoveryOutcome | null => s.p5.outcomes[incidentId] ?? null;

const EMPTY: string[] = [];
export const selectMissingEvidence = (s: P5State, incidentId: string): string[] => {
  const outcome = s.p5.outcomes[incidentId];
  if (outcome) return outcome.missingEvidence;
  const approval = [...s.p5.approvals].reverse().find((a) => a.incidentId === incidentId && a.state === 'APPROVED');
  if (!approval) return EMPTY;
  // If outcome is not yet verified in state, evaluate to determine current missing evidence
  return evaluateOutcome(approval, s.p5.actions, s.p5.evidence).missingEvidence;
};

export interface DecisionMemoryFilters {
  strategy?: ScenarioStrategy | 'ESCALATED';
  incidentType?: string;
  ingredientId?: string;
  outcomeStatus?: OutcomeStatus;
  verificationLevel?: DecisionMemoryEntry['verificationLevel'];
  query?: string;
}

const memoryFiltered = memoLast(
  (
    list: DecisionMemoryEntry[],
    strategy: string | undefined,
    incidentType: string | undefined,
    ingredientId: string | undefined,
    outcomeStatus: string | undefined,
    verificationLevel: string | undefined,
    query: string | undefined,
  ): DecisionMemoryEntry[] => {
    const q = query?.trim().toLowerCase();
    return list.filter((m) => {
      if (strategy && m.strategy !== strategy) return false;
      if (incidentType && m.incidentType !== incidentType) return false;
      if (ingredientId && m.ingredientId !== ingredientId) return false;
      if (outcomeStatus && m.outcomeStatus !== outcomeStatus) return false;
      if (verificationLevel && m.verificationLevel !== verificationLevel) return false;
      if (q) {
        const matchInc = m.incidentId.toLowerCase().includes(q);
        const matchScen = m.scenarioId.toLowerCase().includes(q);
        const matchLessons = m.lessons.some((l) => l.text.toLowerCase().includes(q));
        if (!matchInc && !matchScen && !matchLessons) return false;
      }
      return true;
    });
  },
);

export const selectDecisionMemory = (s: P5State, filters: DecisionMemoryFilters = {}): DecisionMemoryEntry[] =>
  memoryFiltered(
    s.p5.decisionMemory,
    filters.strategy,
    filters.incidentType,
    filters.ingredientId,
    filters.outcomeStatus,
    filters.verificationLevel,
    filters.query,
  );

export const selectSuccessfulCaseCount = (s: P5State): number =>
  s.p5.decisionMemory.filter((m) => m.outcomeStatus === 'SUCCESS').length;

export type WorkflowStepId = 'compare' | 'approvals' | 'execution' | 'outcomes';

export interface WorkflowStepStatus {
  id: WorkflowStepId;
  label: string;
  route: string;
  status: string;
  icon: string;
  tone: 'neutral' | 'info' | 'simulated' | 'warning' | 'danger' | 'success';
}

export type WorkflowStepsResult = WorkflowStepStatus[] & {
  compare: WorkflowStepStatus;
  approvals: WorkflowStepStatus;
  execution: WorkflowStepStatus;
  outcomes: WorkflowStepStatus;
};

export function selectWorkflowSteps(
  state: P5State | P5Data,
  deps: Pick<P5Deps, 'getScenario' | 'getSnapshot' | 'getDemoClockLocal' | 'getCurrentRole'> &
    Partial<Pick<P5Deps, 'getActiveIncidentId' | 'nowIso'>>,
): WorkflowStepsResult {
  const data: P5Data = 'p5' in state ? (state as P5State).p5 : (state as P5Data);

  let snapshot: SnapshotRef;
  let clock: string;
  let scenarioA: RecoveryScenario | null = null;
  let scenarioB: RecoveryScenario | null = null;
  try {
    snapshot = deps.getSnapshot();
    clock = deps.getDemoClockLocal();
    scenarioA = deps.getScenario('A');
    scenarioB = deps.getScenario('B');
  } catch {
    const compareStep: WorkflowStepStatus = {
      id: 'compare',
      label: 'Compare',
      route: '/recovery/compare',
      status: 'Waiting for plans',
      icon: '○',
      tone: 'neutral',
    };
    const approvalsStep: WorkflowStepStatus = {
      id: 'approvals',
      label: 'Approve',
      route: '/approvals',
      status: 'Not started',
      icon: '○',
      tone: 'neutral',
    };
    const executionStep: WorkflowStepStatus = {
      id: 'execution',
      label: 'Execute',
      route: '/execution',
      status: 'Not started',
      icon: '○',
      tone: 'neutral',
    };
    const outcomesStep: WorkflowStepStatus = {
      id: 'outcomes',
      label: 'Verify',
      route: '/outcomes',
      status: 'Simulated Outcome: UNVERIFIED',
      icon: '○',
      tone: 'neutral',
    };
    const list: WorkflowStepStatus[] = [compareStep, approvalsStep, executionStep, outcomesStep];
    return Object.assign(list, {
      compare: compareStep,
      approvals: approvalsStep,
      execution: executionStep,
      outcomes: outcomesStep,
    });
  }

  const readiness = selectComparisonReadiness(scenarioA, scenarioB);

  // 1. Compare
  let compareStatus: string;
  let compareTone: WorkflowStepStatus['tone'] = 'neutral';
  let compareIcon = '○';

  if (data.escalationState === 'ESCALATED') {
    compareStatus = 'Escalated';
    compareTone = 'danger';
    compareIcon = '⚠';
  } else if (data.selection !== null) {
    const selScenario = deps.getScenario(data.selection.strategy);
    const isStale =
      !selScenario ||
      selScenario.id !== data.selection.scenarioId ||
      selScenario.version !== data.selection.version ||
      isScenarioStale(selScenario, snapshot);
    if (isStale) {
      compareStatus = 'Stale — recalculation required';
      compareTone = 'warning';
      compareIcon = '⚠';
    } else if (selScenario && isScenarioInfeasible(selScenario.feasibility)) {
      compareStatus = `Blocked: ${ERROR_LABELS.SCENARIO_INFEASIBLE.label}`;
      compareTone = 'danger';
      compareIcon = '✕';
    } else {
      compareStatus = data.selection.strategy === 'A' ? 'Plan A selected' : 'Plan B selected';
      compareTone = data.selection.strategy === 'A' ? 'info' : 'simulated';
      compareIcon = '●';
    }
  } else if (readiness === 'FINGERPRINT_MISMATCH') {
    compareStatus = 'Stale — recalculation required';
    compareTone = 'warning';
    compareIcon = '⚠';
  } else if (readiness === 'WAITING_BOTH' || readiness === 'ONLY_A' || readiness === 'ONLY_B' || (!scenarioA && !scenarioB)) {
    compareStatus = 'Waiting for plans';
    compareTone = 'neutral';
    compareIcon = '○';
  } else {
    compareStatus = 'Ready to choose';
    compareTone = 'info';
    compareIcon = '○';
  }

  // 2. Approve
  let approveStatus: string;
  let approveTone: WorkflowStepStatus['tone'] = 'neutral';
  let approveIcon = '○';

  const sel = data.selection;
  const approvedRecord = sel
    ? data.approvals.find(
        (a) => a.state === 'APPROVED' && a.idempotencyKey === approvalKey(sel.scenarioId, sel.version, sel.fingerprint),
      )
    : [...data.approvals].reverse().find((a) => a.state === 'APPROVED');

  if (approvedRecord) {
    const isStale = approvedRecord.snapshotFingerprint !== snapshot.fingerprint;
    const isExpired = isApprovalExpired(approvedRecord, clock);
    if (isStale || isExpired) {
      approveStatus = 'Stale/Expired';
      approveTone = 'warning';
      approveIcon = '⚠';
    } else {
      approveStatus = 'Approved (simulated)';
      approveTone = 'info';
      approveIcon = '●';
    }
  } else if (sel !== null) {
    const depsWithNow = {
      ...deps,
      nowIso: deps.nowIso ? deps.nowIso.bind(deps) : () => '2026-11-14T10:15:00.000Z',
    };
    const blocker = preflightApproval(data, depsWithNow);
    if (blocker !== null) {
      if (blocker.error === 'APPROVAL_EXPIRED' || blocker.error === 'STALE_SCENARIO') {
        approveStatus = 'Stale/Expired';
        approveTone = 'warning';
        approveIcon = '⚠';
      } else {
        approveStatus = `Blocked: ${ERROR_LABELS[blocker.error].label}`;
        approveTone = 'danger';
        approveIcon = '✕';
      }
    } else {
      approveStatus = 'Not started';
      approveTone = 'neutral';
      approveIcon = '○';
    }
  } else {
    const lastApproval = data.approvals[data.approvals.length - 1];
    if (lastApproval?.state === 'REJECTED' || data.escalationState === 'ESCALATED') {
      approveStatus = 'Rejected';
      approveTone = 'danger';
      approveIcon = '✕';
    } else {
      approveStatus = 'Not started';
      approveTone = 'neutral';
      approveIcon = '○';
    }
  }

  // 3. Execute
  let executeStatus: string;
  let executeTone: WorkflowStepStatus['tone'] = 'neutral';
  let executeIcon = '○';

  const activeApproval = sel
    ? data.approvals.find(
        (a) => a.state === 'APPROVED' && a.idempotencyKey === approvalKey(sel.scenarioId, sel.version, sel.fingerprint),
      )
    : [...data.approvals].reverse().find((a) => a.state === 'APPROVED');

  if (!activeApproval) {
    executeStatus = 'Not started';
    executeTone = 'neutral';
    executeIcon = '○';
  } else {
    const isStale = activeApproval.snapshotFingerprint !== snapshot.fingerprint;
    const isExpired = isApprovalExpired(activeApproval, clock);
    if (isStale || isExpired) {
      executeStatus = 'Blocked: stale/expired';
      executeTone = 'warning';
      executeIcon = '⚠';
    } else {
      const tasks = data.actions.filter((t) => t.approvalId === activeApproval.id);
      if (tasks.length === 0) {
        executeStatus = 'Not started';
        executeTone = 'neutral';
        executeIcon = '○';
      } else {
        const awaiting = tasks.filter((t) => t.state === 'AWAITING_EVIDENCE').length;
        const total = tasks.length;
        executeStatus = `${awaiting}/${total} awaiting evidence`;
        executeTone = awaiting === total ? 'info' : 'simulated';
        executeIcon = awaiting === total ? '●' : '○';
      }
    }
  }

  // 4. Verify
  let verifyStatus: string;
  let verifyTone: WorkflowStepStatus['tone'] = 'neutral';
  let verifyIcon = '○';

  const incidentId =
    deps.getActiveIncidentId?.() ??
    sel?.incidentId ??
    activeApproval?.incidentId ??
    data.approvals[data.approvals.length - 1]?.incidentId ??
    Object.keys(data.outcomes)[0] ??
    'HP-INC-001';

  const outcome = data.outcomes[incidentId] ?? Object.values(data.outcomes)[0];
  const freshness = selectOutcomeFreshness({ p5: data } as any, incidentId);
  const isOutOfDate = freshness === 'OUT_OF_DATE';

  if (!outcome || outcome.status === 'UNVERIFIED') {
    verifyStatus = 'Simulated Outcome: UNVERIFIED';
    verifyTone = 'neutral';
    verifyIcon = '○';
  } else if (outcome.status === 'PARTIAL') {
    verifyStatus = isOutOfDate ? 'Simulated Outcome: PARTIAL (out of date)' : 'Simulated Outcome: PARTIAL';
    verifyTone = 'warning';
    verifyIcon = '△';
  } else if (outcome.status === 'FAILED') {
    verifyStatus = isOutOfDate ? 'Simulated Outcome: FAILED (out of date)' : 'Simulated Outcome: FAILED';
    verifyTone = 'danger';
    verifyIcon = '✕';
  } else {
    if (isOutOfDate) {
      verifyStatus = 'Simulated Outcome: SUCCESS (out of date)';
      verifyTone = 'warning';
      verifyIcon = '⚠';
    } else {
      verifyStatus = 'Simulated Outcome: SUCCESS';
      verifyTone = 'success';
      verifyIcon = '✓';
    }
  }

  const compareStep: WorkflowStepStatus = {
    id: 'compare',
    label: 'Compare',
    route: '/recovery/compare',
    status: compareStatus,
    icon: compareIcon,
    tone: compareTone,
  };
  const approvalsStep: WorkflowStepStatus = {
    id: 'approvals',
    label: 'Approve',
    route: '/approvals',
    status: approveStatus,
    icon: approveIcon,
    tone: approveTone,
  };
  const executionStep: WorkflowStepStatus = {
    id: 'execution',
    label: 'Execute',
    route: '/execution',
    status: executeStatus,
    icon: executeIcon,
    tone: executeTone,
  };
  const outcomesStep: WorkflowStepStatus = {
    id: 'outcomes',
    label: 'Verify',
    route: '/outcomes',
    status: verifyStatus,
    icon: verifyIcon,
    tone: verifyTone,
  };

  const list: WorkflowStepStatus[] = [compareStep, approvalsStep, executionStep, outcomesStep];
  return Object.assign(list, {
    compare: compareStep,
    approvals: approvalsStep,
    execution: executionStep,
    outcomes: outcomesStep,
  });
}
