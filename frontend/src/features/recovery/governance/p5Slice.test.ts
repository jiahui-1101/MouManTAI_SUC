import { describe, expect, it } from 'vitest';
import { devScenarioA, devScenarioB } from '../../../__dev__/mockScenarios';
import { approve, makeHarness } from './testHarness';
import {
  selectComparisonReadiness,
  selectDecisionMemory,
  selectExecutionTasks,
  selectIsScenarioStale,
  selectPendingApprovals,
  selectSuccessfulCaseCount,
} from './selectors';
import { formatOutcomeLabel } from '../../outcomes/verifyOutcome';
import { approvalIdFromKey, approvalKey, actionIdFromKey, taskKey } from '../../approvals/idempotency';

const eventTypes = (h: ReturnType<typeof makeHarness>) => h.events.map((e) => e.type);

describe('comparison (P5-T01, P5-T02)', () => {
  it('P5-T01: reads A=25500/150 CONDITIONAL and B=0/72 FEASIBLE straight from scenarios', () => {
    const h = makeHarness();
    const a = h.env.scenarios.A!;
    const b = h.env.scenarios.B!;
    expect([a.additionalCostSen, a.forecastChickenPortionsServed, a.feasibility]).toEqual([25500, 150, 'CONDITIONAL']);
    expect([b.additionalCostSen, b.forecastChickenPortionsServed, b.feasibility]).toEqual([0, 72, 'FEASIBLE']);
    expect(selectComparisonReadiness(a, b)).toBe('READY');
    // Change the published numbers: P5 approval must carry them through verbatim (no hardcoding).
    h.env.scenarios.A = { ...a, additionalCostSen: 31337, forecastChickenPortionsServed: 149 };
    approve(h, 'A');
    expect(h.p5().approvals[0]!.predicted.additionalCostSen).toBe(31337);
    expect(h.p5().approvals[0]!.predicted.forecastChickenPortionsServed).toBe(149);
  });

  it('P5-T02: 78 only surfaces as forecast unmet; protected stays 60', () => {
    const h = makeHarness();
    approve(h, 'B');
    const pred = h.p5().approvals[0]!.predicted;
    expect(pred.forecastChickenPortionsUnmet).toBe(78);
    expect(pred.confirmedChickenPortionsProtected).toBe(60);
    expect(Object.entries(pred).filter(([, v]) => v === 78).map(([k]) => k)).toEqual(['forecastChickenPortionsUnmet']);
  });

  it('readiness states', () => {
    const a = devScenarioA();
    expect(selectComparisonReadiness(null, null)).toBe('WAITING_BOTH');
    expect(selectComparisonReadiness(a, null)).toBe('ONLY_A');
    expect(selectComparisonReadiness(null, devScenarioB())).toBe('ONLY_B');
    expect(selectComparisonReadiness(a, devScenarioB('other'))).toBe('FINGERPRINT_MISMATCH');
  });
});

describe('selection (P5-T03/T04)', () => {
  it('selecting A or B creates no approval and no tasks', () => {
    const h = makeHarness();
    expect(h.p5().chooseRecoveryScenario('A').ok).toBe(true);
    expect(h.p5().chooseRecoveryScenario('B').ok).toBe(true);
    expect(h.p5().approvals).toHaveLength(0);
    expect(h.p5().actions).toHaveLength(0);
    expect(h.p5().selection?.strategy).toBe('B');
    expect(eventTypes(h)).toEqual(['SCENARIO_SELECTED', 'SCENARIO_SELECTED']);
  });

  it('missing scenario → SCENARIO_NOT_READY; mismatched fingerprints → FINGERPRINT_MISMATCH; stale → STALE_SCENARIO', () => {
    const h = makeHarness({ B: false });
    expect(h.p5().chooseRecoveryScenario('B')).toMatchObject({ ok: false, error: 'SCENARIO_NOT_READY' });
    h.env.scenarios.B = devScenarioB('other-fp');
    expect(h.p5().chooseRecoveryScenario('A')).toMatchObject({ ok: false, error: 'FINGERPRINT_MISMATCH' });
    expect(h.p5().chooseRecoveryScenario('B')).toMatchObject({ ok: false, error: 'STALE_SCENARIO' });
  });

  it('B never yields PO_DRAFT; B injected with PO_DRAFT → PLAN_B_PURCHASE_FORBIDDEN', () => {
    const h = makeHarness();
    approve(h, 'B');
    expect(h.p5().actions.some((a) => a.actionType === 'PO_DRAFT')).toBe(false);

    const h2 = makeHarness();
    const b = h2.env.scenarios.B!;
    h2.env.scenarios.B = { ...b, proposedActions: [...b.proposedActions, { actionType: 'PO_DRAFT' }] };
    const sel = h2.p5().chooseRecoveryScenario('B');
    expect(sel.ok).toBe(true);
    const res = h2.p5().approveDemoScenario('x', b.version, b.snapshotFingerprint);
    expect(res).toMatchObject({ ok: false, error: 'PLAN_B_PURCHASE_FORBIDDEN' });
    expect(h2.p5().approvals).toHaveLength(0);
  });
});

