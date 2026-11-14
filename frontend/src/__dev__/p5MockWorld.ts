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
  };
  return world;
}
