import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { isApprovalExpired, preflightApproval } from '../../../approvals/approvalLogic';
import { approvalKey } from '../../../approvals/idempotency';
import { formatKgMilli, formatSenAsRM, shortFingerprint } from '../format';
import type { ApprovalRecord, DemoRole, ProposedAction, RecoveryScenarioWithActions } from '../p5Contracts';
import { BENIGN_ERRORS, p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { Dialog, ReasonDialog } from './Dialog';
import { EscalateDialog, EscalationPanel, LiveRegion, NotWiredNotice, P5ContextHeader } from './common';
import { P5DevControls } from './P5DevControls';

const ROLES: DemoRole[] = ['Owner', 'OperationsManager', 'ProcurementOfficer', 'KitchenLead', 'ViewerAuditor'];

function scopeLine(a: ProposedAction, s: RecoveryScenarioWithActions): string {
  switch (a.actionType) {
    case 'PO_DRAFT':
      return `Create local PO draft for ${formatKgMilli(s.newPurchaseKgMilli)} — NOT sent to any supplier`;
    case 'RECEIPT_CHECK':
      return 'Monitor simulated receipt and quality check';
    case 'MENU_LIMIT_TASK':
      return `Menu limit task for ${a.targetId ?? 'menu item'} — awaiting manual update, not synced to any POS`;
    case 'PREP_BATCH_TASK':
      return `Prep batch ${a.targetId ?? ''} task`.replace('  ', ' ');
  }
}

function RoleSwitcher() {
  const w = useP5World();
  const { adapter } = useP5Runtime();
  const id = useId();
  return (
    <div className="p5-card">
      <label htmlFor={id}>Demo role — not real access control</label>
      <select id={id} value={w.role ?? ''} onChange={(e) => adapter.setRole(e.target.value as DemoRole)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

function History({ approvals, fingerprint, clock }: { approvals: ApprovalRecord[]; fingerprint: string; clock: string }) {
  return (
    <section className="p5-card p5-stack" aria-label="Approval history">
      <h2>Approval history</h2>
      {approvals.length === 0 ? (
        <p className="p5-muted">No approval decisions recorded yet.</p>
      ) : (
        <ul className="p5-stack" data-testid="approval-history">
          {approvals.map((a) => {
            const stale = a.snapshotFingerprint !== fingerprint;
            const expired = a.state === 'APPROVED' && isApprovalExpired(a, clock);
            const active = a.state === 'APPROVED' && !stale && !expired;
            return (
              <li key={a.id} className="p5-card" data-testid="approval-history-item">
                <div className="p5-row">
                  <span className={`p5-badge ${a.state === 'REJECTED' ? 'p5-badge--danger' : ''}`}>{expired ? 'EXPIRED' : a.state}</span>
                  {stale && <span className="p5-badge p5-badge--danger">STALE</span>}
                  {active && <span className="p5-badge p5-badge--brand">Active (simulated)</span>}
                  {!active && a.state === 'APPROVED' && <span className="p5-muted">Not active</span>}
                </div>
                <p className="p5-mono">
                  {a.scenarioId} · v{a.scenarioVersion} · {a.id}
                </p>
                <p>
                  {a.actorRole} ({a.actorId}) · {a.createdAtIso}
                </p>
                <p>Reason: {a.reason}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ApprovalsView() {
  const w = useP5World();
  const { store, adapter } = useP5Runtime();
  const p5 = useP5Store((s) => s.p5);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'confirm' | 'reject' | 'escalate' | null>(null);
  const busy = useRef(false);
  const [inFlight, setInFlight] = useState(false);
  const reasonId = useId();

  if (!w.wired || !w.snapshot || !w.clock) {
    return (
      <div className="p5">
        <P5ContextHeader />
        <NotWiredNotice />
      </div>
    );
  }
  const snapshot = w.snapshot;
  const clock = w.clock;
  const incidentApprovals = p5.approvals.filter((a) => a.incidentId === w.incidentId);
  const history = <History approvals={incidentApprovals} fingerprint={snapshot.fingerprint} clock={clock} />;
  const sel = p5.selection;

  const page = (body: React.ReactNode) => (
    <div className="p5">
      <P5DevControls />
      <P5ContextHeader />
      <RoleSwitcher />
      {body}
      {error && (
        <div className="p5-alert p5-alert--danger" role="alert">
          {error}
        </div>
      )}
      <LiveRegion message={message} />
      {history}
      {dialog === 'escalate' && (
        <EscalateDialog
          onDone={(m) => {
            setDialog(null);
            if (m) setMessage(m);
          }}
        />
      )}
    </div>
  );

  if (!sel) {
    if (p5.escalationState === 'ESCALATED') return page(<EscalationPanel onMessage={setMessage} />);
    return page(
      <div className="p5-card p5-stack" data-testid="no-selection">
        <p>No plan selected. Choose a plan on Recovery Comparison first.</p>
        <Link to="/recovery/compare">Go to Recovery Comparison</Link>
      </div>,
    );
  }

  const scenario = sel.strategy === 'A' ? w.scenarioA : w.scenarioB;
  const existing = p5.approvals.find(
    (a) => a.state === 'APPROVED' && a.idempotencyKey === approvalKey(sel.scenarioId, sel.version, sel.fingerprint),
  );
  if (existing) {
    const tasks = p5.actions.filter((t) => t.approvalId === existing.id);
    return page(
      <div className="p5-alert p5-alert--ok p5-stack" data-testid="approval-success">
        <h2>Approved (simulated). {tasks.length} tasks created — not executed yet.</h2>
        <p className="p5-mono">Approval {existing.id}</p>
        <p>
          Execution is a separate step. <Link to="/execution">Go to Execution</Link>
        </p>
      </div>,
    );
  }

  const blocker = preflightApproval(p5, adapter.deps);
  const viewer = w.role === 'ViewerAuditor';
  const reasonMissing = !reason.trim();
  const approveDisabled = blocker !== null || reasonMissing || inFlight;
  const decisionBlocked = blocker !== null && blocker.error !== 'APPROVAL_EXPIRED';

  const doApprove = () => {
    if (busy.current) return;
    busy.current = true;
    setInFlight(true);
    try {
      const r = store.getState().p5.approveDemoScenario(reason, sel.version, sel.fingerprint);
      setDialog(null);
      if (r.ok) {
        setError(null);
        setReason('');
        setMessage(`Approved (simulated). ${r.value.actions.length} tasks created — not executed yet.`);
      } else if (!BENIGN_ERRORS.has(r.error)) {
        setError(p5ErrorMessage(r.error, r.detail));
      }
    } finally {
      busy.current = false;
      setInFlight(false);
    }
  };

  return page(
    <>
      <section className="p5-card p5-stack" aria-label="Approval request">
        <h2>Approval request — Plan {sel.strategy}</h2>
        <table className="p5-table">
          <tbody>
            <tr>
              <th scope="row">Incident</th>
              <td className="p5-mono">{sel.incidentId}</td>
            </tr>
            <tr>
              <th scope="row">Scenario</th>
              <td className="p5-mono">
                {sel.scenarioId} · v{sel.version}
              </td>
            </tr>
            <tr>
              <th scope="row">Snapshot</th>
              <td className="p5-mono">
                {snapshot.id} rev {snapshot.revision} · <abbr title={sel.fingerprint}>{shortFingerprint(sel.fingerprint)}</abbr>
              </td>
            </tr>
            {scenario && scenario.id === sel.scenarioId && (
              <>
                <tr>
                  <th scope="row">New purchase</th>
                  <td>{formatKgMilli(scenario.newPurchaseKgMilli)}</td>
                </tr>
                <tr>
                  <th scope="row">Additional cost</th>
                  <td>{formatSenAsRM(scenario.additionalCostSen)}</td>
                </tr>
                <tr>
                  <th scope="row">Confirmed chicken portions protected</th>
                  <td>{scenario.confirmedChickenPortionsProtected}</td>
                </tr>
                <tr>
                  <th scope="row">Chicken forecast portions unmet</th>
                  <td>{scenario.forecastChickenPortionsUnmet} (forecast only)</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {scenario && (
          <div>
            <h3>Action scope ({scenario.proposedActions.length} actions)</h3>
            <ul className="p5-list" data-testid="action-scope">
              {scenario.proposedActions.map((a, i) => (
                <li key={`${a.actionType}-${a.targetId ?? i}`}>{scopeLine(a, scenario)}</li>
              ))}
            </ul>
          </div>
        )}
        <p>
          <strong>External effects: none — simulation only.</strong>
        </p>
        <p>
          {sel.strategy === 'A'
            ? `Valid until demo clock 10:45 (prep cutoff). Current demo clock: ${clock}.`
            : 'No time-based expiry; invalidated by snapshot change.'}
        </p>

        {blocker && (
          <div className="p5-alert p5-alert--danger" role="alert" data-testid="approval-blocker">
            <strong>{blocker.error}</strong>: {p5ErrorMessage(blocker.error, blocker.detail)}
          </div>
        )}

        <label htmlFor={reasonId}>Approval reason (required)</label>
        <textarea id={reasonId} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={`${reasonId}-hint`} />
        {reasonMissing && (
          <p id={`${reasonId}-hint`} className="p5-reason">
            A reason is required before approving.
          </p>
        )}

        <div className="p5-row">
          <button type="button" className="p5-btn p5-btn--primary" disabled={approveDisabled} onClick={() => setDialog('confirm')}>
            Approve
          </button>
          <button type="button" className="p5-btn" disabled={decisionBlocked || viewer} onClick={() => setDialog('reject')}>
            Reject
          </button>
          <button type="button" className="p5-btn p5-btn--danger" disabled={viewer} onClick={() => setDialog('escalate')}>
            Escalate
          </button>
          {(decisionBlocked || viewer) && <span className="p5-reason">Reject unavailable: {viewer ? 'ViewerAuditor is read-only.' : 'see blocker above.'}</span>}
        </div>
      </section>

      {dialog === 'confirm' && (
        <Dialog title="Confirm simulated approval" onClose={() => setDialog(null)}>
          <p>
            Approve <span className="p5-mono">{sel.scenarioId}</span> version {sel.version} with{' '}
            {scenario?.proposedActions.length ?? 0} actions? Tasks are created but not executed. No external effects.
          </p>
          <div className="p5-row">
            <button type="button" className="p5-btn p5-btn--primary" disabled={inFlight} onClick={doApprove}>
              Confirm approval
            </button>
            <button type="button" className="p5-btn" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}
      {dialog === 'reject' && (
        <ReasonDialog
          title={`Reject Plan ${sel.strategy}`}
          description={`Records a REJECTED decision for ${sel.scenarioId} v${sel.version}. No tasks are created.`}
          confirmLabel="Reject plan"
          onCancel={() => setDialog(null)}
          onConfirm={(r) => {
            const res = store.getState().p5.rejectSelectedScenario(r);
            if (!res.ok) return p5ErrorMessage(res.error, res.detail);
            setDialog(null);
            setMessage(`Plan ${sel.strategy} rejected. Selection cleared.`);
            return null;
          }}
        />
      )}
    </>,
  );
}