describe('approval (P5-T05..T08)', () => {
  it('P5-T05: approve creates a version-bound record and tasks; execution is separate', () => {
    const h = makeHarness();
    const id = approve(h, 'A');
    const rec = h.p5().approvals[0]!;
    expect(rec).toMatchObject({
      id,
      scenarioId: 'HP-SC-A-001',
      scenarioVersion: 1,
      snapshotFingerprint: h.env.snapshot.fingerprint,
      selectedStrategy: 'A',
      actorRole: 'Owner',
      approvedActionTypes: ['PO_DRAFT', 'RECEIPT_CHECK'],
      expiresAtIso: '2026-11-21T10:45:00+08:00',
      consumed: true,
      simulationOnly: true,
      state: 'APPROVED',
    });
    expect(h.p5().actions.map((a) => a.actionType)).toEqual(['PO_DRAFT', 'RECEIPT_CHECK']);
    expect(h.p5().actions.every((a) => a.state === 'APPROVED' && a.simulated)).toBe(true);
    expect(h.p5().auditLog).toHaveLength(0);
    expect(eventTypes(h)).toEqual(['SCENARIO_SELECTED', 'PLAN_APPROVED', 'EXECUTION_TASKS_CREATED']);
  });

  it('B creates 3 MENU_LIMIT_TASK + 4 PREP_BATCH_TASK with targets from the scenario; expiry null', () => {
    const h = makeHarness();
    approve(h, 'B');
    expect(h.p5().approvals[0]!.expiresAtIso).toBeNull();
    const acts = h.p5().actions;
    expect(acts.filter((a) => a.actionType === 'MENU_LIMIT_TASK').map((a) => a.targetId)).toEqual(['HP-MENU-CP', 'HP-MENU-CT', 'HP-MENU-HC']);
    expect(acts.filter((a) => a.actionType === 'PREP_BATCH_TASK').map((a) => a.targetId)).toEqual([
      'HP-BATCH-B-01', 'HP-BATCH-B-02', 'HP-BATCH-B-03', 'HP-BATCH-B-04',
    ]);
    expect(acts.filter((a) => a.actionType === 'MENU_LIMIT_TASK').every((a) => a.externalSyncStatus === 'AWAITING_MANUAL_UPDATE')).toBe(true);
    expect(acts.filter((a) => a.actionType === 'PREP_BATCH_TASK').every((a) => a.externalSyncStatus === 'SIMULATED_LOCAL_ONLY')).toBe(true);
  });

  it('validation order: NO_SELECTION, MISSING_REASON, STALE_SCENARIO, DEMO_FORBIDDEN', () => {
    const h = makeHarness();
    const fp = h.env.snapshot.fingerprint;
    expect(h.p5().approveDemoScenario('', 1, fp)).toMatchObject({ error: 'NO_SELECTION' });
    h.p5().chooseRecoveryScenario('B');
    expect(h.p5().approveDemoScenario('  ', 1, fp)).toMatchObject({ error: 'MISSING_REASON' });
    expect(h.p5().approveDemoScenario('r', 2, fp)).toMatchObject({ error: 'STALE_SCENARIO' });
    h.env.role = 'OperationsManager';
    expect(h.p5().approveDemoScenario('r', 1, fp)).toMatchObject({ error: 'DEMO_FORBIDDEN' });
    h.env.role = 'ViewerAuditor';
    expect(h.p5().approveDemoScenario('r', 1, fp)).toMatchObject({ error: 'DEMO_FORBIDDEN' });
    expect(h.p5().approvals).toHaveLength(0);
  });

  it('P5-T06: ViewerAuditor cannot select, escalate, execute or record evidence', () => {
    const h = makeHarness();
    approve(h, 'A');
    h.env.role = 'ViewerAuditor';
    const act = h.p5().actions[0]!;
    expect(h.p5().chooseRecoveryScenario('A')).toMatchObject({ error: 'DEMO_FORBIDDEN' });
    expect(h.p5().rejectBothAndEscalate('r')).toMatchObject({ error: 'DEMO_FORBIDDEN' });
    expect(h.p5().simulateExecutionAction(act.id, act.approvalId, 'r')).toMatchObject({ error: 'DEMO_FORBIDDEN' });
    expect(h.p5().recordSimulatedEvidence(act.id, 'ORDER_FULFILMENT', { confirmedFulfilled: 60, confirmedRequired: 60 })).toMatchObject({ error: 'DEMO_FORBIDDEN' });
  });

  it('P5-T07: fingerprint change after selection → approve STALE; after approval → simulate STALE', () => {
    const h = makeHarness();
    const sel = h.p5().chooseRecoveryScenario('A');
    if (!sel.ok) throw new Error();
    h.changeSnapshot('fp-2');
    expect(h.p5().approveDemoScenario('r', sel.value.version, sel.value.fingerprint)).toMatchObject({ error: 'STALE_SCENARIO' });
    expect(selectIsScenarioStale(h.env.scenarios.A, h.env.snapshot)).toBe(true);

    const h2 = makeHarness();
    approve(h2, 'A');
    h2.changeSnapshot('fp-2');
    const act = h2.p5().actions[0]!;
    expect(h2.p5().simulateExecutionAction(act.id, act.approvalId, 'go')).toMatchObject({ error: 'STALE_SCENARIO' });
    expect(selectPendingApprovals(h2.state(), { fingerprint: 'fp-2', demoClockLocal: '09:00' })).toHaveLength(0);
  });

  it('P5-T08: double approve → one record, one event, DUPLICATE_REQUEST; createExecutionTasks twice → no duplicates', () => {
    const h = makeHarness();
    const id = approve(h, 'B');
    const fp = h.env.snapshot.fingerprint;
    h.p5().chooseRecoveryScenario('B');
    expect(h.p5().approveDemoScenario('again', 1, fp)).toMatchObject({ ok: false, error: 'DUPLICATE_REQUEST' });
    expect(h.p5().approvals).toHaveLength(1);
    expect(eventTypes(h).filter((t) => t === 'PLAN_APPROVED')).toHaveLength(1);
    expect(h.p5().createExecutionTasks(id)).toMatchObject({ ok: false, error: 'DUPLICATE_REQUEST' });
    expect(h.p5().createExecutionTasks(id)).toMatchObject({ ok: false, error: 'DUPLICATE_REQUEST' });
    expect(h.p5().actions).toHaveLength(7);
    expect(eventTypes(h).filter((t) => t === 'EXECUTION_TASKS_CREATED')).toHaveLength(1);
  });

  it('requestDemoApproval records the request and emits APPROVAL_REQUESTED without approving', () => {
    const h = makeHarness();
    expect(h.p5().requestDemoApproval()).toMatchObject({ error: 'NO_SELECTION' });
    h.p5().chooseRecoveryScenario('A');
    expect(h.p5().requestDemoApproval().ok).toBe(true);
    expect(h.p5().approvalRequest?.scenarioId).toBe('HP-SC-A-001');
    expect(h.p5().approvals).toHaveLength(0);
  });
});

