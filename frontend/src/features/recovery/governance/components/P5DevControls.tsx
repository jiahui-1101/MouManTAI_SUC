import { useState } from 'react';
import { seedEvidence } from '../../../../__dev__/p5MockWorld';
import { CHECKPOINTS, runCheckpoint } from '../demoCheckpoints';
import { useP5Runtime, useP5Ui } from '../p5Store';

/**
 * TEMPORARY dev / presenter panel standing in for the Integrator's debug panel.
 * Hidden entirely in presentation mode (the checkpoints stay reachable via Shift+1…6; "?" lists them).
 * TODO(G0): debug-panel ownership moves to the Integrator (markSnapshotChanged, ADVANCE_DEMO_CLOCK).
 */
export function P5DevControls() {
  const runtime = useP5Runtime();
  const { adapter, store } = runtime;
  const presentation = useP5Ui((s) => s.presentationMode);
  const [status, setStatus] = useState('');
  if (presentation || !adapter.wired) return null;
  const world = adapter.mockWorld;

  return (
    <details className="p5-dev" data-testid="p5-dev-controls">
      <summary>DEV CONTROLS — not part of demo product</summary>
      <div className="p5-row" data-testid="p5-checkpoints">
        <span className="p5-muted">Jump to demo state:</span>
        {CHECKPOINTS.map((cp, i) => (
          <button
            key={cp.id}
            type="button"
            className="p5-btn"
            title={`Shift+${i + 1}`}
            data-testid={`p5-checkpoint-${cp.id}`}
            onClick={() => {
              const res = runCheckpoint(cp.id, runtime);
              setStatus(res.ok ? `Demo state: ${cp.label}` : `Could not reach “${cp.label}”: ${res.detail}`);
            }}
          >
            {cp.label}
          </button>
        ))}
      </div>
      {status && (
        <p className="p5-muted" role="status" data-testid="p5-checkpoint-status">
          {status}
        </p>
      )}
      {world && (
        <>
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
            <span className="p5-muted">Evidence seeds:</span>
            {(
              [
                ['B_COMPLETE', 'Seed: B Complete'],
                ['B_PARTIAL', 'Seed: B Partial (3/4)'],
                ['A_COMPLETE', 'Seed: A Complete'],
                ['A_LATE', 'Seed: A Late (11:00)'],
                ['A_REJECTED', 'Seed: A Rejected'],
                ['FULFILMENT_SHORT', 'Seed: Shortfall (55/60)'],
              ] as const
            ).map(([seed, label]) => (
              <button key={seed} type="button" className="p5-btn" onClick={() => seedEvidence(store, world, seed)}>
                {label}
              </button>
            ))}
          </div>
          <div className="p5-row">
            <span className="p5-muted">Demo clock:</span>
            {['09:00', '10:44', '10:50'].map((t) => (
              <button key={t} type="button" className="p5-btn" onClick={() => world.setClock(t)}>
                Set clock {t}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="p5-row">
        <button
          type="button"
          className="p5-btn p5-btn--danger"
          onClick={() => {
            store.getState().p5.resetP5();
            world?.reset();
            setStatus('P5 reset.');
          }}
        >
          Reset P5
        </button>
      </div>
    </details>
  );
}
