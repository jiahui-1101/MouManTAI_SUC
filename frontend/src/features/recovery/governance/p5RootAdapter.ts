import type {
  ActiveIncidentRef,
  P5Deps,
} from './p5Deps';
import type {
  ApprovalRecord,
  DemoRole,
  ExecutionAction,
  ImpactSummaryLike,
  P5Event,
  RecoveryScenarioWithActions,
  ScenarioStrategy,
  SnapshotRef,
} from './p5Contracts';
import { isApprovalExpired } from '../../approvals/approvalLogic';
import type { P5DepsAdapter, P5WorldView } from './p5Store';
import type { P5State } from './p5Slice';

/**
 * Minimal structural interfaces mirroring docs/00_SHARED §3–4.
 * Teammates or the Integration Lead can plug their root Zustand store
 * directly into these contracts without circular dependencies or import conflicts.
 */

export interface RootMenuItem {
  id: string;
  name: string;
  priceSen?: number;
  chickenKgMilli?: number;
  potatoFriesKgMilli?: number;
  recipeVersion?: string;
  approvedInDemo?: boolean;
  [key: string]: unknown;
}

export interface RootSnapshot {
  id: string;
  revision: number;
  fingerprint: string;
  capturedAtIso?: string;
  demoBusinessDate?: string;
  dataMode?: string;
  menuItems?: RootMenuItem[];
  [key: string]: unknown;
}

export interface RootIncident {
  id: string;
  poId: string;
  ingredientId: string;
  type: string;
  status?: string;
  revision?: number;
  snapshotFingerprint?: string;
  [key: string]: unknown;
}

export interface RootScenarios {
  A?: RecoveryScenarioWithActions | null;
  B?: RecoveryScenarioWithActions | null;
  [key: string]: RecoveryScenarioWithActions | null | undefined;
}

export interface RootStoreContract {
  snapshot?: RootSnapshot | null;
  scenarios?: RootScenarios | null;
  activeIncidentId?: string | null;
  activeIncident?: RootIncident | null;
  incidents?: RootIncident[] | Record<string, RootIncident> | null;
  impact?: ImpactSummaryLike | null;
  demoClockLocal?: string | null;
  currentDemoRole?: DemoRole | string | null;
  currentActorId?: string | null;
  nowIso?: () => string;
  dispatchDomainEvent?: (type: string, payload: unknown) => void;
  [key: string]: unknown;
}

export type RootStoreState = RootStoreContract;

export type RootEventDispatcher = (event: P5Event) => void;

/**
 * Maps a root Zustand/demoStore state into P5Deps.
 */
export function createRootP5Deps(
  getRootState: () => RootStoreContract,
  dispatchRootEvent?: RootEventDispatcher,
): P5Deps & { resolveMenuDisplayName(menuId: string): string } {
  return {
    getSnapshot(): SnapshotRef {
      const s = getRootState();
      if (!s?.snapshot) {
        throw new Error('P5 cannot read snapshot: RootStoreContract.snapshot is not available');
      }
      return {
        id: s.snapshot.id ?? 'HP-SNAP-001',
        revision: s.snapshot.revision ?? 1,
        fingerprint: s.snapshot.fingerprint ?? 'fp_snap_001',
        demoBusinessDate: s.snapshot.demoBusinessDate ?? '2026-11-14',
      };
    },

    getScenario(strategy: ScenarioStrategy): RecoveryScenarioWithActions | null {
      const s = getRootState();
      const scen = s?.scenarios?.[strategy];
      if (!scen) return null;
      return {
        ...scen,
        proposedActions: scen.proposedActions ?? [],
      };
    },

    getActiveIncidentId(): string | null {
      const s = getRootState();
      if (!s) return null;
      if (s.activeIncidentId) return s.activeIncidentId;
      if (s.activeIncident?.id) return s.activeIncident.id;
      if (Array.isArray(s.incidents) && s.incidents[0]?.id) return s.incidents[0].id;
      return null;
    },

    getActiveIncident(): ActiveIncidentRef | null {
      const s = getRootState();
      if (!s) return null;
      if (s.activeIncident) {
        return {
          id: s.activeIncident.id,
          type: s.activeIncident.type ?? 'UNAVAILABLE',
          ingredientId: s.activeIncident.ingredientId ?? 'HP-ING-CHICKEN',
          poId: s.activeIncident.poId ?? 'HP-PO-1042',
        };
      }
      if (Array.isArray(s.incidents) && s.incidents.length > 0) {
        const found = (s.activeIncidentId ? s.incidents.find((i) => i.id === s.activeIncidentId) : null) ?? s.incidents[0];
        if (found) {
          return {
            id: found.id,
            type: found.type ?? 'UNAVAILABLE',
            ingredientId: found.ingredientId ?? 'HP-ING-CHICKEN',
            poId: found.poId ?? 'HP-PO-1042',
          };
        }
      }
      if (s.activeIncidentId) {
        return {
          id: s.activeIncidentId,
          type: 'UNAVAILABLE',
          ingredientId: 'HP-ING-CHICKEN',
          poId: 'HP-PO-1042',
        };
      }
      return null;
    },

    getImpact(): ImpactSummaryLike | null {
      const s = getRootState();
      return s?.impact ?? null;
    },

    getDemoClockLocal(): string {
      const s = getRootState();
      return s?.demoClockLocal ?? '10:00';
    },

    getCurrentRole(): { role: DemoRole; actorId: string } {
      const s = getRootState();
      const role = (s?.currentDemoRole as DemoRole) ?? 'Owner';
      const actorId = s?.currentActorId ?? `HP-ACTOR-${role.toUpperCase()}`;
      return { role, actorId };
    },

    nowIso(): string {
      const s = getRootState();
      if (typeof s?.nowIso === 'function') {
        return s.nowIso();
      }
      const bDate = s?.snapshot?.demoBusinessDate ?? '2026-11-14';
      const clock = s?.demoClockLocal ?? '10:00';
      return `${bDate}T${clock}:00+08:00`;
    },

    emit(event: P5Event): void {
      if (dispatchRootEvent) {
        dispatchRootEvent(event);
      }
      const s = getRootState();
      if (s && typeof s.dispatchDomainEvent === 'function') {
        s.dispatchDomainEvent(event.type, event.payload);
      }
    },

    resolveMenuDisplayName(menuId: string): string {
      const s = getRootState();
      const item = s?.snapshot?.menuItems?.find((m) => m.id === menuId);
      return item?.name ?? menuId;
    },
  };
}

