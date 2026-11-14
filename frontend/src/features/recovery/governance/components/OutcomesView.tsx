import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../../../components/ui';
import { hasCapability } from '../../../approvals/permissions';
import { evaluateOutcome } from '../../../outcomes/verifyOutcome';
import { formatKgMilli, formatSenAsRM } from '../format';
import type {
  ApprovalRecord,
  DemoRole,
  EvidenceKind,
  ExecutionAction,
  Measured,
  OutcomeReason,
  RecoveryOutcome,
  VerificationEvidence,
} from '../p5Contracts';
import {
  EVIDENCE_KIND_LABELS,
  OUTCOME_STATUS_LABELS,
  TRUTH_LABELS,
  demoTime,
  describeMissing,
  describeReason,
  reasonContext,
  roleLabel,
  roleList,
  type ReasonContext,
} from '../labels';
import { p5ErrorMessage } from '../p5Errors';
import { useP5Runtime, useP5Store, useP5World } from '../p5Store';
import { P5Details } from './P5Details';
import { selectEvidenceForAction, selectOutcomeFreshness } from '../selectors';
import { EscalationPanel, LiveRegion, NotWiredNotice } from './common';
import { RecoveryWorkflowHeader } from './RecoveryWorkflowHeader';
import { P5DevControls } from './P5DevControls';
import './p5.css';

const ROLES_BY_EVIDENCE: Record<EvidenceKind, DemoRole[]> = {
  RECEIPT: ['Owner', 'ProcurementOfficer'],
  PREP: ['Owner', 'OperationsManager', 'KitchenLead'],
  MENU_UPDATE: ['Owner', 'OperationsManager'],
  ORDER_FULFILMENT: ['Owner', 'OperationsManager'],
};

