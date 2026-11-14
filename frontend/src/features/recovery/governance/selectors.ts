import { isApprovalExpired } from '../../approvals/approvalLogic';
import { latestEvidence } from '../../outcomes/evidence';
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
import type { P5State } from './p5Slice';
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

export const selectOutcome = (s: P5State, incidentId: string): RecoveryOutcome | null => s.p5.outcomes[incidentId] ?? null;

const EMPTY: string[] = [];
export const selectMissingEvidence = (s: P5State, incidentId: string): string[] =>
  s.p5.outcomes[incidentId]?.missingEvidence ?? EMPTY;

export interface DecisionMemoryFilters {
  strategy?: ScenarioStrategy | 'ESCALATED';
  outcomeStatus?: OutcomeStatus;
}
const memoryFiltered = memoLast(
  (list: DecisionMemoryEntry[], strategy: string | undefined, status: string | undefined): DecisionMemoryEntry[] =>
    strategy === undefined && status === undefined
      ? list
      : list.filter((m) => (strategy === undefined || m.strategy === strategy) && (status === undefined || m.outcomeStatus === status)),
);
export const selectDecisionMemory = (s: P5State, filters: DecisionMemoryFilters = {}): DecisionMemoryEntry[] =>
  memoryFiltered(s.p5.decisionMemory, filters.strategy, filters.outcomeStatus);

export const selectSuccessfulCaseCount = (s: P5State): number =>
  s.p5.decisionMemory.filter((m) => m.outcomeStatus === 'SUCCESS').length;
