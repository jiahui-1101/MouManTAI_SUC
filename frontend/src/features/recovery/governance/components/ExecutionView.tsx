import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatusBadge } from '../../../../components/ui';
import { isApprovalExpired } from '../../../approvals/approvalLogic';
import { advanceMyTasks, planAdvanceMyTasks, preflightExecution, type AdvanceSkip } from '../../../approvals/executionLogic';
import { formatKgMilli, formatSenAsRM, shortFingerprint } from '../format';
import {
  ALL_ROLES,
  ACTION_TYPE_LABELS,
  EXECUTION_STATE_LABELS,
  SYNC_STATUS_LABELS,
  TRUTH_LABELS,
  batchLabelFrom,
  demoTime,
  executionRefusal,
  roleLabel,
  roleList,
} from '../labels';
import type { ActionType, DemoRole, ExecutionAction, ExecutionAuditEntry, P5ErrorCode, RecoveryScenarioWithActions } from '../p5Contracts';
import type { P5Deps } from '../p5Deps';
import { BENIGN_ERRORS, p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { selectExecutionTasks } from '../selectors';
import { hasCapability } from '../../../approvals/permissions';
import { BlockerCard, blockerView } from './BlockerCard';
import { ReasonDialog } from './Dialog';
import { EscalationPanel, LiveRegion, NotWiredNotice } from './common';
import { P5Details } from './P5Details';
import { RecoveryWorkflowHeader } from './RecoveryWorkflowHeader';
import { P5DevControls } from './P5DevControls';
import './p5.css';

function allowedRolesFor(actionType: ActionType): DemoRole[] {
  return ALL_ROLES.filter((r) => hasCapability(r, { kind: 'EXECUTE', actionType }));
}

/** Menu display name from the data layer (P2 menu / mock world), falling back to the ID. Never hardcoded here. */
export function menuDisplayName(deps: Pick<P5Deps, 'resolveMenuDisplayName'>, menuId: string | undefined): string {
  if (!menuId) return 'Menu item';
  return deps.resolveMenuDisplayName?.(menuId) ?? menuId;
}

/** "Advanced 4 tasks · 3 skipped (not allowed for Kitchen Lead)". */
export function advanceSummary(advanced: number, skipped: readonly AdvanceSkip[], role: DemoRole): string {
  const head = `Advanced ${advanced} task${advanced === 1 ? '' : 's'}`;
  if (skipped.length === 0) return head;
  const why: Partial<Record<P5ErrorCode, string>> = {
    DEMO_FORBIDDEN: `not allowed for ${roleLabel(role)}`,
    STALE_SCENARIO: 'the numbers changed',
    APPROVAL_EXPIRED: 'too late on the demo clock',
  };
  const reasons = [...new Set(skipped.map((s) => why[s.error] ?? 'not available'))];
  return `${head} · ${skipped.length} skipped (${reasons.join('; ')})`;
}

export function ExecutionView() {
  const p5 = useP5Store((s) => s.p5);
  const w = useP5World();
  const { adapter, store } = useP5Runtime();
  const [live, setLive] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'one'; actionId: string } | { kind: 'all' } | null>(null);

  const activeApproval = [...p5.approvals].reverse().find((a) => a.state === 'APPROVED');
  const scenario = activeApproval ? (activeApproval.selectedStrategy === 'A' ? w.scenarioA : w.scenarioB) : null;
  const role: DemoRole = w.role ?? 'ViewerAuditor';

  const isStale = Boolean(activeApproval && w.snapshot && activeApproval.snapshotFingerprint !== w.snapshot.fingerprint);
  const isExpired = Boolean(activeApproval && w.clock && isApprovalExpired(activeApproval, w.clock));
  const deadline = activeApproval?.expiresAtIso?.slice(11, 16) ?? null;

  const tasks = activeApproval ? selectExecutionTasks({ p5 } as any, activeApproval.id) : [];
  const plan = w.wired && activeApproval ? planAdvanceMyTasks(p5, adapter.deps) : { eligible: [], skipped: [] };
  const remaining = tasks.filter((t) => t.state === 'APPROVED' || t.state === 'SIMULATED_EXECUTION');
  const roleBlockedEverywhere =
    !isStale && !isExpired && remaining.length > 0 && remaining.every((t) => !hasCapability(role, { kind: 'EXECUTE', actionType: t.actionType }));

  const handleSimulateOne = (actionId: string, reason: string): string | null => {
    if (!activeApproval) return null;
    const res = store.getState().p5.simulateExecutionAction(actionId, activeApproval.id, reason);
    if (!res.ok) {
      if (!BENIGN_ERRORS.has(res.error)) return p5ErrorMessage(res.error, res.detail);
    } else {
      setLive(`${ACTION_TYPE_LABELS[res.value.actionType].label}: ${EXECUTION_STATE_LABELS[res.value.state].label}.`);
    }
    setDialog(null);
    return null;
  };

  const handleAdvanceAll = (reason: string): string | null => {
    const res = advanceMyTasks(store.getState().p5, adapter.deps, reason);
    if (!res.ok) return p5ErrorMessage(res.error, res.detail);
    const text = advanceSummary(res.value.advanced.length, res.value.skipped, role);
    setSummary(text);
    setLive(text);
    setDialog(null);
    return null;
  };

  const notStarted = tasks.filter((t) => t.state === 'APPROVED').length;
  const inProgress = tasks.filter((t) => t.state === 'SIMULATED_EXECUTION').length;
  const waitingProof = tasks.filter((t) => t.state === 'AWAITING_EVIDENCE' || t.state === 'VERIFIED').length;
  const allAwaiting = tasks.length > 0 && waitingProof === tasks.length;
  const batchLabel = batchLabelFrom(tasks.filter((t) => t.actionType === 'PREP_BATCH_TASK' && t.targetId).map((t) => t.targetId as string));

  const blockCtx = {
    verb: 'executed' as const,
    role,
    actionTypes: [...new Set(tasks.map((t) => t.actionType))],
    clock: w.clock,
    deadlineLocal: deadline,
    snapshotRevision: w.snapshot?.revision ?? null,
  };

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
          <p className="p5-muted">No approved plan. Approve a plan on Approvals first.</p>
          <div>
            <Link to="/approvals" className="fm-btn fm-btn--primary p5-btn p5-btn--primary">
              Go to Approvals →
            </Link>
          </div>
        </section>
      ) : (
        <>
          {(isStale || isExpired) && (
            <BlockerCard testId="p5-execution-blocked-banner" view={blockerView(isStale ? 'STALE_SCENARIO' : 'APPROVAL_EXPIRED', '', blockCtx)} />
          )}

          {roleBlockedEverywhere && (
            <BlockerCard
              testId="p5-execution-role-refusal"
              view={blockerView('DEMO_FORBIDDEN', '', { ...blockCtx, actionTypes: [...new Set(remaining.map((t) => t.actionType))] })}
            />
          )}

          {allAwaiting && !isStale && !isExpired && (
            <div className="p5-alert p5-alert--ok fm-banner fm-banner--info">
              <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <p style={{ margin: 0 }}>
                  <strong>All tasks done in the demo — now they need proof.</strong> Evidence is checked on Outcomes.
                </p>
                <Link to="/outcomes" className="fm-btn fm-btn--primary p5-btn p5-btn--primary" data-testid="p5-next-step-cta">
                  Record evidence & verify →
                </Link>
              </div>
            </div>
          )}

          <header className="fm-panel p5-card p5-card--accent-sim p5-stack" aria-label="Approved plan execution header">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h2>Execution — Plan {activeApproval.selectedStrategy}</h2>
              <StatusBadge tone="simulated" title="SIMULATED_ACTION">
                {TRUTH_LABELS.SIMULATED_ACTION.label}
              </StatusBadge>
            </div>
            <p className="p5-muted">Simulation only — no supplier, POS or kitchen system is contacted.</p>
            <p className="p5-muted">
              Approved by <strong>{roleLabel(activeApproval.actorRole)}</strong> at {demoTime(activeApproval.createdAtIso)}
            </p>
            <P5Details summary="Audit details">
              Approval {activeApproval.id} · {activeApproval.scenarioId} v{activeApproval.scenarioVersion} · {activeApproval.actorId}
            </P5Details>
          </header>

          <section className="fm-panel p5-card p5-stack" aria-label="Execution progress">
            <div className="p5-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <h3>Progress</h3>
              <Button
                variant="secondary"
                disabled={plan.eligible.length === 0}
                onClick={() => setDialog({ kind: 'all' })}
                data-testid="p5-advance-all-btn"
              >
                Advance all tasks I can do as {roleLabel(role)} ({plan.eligible.length})
              </Button>
            </div>
            <div className="p5-kpi-grid p5-kpi-grid--3">
              <div className="p5-kpi-card p5-kpi-card--approved">
                <span className="p5-kpi-lbl">Not started</span>
                <span className="p5-kpi-val">{notStarted}</span>
              </div>
              <div className="p5-kpi-card p5-kpi-card--sim">
                <span className="p5-kpi-lbl">In progress (simulated)</span>
                <span className="p5-kpi-val">{inProgress}</span>
              </div>
              <div className="p5-kpi-card p5-kpi-card--awaiting">
                <span className="p5-kpi-lbl">Waiting for proof</span>
                <span className="p5-kpi-val">{waitingProof}</span>
              </div>
            </div>
            <p className="p5-muted" data-testid="p5-progress-text">
              {waitingProof} of {tasks.length} tasks waiting for proof · proof is checked on <Link to="/outcomes">Outcomes</Link>
            </p>
            {summary && (
              <p className="p5-advance-summary" data-testid="p5-advance-summary">
                {summary}
              </p>
            )}
          </section>

          <section className="p5-stack" aria-label="Execution tasks">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h2>Tasks</h2>
              <span className="p5-muted">
                {tasks.length} task{tasks.length === 1 ? '' : 's'}
              </span>
            </div>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                scenario={scenario}
                role={role}
                deadline={deadline}
                batchLabel={batchLabel}
                blockedBanner={isStale || isExpired}
                auditEntries={p5.auditLog.filter((e) => e.actionId === task.id)}
                onOpenSimulate={(id) => setDialog({ kind: 'one', actionId: id })}
              />
            ))}
          </section>
        </>
      )}

      {dialog?.kind === 'one' && (
        <ReasonDialog
          title="Simulate next step"
          description="Give a short operational reason. This advances one task by one step, in the demo only."
          confirmLabel="Advance step"
          onConfirm={(r) => handleSimulateOne(dialog.actionId, r)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'all' && (
        <ReasonDialog
          title={`Advance all tasks you can do as ${roleLabel(role)}`}
          description={`Moves ${plan.eligible.length} task${plan.eligible.length === 1 ? '' : 's'} forward by exactly one step each, with one audit entry per task. Tasks your role can't do are skipped.`}
          confirmLabel="Advance tasks"
          onConfirm={handleAdvanceAll}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  scenario,
  role,
  deadline,
  batchLabel,
  blockedBanner,
  auditEntries,
  onOpenSimulate,
}: {
  task: ExecutionAction;
  scenario: RecoveryScenarioWithActions | null;
  role: DemoRole;
  deadline: string | null;
  batchLabel: (id: string) => string;
  blockedBanner: boolean;
  auditEntries: ExecutionAuditEntry[];
  onOpenSimulate: (id: string) => void;
}) {
  const p5 = useP5Store((s) => s.p5);
  const { adapter } = useP5Runtime();
  const allowed = allowedRolesFor(task.actionType);
  const blocker = preflightExecution(p5, adapter.deps, task.id);
  const done = task.state === 'AWAITING_EVIDENCE' || task.state === 'VERIFIED';
  const isSimulationDisabled = blockedBanner || blocker !== null;
  const blockerText =
    !done && blocker && !blockedBanner
      ? blocker.error === 'DEMO_FORBIDDEN'
        ? executionRefusal(role, task.actionType).headline
        : p5ErrorMessage(blocker.error, blocker.detail)
      : null;

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
        <h3>{taskTitle(task, adapter.deps, batchLabel)}</h3>
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
            title={task.state}
            data-testid={`p5-task-state-${task.id}`}
          >
            {EXECUTION_STATE_LABELS[task.state].label}
          </span>
          {task.actionType === 'MENU_LIMIT_TASK' && (
            <span
              className={`p5-badge fm-badge ${
                task.externalSyncStatus === 'MANUALLY_CONFIRMED_DEMO' ? 'fm-badge--success p5-badge--brand' : 'fm-badge--warning p5-badge--warn'
              }`}
              title={task.externalSyncStatus}
              data-testid={`p5-task-sync-${task.id}`}
            >
              {SYNC_STATUS_LABELS[task.externalSyncStatus].label}
            </span>
          )}
        </div>
      </div>

      {task.actionType === 'PO_DRAFT' && (
        <div className="p5-stack p5-muted p5-task-detail" data-testid="p5-po-draft-content">
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Local purchase order draft — NOT SENT</strong>
          </p>
          <div className="p5-row">
            <span>
              Quantity: <strong>{scenario ? formatKgMilli(scenario.newPurchaseKgMilli) : 'Not provided by Plan A'}</strong>
            </span>
            <span>
              Landed total: <strong>{scenario ? formatSenAsRM(scenario.additionalCostSen) : 'Not provided by Plan A'}</strong>
            </span>
          </div>
        </div>
      )}

      {task.actionType === 'RECEIPT_CHECK' && (
        <div className="p5-muted p5-task-detail" data-testid="p5-receipt-check-content">
          <p>Waiting for the simulated delivery and quality check{deadline ? ` before ${deadline}` : ''}.</p>
        </div>
      )}

      {task.actionType === 'PREP_BATCH_TASK' && (
        <div className="p5-row p5-muted">
          <span>
            Planned portions: <strong>{plannedPortionsFor(task, scenario)}</strong>
          </span>
        </div>
      )}

      {task.actionType === 'MENU_LIMIT_TASK' && (
        <div className="p5-row p5-muted">
          <span>
            Item: <strong>{menuDisplayName(adapter.deps, task.targetId)}</strong>
          </span>
        </div>
      )}

      <div className="p5-row p5-muted" style={{ fontSize: '12.5px' }}>
        <span>
          Who can do this: <strong>{roleList(allowed)}</strong>
        </span>
      </div>

      <div className="p5-row" style={{ alignItems: 'center' }}>
        {!done && (
          <Button variant="primary" disabled={isSimulationDisabled} onClick={() => onOpenSimulate(task.id)} data-testid={`p5-simulate-btn-${task.id}`}>
            Simulate next step
          </Button>
        )}
        {blockerText && (
          <span className="p5-reason" data-testid={`p5-task-blocker-${task.id}`}>
            {blockerText}
          </span>
        )}
        {task.state === 'AWAITING_EVIDENCE' && (
          <Link
            to={`/outcomes?actionId=${task.id}`}
            className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
            data-testid={`p5-record-evidence-link-${task.id}`}
          >
            Next: record proof →
          </Link>
        )}
      </div>

      <details className="p5-card p5-task-audit" data-testid={`p5-task-audit-${task.id}`}>
        <summary>
          Audit timeline ({auditEntries.length} event{auditEntries.length === 1 ? '' : 's'})
        </summary>
        {auditEntries.length === 0 ? (
          <p className="p5-muted" style={{ marginTop: '8px' }}>
            No simulated changes recorded yet.
          </p>
        ) : (
          <ul className="p5-list" style={{ marginTop: '8px' }}>
            {auditEntries.map((entry, idx) => (
              <li key={idx} className="p5-muted" title={`${entry.from} → ${entry.to} · ${entry.actorId}`}>
                <strong>
                  {EXECUTION_STATE_LABELS[entry.from].label} → {EXECUTION_STATE_LABELS[entry.to].label}
                </strong>{' '}
                by <strong>{roleLabel(entry.actorRole)}</strong> at {demoTime(entry.atIso)}: “{entry.reason}”{' '}
                <span className="p5-badge fm-badge p5-badge--sim" style={{ fontSize: '10.5px' }}>
                  simulated
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
      <P5Details summary="Audit details">
        {task.actionType}
        {task.targetId ? ` ${task.targetId}` : ''} · key <abbr title={task.idempotencyKey}>{shortFingerprint(task.idempotencyKey)}</abbr>
      </P5Details>
    </article>
  );
}

function taskTitle(task: ExecutionAction, deps: Pick<P5Deps, 'resolveMenuDisplayName'>, batchLabel: (id: string) => string): string {
  switch (task.actionType) {
    case 'PO_DRAFT':
      return 'Purchase order draft';
    case 'RECEIPT_CHECK':
      return 'Delivery & quality check';
    case 'MENU_LIMIT_TASK':
      return `Menu limit — ${menuDisplayName(deps, task.targetId)}`;
    case 'PREP_BATCH_TASK':
      return task.targetId ? batchLabel(task.targetId) : 'Prep batch';
  }
}

/** Planned portions from the task or the published scenario only — never a local default. */
function plannedPortionsFor(task: ExecutionAction, scenario: RecoveryScenarioWithActions | null): string {
  if (task.plannedPortions !== undefined) return String(task.plannedPortions);
  const p = scenario?.proposedActions?.find((a) => a.actionType === 'PREP_BATCH_TASK' && a.targetId === task.targetId);
  return p?.plannedPortions !== undefined ? String(p.plannedPortions) : 'Not provided by Plan B';
}