export function OutcomesView() {
  const p5 = useP5Store((s) => s.p5);
  const w = useP5World();
  const [searchParams] = useSearchParams();
  const actionIdParam = searchParams.get('actionId') ?? '';

  const [live, setLive] = useState('');
  const [savedMemory, setSavedMemory] = useState(false);

  // Active approval & outcome
  const activeApproval = [...p5.approvals].reverse().find((a) => a.state === 'APPROVED');
  const incidentId = activeApproval?.incidentId ?? w.incidentId ?? 'HP-INC-001';
  const savedOutcome: RecoveryOutcome | null = p5.outcomes[incidentId] ?? null;
  const outcome: RecoveryOutcome | null =
    savedOutcome ?? (activeApproval ? evaluateOutcome(activeApproval, p5.actions, p5.evidence) : null);
  const freshness = selectOutcomeFreshness({ p5 } as any, incidentId);

  // Selected task for evidence form
  const tasks = activeApproval ? p5.actions.filter((a) => a.approvalId === activeApproval.id) : [];
  const defaultAction = tasks.find((t) => t.id === actionIdParam) ?? tasks[0];
  const [selectedActionId, setSelectedActionId] = useState<string>(defaultAction?.id ?? '');

  // Keep selectedActionId updated if param changes or initial load
  const activeTask = tasks.find((t) => t.id === (selectedActionId || actionIdParam)) ?? defaultAction;

  const { adapter } = useP5Runtime();
  const ctx = reasonContext(adapter.deps.resolveMenuDisplayName?.bind(adapter.deps), tasks);
  /** Live preview of the evidence (drives the checklist); the hero shows only the VERIFIED result. */
  const preview: RecoveryOutcome | null = activeApproval ? evaluateOutcome(activeApproval, p5.actions, p5.evidence) : null;
  const verified: RecoveryOutcome | null = savedOutcome;
  const heroStatus = verified?.status ?? 'UNVERIFIED';
  const previewMissing = preview?.missingEvidence ?? [];
  const requiredCount = activeApproval
    ? activeApproval.selectedStrategy === 'A'
      ? 2
      : tasks.filter((t) => t.actionType === 'PREP_BATCH_TASK' || t.actionType === 'MENU_LIMIT_TASK').length + 1
    : 0;
  const recordedCount = Math.max(0, requiredCount - previewMissing.length);
  const deadline = activeApproval?.expiresAtIso?.slice(11, 16) ?? null;

  // Brief highlight when the verified status changes (CSS disables it under prefers-reduced-motion).
  const prevStatus = useRef(heroStatus);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prevStatus.current !== heroStatus) {
      prevStatus.current = heroStatus;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [heroStatus]);

  const handleVerify = () => {
    const res = p5.verifyDemoOutcome(incidentId);
    if (!res.ok) {
      setLive(`Check failed: ${p5ErrorMessage(res.error, res.detail)}`);
    } else {
      setLive(`Simulated outcome checked: ${res.value.status}.`);
    }
  };

  const handleSaveMemory = () => {
    const res = p5.saveDemoDecisionMemory(incidentId);
    if (!res.ok) {
      if (res.error === 'DUPLICATE_REQUEST') {
        setSavedMemory(true);
        setLive('Already in Decision Memory.');
      } else {
        setLive(`Save failed: ${p5ErrorMessage(res.error, res.detail)}`);
      }
    } else {
      setSavedMemory(true);
      setLive('Case added to Decision Memory.');
    }
  };

  const currentRole = w.role ?? 'ViewerAuditor';

  const heroTone =
    heroStatus === 'SUCCESS' ? 'success' : heroStatus === 'FAILED' ? 'danger' : heroStatus === 'PARTIAL' ? 'warn' : 'neutral';
  const checks = (verified?.reasons ?? []).filter((x) => x.code !== 'NO_EVIDENCE');
  const passed = checks.filter((x) => x.kind === 'PASS').length;
  const firstProblem = checks.find((x) => x.kind === 'HARD_FAILURE') ?? checks.find((x) => x.kind !== 'PASS');
  const heroWhy =
    heroStatus === 'UNVERIFIED'
      ? recordedCount === requiredCount && requiredCount > 0
        ? `all ${requiredCount} evidence items recorded — press “Verify simulated outcome” to check them`
        : `waiting for evidence (${recordedCount} of ${requiredCount} items recorded)`
      : heroStatus === 'SUCCESS'
      ? `all ${checks.length} checks passed on demo evidence`
      : heroStatus === 'FAILED'
      ? firstProblem
        ? describeReason(firstProblem, ctx)
        : 'a hard requirement failed'
      : `${passed} of ${checks.length} checks passed${firstProblem ? ` — ${describeReason(firstProblem, ctx)}` : ''}`;

  return (
    <div className="p5" data-testid="p5-outcomes-view">
      <P5DevControls />
      {!w.wired && <NotWiredNotice />}
      <RecoveryWorkflowHeader currentStep="outcomes" />
      <LiveRegion message={live} />

      {p5.escalationState === 'ESCALATED' && <EscalationPanel onMessage={setLive} />}

      {!activeApproval ? (
        <section className="p5-card p5-stack" aria-label="No approval">
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
          {/* Outcome hero */}
          <header
            className={`p5-hero p5-hero--${heroTone}${flash ? ' p5-hero--flash' : ''}`}
            aria-label="Simulated outcome status"
            data-testid="p5-outcome-hero"
            data-tone={heroTone}
          >
            <p className="p5-hero__status">
              <span data-testid="p5-outcome-badge" title={OUTCOME_STATUS_LABELS[heroStatus].explain}>
                Simulated Outcome: {OUTCOME_STATUS_LABELS[heroStatus].label}
              </span>
            </p>
            <p className="p5-hero__why" data-testid="p5-outcome-why">
              {heroWhy}
            </p>
            {heroStatus === 'SUCCESS' && (
              <p className="p5-hero__note" data-testid="p5-success-subtext">
                Demo evidence only — not real Happy Potato operations
              </p>
            )}
            {freshness === 'OUT_OF_DATE' && (
              <p className="p5-hero__note" data-testid="p5-freshness-badge">
                Evidence changed since the last check — verify again.
              </p>
            )}
            <div className="p5-row" style={{ marginTop: '10px', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <Button variant="primary" onClick={handleVerify} data-testid="p5-verify-btn">
                Verify simulated outcome
              </Button>
              {(outcome !== null || p5.escalationState === 'ESCALATED') && (
                <Button
                  variant={savedMemory ? 'secondary' : heroStatus === 'UNVERIFIED' ? 'secondary' : 'primary'}
                  onClick={handleSaveMemory}
                  aria-label="Save case to Decision Memory"
                  data-testid="p5-save-memory-btn"
                >
                  Add case to Decision Memory
                </Button>
              )}
              {savedMemory && (
                <Link to="/decision-memory" className="fm-btn fm-btn--primary p5-btn p5-btn--primary" data-testid="p5-next-step-cta">
                  View in Decision Memory →
                </Link>
              )}
            </div>
            <p className="p5-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              A supplier message is not evidence. Only recorded demo evidence counts.
            </p>
          </header>

          {/* Missing Evidence Checklist — directly under the hero */}
          {previewMissing.length > 0 && (
            <section className="p5-card p5-card--accent-warn p5-stack" aria-label="Missing evidence checklist" data-testid="p5-missing-evidence-list">
              <div className="p5-row" style={{ justifyContent: 'space-between' }}>
                <h3>Still needed</h3>
                <span className="p5-badge p5-badge--warn">
                  {previewMissing.length} of {requiredCount} item{requiredCount === 1 ? '' : 's'} missing
                </span>
              </div>
              <ul className="p5-checklist">
                {previewMissing.map((m) => {
                  const matchingTask = findMatchingTask(m, tasks);
                  const kind = evidenceKindOf(m);
                  const allowed = ROLES_BY_EVIDENCE[kind] ?? [];
                  return (
                    <li key={m} className="p5-checklist__item" title={m}>
                      <span>
                        <span aria-hidden="true">✗ </span>
                        {describeMissing(m, ctx)} <span className="p5-muted">— {roleList(allowed)} can record it</span>
                      </span>
                      {matchingTask && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedActionId(matchingTask.id);
                            const el = document.getElementById('p5-evidence-entry-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          Record this →
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Verification Reasons Summary */}
          {verified && checks.length > 0 && (
            <section className="p5-card p5-stack" aria-label="Verification reasons">
              <div className="p5-row" style={{ justifyContent: 'space-between' }}>
                <h3>Why this result</h3>
                <span className="p5-badge fm-badge">{checks.length} checks</span>
              </div>
              <div className="p5-grid2">
                <ReasonGroup title="Hard failures" kind="HARD_FAILURE" reasons={checks} icon="✗" ctx={ctx} />
                <ReasonGroup title="Missing evidence" kind="MISSING" reasons={checks} icon="○" ctx={ctx} />
                <ReasonGroup title="Below plan" kind="SHORTFALL" reasons={checks} icon="!" ctx={ctx} />
                <ReasonGroup title="Passed checks" kind="PASS" reasons={checks} icon="✓" ctx={ctx} />
              </div>
            </section>
          )}

          {/* Predicted vs Simulated Actual Table */}
          <section className="p5-card p5-stack" aria-label="Predicted vs Simulated Actual">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h2>Predicted vs Simulated Actual</h2>
              <P5Details summary="Audit details">Approval {activeApproval.id}</P5Details>
            </div>
            <div className="fm-table-wrap p5-table-wrap" role="region" aria-label="Predicted vs Simulated Actual Table" tabIndex={0}>
              <table className="fm-table p5-table" data-testid="p5-predicted-actual-table">
                <caption className="p2-sr sr-only">Predicted vs Simulated Actual Table</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '28%' }}>Metric / Task</th>
                    <th scope="col" style={{ width: '26%' }}>Predicted (from Approval)</th>
                    <th scope="col" style={{ width: '26%' }}>Simulated Actual</th>
                    <th scope="col" style={{ width: '20%' }}>Source & Revision</th>
                  </tr>
                </thead>
                <tbody>
                  {activeApproval.selectedStrategy === 'A' ? (
                    <PlanATableRows approval={activeApproval} evidence={p5.evidence} deadline={deadline} />
                  ) : (
                    <PlanBTableRows approval={activeApproval} tasks={tasks} evidence={p5.evidence} ctx={ctx} />
                  )}
                  <tr>
                    <th scope="row">External acknowledgment</th>
                    <td colSpan={3} title="NOT_APPLICABLE_SIMULATION · SIMULATED_LOCAL_ONLY">
                      Not applicable — nothing was sent outside the demo
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Evidence Entry Forms */}
          <section id="p5-evidence-entry-section" className="p5-card p5-stack" aria-label="Record simulated evidence">
            <div className="p5-row" style={{ justifyContent: 'space-between' }}>
              <h2>Record demo evidence</h2>
              <span className="p5-badge p5-badge--sim" title="SIMULATED_EVIDENCE">
                {TRUTH_LABELS.SIMULATED_EVIDENCE.label}
              </span>
            </div>

            <div className="p5-row">
              <label htmlFor="p5-task-select" style={{ minWidth: '240px' }}>
                Task:
                <select
                  id="p5-task-select"
                  value={activeTask?.id ?? ''}
                  onChange={(e) => setSelectedActionId(e.target.value)}
                  data-testid="p5-task-select"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {taskLabel(t, ctx)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeTask && (
              <EvidenceForm
                key={activeTask.id}
                ctx={ctx}
                clock={w.clock}
                task={activeTask}
                currentRole={currentRole}
                approval={activeApproval}
                onSaved={(msg) => setLive(msg)}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ReasonGroup({
  title,
  kind,
  reasons,
  icon,
  ctx,
}: {
  title: string;
  kind: OutcomeReason['kind'];
  reasons: OutcomeReason[];
  icon: string;
  ctx: ReasonContext;
}) {
  const filtered = reasons.filter((r) => r.kind === kind);
  if (filtered.length === 0) return null;
  const groupToneClass =
    kind === 'HARD_FAILURE' ? 'p5-reason-card--danger' : kind === 'PASS' ? 'p5-reason-card--success' : 'p5-reason-card--warn';
  return (
    <div className={`p5-stack p5-card p5-reason-card ${groupToneClass}`} style={{ padding: '12px 14px', background: 'var(--surface-secondary)' }}>
      <h4>
        {title} ({filtered.length})
      </h4>
      <ul className="p5-checklist">
        {filtered.map((r, i) => (
          <li key={i} title={r.code}>
            <span aria-hidden="true">{icon} </span>
            {describeReason(r, ctx)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function taskLabel(t: ExecutionAction, ctx: ReasonContext): string {
  switch (t.actionType) {
    case 'PO_DRAFT':
      return 'Purchase order draft';
    case 'RECEIPT_CHECK':
      return 'Delivery & quality check';
    case 'MENU_LIMIT_TASK':
      return `Menu limit — ${t.targetId ? ctx.menuName(t.targetId) : 'menu item'}`;
    case 'PREP_BATCH_TASK':
      return t.targetId ? ctx.batchLabel(t.targetId) : 'Prep batch';
  }
}

function PlanATableRows({ approval, evidence, deadline }: { approval: ApprovalRecord; evidence: VerificationEvidence[]; deadline: string | null }) {
  const rEv = latestForKind(evidence, 'RECEIPT');
  const fEv = latestForKind(evidence, 'ORDER_FULFILMENT');

  return (
    <>
      <tr>
        <th scope="row">Received chilled chicken</th>
        <td>{formatKgMilli(approval.predicted.newPurchaseKgMilli)}</td>
        <td data-testid="p5-actual-received-kg">
          {rEv ? formatKgMilli(rEv.payload.receivedKgMilli) : 'Not recorded yet'}
        </td>
        <td><EvidenceSourceBadge ev={rEv} /></td>
      </tr>
      <tr>
        <th scope="row">Acceptance</th>
        <td>Accepted (quality check)</td>
        <td data-testid="p5-actual-acceptance">
          {rEv ? (rEv.payload.accepted ? 'Accepted' : 'Rejected') : 'Not recorded yet'}
        </td>
        <td><EvidenceSourceBadge ev={rEv} /></td>
      </tr>
      <tr>
        <th scope="row">Arrival</th>
        <td>{deadline ? `By ${deadline}` : 'Before the prep cutoff'}</td>
        <td data-testid="p5-actual-arrival">
          {rEv ? rEv.payload.arrivalLocal : 'Not recorded yet'}
        </td>
        <td><EvidenceSourceBadge ev={rEv} /></td>
      </tr>
      <tr>
        <th scope="row">Landed cost</th>
        <td>{formatSenAsRM(approval.predicted.additionalCostSen)}</td>
        <td data-testid="p5-actual-landed-cost">
          {rEv ? formatSenAsRM(rEv.payload.landedCostSen) : 'Not recorded yet'}
        </td>
        <td><EvidenceSourceBadge ev={rEv} /></td>
      </tr>
      <tr>
        <th scope="row">Confirmed portions fulfilled</th>
        <td>{approval.predicted.confirmedChickenPortionsProtected}</td>
        <td data-testid="p5-actual-confirmed-portions">
          {fEv ? fEv.payload.confirmedFulfilled : 'Not recorded yet'}
        </td>
        <td><EvidenceSourceBadge ev={fEv} /></td>
      </tr>
      <tr>
        <th scope="row">Chicken forecast portions served</th>
        <td>{approval.predicted.forecastChickenPortionsServed} (conditional)</td>
        <td data-testid="p5-actual-forecast-served">Not measured in this demo</td>
        <td><span className="p5-muted">—</span></td>
      </tr>
    </>
  );
}

function PlanBTableRows({
  approval,
  tasks,
  evidence,
  ctx,
}: {
  approval: ApprovalRecord;
  tasks: ExecutionAction[];
  evidence: VerificationEvidence[];
  ctx: ReasonContext;
}) {
  const prepTasks = tasks.filter((t) => t.actionType === 'PREP_BATCH_TASK');
  const menuTasks = tasks.filter((t) => t.actionType === 'MENU_LIMIT_TASK');
  const fEv = latestForKind(evidence, 'ORDER_FULFILMENT');

  // Total produced portions across all PREP evidence
  const allPrepEvs = prepTasks
    .map((t) => evidence.filter((e): e is Extract<VerificationEvidence, { kind: 'PREP' }> => e.actionId === t.id && e.kind === 'PREP').reverse()[0])
    .filter((e): e is Extract<VerificationEvidence, { kind: 'PREP' }> => e !== undefined);
  const totalProduced = allPrepEvs.length > 0 ? allPrepEvs.reduce((acc, e) => acc + e.payload.producedPortions, 0) : null;

  // Menus count applied
  const allMenuEvs = menuTasks
    .map((t) => evidence.filter((e): e is Extract<VerificationEvidence, { kind: 'MENU_UPDATE' }> => e.actionId === t.id && e.kind === 'MENU_UPDATE').reverse()[0])
    .filter((e): e is Extract<VerificationEvidence, { kind: 'MENU_UPDATE' }> => e !== undefined);
  const menusApplied = allMenuEvs.filter((e) => e.payload.applied).length;

  return (
    <>
      {prepTasks.map((t) => {
        const pEv = evidence.filter((e): e is Extract<VerificationEvidence, { kind: 'PREP' }> => e.actionId === t.id && e.kind === 'PREP').reverse()[0];
        const planned = t.plannedPortions;
        return (
          <tr key={t.id}>
            <th scope="row" title={t.targetId}>
              {t.targetId ? ctx.batchLabel(t.targetId) : 'Prep batch'} produced
            </th>
            <td>{planned !== undefined ? `${planned} portions` : 'Not provided by Plan B'}</td>
            <td data-testid={`p5-actual-batch-${t.targetId}`}>
              {pEv ? `${pEv.payload.producedPortions} portions` : 'Not recorded yet'}
            </td>
            <td><EvidenceSourceBadge ev={pEv} /></td>
          </tr>
        );
      })}

      <tr>
        <th scope="row">Menu limit tasks applied</th>
        <td>
          {menuTasks.length} of {menuTasks.length} limits live
        </td>
        <td data-testid="p5-actual-menus-applied">
          {allMenuEvs.length > 0 ? `${menusApplied} of ${menuTasks.length} confirmed live` : 'Not recorded yet'}
        </td>
        <td>
          {allMenuEvs.length > 0 ? (
            <span className="p5-badge p5-badge--sim" title="SIMULATED_EVIDENCE">Demo evidence</span>
          ) : (
            <span className="p5-muted">—</span>
          )}
        </td>
      </tr>

      <tr>
        <th scope="row">Confirmed portions fulfilled</th>
        <td>{approval.predicted.confirmedChickenPortionsProtected}</td>
        <td data-testid="p5-actual-confirmed-portions">
          {fEv ? fEv.payload.confirmedFulfilled : 'Not recorded yet'}
        </td>
        <td><EvidenceSourceBadge ev={fEv} /></td>
      </tr>

      <tr>
        <th scope="row">Waste</th>
        <td>No prediction</td>
        <td data-testid="p5-actual-waste">
          {allPrepEvs.length > 0 ? formatWasteSummary(allPrepEvs) : 'Not recorded yet'}
        </td>
        <td>
          {allPrepEvs.length > 0 ? (
            <span className="p5-badge p5-badge--sim" title="SIMULATED_EVIDENCE">Demo evidence</span>
          ) : (
            <span className="p5-muted">—</span>
          )}
        </td>
      </tr>

      <tr>
        <th scope="row">Chicken forecast portions planned</th>
        <td>{approval.predicted.forecastChickenPortionsServed}</td>
        <td data-testid="p5-actual-forecast-planned">
          {totalProduced !== null ? `${totalProduced} produced` : 'Not recorded yet'}
        </td>
        <td>
          {totalProduced !== null ? (
            <span className="p5-badge p5-badge--sim" title="SIMULATED_EVIDENCE">Demo evidence</span>
          ) : (
            <span className="p5-muted">—</span>
          )}
        </td>
      </tr>
    </>
  );
}

function EvidenceSourceBadge({ ev }: { ev?: VerificationEvidence }) {
  if (!ev) return <span className="p5-muted">—</span>;
  return (
    <div className="p5-row" style={{ gap: '6px' }} title={`${ev.source} · ${ev.id}`}>
      <span className="p5-badge p5-badge--sim">Demo evidence</span>
      <span style={{ fontSize: '11.5px' }}>revision {ev.revision}</span>
    </div>
  );
}

function formatWasteSummary(evs: VerificationEvidence[]): string {
  const parts: string[] = [];
  for (const e of evs) {
    if (e.kind === 'PREP') {
      const w = e.payload.waste;
      if (w.status === 'UNKNOWN') {
        parts.push(`${e.payload.batchId}: unknown`);
      } else {
        parts.push(`${e.payload.batchId}: ${formatKgMilli(w.valueMilli)}`);
      }
    }
  }
  return parts.join(', ');
}

type Ev<K extends EvidenceKind> = Extract<VerificationEvidence, { kind: K }>;

function latestForKind<K extends EvidenceKind>(log: VerificationEvidence[], kind: K): Ev<K> | undefined {
  const list = log.filter((e): e is Ev<K> => e.kind === kind);
  return list.reverse()[0];
}

function findMatchingTask(missingCode: string, tasks: ExecutionAction[]): ExecutionAction | undefined {
  if (missingCode === 'RECEIPT') {
    return tasks.find((t) => t.actionType === 'RECEIPT_CHECK') ?? tasks.find((t) => t.actionType === 'PO_DRAFT');
  }
  if (missingCode.startsWith('PREP:')) {
    const target = missingCode.slice(5);
    return tasks.find((t) => t.targetId === target);
  }
  if (missingCode.startsWith('MENU_UPDATE:')) {
    const target = missingCode.slice(12);
    return tasks.find((t) => t.targetId === target);
  }
  if (missingCode === 'ORDER_FULFILMENT') {
    return tasks[0];
  }
  return undefined;
}

function evidenceKindOf(missingCode: string): EvidenceKind {
  if (missingCode === 'RECEIPT') return 'RECEIPT';
  if (missingCode.startsWith('PREP')) return 'PREP';
  if (missingCode.startsWith('MENU_UPDATE')) return 'MENU_UPDATE';
  return 'ORDER_FULFILMENT';
}

function EvidenceForm({
  task,
  currentRole,
  approval,
  onSaved,
  ctx,
  clock,
}: {
  task: ExecutionAction;
  currentRole: DemoRole;
  approval: ApprovalRecord;
  onSaved: (msg: string) => void;
  ctx: ReasonContext;
  clock: string | null;
}) {
  const p5 = useP5Store((s) => s.p5);
  const evidenceLogs = selectEvidenceForAction({ p5 } as any, task.id);

  // Form selection by task type
  let evidenceKind: EvidenceKind = 'ORDER_FULFILMENT';
  if (task.actionType === 'PO_DRAFT' || task.actionType === 'RECEIPT_CHECK') {
    evidenceKind = 'RECEIPT';
  } else if (task.actionType === 'PREP_BATCH_TASK') {
    evidenceKind = 'PREP';
  } else if (task.actionType === 'MENU_LIMIT_TASK') {
    evidenceKind = 'MENU_UPDATE';
  }

  const allowedRoles = ROLES_BY_EVIDENCE[evidenceKind];
  const isAllowed = hasCapability(currentRole, { kind: 'RECORD_EVIDENCE', evidenceKind });

  // Receipt fields
  // Defaults come from the approved plan and the demo clock — never literals.
  const [rcvKg, setRcvKg] = useState(String(approval.predicted.newPurchaseKgMilli / 1000));
  const [accepted, setAccepted] = useState('yes');
  const [arrival, setArrival] = useState(clock ?? '');
  const [landedCost, setLandedCost] = useState((approval.predicted.additionalCostSen / 100).toFixed(2));

  // Prep fields
  const plannedPortions = task.plannedPortions ?? 0;
  const [producedPortions, setProducedPortions] = useState(String(plannedPortions));
  const [completedTime, setCompletedTime] = useState(clock ?? '');
  const [wasteStatus, setWasteStatus] = useState<'UNKNOWN' | 'MEASURED'>('UNKNOWN');
  const [wasteKg, setWasteKg] = useState('0');

  // Menu update fields
  const [applied, setApplied] = useState('yes');

  // Order fulfilment fields
  const [confirmedFulfilled, setConfirmedFulfilled] = useState(String(approval.predicted.confirmedChickenPortionsProtected));
  const [err, setErr] = useState('');

  const handleRevisePrefill = (ev: VerificationEvidence) => {
    if (ev.kind === 'RECEIPT') {
      setRcvKg(String(ev.payload.receivedKgMilli / 1000));
      setAccepted(ev.payload.accepted ? 'yes' : 'no');
      setArrival(ev.payload.arrivalLocal);
      setLandedCost((ev.payload.landedCostSen / 100).toFixed(2));
    } else if (ev.kind === 'PREP') {
      setProducedPortions(String(ev.payload.producedPortions));
      setCompletedTime(ev.payload.completedLocal);
      if (ev.payload.waste.status === 'UNKNOWN') {
        setWasteStatus('UNKNOWN');
      } else {
        setWasteStatus('MEASURED');
        setWasteKg(String(ev.payload.waste.valueMilli / 1000));
      }
    } else if (ev.kind === 'MENU_UPDATE') {
      setApplied(ev.payload.applied ? 'yes' : 'no');
    } else if (ev.kind === 'ORDER_FULFILMENT') {
      setConfirmedFulfilled(String(ev.payload.confirmedFulfilled));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');

    if (evidenceKind === 'RECEIPT') {
      const kg = parseFloat(rcvKg);
      const cost = parseFloat(landedCost);
      if (isNaN(kg) || kg < 0) {
        setErr('Received kg must be a non-negative number.');
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(arrival)) {
        setErr('Arrival time must be HH:mm (e.g. 10:30).');
        return;
      }
      if (isNaN(cost) || cost < 0) {
        setErr('Landed cost must be a non-negative number.');
        return;
      }
      const res = p5.recordSimulatedEvidence(task.id, 'RECEIPT', {
        receivedKgMilli: Math.round(kg * 1000),
        accepted: accepted === 'yes',
        arrivalLocal: arrival,
        landedCostSen: Math.round(cost * 100),
      });
      if (!res.ok) {
        setErr(p5ErrorMessage(res.error, res.detail));
      } else {
        onSaved(`Recorded delivery receipt (revision ${res.value.revision}).`);
      }
    } else if (evidenceKind === 'PREP') {
      const produced = parseInt(producedPortions, 10);
      if (isNaN(produced) || produced < 0) {
        setErr('Produced portions must be a non-negative integer.');
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(completedTime)) {
        setErr('Completed time must be HH:mm.');
        return;
      }
      let waste: Measured = { status: 'UNKNOWN' };
      if (wasteStatus === 'MEASURED') {
        const wKg = parseFloat(wasteKg);
        if (isNaN(wKg) || wKg < 0) {
          setErr('Waste kg must be a non-negative number.');
          return;
        }
        waste = { status: 'MEASURED', valueMilli: Math.round(wKg * 1000) };
      }
      const res = p5.recordSimulatedEvidence(task.id, 'PREP', {
        batchId: task.targetId!,
        producedPortions: produced,
        plannedPortions,
        waste,
        completedLocal: completedTime,
      });
      if (!res.ok) {
        setErr(p5ErrorMessage(res.error, res.detail));
      } else {
        onSaved(`Recorded ${taskLabel(task, ctx)} result (revision ${res.value.revision}).`);
      }
    } else if (evidenceKind === 'MENU_UPDATE') {
      const res = p5.recordSimulatedEvidence(task.id, 'MENU_UPDATE', {
        menuId: task.targetId!,
        applied: applied === 'yes',
      });
      if (!res.ok) {
        setErr(p5ErrorMessage(res.error, res.detail));
      } else {
        onSaved(`Recorded ${taskLabel(task, ctx)} confirmation (revision ${res.value.revision}).`);
      }
    } else if (evidenceKind === 'ORDER_FULFILMENT') {
      const fulfilled = parseInt(confirmedFulfilled, 10);
      if (isNaN(fulfilled) || fulfilled < 0) {
        setErr('Confirmed fulfilled portions must be a non-negative integer.');
        return;
      }
      const res = p5.recordSimulatedEvidence(task.id, 'ORDER_FULFILMENT', {
        confirmedFulfilled: fulfilled,
        confirmedRequired: approval.predicted.confirmedChickenPortionsProtected,
      });
      if (!res.ok) {
        setErr(p5ErrorMessage(res.error, res.detail));
      } else {
        onSaved(`Recorded confirmed orders served (revision ${res.value.revision}).`);
      }
    }
  };

  const idRcv = useId();
  const idAcc = useId();
  const idArr = useId();
  const idCost = useId();
  const idProd = useId();
  const idComp = useId();
  const idApp = useId();
  const idFul = useId();

  return (
    <div className="p5-stack" data-testid={`p5-evidence-form-${task.id}`}>
      <h3 title={`${evidenceKind} · ${task.id}`}>
        {EVIDENCE_KIND_LABELS[evidenceKind].label} — {taskLabel(task, ctx)}
      </h3>

      {!isAllowed && (
        <div className="p5-alert p5-alert--warn" role="alert" data-testid="p5-role-forbidden-alert">
          {roleLabel(currentRole)} can&apos;t record this. Only {roleList(allowedRoles)} can record {EVIDENCE_KIND_LABELS[evidenceKind].label.toLowerCase()}.
        </div>
      )}

      {err && (
        <div className="p5-alert p5-alert--danger" role="alert" data-testid="p5-evidence-error">
          {err}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p5-stack">
        <fieldset disabled={!isAllowed} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
          {evidenceKind === 'RECEIPT' && (
            <>
              <label htmlFor={idRcv}>
                Received Weight (kg):
                <input
                  id={idRcv}
                  type="number"
                  step="0.1"
                  min="0"
                  value={rcvKg}
                  onChange={(e) => setRcvKg(e.target.value)}
                  required
                  data-testid="p5-input-rcv-kg"
                />
              </label>
              <label htmlFor={idAcc}>
                Quality Check Acceptance:
                <select
                  id={idAcc}
                  value={accepted}
                  onChange={(e) => setAccepted(e.target.value)}
                  data-testid="p5-input-accepted"
                >
                  <option value="yes">Accepted (Pass)</option>
                  <option value="no">Rejected (Fail)</option>
                </select>
              </label>
              <label htmlFor={idArr}>
                Arrival Local Time (HH:mm):
                <input
                  id={idArr}
                  type="text"
                  placeholder="10:30"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                  required
                  data-testid="p5-input-arrival"
                />
              </label>
              <label htmlFor={idCost}>
                Landed Cost (RM):
                <input
                  id={idCost}
                  type="number"
                  step="0.01"
                  min="0"
                  value={landedCost}
                  onChange={(e) => setLandedCost(e.target.value)}
                  required
                  data-testid="p5-input-cost"
                />
              </label>
            </>
          )}

          {evidenceKind === 'PREP' && (
            <>
              <div className="p5-row">
                <span title={task.targetId}>
                  Batch: <strong>{task.targetId ? ctx.batchLabel(task.targetId) : '—'}</strong>
                </span>
                <span>Planned portions: <strong>{plannedPortions}</strong></span>
              </div>
              <label htmlFor={idProd}>
                Produced Portions:
                <input
                  id={idProd}
                  type="number"
                  min="0"
                  value={producedPortions}
                  onChange={(e) => setProducedPortions(e.target.value)}
                  required
                  data-testid="p5-input-produced-portions"
                />
              </label>
              <label htmlFor={idComp}>
                Completion Local Time (HH:mm):
                <input
                  id={idComp}
                  type="text"
                  placeholder="11:20"
                  value={completedTime}
                  onChange={(e) => setCompletedTime(e.target.value)}
                  required
                  data-testid="p5-input-completed-time"
                />
              </label>
              <div className="p5-stack">
                <span style={{ fontWeight: 600 }}>Waste:</span>
                <div className="p5-row">
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="waste"
                      checked={wasteStatus === 'UNKNOWN'}
                      onChange={() => setWasteStatus('UNKNOWN')}
                      data-testid="p5-radio-waste-unknown"
                    />
                    Unknown
                  </label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="waste"
                      checked={wasteStatus === 'MEASURED'}
                      onChange={() => setWasteStatus('MEASURED')}
                      data-testid="p5-radio-waste-measured"
                    />
                    Measured (kg)
                  </label>
                  {wasteStatus === 'MEASURED' && (
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={wasteKg}
                      onChange={(e) => setWasteKg(e.target.value)}
                      style={{ width: '100px' }}
                      data-testid="p5-input-waste-kg"
                    />
                  )}
                </div>
              </div>
              <p className="p5-muted" style={{ fontSize: '12px' }}>
                P4 Prep Planning records batch actuals through the same evidence store.
              </p>
            </>
          )}

          {evidenceKind === 'MENU_UPDATE' && (
            <>
              <div className="p5-row">
                <span title={task.targetId}>
                  Menu item: <strong>{task.targetId ? ctx.menuName(task.targetId) : '—'}</strong>
                </span>
              </div>
              <label htmlFor={idApp}>
                Staff confirmed the menu limit is live:
                <select
                  id={idApp}
                  value={applied}
                  onChange={(e) => setApplied(e.target.value)}
                  data-testid="p5-input-applied"
                >
                  <option value="yes">Yes</option>
                  <option value="no">Not yet</option>
                </select>
              </label>
            </>
          )}

          {evidenceKind === 'ORDER_FULFILMENT' && (
            <>
              <div className="p5-row">
                <span>Confirmed Portions Required: <strong>{approval.predicted.confirmedChickenPortionsProtected}</strong> (read-only)</span>
              </div>
              <label htmlFor={idFul}>
                Confirmed Portions Fulfilled:
                <input
                  id={idFul}
                  type="number"
                  min="0"
                  value={confirmedFulfilled}
                  onChange={(e) => setConfirmedFulfilled(e.target.value)}
                  required
                  data-testid="p5-input-confirmed-fulfilled"
                />
              </label>
            </>
          )}

          <div>
            <button
              type="submit"
              className="fm-btn fm-btn--primary p5-btn p5-btn--primary"
              disabled={!isAllowed}
              data-testid="p5-submit-evidence-btn"
            >
              Save simulated evidence
            </button>
          </div>
        </fieldset>
      </form>

      {/* Revision History */}
      <details className="p5-card" style={{ marginTop: '8px', background: 'var(--surface-secondary)' }} data-testid="p5-revision-history">
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
          Revision history for this task ({evidenceLogs.all.length} revision{evidenceLogs.all.length === 1 ? '' : 's'})
        </summary>
        {evidenceLogs.all.length === 0 ? (
          <p className="p5-muted" style={{ marginTop: '8px' }}>
            No evidence recorded for this task yet.
          </p>
        ) : (
          <ul className="p5-list" style={{ marginTop: '8px' }}>
            {[...evidenceLogs.all].reverse().map((ev) => (
              <li key={ev.id} className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div title={`${ev.kind} · ${ev.id} · ${ev.recordedById}`}>
                  <strong>Revision {ev.revision}</strong> · {EVIDENCE_KIND_LABELS[ev.kind].label} recorded by{' '}
                  <strong>{roleLabel(ev.recordedByRole)}</strong> at {demoTime(ev.observedAtIso)}
                  <div className="p5-muted" style={{ fontSize: '12px' }}>
                    {payloadSummary(ev, ctx)}
                  </div>
                </div>
                {isAllowed && (
                  <button
                    type="button"
                    className="p5-btn"
                    onClick={() => handleRevisePrefill(ev)}
                    data-testid={`p5-revise-btn-rev${ev.revision}`}
                  >
                    Revise
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function payloadSummary(ev: VerificationEvidence, ctx: ReasonContext): string {
  switch (ev.kind) {
    case 'RECEIPT':
      return `Received ${formatKgMilli(ev.payload.receivedKgMilli)}, ${ev.payload.accepted ? 'accepted' : 'rejected'}, arrived ${ev.payload.arrivalLocal}, landed cost ${formatSenAsRM(ev.payload.landedCostSen)}`;
    case 'PREP':
      return `${ctx.batchLabel(ev.payload.batchId)}: ${ev.payload.producedPortions} of ${ev.payload.plannedPortions} portions, waste ${
        ev.payload.waste.status === 'UNKNOWN' ? 'unknown' : formatKgMilli(ev.payload.waste.valueMilli)
      }`;
    case 'MENU_UPDATE':
      return `Menu limit for ${ctx.menuName(ev.payload.menuId)}: ${ev.payload.applied ? 'confirmed live' : 'not live yet'}`;
    case 'ORDER_FULFILMENT':
      return `Served ${ev.payload.confirmedFulfilled} of ${ev.payload.confirmedRequired} confirmed portions`;
  }
}

