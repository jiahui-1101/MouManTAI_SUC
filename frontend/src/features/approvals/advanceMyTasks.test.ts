import { describe, expect, it } from 'vitest';
import { approve, makeHarness, type Harness } from '../recovery/governance/testHarness';
import { advanceMyTasks, planAdvanceMyTasks } from './executionLogic';

const run = (h: Harness, reason = 'demo advance') => advanceMyTasks(h.p5(), h.deps, reason);

describe('advanceMyTasks', () => {
  it('requires a reason', () => {
    const h = makeHarness();
    approve(h, 'B');
    expect(run(h, '  ')).toMatchObject({ ok: false, error: 'MISSING_REASON' });
    expect(h.p5().auditLog).toHaveLength(0);
  });

  it('KitchenLead advances only PREP tasks; the rest are skipped with the role reason', () => {
    const h = makeHarness();
    approve(h, 'B');
    h.env.role = 'KitchenLead';
    const r = run(h);
    if (!r.ok) throw new Error(r.detail);
    expect(r.value.advanced).toHaveLength(4);
    expect(r.value.advanced.every((a) => a.actionType === 'PREP_BATCH_TASK')).toBe(true);
    expect(r.value.skipped).toHaveLength(3);
    expect(r.value.skipped.every((s) => s.actionType === 'MENU_LIMIT_TASK' && s.error === 'DEMO_FORBIDDEN')).toBe(true);
  });

  it('advances exactly one step per call and writes one audit entry per advanced task', () => {
    const h = makeHarness();
    approve(h, 'B');
    const first = run(h);
    if (!first.ok) throw new Error();
    expect(first.value.advanced).toHaveLength(7);
    expect(h.p5().actions.every((a) => a.state === 'SIMULATED_EXECUTION')).toBe(true);
    expect(h.p5().auditLog).toHaveLength(7);
    expect(h.p5().auditLog.every((e) => e.reason === 'demo advance')).toBe(true);
  });

  it('a repeated call advances the next step, never skips one, and never reaches VERIFIED', () => {
    const h = makeHarness();
    approve(h, 'B');
    run(h);
    run(h);
    expect(h.p5().actions.every((a) => a.state === 'AWAITING_EVIDENCE')).toBe(true);
    expect(h.p5().auditLog.map((e) => `${e.from}>${e.to}`).filter((x) => x === 'APPROVED>SIMULATED_EXECUTION')).toHaveLength(7);
    const third = run(h);
    if (!third.ok) throw new Error();
    expect(third.value.advanced).toHaveLength(0);
    expect(h.p5().auditLog).toHaveLength(14);
    expect(h.p5().actions.some((a) => a.state === 'VERIFIED')).toBe(false);
  });

  it('stale snapshot blocks every task', () => {
    const h = makeHarness();
    approve(h, 'B');
    h.changeSnapshot('fp-2');
    const r = run(h);
    if (!r.ok) throw new Error();
    expect(r.value.advanced).toHaveLength(0);
    expect(r.value.skipped).toHaveLength(7);
    expect(r.value.skipped.every((s) => s.error === 'STALE_SCENARIO')).toBe(true);
    expect(h.p5().auditLog).toHaveLength(0);
  });

  it('expired Plan A approval blocks every task', () => {
    const h = makeHarness();
    approve(h, 'A');
    h.env.clock = '10:50';
    const r = run(h);
    if (!r.ok) throw new Error();
    expect(r.value.advanced).toHaveLength(0);
    expect(r.value.skipped.every((s) => s.error === 'APPROVAL_EXPIRED')).toBe(true);
  });

  it('planAdvanceMyTasks is pure (no state change)', () => {
    const h = makeHarness();
    approve(h, 'B');
    const before = h.p5().actions;
    const plan = planAdvanceMyTasks(h.p5(), h.deps);
    expect(plan.eligible).toHaveLength(7);
    expect(h.p5().actions).toBe(before);
  });
});
