/**
 * TEMPORARY — delete at integration (Phase 4)
 *
 * A small mutable stand-in for the root demoStore (P2 snapshot + impact, P3/P4 scenarios,
 * demo clock, demo role). It notifies subscribers on every change so the UI re-renders.
 * TODO(G0): replaced by the Integrator's root store + debug panel.
 */
import type {
  DemoRole,
  ImpactSummaryLike,
  P5Event,
  RecoveryScenarioWithActions,
  ScenarioStrategy,
  SnapshotRef,
} from '../features/recovery/governance/p5Contracts';
import type { P5Deps } from '../features/recovery/governance/p5Deps';
import { DEV_INCIDENT_ID, DEV_SNAPSHOT, devScenarioA, devScenarioB } from './mockScenarios';

export const DEV_IMPACT: ImpactSummaryLike = {
  incidentId: DEV_INCIDENT_ID,
  poId: 'HP-PO-1042',
  poExpectedKgMilli: 20000,
  poClaimedKgMilli: 0,
  poShortfallKgMilli: 20000,
  forecastGapKgMilli: 12000,
};

export interface MockWorldState {
  snapshot: SnapshotRef;
  scenarios: Record<ScenarioStrategy, RecoveryScenarioWithActions | null>;
  impact: ImpactSummaryLike | null;
  clock: string;
  role: DemoRole;
  actorId: string;
  incidentId: string | null;
  events: P5Event[];
  tick: number;
}

const ACTOR_IDS: Record<DemoRole, string> = {
  Owner: 'demo-owner',
  OperationsManager: 'demo-ops-manager',
  ProcurementOfficer: 'demo-procurement',
  KitchenLead: 'demo-kitchen-lead',
  ViewerAuditor: 'demo-auditor',
};

function initial(): MockWorldState {
  return {
    snapshot: { ...DEV_SNAPSHOT },
    scenarios: { A: devScenarioA(), B: devScenarioB() },
    impact: { ...DEV_IMPACT },
    clock: '09:00',
    role: 'Owner',
    actorId: ACTOR_IDS.Owner,
    incidentId: DEV_INCIDENT_ID,
    events: [],
    tick: 0,
  };
}

export interface MockWorld {
  readonly state: MockWorldState;
  readonly deps: P5Deps;
  subscribe(cb: () => void): () => void;
  getVersion(): number;
  /** Mutate the world and notify subscribers. */
  update(fn: (s: MockWorldState) => void): void;
  setRole(role: DemoRole): void;
  setClock(hhmm: string): void;
  /** Simulates SNAPSHOT_CHANGED: revision + 1, new fingerprint; published scenarios become stale. */
  changeFingerprint(): void;
  /** Simulates P3/P4 recalculating on the current snapshot: version + 1. */
  publishNextVersion(strategy: ScenarioStrategy): void;
  removePlan(strategy: ScenarioStrategy): void;
  reset(): void;
  seedEvidence(store: { getState(): import('../features/recovery/governance/p5Slice').P5State }, seed: EvidenceSeedType): void;
}

export type EvidenceSeedType =
  | 'B_COMPLETE'
  | 'B_PARTIAL'
  | 'A_COMPLETE'
  | 'A_LATE'
  | 'A_REJECTED'
  | 'FULFILMENT_SHORT';

const BATCH_PLANNED: Record<string, number> = {
  'HP-BATCH-B-01': 25,
  'HP-BATCH-B-02': 20,
  'HP-BATCH-B-03': 15,
  'HP-BATCH-B-04': 12,
};

const BATCH_TIME: Record<string, string> = {
  'HP-BATCH-B-01': '11:20',
  'HP-BATCH-B-02': '11:40',
  'HP-BATCH-B-03': '12:00',
  'HP-BATCH-B-04': '12:15',
};

