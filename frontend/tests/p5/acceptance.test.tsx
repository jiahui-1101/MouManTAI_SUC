import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockWorld, seedEvidence, type MockWorld } from '../../src/__dev__/p5MockWorld';
import { ComparisonView } from '../../src/features/recovery/governance/components/ComparisonView';
import { ApprovalsView } from '../../src/features/recovery/governance/components/ApprovalsView';
import { ExecutionView } from '../../src/features/recovery/governance/components/ExecutionView';
import { OutcomesView } from '../../src/features/recovery/governance/components/OutcomesView';
import { DecisionMemoryView } from '../../src/features/recovery/governance/components/DecisionMemoryView';
import {
  P5RuntimeProvider,
  createP5Runtime,
  devMockDeps,
  type P5Runtime,
} from '../../src/features/recovery/governance/p5Store';
import { selectSuccessfulCaseCount } from '../../src/features/recovery/governance/selectors';
import type { DecisionMemoryEntry } from '../../src/features/recovery/governance/p5Contracts';

afterEach(cleanup);

interface TestCtx {
  world: MockWorld;
  rt: P5Runtime;
  p5: () => P5Runtime['store'] extends { getState(): infer S } ? (S extends { p5: infer P } ? P : never) : never;
}

function setup(prep?: (w: MockWorld) => void): TestCtx {
  const world = createMockWorld();
  prep?.(world);
  const rt = createP5Runtime(devMockDeps(world));
  return { world, rt, p5: () => rt.store.getState().p5 };
}

function show(ctx: TestCtx, view: ReactElement) {
  return render(
    <MemoryRouter>
      <P5RuntimeProvider runtime={ctx.rt}>{view}</P5RuntimeProvider>
    </MemoryRouter>,
  );
}

const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

function typeReason(value: string, scope: HTMLElement = document.body) {
  const box = within(scope).getAllByRole('textbox')[0]!;
  fireEvent.change(box, { target: { value } });
}