describe('demo clock', () => {
  it('Plan A approve at 10:50 → APPROVAL_EXPIRED; Plan B unaffected', () => {
    const h = makeHarness();
    h.env.clock = '10:50';
    const sel = h.p5().chooseRecoveryScenario('A');
    if (!sel.ok) throw new Error();
    expect(h.p5().approveDemoScenario('r', 1, sel.value.fingerprint)).toMatchObject({ error: 'APPROVAL_EXPIRED' });
    expect(() => approve(h, 'B')).not.toThrow();
  });

  it('10:45 exactly is still valid', () => {
    const h = makeHarness();
    h.env.clock = '10:45';
    expect(() => approve(h, 'A')).not.toThrow();
  });

  it('Plan A simulate after the clock passes 10:45 → APPROVAL_EXPIRED; excluded from pending', () => {
    const h = makeHarness();
    approve(h, 'A');
    h.env.clock = '10:46';
    const act = h.p5().actions[0]!;
    expect(h.p5().simulateExecutionAction(act.id, act.approvalId, 'go')).toMatchObject({ error: 'APPROVAL_EXPIRED' });
    expect(selectPendingApprovals(h.state(), { fingerprint: h.env.snapshot.fingerprint, demoClockLocal: '10:46' })).toHaveLength(0);
    expect(selectPendingApprovals(h.state(), { fingerprint: h.env.snapshot.fingerprint, demoClockLocal: '10:00' })).toHaveLength(1);
  });
});

