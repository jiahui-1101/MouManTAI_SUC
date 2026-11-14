import { describe, expect, it } from 'vitest';
import { approve, makeHarness } from '../recovery/governance/testHarness';
import { selectOutcomeFreshness } from '../recovery/governance/selectors';
import { deriveLessons, verificationLevelOf } from './decisionMemory';
import { seedEvidence } from '../../__dev__/p5MockWorld';

describe('verifyDemoOutcome reasons', () => {
  it('no evidence → UNVERIFIED with NO_EVIDENCE and missing reasons', () => {
    const h = makeHarness();
    approve(h, 'B');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('UNVERIFIED');
    expect(res.value.reasons.some((r) => r.code === 'NO_EVIDENCE' && r.kind === 'MISSING')).toBe(true);
    expect(res.value.reasons.some((r) => r.code.startsWith('MISSING_PREP') && r.kind === 'MISSING')).toBe(true);
  });

  it('Plan A complete → SUCCESS with pass reasons', () => {
    const h = makeHarness();
    approve(h, 'A');
    seedEvidence(h.store, h.env, 'A_COMPLETE');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('SUCCESS');
    expect(res.value.reasons.every((r) => r.kind === 'PASS')).toBe(true);
    expect(res.value.reasons.some((r) => r.code === 'PASS_RECEIPT')).toBe(true);
    expect(res.value.reasons.some((r) => r.code === 'PASS_FULFILMENT')).toBe(true);
  });

  it('Plan A late arrival 11:00 → FAILED with RECEIPT_LATE reason', () => {
    const h = makeHarness();
    approve(h, 'A');
    seedEvidence(h.store, h.env, 'A_LATE');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('FAILED');
    const late = res.value.reasons.find((r) => r.code.startsWith('RECEIPT_LATE'));
    expect(late).toBeDefined();
    expect(late?.kind).toBe('HARD_FAILURE');
    expect(late?.text).toContain('arrival 11:00 after 10:45 cutoff');
  });

  it('Plan A rejected receipt → FAILED with RECEIPT_REJECTED reason', () => {
    const h = makeHarness();
    approve(h, 'A');
    seedEvidence(h.store, h.env, 'A_REJECTED');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('FAILED');
    const rej = res.value.reasons.find((r) => r.code === 'RECEIPT_REJECTED');
    expect(rej).toBeDefined();
    expect(rej?.kind).toBe('HARD_FAILURE');
  });

  it('Plan B 3/4 batches → PARTIAL with MISSING_PREP reason for 4th batch', () => {
    const h = makeHarness();
    approve(h, 'B');
    seedEvidence(h.store, h.env, 'B_PARTIAL');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('PARTIAL');
    const miss = res.value.reasons.find((r) => r.code === 'MISSING_PREP:HP-BATCH-B-04');
    expect(miss).toBeDefined();
    expect(miss?.kind).toBe('MISSING');
    expect(miss?.text).toBe('MISSING_PREP: HP-BATCH-B-04');
  });

  it('Plan B shortfall (10/12) → PARTIAL with SHORTFALL_PREP reason', () => {
    const h = makeHarness();
    approve(h, 'B');
    seedEvidence(h.store, h.env, 'B_COMPLETE');
    const b4 = h.p5().actions.find((a) => a.targetId === 'HP-BATCH-B-04')!;
    h.p5().recordSimulatedEvidence(b4.id, 'PREP', {
      batchId: 'HP-BATCH-B-04',
      producedPortions: 10,
      plannedPortions: 12,
      waste: { status: 'UNKNOWN' },
      completedLocal: '12:15',
    });
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('PARTIAL');
    const short = res.value.reasons.find((r) => r.code === 'SHORTFALL_PREP:HP-BATCH-B-04');
    expect(short).toBeDefined();
    expect(short?.kind).toBe('SHORTFALL');
    expect(short?.text).toContain('produced 10 of 12');
  });

  it('fulfilment shortfall 55/60 → FAILED with CONFIRMED_ORDERS_UNMET', () => {
    const h = makeHarness();
    approve(h, 'B');
    seedEvidence(h.store, h.env, 'FULFILMENT_SHORT');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('FAILED');
    const failReason = res.value.reasons.find((r) => r.code.startsWith('CONFIRMED_ORDERS_UNMET'));
    expect(failReason).toBeDefined();
    expect(failReason?.kind).toBe('HARD_FAILURE');
    expect(failReason?.text).toContain('confirmed fulfilment 55 of 60');
  });

  it('waste UNKNOWN still results in SUCCESS; measured 0 is distinct', () => {
    const h = makeHarness();
    approve(h, 'B');
    seedEvidence(h.store, h.env, 'B_COMPLETE');
    const res = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('SUCCESS');
    expect(res.value.actual?.waste?.every((w) => w.waste.status === 'UNKNOWN')).toBe(true);
  });
});

