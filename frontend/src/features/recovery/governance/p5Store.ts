import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { createMockWorld, type MockWorld } from '../../../__dev__/p5MockWorld';
import { isP5DevMocksEnabled } from '../../../__dev__/mockScenarios';
import type { DemoRole, ImpactSummaryLike, RecoveryScenarioWithActions, SnapshotRef } from './p5Contracts';
import type { P5Deps } from './p5Deps';
import { createP5Slice, type P5State } from './p5Slice';

/**
 * Phase 2 wiring until the Integrator's root demoStore exists.
 * TODO(G0): replace rootStoreDeps with a real adapter over the root store.
 */

/** Everything the pages read from outside P5, as one immutable view per world version. */
export interface P5WorldView {
  wired: boolean;
  snapshot: SnapshotRef | null;
  scenarioA: RecoveryScenarioWithActions | null;
  scenarioB: RecoveryScenarioWithActions | null;
  impact: ImpactSummaryLike | null;
  clock: string | null;
  role: DemoRole | null;
  incidentId: string | null;
}

export interface P5DepsAdapter {
  wired: boolean;
  deps: P5Deps;
  subscribe(cb: () => void): () => void;
  getView(): P5WorldView;
  /** TODO(G0): global demo role lives in the root store. */
  setRole(role: DemoRole): void;
  /** Present only for dev mocks (drives P5DevControls). */
  mockWorld: MockWorld | null;
}

const NOT_WIRED = 'P5 root store not wired — TODO(G0)';
const NOT_WIRED_VIEW: P5WorldView = {
  wired: false,
  snapshot: null,
  scenarioA: null,
  scenarioB: null,
  impact: null,
  clock: null,
  role: null,
  incidentId: null,
};

export function rootStoreDeps(): P5DepsAdapter {
  const boom = (): never => {
    throw new Error(NOT_WIRED);
  };
  return {
    wired: false,
    deps: {
      getSnapshot: boom,
      getScenario: boom,
      getActiveIncidentId: boom,
      getActiveIncident: boom,
      getImpact: boom,
      getDemoClockLocal: boom,
      getCurrentRole: boom,
      nowIso: boom,
      emit: boom,
    },
    subscribe: () => () => {},
    getView: () => NOT_WIRED_VIEW,
    setRole: boom,
    mockWorld: null,
  };
}

export function devMockDeps(world: MockWorld = createMockWorld()): P5DepsAdapter {
  let cachedVersion = -1;
  let cached: P5WorldView = NOT_WIRED_VIEW;
  return {
    wired: true,
    deps: world.deps,
    subscribe: world.subscribe,
    getView() {
      if (cachedVersion !== world.getVersion()) {
        const s = world.state;
        cached = {
          wired: true,
          snapshot: s.snapshot,
          scenarioA: s.scenarios.A,
          scenarioB: s.scenarios.B,
          impact: s.impact,
          clock: s.clock,
          role: s.role,
          incidentId: s.incidentId,
        };
        cachedVersion = world.getVersion();
      }
      return cached;
    },
    setRole: (role) => world.setRole(role),
    mockWorld: world,
  };
}

export interface P5Runtime {
  adapter: P5DepsAdapter;
  store: StoreApi<P5State>;
}

export function createP5Runtime(adapter: P5DepsAdapter): P5Runtime {
  return { adapter, store: createStore<P5State>()(createP5Slice(adapter.deps)) };
}

let defaultRuntime: P5Runtime | null = null;
/** Adapter chosen at startup: dev mocks behind the flag, otherwise the (not yet wired) root store. */
export function getDefaultP5Runtime(): P5Runtime {
  defaultRuntime ??= createP5Runtime(isP5DevMocksEnabled() ? devMockDeps() : rootStoreDeps());
  return defaultRuntime;
}

const P5RuntimeContext = createContext<P5Runtime | null>(null);

export function P5RuntimeProvider({ runtime, children }: { runtime: P5Runtime; children: ReactNode }) {
  return createElement(P5RuntimeContext.Provider, { value: runtime }, children);
}

export function useP5Runtime(): P5Runtime {
  return useContext(P5RuntimeContext) ?? getDefaultP5Runtime();
}

/** Zustand hook over the P5 slice of the active runtime. */
export function useP5Store<T>(selector: (s: P5State) => T): T {
  return useStore(useP5Runtime().store, selector);
}

/** Re-renders when the outside world (snapshot, scenarios, clock, role) changes. */
export function useP5World(): P5WorldView {
  const { adapter } = useP5Runtime();
  return useSyncExternalStore(adapter.subscribe, adapter.getView, adapter.getView);
}
