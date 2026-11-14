import { describe, expect, it } from 'vitest';
import { CHECKPOINTS, runCheckpoint, type CheckpointId } from './demoCheckpoints';
import { makeHarness, type Harness } from './testHarness';

function rt(h: Harness) {
  return { store: h.store, adapter: { deps: h.deps, setRole: (r: typeof h.env.role) => void (h.env.role = r) } };
}

function at(id: CheckpointId, prep?: (h: Harness) => void) {
  const h = makeHarness();
  prep?.(h);
  const res = runCheckpoint(id, rt(h));
  return { h, res };
}

describe('demo checkpoints', () => {
  it('lists six checkpoints in story order', () => {
    expect(CHECKPOINTS.map((c) => c.id)).toEqual([
      'PLANS_READY', 'B_CHOSEN', 'B_APPROVED', 'ALL_AWAITING_EVIDENCE', 'EVIDENCE_COMPLETE', 'A_LATE_FAILED',
    ]);
  });

  it('every checkpoint resets earlier P5 state first and ends as Owner', () => {
    const h = makeHarness();
    runCheckpoint('A_LATE_FAILED', rt(h));
    const res = runCheckpoint('PLANS_READY', rt(h));
    expect(res.ok).toBe(true);
    expect(h.p5().approvals).toHaveLength(0);
    expect(h.p5().evidence).toHaveLength(0);
    expect(h.env.role).toBe('Owner');
  });

  it('Plans ready: nothing chosen; fails clearly when no plan is published', () => {
    const { h, res } = at('PLANS_READY');
    expect(res.ok).toBe(true);
    expect(h.p5().selection).toBeNull();
    const none = at('PLANS_READY', (x) => {
      x.env.scenarios.A = null;
      x.env.scenarios.B = null;
    });
    expect(none.res).toMatchObject({ ok: false, error: 'SCENARIO_NOT_READY' });
  });

  it('Plan B chosen: selection only, no approval', () => {
    const { h, res } = at('B_CHOSEN');
    expect(res.ok).toBe(true);
    expect(h.p5().selection?.strategy).toBe('B');
    expect(h.p5().approvals).toHaveLength(0);
  });

  it('Plan B approved: one Owner approval, 7 tasks not started', () => {
    const { h, res } = at('B_APPROVED');
    expect(res.ok).toBe(true);
    expect(h.p5().approvals).toMatchObject([{ state: 'APPROVED', actorRole: 'Owner', selectedStrategy: 'B' }]);
    expect(h.p5().actions).toHaveLength(7);
    expect(h.p5().actions.every((a) => a.state === 'APPROVED')).toBe(true);
  });

  it('All tasks awaiting evidence: done by the usual roles, audited, nothing verified', () => {
    const { h, res } = at('ALL_AWAITING_EVIDENCE');
    expect(res.ok).toBe(true);
    expect(h.p5().actions.every((a) => a.state === 'AWAITING_EVIDENCE')).toBe(true);
    const roles = new Set(h.p5().auditLog.map((e) => e.actorRole));
    expect(roles).toEqual(new Set(['OperationsManager', 'KitchenLead']));
    expect(h.p5().auditLog).toHaveLength(14);
    expect(h.p5().evidence).toHaveLength(0);
  });

  it('Evidence complete (not yet verified): all evidence recorded, no verified outcome yet', () => {
    const { h, res } = at('EVIDENCE_COMPLETE');
    expect(res.ok).toBe(true);
    expect(h.p5().evidence.map((e) => e.kind).sort()).toEqual(
      ['MENU_UPDATE', 'MENU_UPDATE', 'MENU_UPDATE', 'ORDER_FULFILMENT', 'PREP', 'PREP', 'PREP', 'PREP'],
    );
    expect(h.p5().outcomes['HP-INC-001']).toBeUndefined();
    const v = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(v).toMatchObject({ ok: true, value: { status: 'SUCCESS' } });
  });

  it('Plan A late delivery: FAILED with a late receipt derived from the plan deadline', () => {
    const { h, res } = at('A_LATE_FAILED');
    expect(res.ok).toBe(true);
    const outcome = h.p5().outcomes['HP-INC-001'];
    expect(outcome?.status).toBe('FAILED');
    const receipt = h.p5().evidence.find((e) => e.kind === 'RECEIPT');
    expect(receipt?.recordedByRole).toBe('ProcurementOfficer');
    expect(receipt && receipt.kind === 'RECEIPT' && receipt.payload.arrivalLocal).toBe('11:00');
  });

  it('a blocked checkpoint reports why instead of half-applying', () => {
    const { h, res } = at('B_APPROVED', (x) => void (x.env.scenarios.B = null));
    expect(res).toMatchObject({ ok: false, error: 'SCENARIO_NOT_READY' });
    expect(h.p5().approvals).toHaveLength(0);
  });
});

describe('checkpoint guards', () => {
  it('refuses to replay a choice of an infeasible plan (same hard blocker as the UI)', () => {
    const h = makeHarness();
    h.env.scenarios.B = { ...h.env.scenarios.B!, feasibility: 'INFEASIBLE' };
    const res = runCheckpoint('B_APPROVED', rt(h));
    expect(res).toMatchObject({ ok: false, error: 'SCENARIO_NOT_READY' });
    expect(h.p5().approvals).toHaveLength(0);
  });
});
