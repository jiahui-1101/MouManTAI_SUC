import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatusBadge } from '../../../../components/ui';
import { isApprovalExpired } from '../../../approvals/approvalLogic';
import { preflightExecution } from '../../../approvals/executionLogic';
import { hasCapability } from '../../../approvals/permissions';
import { formatKgMilli, formatSenAsRM, shortFingerprint } from '../format';
import type { ActionType, ApprovalRecord, DemoRole, ExecutionAction, RecoveryScenarioWithActions } from '../p5Contracts';
import { BENIGN_ERRORS, p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { selectExecutionTasks } from '../selectors';
import { ReasonDialog } from './Dialog';
import { EscalationPanel, LiveRegion, NotWiredNotice } from './common';
import { RecoveryWorkflowHeader } from './RecoveryWorkflowHeader';
import { P5DevControls } from './P5DevControls';
import './p5.css';

const MENU_NAMES: Record<string, string> = {
  'HP-MENU-CP': 'Chicken Poppers',
  'HP-MENU-CT': 'Chicken Tender',
  'HP-MENU-HC': 'Hot Crispy Chicken',
};

const ALL_ROLES: readonly DemoRole[] = [
  'Owner',
  'OperationsManager',
  'ProcurementOfficer',
  'KitchenLead',
  'ViewerAuditor',
];

function allowedRolesFor(actionType: ActionType): DemoRole[] {
  return ALL_ROLES.filter((r) => hasCapability(r, { kind: 'EXECUTE', actionType }));
}

interface SimulateDialogState {
  open: boolean;
  actionId: string;
}

export function ExecutionView() {
  const p5 = useP5Store((s) => s.p5);
  const w = useP5World();
  const [live, setLive] = useState('');
  const [simulateDialog, setSimulateDialog] = useState<SimulateDialogState>({ open: false, actionId: '' });

  // Find latest approved approval
  const activeApproval = [...p5.approvals].reverse().find((a) => a.state === 'APPROVED');
  const scenario = activeApproval ? (activeApproval.selectedStrategy === 'A' ? w.scenarioA : w.scenarioB) : null;

  // Stale & expiry checks
  const isStale = Boolean(activeApproval && w.snapshot && activeApproval.snapshotFingerprint !== w.snapshot.fingerprint);
  const isExpired = Boolean(activeApproval && w.clock && isApprovalExpired(activeApproval, w.clock));

  const blockReason = isStale
    ? 'Snapshot changed since approval'
    : isExpired
    ? `Approval expired at ${activeApproval?.expiresAtIso?.slice(11, 16) ?? '10:45'} on demo clock`
    : null;

  const tasks = activeApproval ? selectExecutionTasks({ p5 } as any, activeApproval.id) : [];

  const handleSimulate = (reason: string): string | null => {
    if (!activeApproval || !simulateDialog.actionId) return null;
    const res = p5.simulateExecutionAction(simulateDialog.actionId, activeApproval.id, reason);
    if (!res.ok) {
      if (!BENIGN_ERRORS.has(res.error)) {
        return p5ErrorMessage(res.error, res.detail);
      }
    } else {
      setLive(`Simulated action ${res.value.actionType} → ${res.value.state}.`);
    }
    setSimulateDialog({ open: false, actionId: '' });
    return null;
  };

  // Progress counts
  const approvedCount = tasks.filter((t) => t.state === 'APPROVED').length;
  const simExecCount = tasks.filter((t) => t.state === 'SIMULATED_EXECUTION').length;
  const awaitingCount = tasks.filter((t) => t.state === 'AWAITING_EVIDENCE').length;
  const verifiedCount = tasks.filter((t) => t.state === 'VERIFIED').length;
  const allAwaiting = tasks.length > 0 && tasks.every((t) => t.state === 'AWAITING_EVIDENCE' || t.state === 'VERIFIED');

  return (
    <div className="p5" data-testid="p5-execution-view">
      <P5DevControls />
      {!w.wired && <NotWiredNotice />}
      <RecoveryWorkflowHeader currentStep="execution" />
      <LiveRegion message={live} />

      {p5.escalationState === 'ESCALATED' && <EscalationPanel onMessage={setLive} />}

      {!activeApproval ? (
        <section className="fm-panel p5-card p5-stack" aria-label="No approval">
          <h2>No approved plan</h2>
          <p className="p5-muted">
            No approved plan. Approve a plan on Approvals first.
          </p>
          <div>
            <Link to="/approvals" className="fm-btn fm-btn--primary p5-btn p5-btn--primary">
              Go to Approvals →
            </Link>
          </div>
        </section>
      ) : (
        <>
          {blockReason && (
            <div className="p5-alert p5-alert--danger fm-banner fm-banner--danger" role="alert" data-testid="p5-execution-blocked-banner">
              <strong>Execution blocked: {blockReason}. Re-calculation and re-approval required.</strong>
              <div className="p5-row" style={{ marginTop: '8px' }}>
                <Link
                  to="/recovery/compare"
                  className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
                  data-testid="p5-next-step-cta"
                >
                  Recalculate on Comparison
                </Link>
                <Link to="/approvals" className="fm-btn fm-btn--secondary p5-btn p5-btn--secondary">
                  Go to Approvals →
                </Link>
              </div>
            </div>
          )}

          {allAwaiting && !blockReason && (
            <div className="p5-alert p5-alert--ok fm-banner fm-banner--info" style={{ marginBottom: '14px' }}>
              <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <p style={{ margin: 0 }}>
                  <strong>All tasks simulated and awaiting evidence.</strong> Proceed to Outcomes to record evidence and verify the simulated outcome.
                </p>
                <Link
                  to="/outcomes"
                  className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
                  data-testid="p5-next-step-cta"
                >
                  Record evidence & verify →
                </Link>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="fm-panel p5-card p5-card--accent-sim p5-stack" aria-label="Approved plan execution header">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h2>
                Execution Tracker — Plan {activeApproval.selectedStrategy} ({activeApproval.scenarioId} v{activeApproval.scenarioVersion})
              </h2>
              <StatusBadge tone="simulated" title="SIMULATED_ACTION">
                SIMULATED_ACTION
              </StatusBadge>
            </div>
            <p className="p5-muted">
              Simulation only — no supplier, POS or kitchen system is contacted.
            </p>
            <div className="p5-row p5-muted" style={{ fontSize: '12.5px' }}>
              <span>
                Approval ID: <strong className="p5-mono">{activeApproval.id}</strong>
              </span>
              <span>·</span>
              <span>
                Approved by: <strong>{activeApproval.actorRole}</strong> ({activeApproval.actorId})
              </span>
              <span>·</span>
              <span>
                Approved at: <span className="p5-mono">{activeApproval.createdAtIso.slice(11, 16)}</span>
              </span>
              <span>·</span>
              <span>
                Demo clock: <strong className="p5-mono">{w.clock ?? '—'}</strong>
              </span>
            </div>
          </header>

          {/* Progress */}
          <section className="fm-panel p5-card p5-stack" aria-label="Execution progress">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h3>Execution progress</h3>
              <span className="p5-badge fm-badge">{tasks.length} total tasks</span>
            </div>
            <div className="p5-kpi-grid">
              <div className="p5-kpi-card p5-kpi-card--approved">
                <span className="p5-kpi-lbl">Approved</span>
                <span className="p5-kpi-val">{approvedCount}</span>
              </div>
              <div className="p5-kpi-card p5-kpi-card--sim">
                <span className="p5-kpi-lbl">Simulated execution</span>
                <span className="p5-kpi-val">{simExecCount}</span>
              </div>
              <div className="p5-kpi-card p5-kpi-card--awaiting">
                <span className="p5-kpi-lbl">Awaiting evidence</span>
                <span className="p5-kpi-val">{awaitingCount}</span>
              </div>
              <div className="p5-kpi-card p5-kpi-card--verified">
                <span className="p5-kpi-lbl">Verified</span>
                <span className="p5-kpi-val">{verifiedCount}</span>
              </div>
            </div>
            <p className="p5-muted" data-testid="p5-progress-text">
              {awaitingCount} of {tasks.length} tasks awaiting evidence{simExecCount > 0 ? ` · ${simExecCount} in progress (one more step each)` : ''}
            </p>
          </section>

          {/* Tasks List */}
          <section className="p5-stack" aria-label="Execution tasks">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h2>Execution tasks</h2>
              <span className="p5-muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} assigned</span>
            </div>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                activeApproval={activeApproval}
                scenario={scenario}
                blockedBanner={Boolean(blockReason)}
                auditEntries={p5.auditLog.filter((e) => e.actionId === task.id)}
                onOpenSimulate={(id) => setSimulateDialog({ open: true, actionId: id })}
              />
            ))}
          </section>
        </>
      )}

      {simulateDialog.open && (
        <ReasonDialog
          title="Simulate Next Step"
          description="Provide a simulated operational reason to advance this task to its next state:"
          confirmLabel="Advance step"
          onConfirm={handleSimulate}
          onCancel={() => setSimulateDialog({ open: false, actionId: '' })}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  scenario,
  blockedBanner,
  auditEntries,
  onOpenSimulate,
}: {
  task: ExecutionAction;
  activeApproval?: ApprovalRecord;
  scenario: RecoveryScenarioWithActions | null;
  blockedBanner: boolean;
  auditEntries: any[];
  onOpenSimulate: (id: string) => void;
}) {
  const p5 = useP5Store((s) => s.p5);
  const { adapter } = useP5Runtime();
  const allowed = allowedRolesFor(task.actionType);

  // Preflight check
  const blocker = preflightExecution(p5, adapter.deps, task.id);
  const isSimulationDisabled = blockedBanner || blocker !== null;

  const stateClass =
    task.state === 'VERIFIED'
      ? 'p5-task-card--verified'
      : task.state === 'AWAITING_EVIDENCE'
      ? 'p5-task-card--awaiting'
      : task.state === 'SIMULATED_EXECUTION'
      ? 'p5-task-card--sim'
      : 'p5-task-card--approved';

  return (
    <article className={`fm-panel p5-card p5-task-card ${stateClass} p5-stack`} data-testid={`p5-task-card-${task.id}`}>
      <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="p5-stack" style={{ gap: '4px' }}>
          <h3>{taskTitle(task)}</h3>
          <span className="p5-muted p5-mono">
            Key: <abbr title={task.idempotencyKey}>{shortFingerprint(task.idempotencyKey)}</abbr>
          </span>
        </div>
        <div className="p5-row">
          <span
            className={`p5-badge fm-badge ${
              task.state === 'VERIFIED'
                ? 'p5-badge--success'
                : task.state === 'AWAITING_EVIDENCE'
                ? 'p5-badge--info'
                : task.state === 'SIMULATED_EXECUTION'
                ? 'p5-badge--warn'
                : ''
            }`}
            data-testid={`p5-task-state-${task.id}`}
          >
            {task.state}
          </span>
          {task.actionType === 'MENU_LIMIT_TASK' && (
            <span
              className={`p5-badge fm-badge ${
                task.externalSyncStatus === 'MANUALLY_CONFIRMED_DEMO'
                  ? 'fm-badge--success p5-badge--brand'
                  : 'fm-badge--warning p5-badge--warn'
              }`}
              data-testid={`p5-task-sync-${task.id}`}
            >
              {task.externalSyncStatus === 'MANUALLY_CONFIRMED_DEMO'
                ? 'Manually confirmed (demo evidence)'
                : 'Awaiting manual update — not synced to any POS'}
            </span>
          )}
        </div>
      </div>

      {/* Strategy-specific content */}
      {task.actionType === 'PO_DRAFT' && (
        <div
          className="p5-stack p5-muted"
          style={{ background: 'var(--surface-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}
          data-testid="p5-po-draft-content"
        >
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Local PO draft — NOT SENT</strong>
          </p>
          <div className="p5-row">
            <span>Supplier: <strong>{(scenario as any)?.supplierId ?? 'Not provided by Plan A scenario'}</strong></span>
            <span>Qty: <strong>{scenario ? formatKgMilli(scenario.newPurchaseKgMilli) : 'Not provided by Plan A scenario'}</strong></span>
            <span>Unit cost: <strong>{(scenario as any)?.unitCostSen ? `${formatSenAsRM((scenario as any).unitCostSen)}/kg` : 'Not provided by Plan A scenario'}</strong></span>
            <span>Freight: <strong>{(scenario as any)?.freightSen ? formatSenAsRM((scenario as any).freightSen) : 'Not provided by Plan A scenario'}</strong></span>
            <span>Landed total: <strong>{scenario ? formatSenAsRM(scenario.additionalCostSen) : 'Not provided by Plan A scenario'}</strong></span>
          </div>
        </div>
      )}

      {task.actionType === 'RECEIPT_CHECK' && (
        <div
          className="p5-muted"
          style={{ background: 'var(--surface-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}
          data-testid="p5-receipt-check-content"
        >
          <p>Awaiting simulated receipt + quality check before 10:45.</p>
        </div>
      )}

      {task.actionType === 'PREP_BATCH_TASK' && (
        <div className="p5-row p5-muted">
          <span>Batch ID: <strong className="p5-mono">{task.targetId ?? '—'}</strong></span>
          <span>·</span>
          <span>Planned portions: <strong>{plannedPortionsFor(task, scenario)}</strong></span>
        </div>
      )}

      {task.actionType === 'MENU_LIMIT_TASK' && (
        <div className="p5-row p5-muted">
          <span>Item: <strong>{adapter.deps.resolveMenuDisplayName?.(task.targetId ?? '') ?? MENU_NAMES[task.targetId ?? ''] ?? task.targetId}</strong></span>
          <span>·</span>
          <span>Menu ID: <strong className="p5-mono">{task.targetId ?? '—'}</strong></span>
        </div>
      )}

      <div className="p5-row p5-muted" style={{ fontSize: '12.5px' }}>
        <span>Allowed roles: <strong>{allowed.join(', ')}</strong></span>
      </div>

      {/* Actions */}
      <div className="p5-row" style={{ alignItems: 'center' }}>
        {task.state !== 'AWAITING_EVIDENCE' && task.state !== 'VERIFIED' && (
          <Button
            variant="primary"
            disabled={isSimulationDisabled}
            onClick={() => onOpenSimulate(task.id)}
            data-testid={`p5-simulate-btn-${task.id}`}
          >
            Simulate next step
          </Button>
        )}

        {blocker && (
          <span className="p5-reason" data-testid={`p5-task-blocker-${task.id}`}>
            {blocker.detail}
          </span>
        )}

        {task.state === 'AWAITING_EVIDENCE' && (
          <Link
            to={`/outcomes?actionId=${task.id}`}
            className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
            data-testid={`p5-record-evidence-link-${task.id}`}
          >
            Record evidence →
          </Link>
        )}
      </div>

      {/* Audit timeline */}
      <details className="p5-card" style={{ marginTop: '6px', background: 'var(--surface-secondary)' }} data-testid={`p5-task-audit-${task.id}`}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
          Audit timeline ({auditEntries.length} event{auditEntries.length === 1 ? '' : 's'})
        </summary>
        {auditEntries.length === 0 ? (
          <p className="p5-muted" style={{ marginTop: '8px' }}>
            No simulated state changes recorded yet.
          </p>
        ) : (
          <ul className="p5-list" style={{ marginTop: '8px' }}>
            {auditEntries.map((entry, idx) => (
              <li key={idx} className="p5-muted">
                <strong>{entry.from} → {entry.to}</strong> by <strong>{entry.actorRole}</strong> ({entry.actorId}) at{' '}
                <span className="p5-mono">{entry.atIso.slice(11, 16)}</span>: "{entry.reason}"{' '}
                <span className="p5-badge fm-badge p5-badge--sim" style={{ fontSize: '10.5px' }}>simulated</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </article>
  );
}

function taskTitle(task: ExecutionAction): string {
  switch (task.actionType) {
    case 'PO_DRAFT':
      return 'PO Draft Task';
    case 'RECEIPT_CHECK':
      return 'Receipt & Quality Check Task';
    case 'MENU_LIMIT_TASK':
      return `Menu Limit Task — ${MENU_NAMES[task.targetId ?? ''] ?? task.targetId ?? 'Menu'}`;
    case 'PREP_BATCH_TASK':
      return `Prep Batch Task — ${task.targetId ?? 'Batch'}`;
  }
}

function plannedPortionsFor(task: ExecutionAction, scenario: RecoveryScenarioWithActions | null): number {
  const p = scenario?.proposedActions?.find((a) => a.actionType === 'PREP_BATCH_TASK' && a.targetId === task.targetId);
  if (p?.plannedPortions !== undefined) return p.plannedPortions;
  const BATCH_DEFAULT: Record<string, number> = {
    'HP-BATCH-B-01': 25,
    'HP-BATCH-B-02': 20,
    'HP-BATCH-B-03': 15,
    'HP-BATCH-B-04': 12,
  };
  return BATCH_DEFAULT[task.targetId ?? ''] ?? 10;
}
