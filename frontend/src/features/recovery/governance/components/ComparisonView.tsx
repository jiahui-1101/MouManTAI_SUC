import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatusBadge, AlertBanner } from '../../../../components/ui';
import { formatKgMilli, formatSenAsRM } from '../format';
import { publishPlanAFromShared } from '../p5RootAdapter';
import { isScenarioInfeasible, type RecoveryScenarioWithActions, type ScenarioStrategy, type SnapshotRef } from '../p5Contracts';
import { approvalKey } from '../../../approvals/idempotency';
import { FEASIBILITY_LABELS } from '../labels';
import { BENIGN_ERRORS, p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { selectComparisonReadiness, selectIsScenarioStale } from '../selectors';
import {
  EscalateDialog,
  EscalationPanel,
  LiveRegion,
  NotWiredNotice,
  ReviseDialog,
} from './common';
import { RecoveryWorkflowHeader } from './RecoveryWorkflowHeader';
import { P5DevControls } from './P5DevControls';
import './p5.css';

const STRATEGY_TITLE: Record<ScenarioStrategy, string> = {
  A: 'Plan A — Buy replacement chicken',
  B: 'Plan B — Protect orders with existing stock',
};

const STRATEGY_BADGE: Record<ScenarioStrategy, { label: string; tone: 'info' | 'simulated' }> = {
  A: { label: 'External Supplier Sourcing', tone: 'info' },
  B: { label: 'Internal Stock & Prep', tone: 'simulated' },
};

const PLAN_ROUTE: Record<ScenarioStrategy, string> = { A: '/recovery/plan-a', B: '/recovery/plan-b' };

function feasibilityReason(s: RecoveryScenarioWithActions): string {
  switch (s.feasibility) {
    case 'CONDITIONAL':
      return 'until supplier receipt, spec and timing are verified';
    case 'FEASIBLE':
      return 'within synthetic scenario assumptions';
    case 'INFEASIBLE':
      return 'plan owner reports this plan cannot be carried out';
    case 'UNKNOWN':
      return 'plan owner could not determine feasibility';
  }
}

const isHardBlocked = (s: RecoveryScenarioWithActions) => isScenarioInfeasible(s.feasibility);

function RowHeader({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="p5-th-content">
      <span className="p5-th-label">{label}</span>
      <span
        tabIndex={0}
        role="button"
        className="p5-tooltip-trigger"
        aria-label={`${label}: ${tooltip}`}
        title={tooltip}
      >
        <span aria-hidden="true">ⓘ</span>
        <span className="p5-tooltip-bubble" role="tooltip">
          {tooltip}
        </span>
      </span>
    </div>
  );
}

function ImpactStrip() {
  const { impact } = useP5World();
  if (!impact) {
    return (
      <div role="region" aria-label="Impact context" style={{ marginBottom: '16px' }}>
        <AlertBanner tone="info" title="Impact context">
          Impact summary not available yet.
        </AlertBanner>
      </div>
    );
  }
  return (
    <div className="p5-stack" role="region" aria-label="Impact context">
      <div className="p5-grid2">
        <div className="fm-panel p5-card p5-card--accent-warn p5-impact-card" data-testid="impact-po-shortfall">
          <div className="p5-row" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
            <span className="p5-badge p5-badge--warn">Supplier shortfall</span>
          </div>
          <h3>Supplier won&apos;t deliver: {formatKgMilli(impact.poShortfallKgMilli ?? 0)}</h3>
          <p className="p5-muted p5-impact-sub">
            {impact.poId ?? 'The PO'} expected {formatKgMilli(impact.poExpectedKgMilli ?? 0)}, supplier says{' '}
            {formatKgMilli(impact.poClaimedKgMilli ?? 0)} today
          </p>
        </div>
        <div className="fm-panel p5-card p5-card--accent-info p5-impact-card" data-testid="impact-forecast-gap">
          <div className="p5-row" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
            <span className="p5-badge p5-badge--info">Forecast gap</span>
          </div>
          <h3>Actually short for today&apos;s forecast: {formatKgMilli(impact.forecastGapKgMilli ?? impact.demandGapKgMilli ?? 0)}</h3>
          <p className="p5-muted p5-impact-sub">After counting chicken already accepted on hand</p>
        </div>
      </div>
    </div>
  );
}

function PlanRows({ s }: { s: RecoveryScenarioWithActions }) {
  const cond = s.feasibility === 'CONDITIONAL' ? ' (conditional)' : '';
  const a = s.strategy === 'A';
  return (
    <div
      className="p5-compare-table-wrap fm-table-wrap"
      role="region"
      aria-label={`Metrics for ${STRATEGY_TITLE[s.strategy]}`}
      tabIndex={0}
    >
      <table className="p5-compare-table fm-table">
        <caption className="p2-sr sr-only">Metrics for {STRATEGY_TITLE[s.strategy]}</caption>
        <tbody>
          <tr>
            <th scope="row">
              <RowHeader label="Strategy" tooltip="Recovery strategy name and operational approach" />
            </th>
            <td>{STRATEGY_TITLE[s.strategy]}</td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader label="Feasibility" tooltip="Feasibility status under current synthetic operational constraints" />
            </th>
            <td>
              <strong title={s.feasibility}>{FEASIBILITY_LABELS[s.feasibility].label}</strong> — {feasibilityReason(s)}
            </td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader label="New purchase" tooltip="New purchase quantity required for recovery" />
            </th>
            <td>{a ? `${formatKgMilli(s.newPurchaseKgMilli)} chilled chicken` : formatKgMilli(s.newPurchaseKgMilli)}</td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader label="Additional cost" tooltip="Projected additional landed cost for this recovery strategy" />
            </th>
            <td>
              {a
                ? `${formatSenAsRM(s.additionalCostSen)} projected additional landed cost`
                : `${formatSenAsRM(s.additionalCostSen)} new purchase (not total operating cost)`}
            </td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader label="Forecast served" tooltip="Chicken forecast portions served under this plan" />
            </th>
            <td>{a ? `${s.forecastChickenPortionsServed}${cond}` : `${s.forecastChickenPortionsServed} planned`}</td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader
                label="Forecast unmet"
                tooltip="Chicken forecast portions unmet (forecast demand gap only, not order breaches)"
              />
            </th>
            <td>
              {a
                ? `${s.forecastChickenPortionsUnmet}${cond}`
                : `${s.forecastChickenPortionsUnmet} — forecast only, not confirmed-order breaches`}
            </td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader
                label="Confirmed protected"
                tooltip="Confirmed chicken portions protected for existing orders"
              />
            </th>
            <td>{a ? `${s.confirmedChickenPortionsProtected}${cond}` : `${s.confirmedChickenPortionsProtected} planned`}</td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader label="Assumptions" tooltip="Key operational conditions and assumptions set by the plan owner" />
            </th>
            <td>
              {s.assumptions.length ? (
                <ul className="p5-list">
                  {s.assumptions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <span className="p5-muted">None listed by plan owner</span>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">
              <RowHeader label="Scenario / version" tooltip="Scenario identifier, version, and referenced evidence" />
            </th>
            <td className="p5-mono" title={`${s.id} · v${s.version}`}>
              Version {s.version}
              {s.evidenceRefs.length > 0 && ` · refs ${s.evidenceRefs.join(', ')}`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlanDetails({ strategy, scenario, snapshot }: { strategy: ScenarioStrategy; scenario: RecoveryScenarioWithActions | null; snapshot: SnapshotRef }) {
  const isA = strategy === 'A';
  if (!scenario) {
    return (
      <section className={`fm-panel p5-card p5-compare-card ${isA ? 'p5-compare-card--plan-a' : 'p5-compare-card--plan-b'}`} data-testid={`plan-${strategy}-details`}>
        <h3>Plan {strategy} not ready</h3>
      </section>
    );
  }
  const stale = selectIsScenarioStale(scenario, snapshot);
  return (
    <section
      className={`fm-panel p5-card p5-compare-card ${isA ? 'p5-compare-card--plan-a' : 'p5-compare-card--plan-b'}`}
      aria-label={`Plan ${strategy} details`}
      data-testid={`plan-${strategy}-details`}
    >
      <div className={`p5-compare-header ${isA ? 'p5-compare-header--plan-a' : 'p5-compare-header--plan-b'}`}>
        <div className="p5-row">
          <StatusBadge tone={STRATEGY_BADGE[strategy].tone}>{STRATEGY_BADGE[strategy].label}</StatusBadge>
          <h3>{STRATEGY_TITLE[strategy]}</h3>
          {stale && (
            <StatusBadge tone="danger" title="STALE_SCENARIO">
              Numbers changed — recalculation required
            </StatusBadge>
          )}
        </div>
      </div>
      <PlanRows s={scenario} />
      {isHardBlocked(scenario) && (
        <div style={{ marginTop: '12px' }}>
          <AlertBanner tone="danger" title="Hard blocker">
            <p>
              {FEASIBILITY_LABELS[scenario.feasibility].label}: {feasibilityReason(scenario)}.
            </p>
            {scenario.assumptions.length > 0 && (
              <ul className="p5-list">
                {scenario.assumptions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </AlertBanner>
        </div>
      )}
    </section>
  );
}

/** "What you give up", built only from the scenario's own numbers and assumption text. */
export function giveUpLine(s: RecoveryScenarioWithActions): string {
  if (s.strategy === 'A') {
    const deadline = s.assumptions.map((a) => a.match(/\b(\d{2}:\d{2})\b/)?.[1]).find(Boolean);
    const chilled = s.assumptions.some((a) => /chilled/i.test(a)) ? ' chilled' : '';
    const kg = formatKgMilli(s.newPurchaseKgMilli);
    return `${formatSenAsRM(s.additionalCostSen)} and depends on ${kg}${chilled} chicken arriving and passing checks ${
      deadline ? `by ${deadline}` : 'before the prep cutoff'
    }`;
  }
  return s.forecastChickenPortionsUnmet > 0
    ? `${s.forecastChickenPortionsUnmet} forecast portions can't be offered today (forecast, not customer orders)`
    : 'No forecast portions given up';
}

function DecisionCard(props: {
  strategy: ScenarioStrategy;
  scenario: RecoveryScenarioWithActions | null;
  snapshot: SnapshotRef;
  blockedReason: string | null;
  selected: boolean;
  onChoose: () => void;
}) {
  const { strategy, scenario } = props;
  const title = `Plan ${strategy}`;
  const isA = strategy === 'A';
  const cls = `fm-panel p5-card p5-decision-card ${isA ? 'p5-compare-card--plan-a' : 'p5-compare-card--plan-b'}${
    props.selected ? ' p5-compare-card--selected' : ''
  }`;

  if (!scenario) {
    return (
      <section className={cls} aria-label={title} data-testid={`plan-${strategy}`}>
        <h2>{title} not ready</h2>
        <p className="p5-muted">The plan owner has not published this plan yet.</p>
        <div className="p5-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <Link to={PLAN_ROUTE[strategy]} className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary">
            Go to {title}
          </Link>
          {isA && (
            <button type="button" className="fm-btn fm-btn--primary p5-btn p5-btn--primary" onClick={() => publishPlanAFromShared()}>
              Propose Plan A
            </button>
          )}
        </div>
      </section>
    );
  }

  const stale = selectIsScenarioStale(scenario, props.snapshot);
  const cond = scenario.feasibility === 'CONDITIONAL';
  const totalForecast = scenario.forecastChickenPortionsServed + scenario.forecastChickenPortionsUnmet;
  const reasonId = `choose-${strategy}-reason`;
  const pillTone = cond ? 'p5-pill--warn' : isHardBlocked(scenario) ? 'p5-pill--danger' : 'p5-pill--ok';

  return (
    <section className={cls} aria-label={title} data-testid={`plan-${strategy}`}>
      <div className="p5-decision-card__head">
        <h2>{STRATEGY_TITLE[strategy]}</h2>
        <span className={`p5-pill ${pillTone}`} title={scenario.feasibility}>
          {FEASIBILITY_LABELS[scenario.feasibility].label}
        </span>
        {stale && (
          <span className="p5-pill p5-pill--danger" title="STALE_SCENARIO">
            Numbers changed — recalculation required
          </span>
        )}
      </div>
      <dl className="p5-decision-lines">
        <div>
          <dt>New spend</dt>
          <dd data-testid={`strip-${strategy}-spend`}>
            <strong>{formatSenAsRM(scenario.additionalCostSen)}</strong> {isA ? '(projected)' : 'new purchase'}
          </dd>
        </div>
        <div>
          <dt>Forecast chicken coverage</dt>
          <dd data-testid={`strip-${strategy}-coverage`}>
            <strong>
              {scenario.forecastChickenPortionsServed} of {totalForecast}
            </strong>{' '}
            portions{cond ? ' (conditional)' : ''}
          </dd>
        </div>
        <div>
          <dt>Confirmed orders</dt>
          <dd data-testid={`strip-${strategy}-confirmed`}>
            <strong>{scenario.confirmedChickenPortionsProtected}</strong> protected{cond ? ' (conditional)' : ''}
          </dd>
        </div>
        <div className="p5-decision-lines__giveup">
          <dt>What you give up</dt>
          <dd data-testid={`strip-${strategy}-giveup`}>{giveUpLine(scenario)}</dd>
        </div>
      </dl>
      <div className="p5-row p5-decision-card__actions">
        {props.selected ? (
          <button type="button" className="fm-btn fm-btn--secondary p5-btn" disabled>
            ✓ {title} chosen
          </button>
        ) : (
          <Button
            variant="primary"
            disabled={props.blockedReason !== null}
            aria-describedby={props.blockedReason ? reasonId : undefined}
            onClick={props.onChoose}
          >
            Choose {title}
          </Button>
        )}
        {props.blockedReason && !props.selected && (
          <span id={reasonId} className="p5-reason">
            {props.blockedReason}
          </span>
        )}
      </div>
    </section>
  );
}

export function ComparisonView() {
  const w = useP5World();
  const { store, adapter } = useP5Runtime();
  const p5 = useP5Store((s) => s.p5);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'escalate' | 'revise' | null>(null);

  useEffect(() => {
    if (adapter && 'bindStore' in adapter && typeof (adapter as any).bindStore === 'function') {
      (adapter as any).bindStore(store);
    }
  }, [adapter, store]);

  const readiness = selectComparisonReadiness(w.scenarioA, w.scenarioB);
  useEffect(() => {
    if (w.wired && readiness === 'WAITING_BOTH' && (p5.selection !== null || p5.approvals.length > 0)) {
      store.getState().p5.resetP5();
    }
  }, [w.wired, readiness, p5.selection, p5.approvals.length, store]);

  if (!w.wired || !w.snapshot) {
    return (
      <div className="p5">
        <RecoveryWorkflowHeader currentStep="compare" />
        <NotWiredNotice />
      </div>
    );
  }
  const snapshot = w.snapshot;
  const viewer = w.role === 'ViewerAuditor';
  const escalatedBlock = p5.escalationState === 'ESCALATED' && !p5.recalculationRequestedSinceEscalation;

  const blockedReason = (s: RecoveryScenarioWithActions | null): string | null => {
    if (!s) return 'Plan not ready';
    if (readiness === 'FINGERPRINT_MISMATCH') return 'Plans were calculated on different data versions';
    if (selectIsScenarioStale(s, snapshot)) return 'Numbers changed — recalculation required';
    if (isHardBlocked(s)) return `Hard blocker: ${FEASIBILITY_LABELS[s.feasibility].label}`;
    if (viewer) return 'Viewer (audit only) is read-only';
    if (escalatedBlock) return 'Escalated — request revised constraints first';
    return null;
  };

  const choose = (strategy: ScenarioStrategy) => {
    const r = store.getState().p5.chooseRecoveryScenario(strategy);
    if (r.ok) {
      setError(null);
      setMessage(`Plan ${strategy} chosen — not approved yet.`);
    } else if (!BENIGN_ERRORS.has(r.error)) {
      setError(p5ErrorMessage(r.error, r.detail));
    }
  };

  const sel = p5.selection;
  const selectionApproved = Boolean(
    sel && p5.approvals.some((a) => a.state === 'APPROVED' && a.idempotencyKey === approvalKey(sel.scenarioId, sel.version, sel.fingerprint)),
  );
  return (
    <div className="p5">
      <P5DevControls />
      <RecoveryWorkflowHeader currentStep="compare" />
      <ImpactStrip />
      <EscalationPanel onMessage={setMessage} />

      {readiness === 'WAITING_BOTH' ? (
        <div
          className="fm-panel p5-card p5-stack p5-waiting-card"
          data-testid="waiting-both"
        >
          <h2 className="p5-waiting-title">
            Waiting for Plan A and Plan B
          </h2>
          <p className="p5-waiting-desc">
            {!w.incidentId ? (
              <>
                No supplier disruption has been reported yet. Trigger <strong>Simulate supplier report</strong> in the
                top-right <strong>Supplier disruption demo</strong> panel to open recovery comparison, or check status on
                Overview, Inbox, or Incidents.
              </>
            ) : !w.impact ? (
              <>
                Supplier disruption report is pending verification or impact assessment. Confirm the report and evaluate
                demand gap in Impact Explorer before comparing recovery plans.
              </>
            ) : (
              <>
                Impact assessed. Recovery proposals are being generated. Prepare or review proposals on Plan A and Plan B.
              </>
            )}
          </p>

          <div className="p5-waiting-steps">
            <div className="p5-waiting-step">
              <StatusBadge tone={w.incidentId ? 'success' : 'warning'}>
                {w.incidentId ? 'Done' : 'Pending'}
              </StatusBadge>
              <span>
                <strong>Step One:</strong> Receive and verify supplier disruption message (Demo panel → Simulate supplier report → Inbox / Message Intelligence)
              </span>
            </div>
            <div className="p5-waiting-step">
              <StatusBadge tone={w.impact ? 'success' : w.incidentId ? 'warning' : 'neutral'}>
                {w.impact ? 'Done' : 'Pending'}
              </StatusBadge>
              <span>
                <strong>Step Two:</strong> Assess stock and menu impact (Incidents / Impact Explorer)
              </span>
            </div>
            <div className="p5-waiting-step">
              <StatusBadge tone="neutral">Pending</StatusBadge>
              <span>
                <strong>Step Three:</strong> Prepare Plan A and Plan B for comparison
              </span>
            </div>
          </div>

          <div className="p5-waiting-actions">
            <Link to="/inbox" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary p5-waiting-btn">
              Go to Inbox
            </Link>
            <Link to="/impact" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary p5-waiting-btn">
              Go to Impact Explorer
            </Link>
            <Link to="/recovery/plan-a" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary p5-waiting-btn">
              Go to Plan A
            </Link>
            <Link to="/recovery/plan-b" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary p5-waiting-btn">
              Go to Plan B
            </Link>
            <Link to="/overview" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary p5-waiting-btn">
              Go to Overview
            </Link>
            <Link to="/incidents" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary p5-waiting-btn">
              Go to Incidents
            </Link>
          </div>
        </div>
      ) : (
        <>
          {readiness === 'ONLY_B' && (
            <AlertBanner tone="info" title="Plan B is ready — waiting for Plan A proposal">
              Plan B (Internal Stock & Prep) is calculated and ready. Plan A is awaiting external sourcing proposal from Plan A page.
            </AlertBanner>
          )}
          {readiness === 'ONLY_A' && (
            <AlertBanner tone="info" title="Plan A is ready — waiting for Plan B">
              Plan A (External Supplier Sourcing) is ready. Plan B is awaiting internal stock calculation.
            </AlertBanner>
          )}
          {readiness === 'FINGERPRINT_MISMATCH' && (
            <AlertBanner tone="danger" title="Plans used different data">
              Plans were calculated on different data versions. Choosing is disabled until both are recalculated.
            </AlertBanner>
          )}
          <div className="p5-grid2 p5-decision-strip" role="region" aria-label="Decision strip" data-testid="p5-decision-strip">
            {(['A', 'B'] as const).map((st) => {
              const s = st === 'A' ? w.scenarioA : w.scenarioB;
              return (
                <DecisionCard
                  key={st}
                  strategy={st}
                  scenario={s}
                  snapshot={snapshot}
                  blockedReason={blockedReason(s)}
                  selected={sel?.strategy === st && sel.scenarioId === s?.id}
                  onChoose={() => choose(st)}
                />
              );
            })}
          </div>
        </>
      )}

      {sel && (
        <div className="p5-alert p5-alert--ok fm-banner fm-banner--info" data-testid="selection-panel">
          <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            {selectionApproved ? (
              <>
                <p style={{ margin: 0 }}>
                  <strong>Plan {sel.strategy} approved (simulated) — tasks not executed yet.</strong> Execution is a separate step.
                </p>
                <Link to="/execution" className="fm-btn fm-btn--primary p5-btn p5-btn--primary" data-testid="p5-next-step-cta">
                  Continue to Execution →
                </Link>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  <strong>Plan {sel.strategy} chosen — not approved yet.</strong> Approval is a separate step.
                </p>
                <Link to="/approvals" className="fm-btn fm-btn--primary p5-btn p5-btn--primary" data-testid="p5-next-step-cta">
                  Continue to Approval →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      {error && (
        <AlertBanner tone="danger" title="Error">
          {error}
        </AlertBanner>
      )}

      <div className="p5-row">
        <Button
          variant="danger"
          disabled={viewer || p5.escalationState === 'ESCALATED'}
          onClick={() => setDialog('escalate')}
        >
          Reject both / Escalate
        </Button>
        <Button variant="secondary" disabled={viewer} onClick={() => setDialog('revise')}>
          Revise constraints
        </Button>
        {viewer && <span className="p5-reason">Viewer (audit only) is read-only.</span>}
        {!viewer && p5.escalationState === 'ESCALATED' && <span className="p5-muted">Already escalated.</span>}
      </div>

      {readiness !== 'WAITING_BOTH' && (
        <details className="p5-full-compare" data-testid="p5-full-comparison">
          <summary>Full comparison details</summary>
          <div className="p5-grid2">
            <PlanDetails strategy="A" scenario={w.scenarioA} snapshot={snapshot} />
            <PlanDetails strategy="B" scenario={w.scenarioB} snapshot={snapshot} />
          </div>
        </details>
      )}

      <LiveRegion message={message} />

      {dialog === 'escalate' && (
        <EscalateDialog
          onDone={(m) => {
            setDialog(null);
            if (m) setMessage(m);
          }}
        />
      )}
      {dialog === 'revise' && (
        <ReviseDialog
          onDone={(m) => {
            setDialog(null);
            if (m) setMessage(m);
          }}
        />
      )}
    </div>
  );
}
