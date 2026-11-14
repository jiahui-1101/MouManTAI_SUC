import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPublishedScenarios,
  createPlanAPublisher,
  createRestaurantStoreAdapter,
  createRootP5Deps,
  createRootP5Selectors,
  createRootStoreAdapter,
  getPublishedScenario,
  getUpstreamWorkflowStage,
  hasActiveDisruption,
  isImpactAssessed,
  isIncidentVerified,
  publishPlanAFromShared,
  type RootIncident,
  type RootSnapshot,
  type RootStoreContract,
} from './p5RootAdapter';
import type { ApprovalRecord, ExecutionAction, P5Event, RecoveryScenarioWithActions } from './p5Contracts';
import { devScenarioA, devScenarioB } from '../../../__dev__/mockScenarios';
import {
  __resetP2StoreForTests,
  assessImpactAction,
  resetDemo,
  simulateSupplierReport,
  simulateVerification,
} from '../../../services/mock/restaurantStore';

describe('p5RootAdapter', () => {
  beforeEach(() => {
    __resetP2StoreForTests();
    clearPublishedScenarios();
  });
  const sampleSnapshot: RootSnapshot = {
    id: 'HP-SNAP-001',
    revision: 1,
    fingerprint: 'fp_snap_001',
    demoBusinessDate: '2026-11-14',
    menuItems: [
      { id: 'HP-MENU-CP', name: 'Chicken Popcorn' },
      { id: 'HP-MENU-CT', name: 'Chicken Tenders' },
    ],
  };

  const sampleIncident: RootIncident = {
    id: 'HP-INC-001',
    poId: 'HP-PO-1042',
    ingredientId: 'HP-ING-CHICKEN',
    type: 'UNAVAILABLE',
  };

  it('createRootP5Deps maps root state properties accurately', () => {
    const rootState: RootStoreContract = {
      snapshot: sampleSnapshot,
      scenarios: {
        A: devScenarioA() as RecoveryScenarioWithActions,
        B: devScenarioB() as RecoveryScenarioWithActions,
      },
      activeIncidentId: 'HP-INC-001',
      activeIncident: sampleIncident,
      demoClockLocal: '10:15',
      currentDemoRole: 'OperationsManager',
      currentActorId: 'HP-ACTOR-OPS',
      impact: {
        incidentId: 'HP-INC-001',
        poId: 'HP-PO-1042',
        poExpectedKgMilli: 20000,
        poClaimedKgMilli: 0,
        poShortfallKgMilli: 20000,
        forecastGapKgMilli: 12000,
      },
    };

    const emitted: P5Event[] = [];
    const deps = createRootP5Deps(() => rootState, (e) => emitted.push(e));

    // Snapshot
    expect(deps.getSnapshot()).toEqual({
      id: 'HP-SNAP-001',
      revision: 1,
      fingerprint: 'fp_snap_001',
      demoBusinessDate: '2026-11-14',
    });

    // Scenarios
    expect(deps.getScenario('A')?.id).toBe('HP-SC-A-001');
    expect(deps.getScenario('B')?.id).toBe('HP-SC-B-001');

    // Incident
    expect(deps.getActiveIncidentId()).toBe('HP-INC-001');
    expect(deps.getActiveIncident()).toEqual({
      id: 'HP-INC-001',
      type: 'UNAVAILABLE',
      ingredientId: 'HP-ING-CHICKEN',
      poId: 'HP-PO-1042',
    });

    // Impact
    expect(deps.getImpact()?.poShortfallKgMilli).toBe(20000);

    // Clock & Role
    expect(deps.getDemoClockLocal()).toBe('10:15');
    expect(deps.getCurrentRole()).toEqual({
      role: 'OperationsManager',
      actorId: 'HP-ACTOR-OPS',
    });

    // Menu item resolution
    expect(deps.resolveMenuDisplayName('HP-MENU-CP')).toBe('Chicken Popcorn');
    expect(deps.resolveMenuDisplayName('HP-MENU-UNKNOWN')).toBe('HP-MENU-UNKNOWN');

    // Event dispatch
    deps.emit({ type: 'SCENARIO_SELECTED', payload: { strategy: 'B' } });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe('SCENARIO_SELECTED');
  });

  it('createRootP5Deps throws if snapshot is missing', () => {
    const deps = createRootP5Deps(() => ({ snapshot: null }));
    expect(() => deps.getSnapshot()).toThrow(/snapshot is not available/);
  });

  it('createRootP5Deps dispatches to rootState.dispatchDomainEvent if present', () => {
    const dispatchDomainEvent = vi.fn();
    const rootState: RootStoreContract = {
      snapshot: sampleSnapshot,
      dispatchDomainEvent,
    };
    const deps = createRootP5Deps(() => rootState);
    deps.emit({ type: 'PLAN_APPROVED', payload: { id: 'APP-1' } });
    expect(dispatchDomainEvent).toHaveBeenCalledWith('PLAN_APPROVED', { id: 'APP-1' });
  });

  it('createRootStoreAdapter wraps store and supports subscribe and setRole', () => {
    let state: RootStoreContract = {
      snapshot: sampleSnapshot,
      demoClockLocal: '09:30',
      currentDemoRole: 'Owner',
    };
    const listeners = new Set<() => void>();

    const fakeStore = {
      getState: () => state,
      setState: (partial: Partial<RootStoreContract>) => {
        state = { ...state, ...partial };
        listeners.forEach((l) => l());
      },
      subscribe: (cb: () => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    };

    const adapter = createRootStoreAdapter(fakeStore);
    expect(adapter.wired).toBe(true);

    const view1 = adapter.getView();
    expect(view1.clock).toBe('09:30');
    expect(view1.role).toBe('Owner');

    // Test setRole
    adapter.setRole('ProcurementOfficer');
    const view2 = adapter.getView();
    expect(view2.role).toBe('ProcurementOfficer');
  });

  it('createRootP5Selectors filters stale and expired approvals and counts tasks', () => {
    const validApproval: ApprovalRecord = {
      id: 'APP-1',
      incidentId: 'HP-INC-001',
      scenarioId: 'HP-SC-B-001',
      scenarioVersion: 1,
      snapshotFingerprint: 'fp_snap_001',
      selectedStrategy: 'B',
      actorRole: 'Owner',
      actorId: 'HP-ACTOR-OWNER',
      reason: 'Protect confirmed orders',
      approvedActionTypes: ['MENU_LIMIT_TASK', 'PREP_BATCH_TASK'],
      state: 'APPROVED',
      createdAtIso: '2026-11-14T10:00:00Z',
      expiresAtIso: null,
      consumed: false,
      simulationOnly: true,
      idempotencyKey: 'idemp-1',
      predicted: {
        feasibility: 'FEASIBLE',
        newPurchaseKgMilli: 0,
        additionalCostSen: 0,
        forecastChickenPortionsServed: 72,
        forecastChickenPortionsUnmet: 78,
        confirmedChickenPortionsProtected: 60,
      },
    };

    const staleApproval: ApprovalRecord = {
      ...validApproval,
      id: 'APP-STALE',
      snapshotFingerprint: 'fp_old_fingerprint',
    };

    const expiredPlanAApproval: ApprovalRecord = {
      ...validApproval,
      id: 'APP-EXPIRED',
      scenarioId: 'HP-SC-A-001',
      expiresAtIso: '2026-11-14T10:45:00+08:00',
    };

    const tasks: ExecutionAction[] = [
      {
        id: 'ACT-1',
        scenarioId: 'HP-SC-B-001',
        actionType: 'MENU_LIMIT_TASK',
        state: 'APPROVED',
        simulated: true,
        incidentId: 'HP-INC-001',
        approvalId: 'APP-1',
        idempotencyKey: 'key-1',
        externalSyncStatus: 'AWAITING_MANUAL_UPDATE',
      },
      {
        id: 'ACT-2',
        scenarioId: 'HP-SC-B-001',
        actionType: 'PREP_BATCH_TASK',
        state: 'AWAITING_EVIDENCE',
        simulated: true,
        incidentId: 'HP-INC-001',
        approvalId: 'APP-1',
        idempotencyKey: 'key-2',
        externalSyncStatus: 'SIMULATED_LOCAL_ONLY',
      },
    ];

    const rootState = {
      snapshot: sampleSnapshot,
      demoClockLocal: '11:00', // Past Plan A's 10:45 deadline
      p5: {
        approvals: [validApproval, staleApproval, expiredPlanAApproval],
        actions: tasks,
      },
    };

    const selectors = createRootP5Selectors((r: typeof rootState) => r.p5);

    // Pending approvals: validApproval is B, valid fingerprint, not expired.
    // staleApproval has wrong fingerprint.
    // expiredPlanAApproval is Plan A at 11:00 (past 10:45) so expired.
    const pending = selectors.selectPendingApprovals(rootState as any);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('APP-1');
    expect(selectors.selectPendingApprovalCount(rootState as any)).toBe(1);

    // Execution tasks and awaiting evidence
    expect(selectors.selectExecutionTasks(rootState as any)).toHaveLength(2);
    expect(selectors.selectAwaitingEvidenceCount(rootState as any)).toBe(1);
  });

  it('gates scenarios and active incident on full upstream workflow progression', () => {
    expect(hasActiveDisruption()).toBe(false);
    expect(isIncidentVerified()).toBe(false);
    expect(isImpactAssessed()).toBe(false);
    expect(getUpstreamWorkflowStage()).toBe('NO_DISRUPTION');

    const adapter = createRestaurantStoreAdapter();
    expect(adapter.wired).toBe(true);

    // 1. Initial pristine state: scenarios and incident are null
    expect(adapter.getView().scenarioA).toBeNull();
    expect(adapter.getView().scenarioB).toBeNull();
    expect(adapter.deps.getActiveIncident()).toBeNull();
    expect(adapter.deps.getScenario('A')).toBeNull();
    expect(adapter.deps.getScenario('B')).toBeNull();
    expect(adapter.deps.getImpact()).toBeNull();

    // 2. Step 1: Simulate supplier report (pending verification)
    simulateSupplierReport('WHATSAPP', 'PENDING');
    expect(hasActiveDisruption()).toBe(true);
    expect(isIncidentVerified()).toBe(false);
    expect(isImpactAssessed()).toBe(false);
    expect(getUpstreamWorkflowStage()).toBe('PENDING_VERIFICATION');

    // Scenarios and impact MUST still be null while pending verification
    expect(adapter.getView().scenarioA).toBeNull();
    expect(adapter.getView().scenarioB).toBeNull();
    expect(adapter.deps.getScenario('A')).toBeNull();
    expect(adapter.deps.getScenario('B')).toBeNull();
    expect(adapter.deps.getImpact()).toBeNull();
    expect(adapter.deps.getActiveIncident()?.id).toBe('HP-INC-001');

    // 3. Step 2: Verification complete, but impact not yet assessed
    simulateVerification('HP-INC-001');
    expect(isIncidentVerified()).toBe(true);
    expect(isImpactAssessed()).toBe(false);
    expect(getUpstreamWorkflowStage()).toBe('PENDING_IMPACT');

    // Scenarios still null until impact is assessed
    expect(adapter.getView().scenarioA).toBeNull();
    expect(adapter.getView().scenarioB).toBeNull();
    expect(adapter.deps.getScenario('A')).toBeNull();
    expect(adapter.deps.getScenario('B')).toBeNull();

    // 4. Step 3: Assess impact
    assessImpactAction('HP-INC-001');
    expect(isImpactAssessed()).toBe(true);
    expect(getUpstreamWorkflowStage()).toBe('IMPACT_ASSESSED');

    // Plan B is now ready from stock/schedule; Plan A waits for publication
    expect(adapter.getView().scenarioB?.id).toBe('HP-SC-B-001');
    expect(adapter.deps.getScenario('B')?.id).toBe('HP-SC-B-001');
    expect(adapter.getView().scenarioA).toBeNull();
    expect(adapter.deps.getScenario('A')).toBeNull();

    // 5. Step 4: Publish Plan A
    publishPlanAFromShared();
    expect(adapter.getView().scenarioA?.id).toBe('HP-SC-A-001');
    expect(adapter.deps.getScenario('A')?.id).toBe('HP-SC-A-001');

    // 6. Reset demo
    resetDemo();
    expect(hasActiveDisruption()).toBe(false);
    expect(isIncidentVerified()).toBe(false);
    expect(isImpactAssessed()).toBe(false);
    expect(getUpstreamWorkflowStage()).toBe('NO_DISRUPTION');
    expect(adapter.getView().scenarioA).toBeNull();
    expect(adapter.getView().scenarioB).toBeNull();
    expect(adapter.deps.getActiveIncident()).toBeNull();
    expect(adapter.deps.getScenario('A')).toBeNull();
    expect(adapter.deps.getScenario('B')).toBeNull();
  });

  it('createRestaurantStoreAdapter dynamically resolves scenarios and supports publication', async () => {
    simulateSupplierReport('WHATSAPP', 'PENDING');
    simulateVerification('HP-INC-001');
    assessImpactAction('HP-INC-001');

    const adapter = createRestaurantStoreAdapter();
    expect(adapter.wired).toBe(true);

    // Publish Plan A so both plans are present
    publishPlanAFromShared();

    const view = adapter.getView();
    expect(view.snapshot?.id).toBe('HP-SNAP-001');
    expect(view.scenarioA?.id).toBe('HP-SC-A-001');
    expect(view.scenarioB?.id).toBe('HP-SC-B-001');
    expect(view.scenarioB?.forecastChickenPortionsServed).toBe(72);
    expect(view.scenarioB?.forecastChickenPortionsUnmet).toBe(78);
    expect(view.scenarioB?.confirmedChickenPortionsProtected).toBe(60);

    // Test Plan A publisher
    const publisher = createPlanAPublisher();
    const current = publisher.readCurrent();
    expect(current.source).toBeDefined();

    // Commit custom Plan A scenario
    const sampleHandoff = {
      id: 'HP-SC-A-001',
      incidentId: 'HP-INC-001',
      strategy: 'A' as const,
      snapshotFingerprint: view.snapshot?.fingerprint ?? 'fp_snap_001',
      version: 1,
      feasibility: 'CONDITIONAL' as const,
      newPurchaseKgMilli: 15000,
      additionalCostSen: 25500,
      forecastChickenPortionsServed: 150,
      forecastChickenPortionsUnmet: 0,
      confirmedChickenPortionsProtected: 60,
      assumptions: ['Sample assumption'],
      evidenceRefs: ['REF-1'],
      actionIds: ['ACT-1'],
      simulatedCalculation: true as const,
    };

    const ack = await publisher.commitScenarioA({
      type: 'SCENARIO_A_READY',
      scenario: sampleHandoff,
      idempotencyKey: 'test-key-1',
      expectedSnapshotRevision: view.snapshot?.revision ?? 1,
      detail: {
        conditions: [],
        sourceLabels: ['LIVE_CHANNEL', 'SIMULATED_CALCULATION'],
        selectedOfferAssessment: {} as any,
      },
    });

    expect(ack.status).toBe('STORED');
    expect(getPublishedScenario('A')?.id).toBe('HP-SC-A-001');
    expect(adapter.deps.getScenario('A')?.additionalCostSen).toBe(25500);

    clearPublishedScenarios();
  });
});
