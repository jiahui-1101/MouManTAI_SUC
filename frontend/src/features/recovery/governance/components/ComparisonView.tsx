import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatusBadge, AlertBanner } from '../../../../components/ui';
import { formatKgMilli, formatSenAsRM } from '../format';
import type { RecoveryScenarioWithActions, ScenarioStrategy, SnapshotRef } from '../p5Contracts';
import { BENIGN_ERRORS, p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { selectComparisonReadiness, selectIsScenarioStale } from '../selectors';
import {
  EscalateDialog,
  EscalationPanel,
  LiveRegion,
  NotWiredNotice,
  P5ContextHeader,
  ReviseDialog,
} from './common';
import { P5DevControls } from './P5DevControls';

const STRATEGY_TITLE: Record<ScenarioStrategy, string> = {
  A: 'Plan A — Buy replacement chicken',
  B: 'Plan B — Protect orders with existing stock',
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

const isHardBlocked = (s: RecoveryScenarioWithActions) => s.feasibility === 'INFEASIBLE' || s.feasibility === 'UNKNOWN';

function ImpactStrip() {
  const { impact } = useP5World();
  if (!impact) {
    return (
      <div className="fm-panel p5-card" role="region" aria-label="Impact context">
        <p className="p5-muted">Impact summary not available yet.</p>
      </div>
    );
  }
  return (
    <div className="p5-stack" role="region" aria-label="Impact context">
      <div className="p5-grid2">
        <div className="fm-panel p5-card" data-testid="impact-po-shortfall">
          <h3>Supplier PO shortfall: {formatKgMilli(impact.poShortfallKgMilli ?? 0)}</h3>
          <p className="p5-muted">
            {impact.poId ?? 'HP-PO-1042'} expected {formatKgMilli(impact.poExpectedKgMilli ?? 0)}, supplier claims {formatKgMilli(impact.poClaimedKgMilli ?? 0)} today
          </p>
        </div>
        <div className="fm-panel p5-card" data-testid="impact-forecast-gap">
          <h3>Forecast chicken demand gap: {formatKgMilli(impact.forecastGapKgMilli ?? impact.demandGapKgMilli ?? 0)}</h3>
          <p className="p5-muted">Forecast need vs accepted on-hand</p>
        </div>
      </div>
      <p className="p5-muted">
        Why these differ: the PO shortfall is what the supplier will not deliver; the demand gap is what remains after
        counting chicken already accepted on hand.
      </p>
    </div>
  );
}

function PlanRows({ s }: { s: RecoveryScenarioWithActions }) {
  const cond = s.feasibility === 'CONDITIONAL' ? ' (conditional)' : '';
  const a = s.strategy === 'A';
  return (
    <div className="fm-table-wrap p5-table-wrap" role="region" aria-label={`Metrics for ${STRATEGY_TITLE[s.strategy]}`} tabIndex={0}>
      <table className="fm-table p5-table">
        <caption className="p2-sr sr-only">Metrics for {STRATEGY_TITLE[s.strategy]}</caption>
        <tbody>
          <tr>
            <th scope="row">Strategy</th>
            <td>{STRATEGY_TITLE[s.strategy]}</td>
          </tr>
          <tr>
            <th scope="row">Feasibility</th>
            <td>
              <strong>{s.feasibility}</strong> — {feasibilityReason(s)}
            </td>
          </tr>
          <tr>
            <th scope="row">New purchase</th>
            <td>{a ? `${formatKgMilli(s.newPurchaseKgMilli)} chilled chicken` : formatKgMilli(s.newPurchaseKgMilli)}</td>
          </tr>
          <tr>
            <th scope="row">Additional cost</th>
            <td>
              {a
                ? `${formatSenAsRM(s.additionalCostSen)} projected additional landed cost`
                : `${formatSenAsRM(s.additionalCostSen)} new purchase (not total operating cost)`}
            </td>
          </tr>
          <tr>
            <th scope="row">Chicken forecast portions served</th>
            <td>{a ? `${s.forecastChickenPortionsServed}${cond}` : `${s.forecastChickenPortionsServed} planned`}</td>
          </tr>
          <tr>
            <th scope="row">Chicken forecast portions unmet</th>
            <td>
              {a
                ? `${s.forecastChickenPortionsUnmet}${cond}`
                : `${s.forecastChickenPortionsUnmet} — forecast only, not confirmed-order breaches`}
            </td>
          </tr>
          <tr>
            <th scope="row">Confirmed chicken portions protected</th>
            <td>{a ? `${s.confirmedChickenPortionsProtected}${cond}` : `${s.confirmedChickenPortionsProtected} planned`}</td>
          </tr>
          <tr>
            <th scope="row">Assumptions</th>
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
            <th scope="row">Scenario / version</th>
            <td className="p5-mono">
              {s.id} · v{s.version}
              {s.evidenceRefs.length > 0 && ` · refs ${s.evidenceRefs.join(', ')}`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlanColumn(props: {
  strategy: ScenarioStrategy;
  scenario: RecoveryScenarioWithActions | null;
  snapshot: SnapshotRef;
  blockedReason: string | null;
  selected: boolean;
  onChoose: () => void;
}) {
  const { strategy, scenario } = props;
  const title = `Plan ${strategy}`;
  if (!scenario) {
    return (
      <section className="fm-panel p5-card p5-stack" aria-label={title} data-testid={`plan-${strategy}`}>
        <h2>{title} not ready</h2>
        <p className="p5-muted">The plan owner has not published this plan yet.</p>
        <Link to={PLAN_ROUTE[strategy]}>Go to {title}</Link>
      </section>
    );
  }
  const stale = selectIsScenarioStale(scenario, props.snapshot);
  const reasonId = `choose-${strategy}-reason`;
  return (
    <section className="fm-panel p5-card p5-stack" aria-label={title} data-testid={`plan-${strategy}`}>
      <div className="p5-row">
        <h2>{STRATEGY_TITLE[strategy]}</h2>
        {stale && <StatusBadge tone="danger">STALE — recalculation required</StatusBadge>}
        {props.selected && <StatusBadge tone="simulated">Selected (not approved)</StatusBadge>}
      </div>
      <PlanRows s={scenario} />
      {isHardBlocked(scenario) && (
        <AlertBanner tone="danger" title="Hard blocker">
          <p>Feasibility {scenario.feasibility}: {feasibilityReason(scenario)}.</p>
          {scenario.assumptions.length > 0 && (
            <ul className="p5-list">
              {scenario.assumptions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </AlertBanner>
      )}
      {scenario.feasibility === 'CONDITIONAL' && (
        <AlertBanner tone="warning" title="Conditions">
          <p>Figures hold only {feasibilityReason(scenario)}.</p>
        </AlertBanner>
      )}
      <div className="p5-row">
        <Button
          variant="primary"
          disabled={props.blockedReason !== null}
          aria-describedby={props.blockedReason ? reasonId : undefined}
          onClick={props.onChoose}
        >
          Choose {title}
        </Button>
        {props.blockedReason && (
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
  const { store } = useP5Runtime();
  const p5 = useP5Store((s) => s.p5);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'escalate' | 'revise' | null>(null);

  if (!w.wired || !w.snapshot) {
    return (
      <div className="p5">
        <P5ContextHeader />
        <NotWiredNotice />
      </div>
    );
  }
  const snapshot = w.snapshot;
  const readiness = selectComparisonReadiness(w.scenarioA, w.scenarioB);
  const viewer = w.role === 'ViewerAuditor';
  const escalatedBlock = p5.escalationState === 'ESCALATED' && !p5.recalculationRequestedSinceEscalation;

  const blockedReason = (s: RecoveryScenarioWithActions | null): string | null => {
    if (!s) return 'Plan not ready';
    if (readiness === 'FINGERPRINT_MISMATCH') return 'Plans were calculated on different snapshots';
    if (selectIsScenarioStale(s, snapshot)) return 'STALE — recalculation required';
    if (isHardBlocked(s)) return `Hard blocker: feasibility ${s.feasibility}`;
    if (viewer) return 'ViewerAuditor is read-only';
    if (escalatedBlock) return 'Escalated — request revised constraints first';
    return null;
  };

  const choose = (strategy: ScenarioStrategy) => {
    const r = store.getState().p5.chooseRecoveryScenario(strategy);
    if (r.ok) {
      setError(null);
      setMessage(`Plan ${strategy} selected — not approved yet.`);
    } else if (!BENIGN_ERRORS.has(r.error)) {
      setError(p5ErrorMessage(r.error, r.detail));
    }
  };

  const sel = p5.selection;
  return (
    <div className="p5">
      <P5DevControls />
      <P5ContextHeader />
      <ImpactStrip />
      <EscalationPanel onMessage={setMessage} />

      {readiness === 'WAITING_BOTH' ? (
        <div className="fm-panel p5-card p5-stack" data-testid="waiting-both">
          <h2>Waiting for Plan A and Plan B</h2>
          <p className="p5-muted">Comparison opens once the plan owners publish their plans.</p>
          <p className="p5-row">
            <Link to="/recovery/plan-a">Go to Plan A</Link>
            <Link to="/recovery/plan-b">Go to Plan B</Link>
          </p>
        </div>
      ) : (
        <>
          {readiness === 'FINGERPRINT_MISMATCH' && (
            <AlertBanner tone="danger" title="Snapshot Mismatch">
              Plans were calculated on different snapshots. Choosing is disabled until both are recalculated.
            </AlertBanner>
          )}
          <div className="p5-grid2">
            {(['A', 'B'] as const).map((st) => {
              const s = st === 'A' ? w.scenarioA : w.scenarioB;
              return (
                <PlanColumn
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
          <p>
            <strong>Plan {sel.strategy} selected — not approved yet.</strong> Approval is a separate step.{' '}
            <Link to="/approvals">Go to Approvals</Link>
          </p>
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
        {viewer && <span className="p5-reason">ViewerAuditor is read-only.</span>}
        {!viewer && p5.escalationState === 'ESCALATED' && <span className="p5-muted">Already escalated.</span>}
      </div>

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
