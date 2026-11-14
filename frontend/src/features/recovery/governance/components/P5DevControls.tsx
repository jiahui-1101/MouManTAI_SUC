import { useP5Runtime } from '../p5Store';

/**
 * TEMPORARY dev panel standing in for the Integrator's debug panel.
 * TODO(G0): debug-panel ownership moves to the Integrator (markSnapshotChanged, ADVANCE_DEMO_CLOCK).
 */
export function P5DevControls() {
  const { adapter, store } = useP5Runtime();
  const world = adapter.mockWorld;
  if (!world) return null;
  return (
    <details className="p5-dev" data-testid="p5-dev-controls">
      <summary>DEV CONTROLS — not part of demo product</summary>
      <div className="p5-row">
        <button type="button" className="p5-btn" onClick={() => world.changeFingerprint()}>
          Change snapshot fingerprint
        </button>
        <button type="button" className="p5-btn" onClick={() => world.publishNextVersion('A')}>
          Publish Plan A version + 1
        </button>
        <button type="button" className="p5-btn" onClick={() => world.publishNextVersion('B')}>
          Publish Plan B version + 1
        </button>
        <button type="button" className="p5-btn" onClick={() => world.removePlan('A')}>
          Remove Plan A
        </button>
        <button type="button" className="p5-btn" onClick={() => world.removePlan('B')}>
          Remove Plan B
        </button>
      </div>
      <div className="p5-row">
        <span className="p5-muted">Demo clock:</span>
        {['09:00', '10:44', '10:50'].map((t) => (
          <button key={t} type="button" className="p5-btn" onClick={() => world.setClock(t)}>
            Set clock {t}
          </button>
        ))}
        <button
          type="button"
          className="p5-btn p5-btn--danger"
          onClick={() => {
            store.getState().p5.resetP5();
            world.reset();
          }}
        >
          Reset P5
        </button>
      </div>
    </details>
  );
}
