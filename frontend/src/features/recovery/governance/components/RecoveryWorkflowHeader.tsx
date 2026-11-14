import { Link, useLocation } from 'react-router-dom';
import { DataPanel, StatusBadge } from '../../../../components/ui';
import { shortFingerprint } from '../format';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { selectWorkflowSteps, type WorkflowStepId } from '../selectors';
import { RoleSwitcher } from './common';
import './p5.css';

interface RecoveryWorkflowHeaderProps {
  currentStep?: WorkflowStepId;
}

export function RecoveryWorkflowHeader({ currentStep: propStep }: RecoveryWorkflowHeaderProps) {
  const location = useLocation();
  const w = useP5World();
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

  const sel = p5.selection;
  const activeApproval = [...p5.approvals].reverse().find((a) => a.state === 'APPROVED');
  const scenarioText = sel
    ? `${sel.scenarioId} v${sel.version}`
    : activeApproval
    ? `${activeApproval.scenarioId} v${activeApproval.scenarioVersion}`
    : null;

  return (
    <header className="p5-workflow-header p5-stack" data-testid="p5-workflow-header">
      {/* Context Bar */}
      <DataPanel className="p5-card p5-stack p5-card--accent-brand">
        <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="p5-row" style={{ flexWrap: 'wrap', gap: '8px 12px' }}>
            <span>
              Incident <strong className="p5-mono">{w.incidentId ?? '—'}</strong>
            </span>
            <span>·</span>
            <span>
              Plan:{' '}
              <strong className="p5-mono">
                {sel ? `Plan ${sel.strategy}` : 'No plan selected'}
              </strong>
            </span>
            {scenarioText && (
              <>
                <span>·</span>
                <span>
                  Scenario <strong className="p5-mono">{scenarioText}</strong>
                </span>
              </>
            )}
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

        <div className="p5-row" style={{ alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

      {/* Role Switcher */}
      <RoleSwitcher />

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