describe('execution transitions', () => {
  it('APPROVED → SIMULATED_EXECUTION → AWAITING_EVIDENCE, then INVALID_TRANSITION', () => {
    const h = makeHarness();
    approve(h, 'A');
    const act = h.p5().actions[0]!;
    const step = () => h.p5().simulateExecutionAction(act.id, act.approvalId, 'go');
    expect(step()).toMatchObject({ ok: true, value: { state: 'SIMULATED_EXECUTION' } });
    expect(step()).toMatchObject({ ok: true, value: { state: 'AWAITING_EVIDENCE' } });
    expect(step()).toMatchObject({ ok: false, error: 'INVALID_TRANSITION' });
    expect(h.p5().auditLog.map((e) => `${e.from}>${e.to}`)).toEqual([
      'APPROVED>SIMULATED_EXECUTION',
      'SIMULATED_EXECUTION>AWAITING_EVIDENCE',
    ]);
    expect(h.p5().actions.some((a) => a.state === 'VERIFIED')).toBe(false);
  });

  it('requires reason, matching approval, execute permission', () => {
    const h = makeHarness();
    approve(h, 'B');
    const prep = h.p5().actions.find((a) => a.actionType === 'PREP_BATCH_TASK')!;
    const menu = h.p5().actions.find((a) => a.actionType === 'MENU_LIMIT_TASK')!;
    expect(h.p5().simulateExecutionAction('nope', prep.approvalId, 'r')).toMatchObject({ error: 'NOT_FOUND' });
    expect(h.p5().simulateExecutionAction(prep.id, prep.approvalId, '')).toMatchObject({ error: 'MISSING_REASON' });
    expect(h.p5().simulateExecutionAction(prep.id, 'wrong', 'r')).toMatchObject({ error: 'NOT_FOUND' });
    h.env.role = 'KitchenLead';
    expect(h.p5().simulateExecutionAction(prep.id, prep.approvalId, 'r').ok).toBe(true);
    expect(h.p5().simulateExecutionAction(menu.id, menu.approvalId, 'r')).toMatchObject({ error: 'DEMO_FORBIDDEN' });
  });

  it('menu task stays AWAITING_MANUAL_UPDATE until MENU_UPDATE applied=true; nothing says SYNCED', () => {
    const h = makeHarness();
    approve(h, 'B');
    const menu = h.p5().actions.find((a) => a.actionType === 'MENU_LIMIT_TASK')!;
    h.p5().simulateExecutionAction(menu.id, menu.approvalId, 'go');
    h.p5().simulateExecutionAction(menu.id, menu.approvalId, 'go');
    const cur = () => h.p5().actions.find((a) => a.id === menu.id)!;
    expect(cur().externalSyncStatus).toBe('AWAITING_MANUAL_UPDATE');
    h.p5().recordSimulatedEvidence(menu.id, 'MENU_UPDATE', { menuId: menu.targetId!, applied: false });
    expect(cur().externalSyncStatus).toBe('AWAITING_MANUAL_UPDATE');
    h.p5().recordSimulatedEvidence(menu.id, 'MENU_UPDATE', { menuId: menu.targetId!, applied: true });
    expect(cur().externalSyncStatus).toBe('MANUALLY_CONFIRMED_DEMO');
    expect(JSON.stringify(h.state().p5)).not.toMatch(/SYNCED/);
  });
});

