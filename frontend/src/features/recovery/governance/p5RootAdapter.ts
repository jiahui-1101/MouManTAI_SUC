import type {
  ActiveIncidentRef,
  P5Deps,
} from './p5Deps';
import type {
  ApprovalRecord,
  DemoRole,
  ExecutionAction,
  Feasibility,
  ImpactSummaryLike,
  P5Event,
  RecoveryScenarioWithActions,
  ScenarioStrategy,
  SnapshotRef,
} from './p5Contracts';
import { isApprovalExpired } from '../../approvals/approvalLogic';
import type { P5DepsAdapter, P5WorldView } from './p5Store';
import type { P5State } from './p5Slice';
import { getP2State, subscribeP2 } from '../../../services/mock/restaurantStore';
import { buildP5Handoff } from '../../impact/handoff';
import { HP_BUSINESS, HP_IDS } from '../../../data/fixtures/happyPotato';
import { devScenarioA, devScenarioB } from '../../../__dev__/mockScenarios';
import { calculatePlanB, type PlanInput } from '../plan-b/planB';
import { preview as previewB } from '../plan-b/preview';
import type {
  PlanAPublisher,
  PlanAInputRead,
  ScenarioAReadyRequest,
  ScenarioAReadyAcknowledgement,
} from '../plan-a/integration/types';

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

/**
 * In-memory scenario publication cache for P3 / P4 dynamic scenarios.
 */
const publishedScenarios: {
  A?: RecoveryScenarioWithActions | null;
  B?: RecoveryScenarioWithActions | null;
} = {};

export function publishScenarioToAdapter(scenario: RecoveryScenarioWithActions): void {
  publishedScenarios[scenario.strategy] = scenario;
}

export function getPublishedScenario(strategy: ScenarioStrategy): RecoveryScenarioWithActions | null {
  return publishedScenarios[strategy] ?? null;
}

export function clearPublishedScenarios(): void {
  publishedScenarios.A = null;
  publishedScenarios.B = null;
}

/**
 * Creates a PlanAPublisher that connects P3's external supply recovery proposals
 * directly to P5's comparison and approval pipeline.
 */
export function createPlanAPublisher(
  onPublished?: (scenario: RecoveryScenarioWithActions) => void,
): PlanAPublisher {
  return {
    readCurrent(): PlanAInputRead {
      const p2 = getP2State();
      const inc = p2.restaurant.incidents[0];
      const snap = p2.restaurant.snapshot;
      return {
        source: {
          incident: inc ? (inc as any) : undefined,
          snapshot: snap as any,
        },
      };
    },
    async commitScenarioA(request: ScenarioAReadyRequest): Promise<ScenarioAReadyAcknowledgement> {
      const p2 = getP2State();
      const snap = p2.restaurant.snapshot;
      if (request.expectedSnapshotRevision !== snap.revision) {
        return {
          status: 'REJECTED',
          message: `Snapshot revision mismatch: expected ${request.expectedSnapshotRevision}, current ${snap.revision}`,
        };
      }
      const scenarioWithActions: RecoveryScenarioWithActions = {
        ...request.scenario,
        proposedActions: [{ actionType: 'PO_DRAFT' }, { actionType: 'RECEIPT_CHECK' }],
      };
      publishScenarioToAdapter(scenarioWithActions);
      if (onPublished) onPublished(scenarioWithActions);
      return {
        status: 'STORED',
        idempotencyKey: request.idempotencyKey,
        snapshotRevision: request.expectedSnapshotRevision,
        storedScenario: request.scenario,
      };
    },
  };
}

/**
 * Adapts origin/main's mock restaurant store (src/services/mock/restaurantStore.ts)
 * and P2 impact engine (src/features/impact/handoff.ts) into P5DepsAdapter.
 *
 * Hybrid fallback: Since P3 and P4 have not yet merged into origin/main,
 * canonical scenarios HP-SC-A-001 and HP-SC-B-001 bound to the current snapshot
 * fingerprint are automatically injected if the store lacks scenarios.
 */