export function seedEvidence(
  store: { getState(): import('../features/recovery/governance/p5Slice').P5State },
  world: { setRole?(role: DemoRole): void; role?: DemoRole; readonly state?: MockWorldState },
  seed: EvidenceSeedType,
): void {
  const prevRole = world.state?.role ?? world.role;
  if (typeof world.setRole === 'function') {
    world.setRole('Owner');
  } else if ('role' in world) {
    world.role = 'Owner';
  }

  const p5 = store.getState().p5;
  const actions = p5.actions;

  if (seed === 'B_COMPLETE' || seed === 'B_PARTIAL') {
    const menus = actions.filter((a) => a.actionType === 'MENU_LIMIT_TASK');
    for (const m of menus) {
      if (m.targetId) {
        store.getState().p5.recordSimulatedEvidence(m.id, 'MENU_UPDATE', { menuId: m.targetId, applied: true });
      }
    }
    const preps = actions.filter((a) => a.actionType === 'PREP_BATCH_TASK');
    for (const p of preps) {
      if (!p.targetId) continue;
      if (seed === 'B_PARTIAL' && p.targetId === 'HP-BATCH-B-04') continue;
      const planned = BATCH_PLANNED[p.targetId] ?? 10;
      const time = BATCH_TIME[p.targetId] ?? '11:30';
      store.getState().p5.recordSimulatedEvidence(p.id, 'PREP', {
        batchId: p.targetId,
        producedPortions: planned,
        plannedPortions: planned,
        waste: { status: 'UNKNOWN' },
        completedLocal: time,
      });
    }
    const anyB = actions.find((a) => a.actionType === 'PREP_BATCH_TASK' || a.actionType === 'MENU_LIMIT_TASK');
    if (anyB) {
      store.getState().p5.recordSimulatedEvidence(anyB.id, 'ORDER_FULFILMENT', {
        confirmedFulfilled: 60,
        confirmedRequired: 60,
      });
    }
  } else if (seed === 'A_COMPLETE' || seed === 'A_LATE' || seed === 'A_REJECTED') {
    const rTask =
      actions.find((a) => a.actionType === 'RECEIPT_CHECK') ??
      actions.find((a) => a.actionType === 'PO_DRAFT') ??
      actions[0];
    if (rTask) {
      const accepted = seed !== 'A_REJECTED';
      const arrivalLocal = seed === 'A_LATE' ? '11:00' : '10:30';
      store.getState().p5.recordSimulatedEvidence(rTask.id, 'RECEIPT', {
        receivedKgMilli: 15000,
        accepted,
        arrivalLocal,
        landedCostSen: 25500,
      });
    }
    const anyA = actions.find((a) => a.actionType === 'RECEIPT_CHECK' || a.actionType === 'PO_DRAFT');
    if (anyA) {
      store.getState().p5.recordSimulatedEvidence(anyA.id, 'ORDER_FULFILMENT', {
        confirmedFulfilled: 60,
        confirmedRequired: 60,
      });
    }
  } else if (seed === 'FULFILMENT_SHORT') {
    const bPreps = actions.filter((a) => a.actionType === 'PREP_BATCH_TASK');
    let targetAction = actions[0];
    if (bPreps.length > 0) {
      targetAction = bPreps[0];
      const menus = actions.filter((a) => a.actionType === 'MENU_LIMIT_TASK');
      for (const m of menus) {
        if (m.targetId) {
          store.getState().p5.recordSimulatedEvidence(m.id, 'MENU_UPDATE', { menuId: m.targetId, applied: true });
        }
      }
      for (const p of bPreps) {
        if (!p.targetId) continue;
        const planned = BATCH_PLANNED[p.targetId] ?? 10;
        const time = BATCH_TIME[p.targetId] ?? '11:30';
        store.getState().p5.recordSimulatedEvidence(p.id, 'PREP', {
          batchId: p.targetId,
          producedPortions: planned,
          plannedPortions: planned,
          waste: { status: 'UNKNOWN' },
          completedLocal: time,
        });
      }
    } else {
      const rTask =
        actions.find((a) => a.actionType === 'RECEIPT_CHECK') ??
        actions.find((a) => a.actionType === 'PO_DRAFT');
      if (rTask) {
        targetAction = rTask;
        store.getState().p5.recordSimulatedEvidence(rTask.id, 'RECEIPT', {
          receivedKgMilli: 15000,
          accepted: true,
          arrivalLocal: '10:30',
          landedCostSen: 25500,
        });
      }
    }
    if (targetAction) {
      store.getState().p5.recordSimulatedEvidence(targetAction.id, 'ORDER_FULFILMENT', {
        confirmedFulfilled: 55,
        confirmedRequired: 60,
      });
    }
  }

  if (prevRole && prevRole !== 'Owner') {
    if (typeof world.setRole === 'function') {
      world.setRole(prevRole);
    } else if ('role' in world) {
      world.role = prevRole;
    }
  }
}

export function createMockWorld(): MockWorld {
  let state = initial();
  let version = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    version++;
    listeners.forEach((l) => l());
  };
  const update = (fn: (s: MockWorldState) => void) => {
    const next = structuredClone(state);
    fn(next);
    state = next;
    notify();
  };
  const factories = { A: devScenarioA, B: devScenarioB };

  const world: MockWorld = {
    get state() {
      return state;
    },
    deps: {
      getSnapshot: () => state.snapshot,
      getScenario: (s) => state.scenarios[s],
      getActiveIncidentId: () => state.incidentId,
      getActiveIncident: () =>
        state.incidentId
          ? { id: state.incidentId, type: 'UNAVAILABLE', ingredientId: 'HP-ING-CHICKEN', poId: 'HP-PO-1042' }
          : null,
      getImpact: () => state.impact,
      getDemoClockLocal: () => state.clock,
      getCurrentRole: () => ({ role: state.role, actorId: state.actorId }),
      // Deterministic audit stamps: business date + demo clock + a monotonic counter.
      nowIso: () => {
        const n = state.tick++;
        return `${state.snapshot.demoBusinessDate}T${state.clock}:${String(n % 60).padStart(2, '0')}+08:00`;
      },
      emit: (e) => {
        state.events = [...state.events, e];
      },
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getVersion: () => version,
    update,
    setRole(role) {
      update((s) => {
        s.role = role;
        s.actorId = ACTOR_IDS[role];
      });
    },
    setClock(hhmm) {
      update((s) => {
        s.clock = hhmm;
      });
    },
    changeFingerprint() {
      update((s) => {
        const revision = s.snapshot.revision + 1;
        s.snapshot = { ...s.snapshot, revision, fingerprint: `DEV-FP:${s.snapshot.id}:r${revision}` };
      });
    },
    publishNextVersion(strategy) {
      update((s) => {
        const prev = s.scenarios[strategy];
        const base = prev ?? factories[strategy]();
        s.scenarios[strategy] = { ...base, version: (prev?.version ?? 0) + 1, snapshotFingerprint: s.snapshot.fingerprint };
      });
    },
    removePlan(strategy) {
      update((s) => {
        s.scenarios[strategy] = null;
      });
    },
    reset() {
      state = initial();
      notify();
    },
    seedEvidence(store, seed) {
      seedEvidence(store, world, seed);
    },
  };
  return world;
}
