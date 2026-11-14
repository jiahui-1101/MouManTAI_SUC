import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatusBadge, AlertBanner } from '../../../../components/ui';
import { isApprovalExpired, preflightApproval } from '../../../approvals/approvalLogic';
import { approvalKey } from '../../../approvals/idempotency';
import { formatKgMilli, formatSenAsRM, shortFingerprint } from '../format';
import type { ApprovalRecord, ProposedAction, RecoveryScenarioWithActions, ScenarioStrategy } from '../p5Contracts';
import { BENIGN_ERRORS, p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { Dialog, ReasonDialog } from './Dialog';
import { EscalateDialog, EscalationPanel, LiveRegion, NotWiredNotice } from './common';
import { RecoveryWorkflowHeader } from './RecoveryWorkflowHeader';
import { P5DevControls } from './P5DevControls';
import './p5.css';

const STRATEGY_TITLE: Record<ScenarioStrategy, string> = {
  A: 'Plan A — Buy replacement chicken',
  B: 'Plan B — Protect orders with existing stock',
};

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

function HistoryItem({
  record: a,
  fingerprint,
  clock,
  scenarioA,
  scenarioB,
}: {
  record: ApprovalRecord;
  fingerprint: string;
  clock: string;
  scenarioA: RecoveryScenarioWithActions | null;
  scenarioB: RecoveryScenarioWithActions | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const stale = a.snapshotFingerprint !== fingerprint;
  const expired = a.state === 'APPROVED' && isApprovalExpired(a, clock);
  const active = a.state === 'APPROVED' && !stale && !expired;

  const chosenStrategy = a.selectedStrategy;
  const unchosenStrategy: ScenarioStrategy = chosenStrategy === 'A' ? 'B' : 'A';
  const chosenScenario = chosenStrategy === 'A' ? scenarioA : scenarioB;
  const unchosenScenario = unchosenStrategy === 'A' ? scenarioA : scenarioB;

  return (
    <li className="p5-card p5-history-item" data-testid="approval-history-item">
      <div className="p5-history-header">
        <div className="p5-row">
          <StatusBadge tone={a.state === 'REJECTED' || expired ? 'danger' : 'neutral'}>
            {expired ? 'EXPIRED' : a.state}
          </StatusBadge>
          {stale && <StatusBadge tone="danger">STALE</StatusBadge>}
          {active && <StatusBadge tone="simulated">Active (simulated)</StatusBadge>}
          {!active && a.state === 'APPROVED' && <span className="p5-muted">Not active</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="p5-details-toggle"
        >
          {expanded ? 'Hide details ▴' : 'Show details ▸'}
        </Button>
      </div>

      <p className="p5-mono">
        {a.scenarioId} · v{a.scenarioVersion} · {a.id}
      </p>
      <p>
        {a.actorRole} ({a.actorId}) · {a.createdAtIso}
      </p>
      <p>Reason: {a.reason}</p>

      {expanded && (
        <div className="p5-history-details">
          <div className="p5-history-plans-grid">
            {/* Chosen Plan Summary */}
            <div className="p5-history-plan p5-history-plan--chosen p5-stack">
              <div className="p5-row" style={{ justifyContent: 'space-between' }}>
                <h4>Chosen Plan — Plan {chosenStrategy}</h4>
                <StatusBadge tone="simulated">Chosen</StatusBadge>
              </div>
              <p className="p5-muted">{STRATEGY_TITLE[chosenStrategy]}</p>
              <div className="p5-stack" style={{ gap: '6px', fontSize: '13px' }}>
                <div>
                  Scenario: <strong className="p5-mono">{a.scenarioId} · v{a.scenarioVersion}</strong>
                </div>
                <div>
                  Feasibility: <strong>{a.predicted.feasibility}</strong>
                </div>
                <div>
                  New purchase: <strong>{formatKgMilli(a.predicted.newPurchaseKgMilli)}</strong>
                </div>
                <div>
                  Projected additional cost: <strong>{formatSenAsRM(a.predicted.additionalCostSen)}</strong>
                </div>
                <div>
                  Portions served / unmet:{' '}
                  <strong>
                    {a.predicted.forecastChickenPortionsServed} served / {a.predicted.forecastChickenPortionsUnmet} unmet
                  </strong>
                </div>
                <div>
                  Confirmed portions protected: <strong>{a.predicted.confirmedChickenPortionsProtected}</strong>
                </div>
                <div>
                  Approved actions:{' '}
                  <strong>
                    {a.approvedActionTypes.length > 0 ? a.approvedActionTypes.join(', ') : 'None'}
                  </strong>
                </div>
                {chosenScenario && chosenScenario.assumptions.length > 0 && (
                  <div>
                    <span className="p5-muted">Key assumptions:</span>
                    <ul className="p5-list" style={{ marginTop: '4px' }}>
                      {chosenScenario.assumptions.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Unchosen Plan Summary */}
            <div className="p5-history-plan p5-history-plan--unchosen p5-stack">
              <div className="p5-row" style={{ justifyContent: 'space-between' }}>
                <h4>Alternative Plan — Plan {unchosenStrategy}</h4>
                <StatusBadge tone="neutral">Not chosen</StatusBadge>
              </div>
              {unchosenScenario ? (
                <>
                  <p className="p5-muted">{STRATEGY_TITLE[unchosenStrategy]}</p>
                  <div className="p5-stack" style={{ gap: '6px', fontSize: '13px' }}>
                    <div>
                      Scenario: <strong className="p5-mono">{unchosenScenario.id} · v{unchosenScenario.version}</strong>
                    </div>
                    <div>
                      Feasibility: <strong>{unchosenScenario.feasibility}</strong>
                    </div>
                    <div>
                      New purchase: <strong>{formatKgMilli(unchosenScenario.newPurchaseKgMilli)}</strong>
                    </div>
                    <div>
                      Projected additional cost: <strong>{formatSenAsRM(unchosenScenario.additionalCostSen)}</strong>
                    </div>
                    <div>
                      Portions served / unmet:{' '}
                      <strong>
                        {unchosenScenario.forecastChickenPortionsServed} served /{' '}
                        {unchosenScenario.forecastChickenPortionsUnmet} unmet
                      </strong>
                    </div>
                    <div>
                      Confirmed portions protected: <strong>{unchosenScenario.confirmedChickenPortionsProtected}</strong>
                    </div>
                    <p className="p5-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                      Decision Trade-off: Plan {chosenStrategy} was selected over Plan {unchosenStrategy} for operational
                      suitability and inventory availability.
                    </p>
                  </div>
                </>
              ) : (
                <p className="p5-muted">
                  Alternative plan details are unavailable for this historical snapshot.
                </p>
              )}
            </div>
          </div>

          {/* Governance & Audit Metadata */}
          <div className="p5-history-audit p5-stack">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h4>Governance & Audit Metadata</h4>
              <StatusBadge tone="simulated">SIMULATED_ACTION</StatusBadge>
            </div>
            <div className="p5-history-meta-grid">
              <div>
                <span className="p5-muted">Incident ID: </span>
                <strong className="p5-mono">{a.incidentId}</strong>
              </div>
              <div>
                <span className="p5-muted">Approval ID: </span>
                <strong className="p5-mono">{a.id}</strong>
              </div>
              <div>
                <span className="p5-muted">Snapshot Fingerprint: </span>
                <abbr className="p5-mono" title={a.snapshotFingerprint}>
                  {shortFingerprint(a.snapshotFingerprint)}
                </abbr>
              </div>
              <div>
                <span className="p5-muted">Actor: </span>
                <strong>{a.actorRole}</strong> ({a.actorId})
              </div>
              <div>
                <span className="p5-muted">Recorded at: </span>
                <span className="p5-mono">{a.createdAtIso}</span>
              </div>
              <div>
                <span className="p5-muted">Expiry: </span>
                <span className="p5-mono">{a.expiresAtIso ?? 'No time-based expiry (snapshot bound)'}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="p5-muted">Approval reason: </span>
                <em>"{a.reason}"</em>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function History({
  approvals,
  fingerprint,
  clock,
  scenarioA,
  scenarioB,
}: {
  approvals: ApprovalRecord[];
  fingerprint: string;
  clock: string;
  scenarioA: RecoveryScenarioWithActions | null;
  scenarioB: RecoveryScenarioWithActions | null;
}) {
  return (
    <section className="fm-panel p5-card p5-stack" aria-label="Approval history">
      <div className="p5-row" style={{ justifyContent: 'space-between' }}>
        <h2>Approval history</h2>
        <span className="p5-badge fm-badge">{approvals.length} record{approvals.length === 1 ? '' : 's'}</span>
      </div>
      {approvals.length === 0 ? (
        <p className="p5-muted">No approval decisions recorded yet.</p>
      ) : (
        <ul className="p5-stack" data-testid="approval-history" style={{ listStyle: 'none', padding: 0 }}>
          {approvals.map((a) => (
            <HistoryItem
              key={a.id}
              record={a}
              fingerprint={fingerprint}
              clock={clock}
              scenarioA={scenarioA}
              scenarioB={scenarioB}
            />
          ))}
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
        <RecoveryWorkflowHeader currentStep="approvals" />
        <NotWiredNotice />
      </div>
    );
  }
  const snapshot = w.snapshot;
  const clock = w.clock;
  const incidentApprovals = p5.approvals.filter((a) => a.incidentId === w.incidentId);
  const history = (
    <History
      approvals={incidentApprovals}
      fingerprint={snapshot.fingerprint}
      clock={clock}
      scenarioA={w.scenarioA}
      scenarioB={w.scenarioB}
    />
  );
  const sel = p5.selection;

  const page = (body: React.ReactNode) => (
    <div className="p5">
      <P5DevControls />
      <RecoveryWorkflowHeader currentStep="approvals" />
      {body}
      {error && (
        <AlertBanner tone="danger" title="Error">
          {error}
        </AlertBanner>
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
    const isEscalated = p5.escalationState === 'ESCALATED';
    const lastApproval = p5.approvals[p5.approvals.length - 1];
    const isRejected = lastApproval?.state === 'REJECTED';

    if (isEscalated) {
      return page(
        <div className="p5-stack">
          <EscalationPanel onMessage={setMessage} />
          <div className="p5-row" style={{ marginTop: '8px' }}>
            <Link
              to="/recovery/compare"
              className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
              data-testid="p5-next-step-cta"
            >
              Back to Comparison
            </Link>
          </div>
        </div>,
      );
    }

    return page(
      <div className="fm-panel p5-card p5-stack" data-testid="no-selection">
        <p>No plan selected. Choose a plan on Recovery Comparison first.</p>
        <div>
          <Link
            to="/recovery/compare"
            className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
            data-testid={isRejected ? 'p5-next-step-cta' : undefined}
          >
            {isRejected ? 'Back to Comparison' : 'Go to Recovery Comparison →'}
          </Link>
        </div>
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
      <div className="p5-alert p5-alert--ok p5-stack fm-banner fm-banner--info" data-testid="approval-success">
        <h2>Approved (simulated). {tasks.length} tasks created — not executed yet.</h2>
        <p className="p5-mono">Approval {existing.id}</p>
        <p>Execution is a separate step.</p>
        <div>
          <Link
            to="/execution"
            className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
            data-testid="p5-next-step-cta"
          >
            Continue to Execution →
          </Link>
        </div>
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
      <section className="fm-panel p5-card p5-card--accent-brand p5-stack" aria-label="Approval request">
        <div className="p5-row" style={{ justifyContent: 'space-between' }}>
          <h2>Approval request — Plan {sel.strategy}</h2>
          <StatusBadge tone="simulated">Pending approval</StatusBadge>
        </div>
        <div className="fm-table-wrap p5-table-wrap" role="region" aria-label="Approval request details" tabIndex={0}>
          <table className="fm-table p5-table">
            <caption className="p2-sr sr-only">Approval request details</caption>
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
        </div>

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
          <div className="p5-alert p5-alert--danger fm-banner fm-banner--danger" role="alert" data-testid="approval-blocker">
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
          <Button variant="primary" disabled={approveDisabled} onClick={() => setDialog('confirm')}>
            Approve
          </Button>
          <Button variant="secondary" disabled={decisionBlocked || viewer} onClick={() => setDialog('reject')}>
            Reject
          </Button>
          <Button variant="danger" disabled={viewer} onClick={() => setDialog('escalate')}>
            Escalate
          </Button>
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
            <Button variant="primary" disabled={inFlight} onClick={doApprove}>
              Confirm approval
            </Button>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
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
    </>
  );
}