describe('P5 Acceptance Matrix: P5-T01 through P5-T18', () => {
  // P5-T01: Canonical P3 + P4 scenarios on same snapshot
  it('P5-T01: renders canonical P3 and P4 scenarios on the same snapshot fingerprint', () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);

    const cardA = screen.getByTestId('plan-A');
    const cardB = screen.getByTestId('plan-B');

    // Both scenarios share the same snapshot fingerprint in the context header
    const fp = ctx.world.state.snapshot.fingerprint;
    expect(document.body.textContent).toContain('HP-SNAP-001');
    expect(document.body.textContent).toContain(fp.slice(0, 8));

    // Plan A canonical values: RM255.00, 150 conditional portions
    expect(cardA.textContent).toContain('RM255.00 projected additional landed cost');
    expect(cardA.textContent).toContain('150 (conditional)');
    expect(cardA.textContent).toContain('CONDITIONAL');

    // Plan B canonical values: RM0.00, 72 planned portions
    expect(cardB.textContent).toContain('RM0.00 new purchase');
    expect(cardB.textContent).toContain('72 planned');
    expect(cardB.textContent).toContain('FEASIBLE');
  });

  // P5-T02: Forecast vs confirmed figures (78 is forecast unmet only; 0 order breaches)
  it('P5-T02: separates forecast unmet (78) strictly from confirmed order breaches (0)', () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);

    const cardB = screen.getByTestId('plan-B');
    // 78 must be labelled as forecast unmet
    expect(cardB.textContent).toContain('78 — forecast only, not confirmed-order breaches');
    // 60 confirmed portions protected
    expect(cardB.textContent).toContain('60 planned');
    // Must never claim orders breached
    expect(document.body.textContent).not.toMatch(/orders breached/i);
    expect(document.body.textContent).not.toMatch(/breached confirmed/i);
  });

  // P5-T03: Select A saves selection without implicit approval or PO creation
  it('P5-T03: selecting Plan A saves selection without implicit approval or PO creation', () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);

    fireEvent.click(btn(/Choose Plan A/i));

    // Selection saved in store
    expect(ctx.p5().selection?.strategy).toBe('A');
    expect(ctx.p5().selection?.scenarioId).toBe('HP-SC-A-001');

    // No approval or actions created
    expect(ctx.p5().approvals).toHaveLength(0);
    expect(ctx.p5().actions).toHaveLength(0);
  });

  // P5-T04: Select B saves selection without creating any supplier PO task
  it('P5-T04: selecting Plan B saves selection without creating any supplier PO action', () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);

    fireEvent.click(btn(/Choose Plan B/i));

    expect(ctx.p5().selection?.strategy).toBe('B');
    expect(ctx.p5().selection?.scenarioId).toBe('HP-SC-B-001');

    // No supplier PO action created
    const hasPoDraft = ctx.p5().actions.some((a) => a.actionType === 'PO_DRAFT');
    expect(hasPoDraft).toBe(false);
    expect(ctx.p5().approvals).toHaveLength(0);
  });

  // P5-T05: Owner approves selected plan → version-bound record; Approve ≠ Execute
  it('P5-T05: owner approval creates version-bound ApprovalRecord and tasks start in APPROVED (not VERIFIED)', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');

    show(ctx, <ApprovalsView />);

    typeReason('Protect confirmed portions first');
    fireEvent.click(btn(/^Approve$/));
    fireEvent.click(btn(/^Confirm approval$/));

    // Version-bound approval record
    const approvals = ctx.p5().approvals;
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.state).toBe('APPROVED');
    expect(approvals[0]?.scenarioVersion).toBe(1);
    expect(approvals[0]?.snapshotFingerprint).toBe(ctx.world.state.snapshot.fingerprint);
    expect(approvals[0]?.actorRole).toBe('Owner');

    // Tasks are in APPROVED state, none in VERIFIED
    const tasks = ctx.p5().actions;
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.state === 'APPROVED')).toBe(true);
    expect(tasks.some((t) => t.state === 'VERIFIED')).toBe(false);
  });

  // P5-T06: Viewer/Auditor (and unauthorized roles) denied approval with clear explanation
  it('P5-T06: blocks ViewerAuditor and OperationsManager (Plan A) from approving with visible explanation', () => {
    // 1. ViewerAuditor on Plan B
    const ctxViewer = setup();
    ctxViewer.p5().chooseRecoveryScenario('B');
    ctxViewer.world.setRole('ViewerAuditor');
    const { unmount } = show(ctxViewer, <ApprovalsView />);

    const approveBtn = btn(/^Approve$/);
    expect(approveBtn.disabled).toBe(true);
    expect(screen.getByText(/ViewerAuditor is read-only/i)).toBeDefined();
    unmount();

    // 2. OperationsManager on Plan A (requires Owner authority due to purchase cost)
    const ctxOps = setup();
    ctxOps.p5().chooseRecoveryScenario('A');
    ctxOps.world.setRole('OperationsManager');
    show(ctxOps, <ApprovalsView />);

    const approveBtnA = btn(/^Approve$/);
    expect(approveBtnA.disabled).toBe(true);
    expect(screen.getByTestId('approval-blocker').textContent).toContain('DEMO_FORBIDDEN');
    expect(screen.getByTestId('approval-blocker').textContent).toContain('OperationsManager cannot approve');
  });

  // P5-T07: Snapshot changed after proposal/approval → stale scenario/approval cannot execute
  it('P5-T07: blocks execution and shows stale banner when snapshot fingerprint changes after approval', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');
    ctx.p5().approveDemoScenario('Owner approval', 1, ctx.world.state.snapshot.fingerprint);

    // Mutate snapshot fingerprint
    ctx.world.update((s) => {
      s.snapshot.fingerprint = 'DEV-FP:HP-SNAP-001:r2';
      s.snapshot.revision = 2;
    });

    show(ctx, <ExecutionView />);

    // Stale banner is rendered
    expect(screen.getByTestId('p5-execution-blocked-banner').textContent).toContain('Snapshot changed since approval');

    // All simulate buttons are disabled
    const simulateButtons = screen.queryAllByRole('button', { name: /Simulate next step/i });
    expect(simulateButtons.length).toBeGreaterThan(0);
    for (const b of simulateButtons) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  // P5-T08: Duplicate clicks on Approve or Execute produce at most one effect (DUPLICATE_REQUEST)
  it('P5-T08: handles duplicate approve/execute requests idempotently with at most one effect', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');
    const fp = ctx.world.state.snapshot.fingerprint;

    // First approval succeeds
    const res1 = ctx.p5().approveDemoScenario('Owner approval reason', 1, fp);
    expect(res1.ok).toBe(true);

    // Duplicate approval call returns DUPLICATE_REQUEST
    const res2 = ctx.p5().approveDemoScenario('Owner approval reason', 1, fp);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error).toBe('DUPLICATE_REQUEST');
    }
    expect(ctx.p5().approvals).toHaveLength(1);

    // Execution action state machine: APPROVED -> SIMULATED_EXECUTION -> AWAITING_EVIDENCE
    const task = ctx.p5().actions[0]!;
    const approvalId = ctx.p5().approvals[0]!.id;
    const exec1 = ctx.p5().simulateExecutionAction(task.id, approvalId, 'Step 1');
    expect(exec1.ok).toBe(true);
    const exec2 = ctx.p5().simulateExecutionAction(task.id, approvalId, 'Step 2');
    expect(exec2.ok).toBe(true);

    // Further transition from AWAITING_EVIDENCE is rejected
    const exec3 = ctx.p5().simulateExecutionAction(task.id, approvalId, 'Step 3');
    expect(exec3.ok).toBe(false);
    if (!exec3.ok) {
      expect(exec3.error).toBe('INVALID_TRANSITION');
    }
  });

  // P5-T09: Plan A quote only, no receipt evidence → Outcome UNVERIFIED
  it('P5-T09: keeps outcome as UNVERIFIED when Plan A is approved without verified receipt evidence', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('A');
    ctx.p5().approveDemoScenario('Approve Plan A with supplier quote', 1, ctx.world.state.snapshot.fingerprint);

    show(ctx, <OutcomesView />);

    // Outcome starts as UNVERIFIED
    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('UNVERIFIED');

    // Verification without receipt evidence stays UNVERIFIED with MISSING_RECEIPT
    fireEvent.click(btn(/Verify simulated outcome/i));
    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('UNVERIFIED');
    expect(screen.getAllByText(/MISSING_RECEIPT/i).length).toBeGreaterThan(0);
  });

  // P5-T10: Plan B four batches not all completed → Not SUCCESS (PARTIAL)
  it('P5-T10: returns PARTIAL (never SUCCESS) when Plan B has only 3 of 4 prep batches evidenced', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');
    ctx.p5().approveDemoScenario('Approve Plan B', 1, ctx.world.state.snapshot.fingerprint);

    // Advance tasks and record 3 batches (HP-BATCH-B-04 missing)
    seedEvidence(ctx.rt.store, ctx.world, 'B_PARTIAL');

    show(ctx, <OutcomesView />);
    fireEvent.click(btn(/Verify simulated outcome/i));

    // Badge shows PARTIAL, never SUCCESS
    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('PARTIAL');
    expect(screen.getByTestId('p5-outcome-badge').textContent).not.toContain('SUCCESS');

    // Grouped reasons include MISSING_PREP for B-04
    expect(screen.getByText(/MISSING_PREP: HP-BATCH-B-04/i)).toBeDefined();
  });

  // P5-T11: Complete required simulated evidence → SUCCESS with Demo evidence only subtext
  it('P5-T11: displays Simulated Outcome: SUCCESS with demo caveat subtext when evidence is complete', () => {
    // 1. Plan B Complete
    const ctxB = setup();
    ctxB.p5().chooseRecoveryScenario('B');
    ctxB.p5().approveDemoScenario('Approve Plan B', 1, ctxB.world.state.snapshot.fingerprint);
    seedEvidence(ctxB.rt.store, ctxB.world, 'B_COMPLETE');

    const { unmount } = show(ctxB, <OutcomesView />);
    fireEvent.click(btn(/Verify simulated outcome/i));

    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('SUCCESS');
    expect(screen.getByTestId('p5-success-subtext').textContent).toContain('Demo evidence only — not real Happy Potato operations');
    unmount();

    // 2. Plan A Complete
    const ctxA = setup();
    ctxA.p5().chooseRecoveryScenario('A');
    ctxA.p5().approveDemoScenario('Approve Plan A', 1, ctxA.world.state.snapshot.fingerprint);
    seedEvidence(ctxA.rt.store, ctxA.world, 'A_COMPLETE');

    show(ctxA, <OutcomesView />);
    fireEvent.click(btn(/Verify simulated outcome/i));

    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('SUCCESS');
    expect(screen.getByTestId('p5-success-subtext').textContent).toContain('Demo evidence only — not real Happy Potato operations');
  });

  // P5-T12: Inbound supplier messages do not count as receipt evidence; outcome stays UNVERIFIED
  it('P5-T12: presence of supplier messages does not count as receipt evidence; stays UNVERIFIED', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('A');
    ctx.p5().approveDemoScenario('Approve Plan A', 1, ctx.world.state.snapshot.fingerprint);

    // State has mock supplier message claiming delivery, but no evidence was recorded
    show(ctx, <OutcomesView />);
    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('UNVERIFIED');

    // Clicking verify without explicit evidence remains UNVERIFIED
    fireEvent.click(btn(/Verify simulated outcome/i));
    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('UNVERIFIED');
  });

  // P5-T13: Unknown waste input rendered as UNKNOWN, never 0kg or RM0
  it('P5-T13: renders Unknown waste input as UNKNOWN (never 0kg or RM0)', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');
    ctx.p5().approveDemoScenario('Approve Plan B', 1, ctx.world.state.snapshot.fingerprint);

    // Seed B complete (records waste: { status: 'UNKNOWN' })
    seedEvidence(ctx.rt.store, ctx.world, 'B_COMPLETE');
    ctx.p5().verifyDemoOutcome('HP-INC-001');

    show(ctx, <OutcomesView />);

    // Row for food waste should contain UNKNOWN
    const wasteCell = screen.getByTestId('p5-actual-waste');
    expect(wasteCell.textContent).toContain('UNKNOWN');
    expect(wasteCell.textContent).not.toContain('0kg');
    expect(wasteCell.textContent).not.toContain('RM0');
  });

  // P5-T14: Reject Both / Escalate enters ESCALATED state without automatic plan execution
  it('P5-T14: Reject Both enters ESCALATED state with no automatic plan execution, and allows Revise Constraints recovery', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');

    show(ctx, <ApprovalsView />);

    fireEvent.click(btn(/^Escalate$/));
    const dialog = screen.getByRole('dialog');
    typeReason('Neither plan meets cost/speed trade-off', dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject both and escalate/i }));

    // Escalated state
    expect(ctx.p5().escalationState).toBe('ESCALATED');
    expect(ctx.p5().actions).toHaveLength(0); // No automatic tasks

    // Escalation panel rendered
    const region = screen.getByRole('region', { name: 'Escalation status' });
    expect(region).toBeDefined();

    // Revise constraints triggers recalculation request
    fireEvent.click(within(region).getByRole('button', { name: /^Revise constraints$/ }));
    const reviseDialog = screen.getByRole('dialog');
    typeReason('Relax delivery window and allow partial substitute', reviseDialog);
    fireEvent.click(within(reviseDialog).getByRole('button', { name: /^Request recalculation$/ }));

    expect(ctx.p5().escalationState).toBe('ESCALATED');
    expect(ctx.p5().recalculationRequestedSinceEscalation).toBe(true);
    expect(within(region).getByText(/Recalculation requested from Plan A \/ Plan B owners/i)).toBeDefined();
  });

  // P5-T15: Compare toggles between Plan A/B without scenario drift
  it('P5-T15: toggling selection between Plan A and Plan B preserves exact canonical values without drift', () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);

    // Select A
    fireEvent.click(btn(/Choose Plan A/i));
    expect(ctx.p5().selection?.strategy).toBe('A');

    // Toggle to B
    fireEvent.click(btn(/Choose Plan B/i));
    expect(ctx.p5().selection?.strategy).toBe('B');

    // Toggle back to A
    fireEvent.click(btn(/Choose Plan A/i));
    expect(ctx.p5().selection?.strategy).toBe('A');

    // Values in state match exact scenario contracts without drift
    const scenA = ctx.world.state.scenarios.A!;
    expect(scenA.newPurchaseKgMilli).toBe(15000);
    expect(scenA.additionalCostSen).toBe(25500);
    expect(scenA.forecastChickenPortionsServed).toBe(150);
    expect(scenA.confirmedChickenPortionsProtected).toBe(60);

    const scenB = ctx.world.state.scenarios.B!;
    expect(scenB.newPurchaseKgMilli).toBe(0);
    expect(scenB.additionalCostSen).toBe(0);
    expect(scenB.forecastChickenPortionsServed).toBe(72);
    expect(scenB.forecastChickenPortionsUnmet).toBe(78);
    expect(scenB.confirmedChickenPortionsProtected).toBe(60);
  });

  // P5-T16: Decision Memory filters include only SUCCESS cases in simulated-success count
  it('P5-T16: Decision Memory stores UNVERIFIED, ESCALATED, and SUCCESS, but only SUCCESS is in successfulCaseCount', () => {
    const ctx = setup();

    // Seed 3 entries: UNVERIFIED, ESCALATED, SUCCESS
    const entryUnverified: DecisionMemoryEntry = {
      id: 'MEM-1',
      incidentId: 'HP-INC-001',
      incidentType: 'UNAVAILABLE',
      ingredientId: 'HP-ING-CHICKEN',
      scenarioId: 'HP-SC-A-001',
      strategy: 'A',
      version: 1,
      fingerprint: 'fp_snap_001',
      outcomeStatus: 'UNVERIFIED',
      verificationLevel: 'NO_EVIDENCE',
      evidenceQuality: 'NONE',
      lessons: [{ kind: 'DETERMINISTIC_FACT', text: 'Outcome stayed UNVERIFIED' }],
      savedAtIso: '2026-11-14T10:00:00Z',
      predicted: { newPurchaseKgMilli: 15000, additionalCostSen: 25500, forecastChickenPortionsServed: 150, forecastChickenPortionsUnmet: 0, confirmedChickenPortionsProtected: 60, feasibility: 'CONDITIONAL' },
      actual: null,
    };

    const entryEscalated: DecisionMemoryEntry = {
      id: 'MEM-2',
      incidentId: 'HP-INC-002',
      incidentType: 'UNAVAILABLE',
      ingredientId: 'HP-ING-CHICKEN',
      scenarioId: 'HP-SC-B-001',
      strategy: 'ESCALATED',
      version: 1,
      fingerprint: 'fp_snap_001',
      outcomeStatus: 'FAILED',
      verificationLevel: 'ESCALATED',
      evidenceQuality: 'NONE',
      lessons: [{ kind: 'DETERMINISTIC_FACT', text: 'Escalated by Owner' }],
      savedAtIso: '2026-11-14T10:30:00Z',
      predicted: { newPurchaseKgMilli: 0, additionalCostSen: 0, forecastChickenPortionsServed: 72, forecastChickenPortionsUnmet: 78, confirmedChickenPortionsProtected: 60, feasibility: 'FEASIBLE' },
      actual: null,
    };

    const entrySuccess: DecisionMemoryEntry = {
      id: 'MEM-3',
      incidentId: 'HP-INC-003',
      incidentType: 'UNAVAILABLE',
      ingredientId: 'HP-ING-CHICKEN',
      scenarioId: 'HP-SC-B-001',
      strategy: 'B',
      version: 1,
      fingerprint: 'fp_snap_001',
      outcomeStatus: 'SUCCESS',
      verificationLevel: 'SIMULATED_VERIFIED',
      evidenceQuality: 'COMPLETE',
      lessons: [{ kind: 'DETERMINISTIC_FACT', text: 'Plan B protected 60 confirmed portions' }],
      savedAtIso: '2026-11-14T11:00:00Z',
      predicted: { newPurchaseKgMilli: 0, additionalCostSen: 0, forecastChickenPortionsServed: 72, forecastChickenPortionsUnmet: 78, confirmedChickenPortionsProtected: 60, feasibility: 'FEASIBLE' },
      actual: { receivedKgMilli: 0, landedCostSen: 0, producedPortions: 72, confirmedFulfilled: 60 },
    };

    // Inject entries into state
    ctx.rt.store.setState({
      p5: {
        ...ctx.rt.store.getState().p5,
        decisionMemory: [entryUnverified, entryEscalated, entrySuccess],
      },
    });

    // selectSuccessfulCaseCount must be exactly 1
    expect(selectSuccessfulCaseCount(ctx.rt.store.getState())).toBe(1);

    show(ctx, <DecisionMemoryView />);

    // Total: 3, Successful: 1
    expect(screen.getByTestId('p5-total-count').textContent).toContain('3');
    expect(screen.getByTestId('p5-success-count').textContent).toContain('1');

    // Filter by outcomeStatus SUCCESS
    const outcomeSelect = screen.getByTestId('p5-filter-outcome') as HTMLSelectElement;
    fireEvent.change(outcomeSelect, { target: { value: 'SUCCESS' } });

    // Only MEM-3 is visible
    expect(screen.getByTestId('p5-memory-row-MEM-3')).toBeDefined();
    expect(screen.queryByTestId('p5-memory-row-MEM-1')).toBeNull();
    expect(screen.queryByTestId('p5-memory-row-MEM-2')).toBeNull();
  });

  // P5-T17: State persistence across simulated remount/reload
  it('P5-T17: preserves state consistency and hydration across component remounts', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');
    ctx.p5().approveDemoScenario('Hydration check', 1, ctx.world.state.snapshot.fingerprint);

    // Mount and unmount ExecutionView
    const { unmount: unmount1 } = show(ctx, <ExecutionView />);
    expect(screen.getAllByText(/HP-SC-B-001/i)[0]).toBeDefined();
    unmount1();

    // Re-mount ExecutionView into same store
    const { unmount: unmount2 } = show(ctx, <ExecutionView />);
    expect(screen.getAllByText(/HP-SC-B-001/i)[0]).toBeDefined();
    expect(screen.queryAllByTestId(/^p5-task-card-/)).toHaveLength(7);
    unmount2();

    // Mount OutcomesView into same store
    show(ctx, <OutcomesView />);
    expect(screen.getByTestId('p5-outcome-badge').textContent).toContain('UNVERIFIED');
  });

  // P5-T18: Keyboard accessibility and 768px viewport check
  it('P5-T18: supports keyboard dialog interaction and renders responsively at 768px', () => {
    const ctx = setup();
    ctx.p5().chooseRecoveryScenario('B');

    // 1. Keyboard accessibility: Escape closes dialog
    show(ctx, <ApprovalsView />);
    fireEvent.click(btn(/^Escalate$/));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    // Press Escape
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    // 2. Responsive 768px viewport
    window.innerWidth = 768;
    fireEvent(window, new Event('resize'));

    // Renders without throwing or crashing
    expect(screen.getByTestId('action-scope')).toBeDefined();
    expect(btn(/^Approve$/)).toBeDefined();
  });
});
