import { isApprovalExpired } from '../../approvals/approvalLogic';
import { latestEvidence } from '../../outcomes/evidence';
import { evaluateOutcome } from '../../outcomes/verifyOutcome';
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
