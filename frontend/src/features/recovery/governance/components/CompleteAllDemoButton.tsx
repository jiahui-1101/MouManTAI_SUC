import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useP5Runtime, useP5Store } from '../p5Store';
import { p5ErrorMessage } from '../p5Errors';
import type { ExecutionAction } from '../p5Contracts';

const REASON = 'Demo shortcut: task completed as planned (simulated)';
const BATCH_TIME: Record<string, string> = { 'HP-BATCH-B-01': '11:20', 'HP-BATCH-B-02': '11:40', 'HP-BATCH-B-03': '12:00', 'HP-BATCH-B-04': '12:15' };

/**
 * Demo shortcut for presentations: runs every remaining execution step, records
 * as-planned SIMULATED evidence through the normal P5 actions (same validation,
 * audit log and role checks), verifies the outcome and opens Outcomes.
 * Nothing external is contacted; every record stays labelled simulated.
 */
export function CompleteAllDemoButton() {
  const { store } = useP5Runtime();
  const p5 = useP5Store((s) => s.p5);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const approval = [...p5.approvals].reverse().find((a) => a.state === 'APPROVED');
  const outcome = approval ? p5.outcomes[approval.incidentId] : undefined;
  const done = outcome?.status === 'SUCCESS';

  const run = () => {
    if (!approval) return;
    setError('');
    const api = () => store.getState().p5;
    const fail = (r: { ok: false; error: string; detail?: string }) => { setError(p5ErrorMessage(r.error as never, r.detail)); return false; };
    const tasks = (): ExecutionAction[] => api().actions.filter((a) => a.approvalId === approval.id);
    // 1. Advance every task through each remaining simulated step.
    for (let guard = 0; guard < 50; guard++) {
      const next = tasks().find((t) => t.state === 'APPROVED' || t.state === 'SIMULATED_EXECUTION');
      if (!next) break;
      const r = api().simulateExecutionAction(next.id, approval.id, REASON);
      if (!r.ok) return fail(r);
    }
    // 2. Record as-planned evidence for every task.
    const recorded = (kind: string, id: string) => api().evidence.some((e) => e.actionId === id && e.kind === kind);
    for (const t of tasks()) {
      if (t.actionType === 'MENU_LIMIT_TASK' && t.targetId && !recorded('MENU_UPDATE', t.id)) {
        const r = api().recordSimulatedEvidence(t.id, 'MENU_UPDATE', { menuId: t.targetId, applied: true });
        if (!r.ok) return fail(r);
      }
      if (t.actionType === 'PREP_BATCH_TASK' && t.targetId && !recorded('PREP', t.id)) {
        const planned = t.plannedPortions ?? 0;
        const r = api().recordSimulatedEvidence(t.id, 'PREP', { batchId: t.targetId, producedPortions: planned, plannedPortions: planned, waste: { status: 'UNKNOWN' }, completedLocal: BATCH_TIME[t.targetId] ?? '11:30' });
        if (!r.ok) return fail(r);
      }
      if ((t.actionType === 'RECEIPT_CHECK' || t.actionType === 'PO_DRAFT') && !api().evidence.some((e) => e.kind === 'RECEIPT' && tasks().some((x) => x.id === e.actionId))) {
        const r = api().recordSimulatedEvidence(t.id, 'RECEIPT', { receivedKgMilli: approval.predicted.newPurchaseKgMilli, accepted: true, arrivalLocal: '10:30', landedCostSen: approval.predicted.additionalCostSen });
        if (!r.ok) return fail(r);
      }
    }
    const first = tasks()[0];
    if (first && !api().evidence.some((e) => e.kind === 'ORDER_FULFILMENT' && tasks().some((x) => x.id === e.actionId))) {
      const required = approval.predicted.confirmedChickenPortionsProtected;
      const r = api().recordSimulatedEvidence(first.id, 'ORDER_FULFILMENT', { confirmedFulfilled: required, confirmedRequired: required });
      if (!r.ok) return fail(r);
    }
    // 3. Verify and show the result.
    const v = api().verifyDemoOutcome(approval.incidentId);
    if (!v.ok) return fail(v);
    navigate('/outcomes');
    return true;
  };

  return <span className="p5-complete-all">
    <button type="button" className="fm-btn fm-btn--ghost fm-btn--sm" disabled={!approval || done} onClick={run}
      title={!approval ? 'Approve a plan first' : 'Demo shortcut: simulate every task, record as-planned evidence and verify the outcome'}
      data-testid="p5-complete-all">
      {done ? 'Completed (demo)' : 'Complete all (demo)'}
    </button>
    {error && <span role="alert" className="p5-complete-all__error">{error}</span>}
  </span>;
}