describe('selectOutcomeFreshness transitions', () => {
  it('NOT_VERIFIED → CURRENT → OUT_OF_DATE on revise → CURRENT on re-verify', () => {
    const h = makeHarness();
    approve(h, 'B');

    // Before verify
    expect(selectOutcomeFreshness(h.state(), 'HP-INC-001')).toBe('NOT_VERIFIED');

    // Record some evidence and verify
    seedEvidence(h.store, h.env, 'B_COMPLETE');
    h.p5().verifyDemoOutcome('HP-INC-001');
    expect(selectOutcomeFreshness(h.state(), 'HP-INC-001')).toBe('CURRENT');

    // Revise evidence
    const b1 = h.p5().actions.find((a) => a.targetId === 'HP-BATCH-B-01')!;
    h.p5().recordSimulatedEvidence(b1.id, 'PREP', {
      batchId: 'HP-BATCH-B-01',
      producedPortions: 24,
      plannedPortions: 25,
      waste: { status: 'UNKNOWN' },
      completedLocal: '11:25',
    });
    expect(selectOutcomeFreshness(h.state(), 'HP-INC-001')).toBe('OUT_OF_DATE');

    // Re-verify
    h.p5().verifyDemoOutcome('HP-INC-001');
    expect(selectOutcomeFreshness(h.state(), 'HP-INC-001')).toBe('CURRENT');
  });
});

describe('deriveLessons and decision memory', () => {
  it('produces only labelled lessons with numbers from inputs', () => {
    const h = makeHarness();
    approve(h, 'B');
    seedEvidence(h.store, h.env, 'B_COMPLETE');
    const verifyRes = h.p5().verifyDemoOutcome('HP-INC-001');
    expect(verifyRes.ok).toBe(true);
    if (!verifyRes.ok) return;

    const approval = h.p5().approvals[0]!;
    const scenario = h.env.scenarios.B;
    const lessons = deriveLessons(verifyRes.value, approval, scenario);

    expect(lessons.length).toBeGreaterThan(0);
    for (const l of lessons) {
      if (l.kind === 'DEMO_INTERPRETATION') {
        expect(l.text).toMatch(/^Demo interpretation: /);
      } else {
        expect(l.kind).toBe('DETERMINISTIC_FACT');
      }
    }
    // Plan B protected 60 confirmed portions with 0kg new purchase
    const fact = lessons.find((l) => l.kind === 'DETERMINISTIC_FACT' && l.text.includes('0kg new purchase'));
    expect(fact?.text).toBe('Plan B protected 60 confirmed portions with 0kg new purchase.');
  });

  it('memory verificationLevel mapping', () => {
    expect(verificationLevelOf('ESCALATED', null)).toBe('ESCALATED');
    expect(verificationLevelOf('B', null)).toBe('NO_EVIDENCE');

    const outcomeMock = {
      incidentId: 'HP-INC-001',
      scenarioId: 'HP-SC-B-001',
      strategy: 'B' as const,
      status: 'SUCCESS' as const,
      predicted: {} as any,
      actual: null,
      evidenceIds: ['ev-1'],
      missingEvidence: [],
      failures: [],
      reasons: [],
      simulated: true as const,
    };
    expect(verificationLevelOf('B', outcomeMock)).toBe('SIMULATED_VERIFIED');

    const partialMock = { ...outcomeMock, status: 'PARTIAL' as const };
    expect(verificationLevelOf('B', partialMock)).toBe('PARTIAL_EVIDENCE');

    const failedMock = { ...outcomeMock, status: 'FAILED' as const };
    expect(verificationLevelOf('B', failedMock)).toBe('PARTIAL_EVIDENCE');

    const unverifiedMock = { ...outcomeMock, status: 'UNVERIFIED' as const, evidenceIds: [] };
    expect(verificationLevelOf('B', unverifiedMock)).toBe('NO_EVIDENCE');
  });

  it('seeds go through recordSimulatedEvidence as Owner', () => {
    const h = makeHarness();
    approve(h, 'B');
    h.env.role = 'ViewerAuditor'; // Switch to viewer auditor
    // seedEvidence should temporarily run as Owner and succeed
    seedEvidence(h.store, h.env, 'B_COMPLETE');
    expect(h.p5().evidence.length).toBe(8); // 3 menu + 4 prep + 1 fulfilment
    expect(h.p5().evidence.every((e) => e.recordedByRole === 'Owner')).toBe(true);
    expect(h.env.role).toBe('ViewerAuditor'); // Role restored
  });
});