// ---- outcome helpers -------------------------------------------------------
function completeB(h: ReturnType<typeof makeHarness>, opts: { skipBatch?: string; waste?: 'UNKNOWN' | 'ZERO' } = {}) {
  for (const a of h.p5().actions) {
    if (a.actionType === 'PREP_BATCH_TASK' && a.targetId !== opts.skipBatch) {
      const r = h.p5().recordSimulatedEvidence(a.id, 'PREP', {
        batchId: a.targetId!,
        producedPortions: a.plannedPortions!,
        plannedPortions: a.plannedPortions!,
        waste: opts.waste === 'ZERO' ? { status: 'MEASURED', valueMilli: 0 } : { status: 'UNKNOWN' },
        completedLocal: '12:20',
      });
      if (!r.ok) throw new Error(r.detail);
    }
    if (a.actionType === 'MENU_LIMIT_TASK') h.p5().recordSimulatedEvidence(a.id, 'MENU_UPDATE', { menuId: a.targetId!, applied: true });
  }
  const any = h.p5().actions[0]!;
  h.p5().recordSimulatedEvidence(any.id, 'ORDER_FULFILMENT', { confirmedFulfilled: 60, confirmedRequired: 60 });
}

function receiptA(h: ReturnType<typeof makeHarness>, arrivalLocal = '10:30', accepted = true) {
  const rc = h.p5().actions.find((a) => a.actionType === 'RECEIPT_CHECK')!;
  return h.p5().recordSimulatedEvidence(rc.id, 'RECEIPT', { receivedKgMilli: 15000, accepted, arrivalLocal, landedCostSen: 25500 });
}

describe('outcomes (P5-T09..T13)', () => {
  it('P5-T09: A with no RECEIPT → UNVERIFIED', () => {
    const h = makeHarness();
    approve(h, 'A');
    const r = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(r).toMatchObject({ ok: true, value: { status: 'UNVERIFIED', actual: null, simulated: true } });
    if (r.ok) expect(r.value.missingEvidence).toEqual(['RECEIPT', 'ORDER_FULFILMENT']);
  });

  it('A complete → SUCCESS; predicted copied from scenario', () => {
    const h = makeHarness();
    approve(h, 'A');
    receiptA(h);
    const rc = h.p5().actions[1]!;
    h.p5().recordSimulatedEvidence(rc.id, 'ORDER_FULFILMENT', { confirmedFulfilled: 60, confirmedRequired: 60 });
    const r = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(r).toMatchObject({ ok: true, value: { status: 'SUCCESS', predicted: { additionalCostSen: 25500 } } });
  });

  it('P5-T10: B with 3 of 4 PREP → PARTIAL', () => {
    const h = makeHarness();
    approve(h, 'B');
    completeB(h, { skipBatch: 'HP-BATCH-B-04' });
    const r = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(r).toMatchObject({ ok: true, value: { status: 'PARTIAL' } });
    if (r.ok) expect(r.value.missingEvidence).toEqual(['PREP:HP-BATCH-B-04']);
  });

  it('B with a batch below plan → PARTIAL', () => {
    const h = makeHarness();
    approve(h, 'B');
    completeB(h);
    const b1 = h.p5().actions.find((a) => a.targetId === 'HP-BATCH-B-01')!;
    h.p5().recordSimulatedEvidence(b1.id, 'PREP', { batchId: 'HP-BATCH-B-01', producedPortions: 20, plannedPortions: 25, waste: { status: 'UNKNOWN' }, completedLocal: '11:20' });
    expect(h.p5().verifyDemoOutcome('HP-INC-001')).toMatchObject({ value: { status: 'PARTIAL' } });
  });

  it('P5-T11: complete B → SUCCESS with label', () => {
    const h = makeHarness();
    approve(h, 'B');
    completeB(h);
    const r = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(r).toMatchObject({ ok: true, value: { status: 'SUCCESS' } });
    if (r.ok) expect(formatOutcomeLabel(r.value.status)).toBe('Simulated Outcome: SUCCESS');
  });

  it('FAILED: A arrival 11:00; rejected receipt; fulfilment 55/60; FAILED beats missing evidence', () => {
    const late = makeHarness();
    approve(late, 'A');
    receiptA(late, '11:00');
    expect(late.p5().verifyDemoOutcome('HP-INC-001')).toMatchObject({ value: { status: 'FAILED' } }); // ORDER_FULFILMENT still missing

    const rej = makeHarness();
    approve(rej, 'A');
    receiptA(rej, '10:30', false);
    expect(rej.p5().verifyDemoOutcome('HP-INC-001')).toMatchObject({ value: { status: 'FAILED' } });

    const short = makeHarness();
    approve(short, 'B');
    const any = short.p5().actions[0]!;
    short.p5().recordSimulatedEvidence(any.id, 'ORDER_FULFILMENT', { confirmedFulfilled: 55, confirmedRequired: 60 });
    const r = short.p5().verifyDemoOutcome('HP-INC-001');
    expect(r).toMatchObject({ value: { status: 'FAILED' } });
    if (r.ok) expect(r.value.missingEvidence.length).toBeGreaterThan(0);
  });

  it('P5-T13: UNKNOWN waste stays UNKNOWN and does not block SUCCESS; measured 0 is distinct', () => {
    const h = makeHarness();
    approve(h, 'B');
    completeB(h, { waste: 'UNKNOWN' });
    const r = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(r).toMatchObject({ value: { status: 'SUCCESS' } });
    if (r.ok) expect(r.value.actual?.waste?.every((w) => w.waste.status === 'UNKNOWN')).toBe(true);

    const z = makeHarness();
    approve(z, 'B');
    completeB(z, { waste: 'ZERO' });
    const rz = z.p5().verifyDemoOutcome('HP-INC-001');
    if (rz.ok) expect(rz.value.actual?.waste?.[0]?.waste).toEqual({ status: 'MEASURED', valueMilli: 0 });
  });
});