export function createRestaurantStoreAdapter(
  dispatchRootEvent?: RootEventDispatcher,
): P5DepsAdapter {
  let currentRole: DemoRole = 'Owner';
  const roleListeners = new Set<() => void>();

  function notifyRoleChange() {
    roleListeners.forEach((l) => l());
  }

  function getSnapshotRef(): SnapshotRef {
    const p2 = getP2State();
    const snap = p2.restaurant.snapshot;
    return {
      id: snap.id,
      revision: snap.revision,
      fingerprint: snap.fingerprint,
      demoBusinessDate: snap.demoBusinessDate ?? HP_BUSINESS.fixtureBusinessDate,
    };
  }

  function getActiveIncidentData(): ActiveIncidentRef | null {
    const p2 = getP2State();
    const inc = p2.restaurant.incidents[0];
    if (inc) {
      return {
        id: inc.id,
        type: inc.type,
        ingredientId: inc.ingredientId,
        poId: inc.poId,
      };
    }
    return {
      id: HP_IDS.incident,
      type: 'UNAVAILABLE',
      ingredientId: HP_IDS.chicken,
      poId: HP_IDS.po,
    };
  }

  function getImpactData(): ImpactSummaryLike | null {
    const p2 = getP2State();
    const inc = p2.restaurant.incidents[0];
    const snap = p2.restaurant.snapshot;
    const po = snap.purchaseOrders.find((p) => p.id === (inc?.poId ?? HP_IDS.po));
    const claim = snap.supplierClaims.find((c) => c.poId === (inc?.poId ?? HP_IDS.po));

    if (inc) {
      const handoff = buildP5Handoff(p2.restaurant, inc.id);
      if (handoff.ready) {
        return {
          ...handoff.payload.summary,
          incidentId: inc.id,
          poId: inc.poId,
          poExpectedKgMilli: po?.expectedKgMilli ?? 20000,
          poClaimedKgMilli: claim?.claimedDeliveryTodayKgMilli ?? 0,
          poShortfallKgMilli: handoff.payload.summary.demandGapKgMilli,
          forecastGapKgMilli: handoff.payload.summary.demandGapKgMilli,
        };
      }
      const rawImpact = p2.restaurant.impacts[inc.id];
      if (rawImpact?.summary) {
        return {
          ...rawImpact.summary,
          incidentId: inc.id,
          poId: inc.poId,
          poExpectedKgMilli: po?.expectedKgMilli ?? 20000,
          poClaimedKgMilli: claim?.claimedDeliveryTodayKgMilli ?? 0,
          poShortfallKgMilli: rawImpact.poShortfallKgMilli ?? 20000,
          forecastGapKgMilli: rawImpact.summary.demandGapKgMilli,
        };
      }
    }
    return null;
  }

  function getScenarioData(strategy: ScenarioStrategy): RecoveryScenarioWithActions {
    const snapRef = getSnapshotRef();
    const incidentData = getActiveIncidentData();

    // 1. Check if an explicit scenario was published
    const published = publishedScenarios[strategy];
    if (published && (!published.snapshotFingerprint || published.snapshotFingerprint === snapRef.fingerprint)) {
      return {
        ...published,
        incidentId: incidentData?.id ?? published.incidentId,
      };
    }

    // 2. Dynamic generation for Strategy B from P4 domain engine
    if (strategy === 'B') {
      try {
        const p2 = getP2State();
        const chickenLot = p2.restaurant.snapshot.ingredientLots.find(
          (l) => l.ingredientId === HP_IDS.chicken || l.id === 'HP-LOT-CH-001',
        );
        const chickenGrams = chickenLot ? chickenLot.onHandMilli : 10000;
        const planBInput: PlanInput = {
          ...previewB,
          snapshotId: snapRef.id,
          fingerprint: snapRef.fingerprint,
          revision: snapRef.revision,
          incident: incidentData
            ? {
                id: incidentData.id,
                verified: true,
                po: incidentData.poId,
                ordered: 20000,
                claimed: 0,
              }
            : previewB.incident,
          lots: previewB.lots.map((lot) =>
            lot.ingredient === 'chicken' ? { ...lot, grams: chickenGrams } : lot,
          ),
        };
        const res = calculatePlanB(planBInput);
        if (res.status === 'READY') {
          const sc = res.scenario;
          const proposedActions = [
            ...sc.proposals.map((p) => ({
              actionType: 'MENU_LIMIT_TASK' as const,
              targetId: p.menuId,
            })),
            ...sc.batches.map((b) => ({
              actionType: 'PREP_BATCH_TASK' as const,
              targetId: b.id,
              plannedPortions: b.portions,
            })),
          ];
          return {
            id: sc.id,
            incidentId: incidentData?.id ?? sc.incidentId,
            strategy: 'B',
            snapshotFingerprint: sc.snapshotFingerprint,
            version: sc.version,
            feasibility: sc.feasibility === 'BREACH_RISK' ? 'INFEASIBLE' : (sc.feasibility as Feasibility),
            newPurchaseKgMilli: sc.newPurchaseKgMilli,
            additionalCostSen: sc.additionalCostSen,
            forecastChickenPortionsServed: sc.forecastChickenPortionsServed,
            forecastChickenPortionsUnmet: sc.forecastChickenPortionsUnmet,
            confirmedChickenPortionsProtected: sc.confirmedChickenPortionsProtected,
            assumptions: [...sc.assumptions],
            evidenceRefs: [...sc.evidenceRefs],
            actionIds: [...sc.actionIds],
            simulatedCalculation: true,
            proposedActions,
          };
        }
      } catch {
        // Fall back to devScenarioB
      }
      const b = devScenarioB(snapRef.fingerprint, snapRef.revision);
      if (incidentData) b.incidentId = incidentData.id;
      return b;
    }

    // 3. Fallback for Strategy A to canonical devScenarioA
    const a = devScenarioA(snapRef.fingerprint, snapRef.revision);
    if (incidentData) a.incidentId = incidentData.id;
    return a;
  }

  const deps: P5Deps & { resolveMenuDisplayName(menuId: string): string } = {
    getSnapshot: getSnapshotRef,
    getScenario: (strategy) => getScenarioData(strategy),
    getActiveIncidentId: () => getActiveIncidentData()?.id ?? null,
    getActiveIncident: getActiveIncidentData,
    getImpact: getImpactData,
    getDemoClockLocal: () => HP_BUSINESS.simulationClockLocal,
    getCurrentRole: () => ({ role: currentRole, actorId: `HP-ACTOR-${currentRole.toUpperCase()}` }),
    nowIso: () => `${getSnapshotRef().demoBusinessDate}T${HP_BUSINESS.simulationClockLocal}:00+08:00`,
    emit: (event: P5Event) => {
      if (dispatchRootEvent) dispatchRootEvent(event);
    },
    resolveMenuDisplayName(menuId: string): string {
      const p2 = getP2State();
      return p2.restaurant.snapshot.menuItems.find((m) => m.id === menuId)?.name ?? menuId;
    },
  };

  let cachedP2State: unknown = null;
  let cachedRole: DemoRole = currentRole;
  let cachedView: P5WorldView | null = null;

  function computeView(): P5WorldView {
    const p2 = getP2State();
    if (cachedView && cachedP2State === p2 && cachedRole === currentRole) {
      return cachedView;
    }
    cachedP2State = p2;
    cachedRole = currentRole;

    const snapRef = getSnapshotRef();
    const inc = getActiveIncidentData();
    cachedView = {
      wired: true,
      snapshot: snapRef,
      scenarioA: getScenarioData('A'),
      scenarioB: getScenarioData('B'),
      impact: getImpactData(),
      clock: HP_BUSINESS.simulationClockLocal,
      role: currentRole,
      incidentId: inc?.id ?? null,
    };
    return cachedView;
  }

  return {
    wired: true,
    deps,
    subscribe(cb: () => void) {
      const unsubP2 = subscribeP2(cb);
      roleListeners.add(cb);
      return () => {
        unsubP2();
        roleListeners.delete(cb);
      };
    },
    getView: computeView,
    setRole(role: DemoRole) {
      currentRole = role;
      notifyRoleChange();
    },
    mockWorld: null,
  };
}
