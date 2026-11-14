/** Test-only harness: a standalone store wired to fake, mutable deps. Not imported by app code. */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEV_INCIDENT_ID, DEV_SNAPSHOT, devScenarioA, devScenarioB } from '../../../__dev__/mockScenarios';
import type { DemoRole, P5Event, RecoveryScenarioWithActions, SnapshotRef } from './p5Contracts';
import type { P5Deps } from './p5Deps';
import { createP5Slice, type P5State } from './p5Slice';

export interface Harness {
  store: StoreApi<P5State>;
  p5: () => P5State['p5'];
  state: () => P5State;
  events: P5Event[];
  env: {
    snapshot: SnapshotRef;
    scenarios: { A: RecoveryScenarioWithActions | null; B: RecoveryScenarioWithActions | null };
    clock: string;
    role: DemoRole;
    actorId: string;
    incidentId: string | null;
    tick: number;
  };
  /** Simulates P2 marking a material snapshot change (new fingerprint, scenarios become stale). */
  changeSnapshot(fingerprint: string): void;
}

export function makeHarness(opts: { A?: boolean; B?: boolean } = {}): Harness {
  const env: Harness['env'] = {
    snapshot: { ...DEV_SNAPSHOT },
    scenarios: { A: opts.A === false ? null : devScenarioA(), B: opts.B === false ? null : devScenarioB() },
    clock: '09:00',
    role: 'Owner',
    actorId: 'demo-owner',
    incidentId: DEV_INCIDENT_ID,
    tick: 0,
  };
  const events: P5Event[] = [];
  const deps: P5Deps = {
    getSnapshot: () => env.snapshot,
    getScenario: (s) => env.scenarios[s],
    getActiveIncidentId: () => env.incidentId,
    getImpact: () => null,
    getDemoClockLocal: () => env.clock,
    getCurrentRole: () => ({ role: env.role, actorId: env.actorId }),
    nowIso: () => `2026-11-21T09:00:${String(env.tick++ % 60).padStart(2, '0')}+08:00`,
    emit: (e) => events.push(e),
  };
  const store = createStore<P5State>()(createP5Slice(deps));
  return {
    store,
    p5: () => store.getState().p5,
    state: () => store.getState(),
    events,
    env,
    changeSnapshot(fingerprint) {
      env.snapshot = { ...env.snapshot, fingerprint, revision: env.snapshot.revision + 1 };
    },
  };
}

/** Selects + approves the plan as Owner; returns approval id. Throws on failure (test helper only). */
export function approve(h: Harness, strategy: 'A' | 'B'): string {
  const sel = h.p5().chooseRecoveryScenario(strategy);
  if (!sel.ok) throw new Error(sel.error);
  const res = h.p5().approveDemoScenario('approve for demo', sel.value.version, sel.value.fingerprint);
  if (!res.ok) throw new Error(`${res.error}: ${res.detail}`);
  return res.value.approval.id;
}
