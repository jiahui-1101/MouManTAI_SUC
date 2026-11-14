import { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatKgMilli, shortFingerprint } from '../format';
import { ALL_ROLES, ROLE_LABELS, TRUTH_LABELS } from '../labels';
import type { DemoRole } from '../p5Contracts';
import { useP5Runtime, useP5Store, useP5Ui, useP5World } from '../p5Store';
import { selectWorkflowSteps, type WorkflowStepId } from '../selectors';
import { P5Details } from './P5Details';
import { PresentationToggle, ShortcutsDialog, usePresentationShortcuts } from './PresentationControls';
import './p5.css';

/**
 * One quiet incident bar: the "why" (the supplier disruption) in words, demo clock, acting role and
 * presentation toggle. Truth labels stay visible as small pills; audit IDs move into Details.
 */
export function P5ContextBar() {
  const w = useP5World();
  const p5 = useP5Store((s) => s.p5);
  const { adapter } = useP5Runtime();
  const roleId = useId();
  const presenting = useP5Ui((st) => st.presentationMode);
  const [shortcutMsg, setShortcutMsg] = useState('');
  usePresentationShortcuts(setShortcutMsg);
  useEffect(() => {
    if (!shortcutMsg) return undefined;
    const t = setTimeout(() => setShortcutMsg(''), 6000);
    return () => clearTimeout(t);
  }, [shortcutMsg]);
  useEffect(() => {
    document.body.dataset.p5Presenting = presenting ? 'true' : 'false';
    return () => {
      delete document.body.dataset.p5Presenting;
    };
  }, [presenting]);

  const impact = w.impact;
  const incident = w.wired && w.incidentId ? adapter.deps.getActiveIncident?.() ?? null : null;
  const poId = impact?.poId ?? incident?.poId;
  const sel = p5.selection;
  const activeApproval = [...p5.approvals].reverse().find((a) => a.state === 'APPROVED');
  const scenarioText = sel
    ? `${sel.scenarioId} v${sel.version}`
    : activeApproval
    ? `${activeApproval.scenarioId} v${activeApproval.scenarioVersion}`
    : '—';

  const headline = !w.incidentId
    ? 'No supplier disruption reported yet'
    : impact && impact.poShortfallKgMilli !== undefined
    ? `Supplier can't deliver ${formatKgMilli(impact.poShortfallKgMilli)} of chicken today${poId ? ` (${poId})` : ''}`
    : `Supplier disruption reported${poId ? ` on ${poId}` : ''} — impact not assessed yet`;

  return (
    <section className="fm-panel p5-card p5-context-bar" aria-label="Incident context" data-testid="p5-context-bar">
      <div className="p5-context-bar__row">
        <p className="p5-context-bar__headline">
          <strong>{headline}</strong>
          <span className="p5-muted"> · Happy Potato</span>
        </p>
        <PresentationToggle />
      </div>
      <div className="p5-context-bar__row">
        <div className="p5-context-bar__controls">
          {w.clock && (
            <span className="p5-muted">
              Demo clock <strong className="p5-mono">{w.clock}</strong>
            </span>
          )}
          {w.wired && (
            <label htmlFor={roleId} className="p5-context-bar__role" title="Demo role — not real access control">
              <span>Acting as (demo)</span>
              <select
                id={roleId}
                className="fm-select"
                value={w.role ?? ''}
                onChange={(e) => adapter.setRole(e.target.value as DemoRole)}
                data-testid="p5-role-select"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r].label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="p5-context-bar__truth">
          <span className="p5-pill p5-pill--sim" title={`SIMULATED_CALCULATION — ${TRUTH_LABELS.SIMULATED_CALCULATION.explain}`}>
            {TRUTH_LABELS.SIMULATED_CALCULATION.label}
          </span>
          <span className="p5-pill" title={`SYNTHETIC_BUSINESS — ${TRUTH_LABELS.SYNTHETIC_BUSINESS.explain}`}>
            {TRUTH_LABELS.SYNTHETIC_BUSINESS.label}
          </span>
        </div>
      </div>
      <div className="p5-context-bar__row p5-context-bar__foot">
        <span className="p5-muted p5-context-bar__disclaimer">
          Not a production food-safety or procurement authorization system.
        </span>
        {shortcutMsg && (
          <span className="p5-context-bar__status" role="status" data-testid="p5-shortcut-status">
            {shortcutMsg}
          </span>
        )}
        <P5Details summary="Audit details" testId="p5-context-details">
          Incident {w.incidentId ?? '—'} · Plan {scenarioText}
          {w.snapshot && (
            <>
              {' '}· Snapshot {w.snapshot.id} rev {w.snapshot.revision} · Fingerprint{' '}
              <abbr title={w.snapshot.fingerprint}>{shortFingerprint(w.snapshot.fingerprint)}</abbr>
            </>
          )}
        </P5Details>
      </div>
    </section>
  );
}

interface RecoveryWorkflowHeaderProps {
  currentStep?: WorkflowStepId;
}

export function RecoveryWorkflowHeader({ currentStep: propStep }: RecoveryWorkflowHeaderProps) {
  const location = useLocation();
  const p5 = useP5Store((s) => s.p5);
  const { adapter } = useP5Runtime();

  // Determine current step if not passed explicitly
  const currentStep: WorkflowStepId =
    propStep ??
    (location.pathname.includes('/compare')
      ? 'compare'
      : location.pathname.includes('/approvals')
      ? 'approvals'
      : location.pathname.includes('/execution')
      ? 'execution'
      : 'outcomes');

  const steps = selectWorkflowSteps(p5, adapter.deps);
  const stepOrder: WorkflowStepId[] = ['compare', 'approvals', 'execution', 'outcomes'];
  const currentIndex = Math.max(0, stepOrder.indexOf(currentStep));
  const currentStepItem = steps.find((s) => s.id === currentStep) ?? steps.compare;

  return (
    <header className="p5-workflow-header p5-stack" data-testid="p5-workflow-header">
      <P5ContextBar />
      <ShortcutsDialog />

      {/* Stepper */}
      <nav aria-label="Recovery workflow stepper" className="p5-stepper">
        {/* Desktop Stepper */}
        <div className="p5-stepper--desktop" data-testid="p5-stepper-desktop">
          <ol className="p5-stepper__list">
            {steps.map((st, i) => {
              const isCur = st.id === currentStep;
              return (
                <li
                  key={st.id}
                  className={`p5-stepper__item ${isCur ? 'p5-stepper__item--current' : ''}`}
                >
                  <Link
                    to={st.route}
                    className={`p5-stepper__link p5-stepper__link--${st.tone} ${
                      isCur ? 'p5-stepper__link--current' : ''
                    }`}
                    aria-current={isCur ? 'step' : undefined}
                  >
                    <div className="p5-stepper__header">
                      <span className="p5-stepper__badge">{i + 1}</span>
                      <strong className="p5-stepper__title">{st.label}</strong>
                    </div>
                    <div className={`p5-stepper__status p5-stepper__status--${st.tone}`}>
                      <span aria-hidden="true" className="p5-stepper__icon">
                        {st.icon}
                      </span>
                      <span className="p5-stepper__status-text">{st.status}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Mobile Stepper Collapsed (< 768px) */}
        <div className="p5-stepper--mobile" data-testid="p5-stepper-mobile">
          <div className="p5-stepper-mobile__summary">
            <span className="p5-stepper-mobile__step-text">
              Step {currentIndex + 1} of 4: <strong>{currentStepItem.label}</strong>
            </span>
            <div className={`p5-stepper__status p5-stepper__status--${currentStepItem.tone}`}>
              <span aria-hidden="true" className="p5-stepper__icon">
                {currentStepItem.icon}
              </span>
              <span className="p5-stepper__status-text">{currentStepItem.status}</span>
            </div>
          </div>
          <ol className="p5-stepper-mobile__list">
            {steps.map((st, i) => {
              const isCur = st.id === currentStep;
              return (
                <li key={st.id} className="p5-stepper-mobile__item">
                  <Link
                    to={st.route}
                    className={`p5-stepper-mobile__link ${
                      isCur ? 'p5-stepper-mobile__link--current' : ''
                    }`}
                    aria-current={isCur ? 'step' : undefined}
                  >
                    <span className="p5-stepper-mobile__num">{i + 1}.</span>
                    <span className="p5-stepper-mobile__label">{st.label}</span>
                    <span className={`p5-stepper__status p5-stepper__status--${st.tone}`}>
                      <span aria-hidden="true" className="p5-stepper__icon">
                        {st.icon}
                      </span>
                      <span className="p5-stepper__status-text">{st.status}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </header>
  );
}
