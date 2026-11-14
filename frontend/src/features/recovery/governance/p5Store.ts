import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { createMockWorld, type MockWorld } from '../../../__dev__/p5MockWorld';
import type { DemoRole, ImpactSummaryLike, RecoveryScenarioWithActions, SnapshotRef } from './p5Contracts';
import type { P5Deps } from './p5Deps';
import { createRestaurantStoreAdapter, createRootStoreAdapter, type RootStoreContract } from './p5RootAdapter';
import { createP5Slice, type P5Data, type P5State } from './p5Slice';

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

/** In-memory presentation state. Lives on the runtime, so it survives in-app navigation between P5 pages. */
export interface P5UiState {
  presentationMode: boolean;
  shortcutsOpen: boolean;
  setPresentationMode(on: boolean): void;
  togglePresentationMode(): void;
  setShortcutsOpen(open: boolean): void;
}

export function createP5UiStore(initial: { presentationMode?: boolean } = {}): StoreApi<P5UiState> {
  return createStore<P5UiState>()((set) => ({
    presentationMode: initial.presentationMode ?? false,
    shortcutsOpen: false,
    setPresentationMode: (on) => set({ presentationMode: on }),
    togglePresentationMode: () => set((s) => ({ presentationMode: !s.presentationMode, shortcutsOpen: false })),
    setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  }));
}

export interface P5Runtime {
  adapter: P5DepsAdapter;
  store: StoreApi<P5State>;
  ui: StoreApi<P5UiState>;
}

export function createP5Runtime(adapter: P5DepsAdapter, ui: StoreApi<P5UiState> = createP5UiStore()): P5Runtime {
  return { adapter, store: createStore<P5State>()(createP5Slice(adapter.deps)), ui };
}

let defaultRuntime: P5Runtime | null = null;

const SESSION_KEY = 'moumantai_p5_demo_state';

function saveToSession(state: P5State): void {
  try {
    if (typeof window !== 'undefined' && !import.meta.env.VITEST && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.p5));
    }
  } catch {
    // ignore
  }
}

function loadFromSession(): Partial<P5Data> | null {
  try {
    if (typeof window !== 'undefined' && !import.meta.env.VITEST && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

/** Adapter chosen at startup: defaults to createRestaurantStoreAdapter() for live upstream workflow. */
export function getDefaultP5Runtime(): P5Runtime {
  if (!defaultRuntime) {
    const runtime = createP5Runtime(createRestaurantStoreAdapter());
    const saved = loadFromSession();
    if (saved) {
      try {
        runtime.store.setState((s) => ({ ...s, p5: { ...s.p5, ...saved } }));
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined' && !import.meta.env.VITEST) {
      runtime.store.subscribe((state) => {
        saveToSession(state);
      });
    }
    defaultRuntime = runtime;
  }
  return defaultRuntime;
}

export function resetDefaultP5Runtime(): void {
  defaultRuntime = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

const P5RuntimeContext = createContext<P5Runtime | null>(null);

export function P5RuntimeProvider({
  runtime,
  rootStore,
  children,
}: {
  runtime?: P5Runtime;
  rootStore?:
    | { getState: () => RootStoreContract; subscribe: (cb: () => void) => () => void; setState?: any }
    | (() => RootStoreContract)
    | null;
  children: ReactNode;
}) {
  const activeRuntime =
    runtime ??
    (rootStore
      ? createP5Runtime(createRootStoreAdapter(rootStore))
      : getDefaultP5Runtime());

  return createElement(
    P5RuntimeContext.Provider,
    { value: activeRuntime },
    !activeRuntime.adapter.wired
      ? createElement(
          'div',
          { className: 'p5-page' },
          createElement(
            'div',
            {
              className: 'p5-banner p5-banner--warn',
              role: 'status',
              'data-testid': 'p5-root-unwired-banner',
              style: { margin: '1rem 0' },
            },
            createElement('h3', null, 'P5 Root Store Integration Pending'),
            createElement(
              'p',
              null,
              'The root demo store has not been wired yet. Enable dev mocks with ',
              createElement('code', null, 'VITE_P5_DEV_MOCKS=true'),
              ' or supply a connected root store.',
            ),
          ),
          children,
        )
      : children,
  );
}

export function useP5Runtime(): P5Runtime {
  return useContext(P5RuntimeContext) ?? getDefaultP5Runtime();
}

/** Zustand hook over the P5 slice of the active runtime. */
export function useP5Store<T>(selector: (s: P5State) => T): T {
  return useStore(useP5Runtime().store, selector);
}

/** Presentation-mode flag and toggles (default OFF). */
export function useP5Ui<T>(selector: (s: P5UiState) => T): T {
  return useStore(useP5Runtime().ui, selector);
}

/** Re-renders when the outside world (snapshot, scenarios, clock, role) changes. */
export function useP5World(): P5WorldView {
  const { adapter } = useP5Runtime();
  return useSyncExternalStore(adapter.subscribe, adapter.getView, adapter.getView);
}
