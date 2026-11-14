import { describe, expect, it } from 'vitest';
import { makeHarness } from '../../src/features/recovery/governance/testHarness';
import { selectWorkflowSteps } from '../../src/features/recovery/governance/selectors';
import { seedEvidence } from '../../src/__dev__/p5MockWorld';

describe('selectWorkflowSteps', () => {
  it('initial state with no plans ready: Waiting for plans, Not started, Not started, UNVERIFIED', () => {
    const h = makeHarness({ A: false, B: false });
    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });

    expect(steps.compare.status).toBe('Waiting for plans');
    expect(steps.compare.tone).toBe('neutral');

    expect(steps.approvals.status).toBe('Not started');
    expect(steps.approvals.tone).toBe('neutral');

    expect(steps.execution.status).toBe('Not started');
    expect(steps.execution.tone).toBe('neutral');

    expect(steps.outcomes.status).toBe('Simulated Outcome: UNVERIFIED');
    expect(steps.outcomes.tone).toBe('neutral');
    expect(steps.outcomes.icon).not.toBe('✓');
  });

  it('both plans ready: Ready to choose', () => {
    const h = makeHarness();
    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });

    expect(steps.compare.status).toBe('Ready to choose');
    expect(steps.approvals.status).toBe('Not started');
  });

  it('plan A selected: Plan A selected; plan B selected: Plan B selected', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    let steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.compare.status).toBe('Plan A selected');
    expect(steps.compare.tone).toBe('info');

    h.p5().chooseRecoveryScenario('B');
    steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.compare.status).toBe('Plan B selected');
    expect(steps.compare.tone).toBe('simulated');
  });

  it('escalated: Compare is Escalated, Approve is Rejected', () => {
    const h = makeHarness();
    h.p5().rejectBothAndEscalate('both unsuitable');
    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.compare.status).toBe('Escalated');
    expect(steps.approvals.status).toBe('Rejected');
  });

  it('stale snapshot before approval: Compare is Stale — recalculation required, Approve is Stale/Expired', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    h.changeSnapshot('fp-changed-999');

    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.compare.status).toBe('Stale — recalculation required');
    expect(steps.approvals.status).toBe('Stale/Expired');
  });

  it('role forbidden on approval: Blocked: Not allowed for this role', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    h.env.role = 'ViewerAuditor';

    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.approvals.status).toContain('Blocked: Not allowed for this role');
    expect(steps.approvals.status).not.toContain('DEMO_FORBIDDEN');
    expect(steps.approvals.tone).toBe('danger');
  });

  it('approved plan: Approved (simulated), Execute shows awaiting evidence', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    const sel = h.p5().selection!;
    h.p5().approveDemoScenario('ok', sel.version, sel.fingerprint);

    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });

    expect(steps.approvals.status).toBe('Approved (simulated)');
    expect(steps.approvals.tone).toBe('info');
    // 7 tasks created in APPROVED state, so 0/7 awaiting evidence initially
    expect(steps.execution.status).toBe('0/7 awaiting evidence');
  });

  it('stale after approval: Approve is Stale/Expired, Execute is Blocked: stale/expired', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    const sel = h.p5().selection!;
    h.p5().approveDemoScenario('ok', sel.version, sel.fingerprint);

    h.changeSnapshot('fp-recalculated-456');

    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });

    expect(steps.approvals.status).toBe('Stale/Expired');
    expect(steps.execution.status).toBe('Blocked: stale/expired');
  });

  it('plan rejected: Approve is Rejected', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('A');
    h.p5().rejectSelectedScenario('cost too high');

    const steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });

    expect(steps.approvals.status).toBe('Rejected');
    expect(steps.approvals.tone).toBe('danger');
  });

  it('simulation and evidence: advances awaiting count and outcome verification', () => {
    const h = makeHarness();
    h.p5().chooseRecoveryScenario('B');
    const sel = h.p5().selection!;
    h.p5().approveDemoScenario('ok', sel.version, sel.fingerprint);

    const actions = h.p5().actions;
    const approvalId = h.p5().approvals[0]!.id;

    // Simulate all actions to reach AWAITING_EVIDENCE
    for (const a of actions) {
      h.p5().simulateExecutionAction(a.id, approvalId, 'step 1');
    }
    for (const a of actions) {
      h.p5().simulateExecutionAction(a.id, approvalId, 'step 2');
    }

    let steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.execution.status).toBe('7/7 awaiting evidence');

    // Seed partial evidence and verify -> PARTIAL
    const fakeWorld = { role: h.env.role, setRole: (r: any) => { h.env.role = r; } };
    seedEvidence(h.store, fakeWorld, 'B_PARTIAL');

    h.p5().verifyDemoOutcome(h.env.incidentId!);
    steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.outcomes.status).toBe('Simulated Outcome: PARTIAL');
    expect(steps.outcomes.tone).toBe('warning');

    // Add the missing piece of evidence (HP-BATCH-B-04) after verify -> (out of date)
    const prepActions = h.p5().actions.filter((a) => a.actionType === 'PREP_BATCH_TASK');
    const batch4 = prepActions.find((p) => p.targetId === 'HP-BATCH-B-04')!;
    const recRes = h.p5().recordSimulatedEvidence(batch4.id, 'PREP', {
      batchId: 'HP-BATCH-B-04',
      producedPortions: 15,
      plannedPortions: 15,
      waste: { status: 'UNKNOWN' },
      completedLocal: '11:45',
    });
    expect(recRes.ok).toBe(true);

    steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.outcomes.status).toBe('Simulated Outcome: PARTIAL (out of date)');

    // Seed complete evidence and verify -> SUCCESS
    seedEvidence(h.store, fakeWorld, 'B_COMPLETE');

    h.p5().verifyDemoOutcome(h.env.incidentId!);
    steps = selectWorkflowSteps(h.state(), {
      getScenario: (s) => h.env.scenarios[s],
      getSnapshot: () => h.env.snapshot,
      getDemoClockLocal: () => h.env.clock,
      getCurrentRole: () => ({ role: h.env.role, actorId: h.env.actorId }),
      getActiveIncidentId: () => h.env.incidentId,
    });
    expect(steps.outcomes.status).toBe('Simulated Outcome: SUCCESS');
    expect(steps.outcomes.tone).toBe('success');
    expect(steps.outcomes.icon).toBe('✓');
  });
});
