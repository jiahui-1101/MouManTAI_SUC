import { useId, useState } from 'react';
import { Button, StatusBadge, DataPanel, AlertBanner } from '../../../../components/ui';
import { shortFingerprint } from '../format';
import type { DemoRole } from '../p5Contracts';
import { p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { ReasonDialog } from './Dialog';
import './p5.css';

const ROLES: DemoRole[] = ['Owner', 'OperationsManager', 'ProcurementOfficer', 'KitchenLead', 'ViewerAuditor'];

export function RoleSwitcher() {
  const w = useP5World();
  const { adapter } = useP5Runtime();
  const id = useId();
  return (
    <div className="fm-panel p5-card" data-testid="p5-role-switcher" style={{ padding: '12px 18px' }}>
      <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <span>Demo role — not real access control</span>
        </label>
        <select
          id={id}
          className="fm-select"
          value={w.role ?? ''}
          onChange={(e) => adapter.setRole(e.target.value as DemoRole)}
          style={{ minWidth: '180px' }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function NotWiredNotice() {
  return (
    <AlertBanner tone="warning" title="P5 Store Connection">
      P5 is not connected to the shared demo store yet (TODO(G0)). Waiting for Plan A and Plan B.
    </AlertBanner>
  );
}

export function LiveRegion({ message }: { message: string }) {
  return (
    <div aria-live="polite" role="status" className="p5-muted" data-testid="p5-live">
      {message}
    </div>
  );
}

/** Incident / snapshot header with truth-label badges and disclaimer. */
export function P5ContextHeader() {
  const w = useP5World();
  return (
    <DataPanel className="p5-card p5-stack p5-card--accent-brand">
      <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="p5-row">
          <span>
            Incident <strong className="p5-mono">{w.incidentId ?? '—'}</strong>
          </span>
          {w.snapshot && (
            <>
              <span>·</span>
              <span>
                Snapshot <strong className="p5-mono">{w.snapshot.id}</strong> rev {w.snapshot.revision}
              </span>
              <span>·</span>
              <span>
                Fingerprint{' '}
                <abbr className="p5-mono" title={w.snapshot.fingerprint}>
                  {shortFingerprint(w.snapshot.fingerprint)}
                </abbr>
              </span>
            </>
          )}
          {w.clock && (
            <>
              <span>·</span>
              <span>
                Demo clock <strong className="p5-mono">{w.clock}</strong>
              </span>
            </>
          )}
        </div>
      </div>
      <div className="p5-row" style={{ alignItems: 'center', gap: '8px' }}>
        <StatusBadge tone="simulated" title="SIMULATED_CALCULATION">
          SIMULATED_CALCULATION · Demo calculation
        </StatusBadge>
        <StatusBadge tone="neutral" title="SYNTHETIC_BUSINESS">
          SYNTHETIC_BUSINESS · Happy Potato • Demo data
        </StatusBadge>
      </div>
      <p className="p5-muted" style={{ fontSize: '12px' }}>
        Not a production food-safety or procurement authorization system.
      </p>
    </DataPanel>
  );
}

/** Shown on both pages while ESCALATED. Offers Revise constraints (requestRecalculation). */
export function EscalationPanel({ onMessage }: { onMessage: (m: string) => void }) {
  const p5 = useP5Store((s) => s.p5);
  const w = useP5World();
  const [open, setOpen] = useState(false);
  if (p5.escalationState !== 'ESCALATED') return null;
  const last = p5.escalations[p5.escalations.length - 1];
  const viewer = w.role === 'ViewerAuditor';
  return (
    <div className="p5-alert p5-alert--warn p5-stack fm-banner fm-banner--warning" role="region" aria-label="Escalation status">
      <h2>ESCALATED — both plans rejected</h2>
      <p>No plan will execute. No approval or task has been created.</p>
      {last && <p>Reason: {last.reason}</p>}
      {p5.recalculationRequestedSinceEscalation ? (
        <p>
          <strong>Recalculation requested from Plan A / Plan B owners.</strong> Choosing re-opens once they publish updated plans.
        </p>
      ) : (
        <div className="p5-row" style={{ marginTop: '4px' }}>
          <Button variant="secondary" disabled={viewer} onClick={() => setOpen(true)}>
            Revise constraints
          </Button>
          {viewer && <span className="p5-reason">ViewerAuditor is read-only.</span>}
        </div>
      )}
      {open && (
        <ReviseDialog
          onDone={(m) => {
            setOpen(false);
            if (m) onMessage(m);
          }}
        />
      )}
    </div>
  );
}

export function ReviseDialog({ onDone }: { onDone: (message: string | null) => void }) {
  const { store } = useP5Runtime();
  return (
    <ReasonDialog
      title="Revise constraints"
      description="Asks the Plan A and Plan B owners to recalculate. No numbers change here."
      confirmLabel="Request recalculation"
      onCancel={() => onDone(null)}
      onConfirm={(reason) => {
        const r = store.getState().p5.requestRecalculation(reason);
        if (!r.ok) return p5ErrorMessage(r.error, r.detail);
        onDone('Recalculation requested from Plan A / Plan B owners.');
        return null;
      }}
    />
  );
}

export function EscalateDialog({ onDone }: { onDone: (message: string | null) => void }) {
  const { store } = useP5Runtime();
  return (
    <ReasonDialog
      title="Reject both / Escalate"
      description="Neither plan will be approved or executed. The incident moves to ESCALATED."
      confirmLabel="Reject both and escalate"
      onCancel={() => onDone(null)}
      onConfirm={(reason) => {
        const r = store.getState().p5.rejectBothAndEscalate(reason);
        if (!r.ok) return p5ErrorMessage(r.error, r.detail);
        onDone('Escalated. No plan will execute.');
        return null;
      }}
    />
  );
}
