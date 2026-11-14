import { describe, expect, it } from 'vitest';
import { approve, makeHarness, type Harness } from '../recovery/governance/testHarness';
import type { P5Deps } from '../recovery/governance/p5Deps';
import { preflightApproval } from './approvalLogic';
import { preflightExecution } from './executionLogic';

function depsOf(h: Harness): Parameters<typeof preflightApproval>[1] {
  const d: Pick<P5Deps, 'getScenario' | 'getSnapshot' | 'getCurrentRole' | 'getDemoClockLocal' | 'nowIso'> = {
    getScenario: (s) => h.env.scenarios[s],
    getSnapshot: () => h.env.snapshot,
    getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
    getDemoClockLocal: () => h.env.clock,
    nowIso: () => '',
  };
  return d;
}

/** Asserts preflight and the real call agree, and that preflight did not mutate state. */
function agree(h: Harness) {
  const before = h.p5().approvals.length;
  const pre = preflightApproval(h.p5(), depsOf(h));
  expect(h.p5().approvals.length).toBe(before);
  const sel = h.p5().selection;
  const res = h.p5().approveDemoScenario('reason', sel?.version ?? -1, sel?.fingerprint ?? '');
  if (pre === null) expect(res.ok).toBe(true);
  else expect(res).toMatchObject({ ok: false, error: pre.error });
  return pre;
}

function execAgree(h: Harness, actionId: string, expectedApprovalId: string) {
  const beforeAudit = h.p5().auditLog.length;
  const pre = preflightExecution(h.p5(), depsOf(h), actionId);
  expect(h.p5().auditLog.length).toBe(beforeAudit);
  const res = h.p5().simulateExecutionAction(actionId, expectedApprovalId, 'test reason');
  if (pre === null) {
    expect(res.ok).toBe(true);
  } else {
    expect(res).toMatchObject({ ok: false, error: pre.error });
  }
  return pre;
}

describe('preflightApproval agrees with approveDemoScenario', () => {
  it('NO_SELECTION', () => {
    expect(agree(makeHarness())?.error).toBe('NO_SELECTION');
  });
  it('STALE_SCENARIO', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    h.changeSnapshot('fp-2');
    expect(agree(h)?.error).toBe('STALE_SCENARIO');
  });
  it('PLAN_B_PURCHASE_FORBIDDEN', () => {
    const h = makeHarness();
    const b = h.env.scenarios.B!;
    h.env.scenarios.B = { ...b, proposedActions: [...b.proposedActions, { actionType: 'PO_DRAFT' }] };
    h.p5().chooseRecoveryScenario('B');
    expect(agree(h)?.error).toBe('PLAN_B_PURCHASE_FORBIDDEN');
  });
  it('DEMO_FORBIDDEN names the blocked action types', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    h.env.role = 'OperationsManager';
    const pre = agree(h);
    expect(pre?.error).toBe('DEMO_FORBIDDEN');
    expect(pre?.detail).toBe('OperationsManager cannot approve MENU_LIMIT_TASK.');
  });
  it('DUPLICATE_REQUEST', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    expect(agree(h)).toBeNull();
    expect(agree(h)?.error).toBe('DUPLICATE_REQUEST');
  });
  it('APPROVAL_EXPIRED (A only)', () => {
    const h = makeHarness();
    h.env.clock = '10:50';
    h.p5().chooseRecoveryScenario('A');
    expect(agree(h)?.error).toBe('APPROVAL_EXPIRED');
    h.p5().chooseRecoveryScenario('B');
    expect(agree(h)).toBeNull();
  });
});