describe('evidence', () => {
  it('re-record → revision 2, revision 1 retained, verify uses latest', () => {
    const h = makeHarness();
    approve(h, 'A');
    receiptA(h, '11:00');
    const r2 = receiptA(h, '10:40');
    expect(r2).toMatchObject({ ok: true, value: { revision: 2, source: 'SIMULATED_EVIDENCE' } });
    expect(h.p5().evidence.filter((e) => e.kind === 'RECEIPT').map((e) => e.revision)).toEqual([1, 2]);
    const rc = h.p5().actions[1]!;
    h.p5().recordSimulatedEvidence(rc.id, 'ORDER_FULFILMENT', { confirmedFulfilled: 60, confirmedRequired: 60 });
    expect(h.p5().verifyDemoOutcome('HP-INC-001')).toMatchObject({ value: { status: 'SUCCESS' } });
  });

  it('permission and payload validation', () => {
    const h = makeHarness();
    approve(h, 'B');
    const prep = h.p5().actions.find((a) => a.actionType === 'PREP_BATCH_TASK')!;
    h.env.role = 'KitchenLead';
    expect(h.p5().recordSimulatedEvidence(prep.id, 'ORDER_FULFILMENT', { confirmedFulfilled: 1, confirmedRequired: 1 })).toMatchObject({ error: 'DEMO_FORBIDDEN' });
    const bad = { batchId: prep.targetId!, producedPortions: 2.5, plannedPortions: 25, waste: { status: 'UNKNOWN' as const }, completedLocal: '11:00' };
    expect(h.p5().recordSimulatedEvidence(prep.id, 'PREP', bad)).toMatchObject({ error: 'INVALID_EVIDENCE' });
    expect(h.p5().recordSimulatedEvidence(prep.id, 'PREP', { ...bad, producedPortions: 25, batchId: 'HP-BATCH-X' })).toMatchObject({ error: 'INVALID_EVIDENCE' });
    expect(h.p5().recordSimulatedEvidence(prep.id, 'PREP', { ...bad, producedPortions: 25, completedLocal: '25:00' })).toMatchObject({ error: 'INVALID_EVIDENCE' });
    expect(h.p5().evidence).toHaveLength(0);
  });
});

describe('escalation (P5-T14)', () => {
  it('escalate → ESCALATED, no tasks, selection cleared; recalculation emits event', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    expect(h.p5().rejectBothAndEscalate('')).toMatchObject({ error: 'MISSING_REASON' });
    expect(h.p5().rejectBothAndEscalate('both unacceptable').ok).toBe(true);
    expect(h.p5().escalationState).toBe('ESCALATED');
    expect(h.p5().selection).toBeNull();
    expect(h.p5().actions).toHaveLength(0);
    expect(h.p5().approvals).toHaveLength(0);
    expect(h.p5().requestRecalculation('revise constraints')).toMatchObject({ ok: true, value: { fromState: 'ESCALATED', seq: 1 } });
    expect(eventTypes(h)).toContain('RECALCULATION_REQUESTED');
    expect(eventTypes(h)).toContain('ESCALATED');
    // re-entry after version+1
    h.env.scenarios.A = devScenarioA(h.env.snapshot.fingerprint, 2);
    expect(h.p5().chooseRecoveryScenario('A')).toMatchObject({ ok: true, value: { version: 2 } });
    expect(h.p5().escalationState).toBe('NONE');
  });

  it('requestRecalculation works from normal state and clears selection', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    expect(h.p5().requestRecalculation('stock changed')).toMatchObject({ ok: true, value: { fromState: 'NONE' } });
    expect(h.p5().selection).toBeNull();
  });
});