/**
 * Creates a P5DepsAdapter wrapping the root store.
 */
export function createRootStoreAdapter(
  storeOrGetter:
    | { getState: () => RootStoreContract; subscribe: (cb: () => void) => () => void; setState?: any }
    | (() => RootStoreContract),
  dispatchRootEvent?: RootEventDispatcher,
): P5DepsAdapter {
  const isStore = typeof storeOrGetter === 'object' && storeOrGetter !== null && 'getState' in storeOrGetter;
  const getRootState = isStore ? () => storeOrGetter.getState() : (storeOrGetter as () => RootStoreContract);
  const subscribe = isStore && typeof storeOrGetter.subscribe === 'function'
    ? storeOrGetter.subscribe.bind(storeOrGetter)
    : () => () => {};

  const deps = createRootP5Deps(getRootState, dispatchRootEvent);

  return {
    wired: true,
    deps,
    subscribe,
    getView(): P5WorldView {
      const s = getRootState();
      if (!s) {
        return {
          wired: false,
          snapshot: null,
          scenarioA: null,
          scenarioB: null,
          impact: null,
          clock: null,
          role: null,
          incidentId: null,
        };
      }
      const snapRef: SnapshotRef | null = s.snapshot
        ? {
            id: s.snapshot.id ?? 'HP-SNAP-001',
            revision: s.snapshot.revision ?? 1,
            fingerprint: s.snapshot.fingerprint ?? 'fp_snap_001',
            demoBusinessDate: s.snapshot.demoBusinessDate ?? '2026-11-14',
          }
        : null;

      return {
        wired: true,
        snapshot: snapRef,
        scenarioA: s.scenarios?.A ?? null,
        scenarioB: s.scenarios?.B ?? null,
        impact: s.impact ?? null,
        clock: s.demoClockLocal ?? '10:00',
        role: (s.currentDemoRole as DemoRole) ?? 'Owner',
        incidentId: s.activeIncidentId ?? s.activeIncident?.id ?? (Array.isArray(s.incidents) ? s.incidents[0]?.id : null) ?? null,
      };
    },
    setRole(role: DemoRole) {
      if (isStore && 'setState' in storeOrGetter && typeof storeOrGetter.setState === 'function') {
        storeOrGetter.setState({ currentDemoRole: role });
      }
    },
    mockWorld: null,
  };
}

/**
 * Root-level selectors for P2's Overview cards and cross-module dashboards.
 */
export interface RootP5Selectors<TRoot> {
  selectPendingApprovals: (rootState: TRoot) => ApprovalRecord[];
  selectExecutionTasks: (rootState: TRoot) => ExecutionAction[];
  selectPendingApprovalCount: (rootState: TRoot) => number;
  selectAwaitingEvidenceCount: (rootState: TRoot) => number;
}

export function createRootP5Selectors<TRoot extends RootStoreContract = RootStoreContract>(
  selectP5State: (root: TRoot) => Partial<P5State['p5']> | P5State | undefined | null,
): RootP5Selectors<TRoot> {
  const getP5Slice = (root: TRoot): Partial<P5State['p5']> | null => {
    const raw = selectP5State(root);
    if (!raw) return null;
    return 'p5' in raw ? (raw as P5State).p5 : (raw as Partial<P5State['p5']>);
  };

  const selectPendingApprovalsForRoot = (rootState: TRoot): ApprovalRecord[] => {
    const p5 = getP5Slice(rootState);
    if (!p5 || !p5.approvals) return [];
    const fingerprint = rootState.snapshot?.fingerprint ?? '';
    const demoClockLocal = rootState.demoClockLocal ?? '10:00';
    return p5.approvals.filter(
      (a) => a.state === 'APPROVED' && a.snapshotFingerprint === fingerprint && !isApprovalExpired(a, demoClockLocal),
    );
  };

  const selectExecutionTasksForRoot = (rootState: TRoot): ExecutionAction[] => {
    const p5 = getP5Slice(rootState);
    if (!p5 || !p5.actions) return [];
    return p5.actions;
  };

  const selectPendingApprovalCountForRoot = (rootState: TRoot): number => {
    return selectPendingApprovalsForRoot(rootState).length;
  };

  const selectAwaitingEvidenceCountForRoot = (rootState: TRoot): number => {
    return selectExecutionTasksForRoot(rootState).filter((t) => t.state === 'AWAITING_EVIDENCE').length;
  };

  return {
    selectPendingApprovals: selectPendingApprovalsForRoot,
    selectExecutionTasks: selectExecutionTasksForRoot,
    selectPendingApprovalCount: selectPendingApprovalCountForRoot,
    selectAwaitingEvidenceCount: selectAwaitingEvidenceCountForRoot,
  };
}