describe('rejectSelectedScenario', () => {
  it('records REJECTED, emits PLAN_REJECTED, clears selection, creates no tasks', () => {
    const h = makeHarness();
    expect(h.p5().rejectSelectedScenario('x')).toMatchObject({ error: 'NO_SELECTION' });
    h.p5().chooseRecoveryScenario('B');
    expect(h.p5().rejectSelectedScenario(' ')).toMatchObject({ error: 'MISSING_REASON' });
    const r = h.p5().rejectSelectedScenario('too many unmet portions');
    expect(r).toMatchObject({ ok: true, value: { state: 'REJECTED', scenarioId: 'HP-SC-B-001', scenarioVersion: 1 } });
    expect(h.p5().selection).toBeNull();
    expect(h.p5().actions).toHaveLength(0);
    expect(h.events.map((e) => e.type)).toContain('PLAN_REJECTED');
    h.p5().chooseRecoveryScenario('B');
    expect(h.p5().rejectSelectedScenario('again')).toMatchObject({ error: 'DUPLICATE_REQUEST' });
    expect(h.p5().approvals).toHaveLength(1);
  });
  it('rejection is not an approval: verify/memory see no approved plan', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    h.p5().rejectSelectedScenario('no');
    expect(h.p5().verifyDemoOutcome('HP-INC-001')).toMatchObject({ error: 'NOT_FOUND' });
  });
  it('ViewerAuditor cannot reject', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    h.env.role = 'ViewerAuditor';
    expect(h.p5().rejectSelectedScenario('no')).toMatchObject({ error: 'DEMO_FORBIDDEN' });
  });
  it('recalculation after escalation re-opens choosing', () => {
    const h = makeHarness();
    h.p5().rejectBothAndEscalate('neither');
    expect(h.p5().recalculationRequestedSinceEscalation).toBe(false);
    h.p5().requestRecalculation('revise');
    expect(h.p5().recalculationRequestedSinceEscalation).toBe(true);
  });
});

describe('preflightExecution agrees with simulateExecutionAction', () => {
  it('NOT_FOUND for unknown action', () => {
    const h = makeHarness();
    const app = approve(h, 'B');
    const pre = execAgree(h, 'unknown-action-id', app);
    expect(pre?.error).toBe('NOT_FOUND');
  });

  it('DEMO_FORBIDDEN names blocked role and lists allowed roles', () => {
    const h = makeHarness();
    const app = approve(h, 'B');
    const menuAction = h.p5().actions.find((a) => a.actionType === 'MENU_LIMIT_TASK')!;
    h.env.role = 'KitchenLead';
    const pre = execAgree(h, menuAction.id, app);
    expect(pre?.error).toBe('DEMO_FORBIDDEN');
    expect(pre?.detail).toContain('KitchenLead cannot execute MENU_LIMIT_TASK');
    expect(pre?.allowedRoles).toEqual(['Owner', 'OperationsManager']);
  });

  it('STALE_SCENARIO when snapshot fingerprint changes', () => {
    const h = makeHarness();
    const app = approve(h, 'B');
    const prepAction = h.p5().actions.find((a) => a.actionType === 'PREP_BATCH_TASK')!;
    h.changeSnapshot('fp-changed-123');
    const pre = execAgree(h, prepAction.id, app);
    expect(pre?.error).toBe('STALE_SCENARIO');
  });

  it('APPROVAL_EXPIRED when demo clock passes Plan A deadline (10:45)', () => {
    const h = makeHarness();
    const app = approve(h, 'A');
    const poAction = h.p5().actions.find((a) => a.actionType === 'PO_DRAFT')!;
    h.env.clock = '10:50';
    const pre = execAgree(h, poAction.id, app);
    expect(pre?.error).toBe('APPROVAL_EXPIRED');
  });

  it('INVALID_TRANSITION when action already reaches AWAITING_EVIDENCE', () => {
    const h = makeHarness();
    const app = approve(h, 'B');
    const prepAction = h.p5().actions.find((a) => a.actionType === 'PREP_BATCH_TASK')!;
    // Advance APPROVED -> SIMULATED_EXECUTION
    h.p5().simulateExecutionAction(prepAction.id, app, 'step 1');
    // Advance SIMULATED_EXECUTION -> AWAITING_EVIDENCE
    h.p5().simulateExecutionAction(prepAction.id, app, 'step 2');
    const pre = execAgree(h, prepAction.id, app);
    expect(pre?.error).toBe('INVALID_TRANSITION');
  });

  it('returns null and real call succeeds when valid', () => {
    const h = makeHarness();
    const app = approve(h, 'B');
    const prepAction = h.p5().actions.find((a) => a.actionType === 'PREP_BATCH_TASK')!;
    const pre = execAgree(h, prepAction.id, app);
    expect(pre).toBeNull();
  });
});