describe('decision memory (P5-T16)', () => {
  it('saves UNVERIFIED and ESCALATED cases; success count only counts SUCCESS; idempotent', () => {
    const esc = makeHarness();
    esc.p5().rejectBothAndEscalate('no');
    const e = esc.p5().saveDemoDecisionMemory('HP-INC-001');
    expect(e).toMatchObject({ ok: true, value: { strategy: 'ESCALATED', outcomeStatus: 'UNVERIFIED' } });
    expect(selectSuccessfulCaseCount(esc.state())).toBe(0);

    const unv = makeHarness();
    approve(unv, 'A');
    expect(unv.p5().saveDemoDecisionMemory('HP-INC-001')).toMatchObject({ ok: true, value: { outcomeStatus: 'UNVERIFIED', evidenceQuality: 'NONE' } });
    expect(unv.p5().saveDemoDecisionMemory('HP-INC-001')).toMatchObject({ ok: false, error: 'DUPLICATE_REQUEST' });
    expect(selectSuccessfulCaseCount(unv.state())).toBe(0);

    const ok = makeHarness();
    approve(ok, 'B');
    completeB(ok);
    ok.p5().verifyDemoOutcome('HP-INC-001');
    const m = ok.p5().saveDemoDecisionMemory('HP-INC-001');
    expect(m).toMatchObject({ ok: true, value: { outcomeStatus: 'SUCCESS', evidenceQuality: 'COMPLETE', strategy: 'B' } });
    if (m.ok) {
      expect(m.value.lessons.some((l) => l.kind === 'DETERMINISTIC_FACT')).toBe(true);
      expect(m.value.lessons.some((l) => l.kind === 'DEMO_INTERPRETATION')).toBe(true);
    }
    expect(selectSuccessfulCaseCount(ok.state())).toBe(1);
    expect(selectDecisionMemory(ok.state(), { strategy: 'A' })).toHaveLength(0);
    expect(selectDecisionMemory(ok.state(), { outcomeStatus: 'SUCCESS' })).toHaveLength(1);
  });
});

describe('reset, selectors, determinism', () => {
  it('resetP5 clears P5 state only and keeps actions callable', () => {
    const h = makeHarness();
    approve(h, 'B');
    const snapBefore = { ...h.env.snapshot };
    h.p5().resetP5();
    expect(h.p5().approvals).toEqual([]);
    expect(h.p5().actions).toEqual([]);
    expect(h.p5().selection).toBeNull();
    expect(h.env.snapshot).toEqual(snapBefore);
    expect(() => approve(h, 'B')).not.toThrow();
  });

  it('selectors are referentially stable', () => {
    const h = makeHarness();
    approve(h, 'B');
    const ctx = { fingerprint: h.env.snapshot.fingerprint, demoClockLocal: '09:00' };
    expect(selectPendingApprovals(h.state(), ctx)).toBe(selectPendingApprovals(h.state(), { ...ctx }));
    const id = h.p5().approvals[0]!.id;
    expect(selectExecutionTasks(h.state(), id)).toBe(selectExecutionTasks(h.state(), id));
    expect(selectDecisionMemory(h.state(), { strategy: 'B' })).toBe(selectDecisionMemory(h.state(), { strategy: 'B' }));
  });

  it('same inputs → identical IDs and keys across runs', () => {
    const run = () => {
      const h = makeHarness();
      approve(h, 'B');
      return { a: h.p5().approvals.map((x) => x.id), t: h.p5().actions.map((x) => x.id) };
    };
    expect(run()).toEqual(run());
    const k = approvalKey('HP-SC-B-001', 1, 'fp');
    expect(k).toBe('HP-SC-B-001:1:fp:APPROVE');
    expect(approvalIdFromKey(k)).toBe(approvalIdFromKey(k));
    expect(taskKey('apr', 'PREP_BATCH_TASK', 'HP-BATCH-B-01')).toBe('apr:PREP_BATCH_TASK:HP-BATCH-B-01');
    expect(actionIdFromKey('x')).toBe(actionIdFromKey('x'));
  });
});
