/**
 * TEMPORARY — delete at integration (Phase 4)
 *
 * Dev-only stand-ins for the P3/P4-published scenarios and the P2 snapshot, so P5 can be
 * built and tested before the root demoStore exists. Values mirror docs/00_SHARED exactly.
 * App code must only use these when `isP5DevMocksEnabled()` is true
 * (Vite dev mode AND `VITE_P5_DEV_MOCKS=true`).
 */
import type { RecoveryScenarioWithActions, SnapshotRef } from '../features/recovery/governance/p5Contracts';

export function isP5DevMocksEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_P5_DEV_MOCKS === 'true';
}

export const DEV_INCIDENT_ID = 'HP-INC-001';

/** Deterministic placeholder; NOT a real digest. The real one is computed by P2 at runtime. */
export const DEV_FINGERPRINT = 'DEV-FP:HP-SNAP-001:r1';

export const DEV_SNAPSHOT: SnapshotRef = {
  id: 'HP-SNAP-001',
  revision: 1,
  fingerprint: DEV_FINGERPRINT,
  demoBusinessDate: '2026-11-21',
};

export function devScenarioA(fingerprint = DEV_FINGERPRINT, version = 1): RecoveryScenarioWithActions {
  return {
    id: 'HP-SC-A-001',
    incidentId: DEV_INCIDENT_ID,
    strategy: 'A',
    snapshotFingerprint: fingerprint,
    version,
    feasibility: 'CONDITIONAL',
    newPurchaseKgMilli: 15000,
    additionalCostSen: 25500,
    forecastChickenPortionsServed: 150,
    forecastChickenPortionsUnmet: 0,
    confirmedChickenPortionsProtected: 60,
    assumptions: [
      'Replacement chilled chicken qualified on provided synthetic specs; acceptance pending',
      'Receipt and quality check must complete by the 10:45 prep cutoff',
    ],
    evidenceRefs: [],
    actionIds: [],
    simulatedCalculation: true,
    proposedActions: [{ actionType: 'PO_DRAFT' }, { actionType: 'RECEIPT_CHECK' }],
  };
}

export function devScenarioB(fingerprint = DEV_FINGERPRINT, version = 1): RecoveryScenarioWithActions {
  return {
    id: 'HP-SC-B-001',
    incidentId: DEV_INCIDENT_ID,
    strategy: 'B',
    snapshotFingerprint: fingerprint,
    version,
    feasibility: 'FEASIBLE',
    newPurchaseKgMilli: 0,
    additionalCostSen: 0,
    forecastChickenPortionsServed: 72,
    forecastChickenPortionsUnmet: 78,
    confirmedChickenPortionsProtected: 60,
    assumptions: [
      'Uses existing accepted synthetic stock only (10kg physical)',
      'Menu limits are applied manually by staff; nothing is sent to any POS',
    ],
    evidenceRefs: [],
    actionIds: [],
    simulatedCalculation: true,
    proposedActions: [
      { actionType: 'MENU_LIMIT_TASK', targetId: 'HP-MENU-CP' },
      { actionType: 'MENU_LIMIT_TASK', targetId: 'HP-MENU-CT' },
      { actionType: 'MENU_LIMIT_TASK', targetId: 'HP-MENU-HC' },
      { actionType: 'PREP_BATCH_TASK', targetId: 'HP-BATCH-B-01', plannedPortions: 25 },
      { actionType: 'PREP_BATCH_TASK', targetId: 'HP-BATCH-B-02', plannedPortions: 20 },
      { actionType: 'PREP_BATCH_TASK', targetId: 'HP-BATCH-B-03', plannedPortions: 15 },
      { actionType: 'PREP_BATCH_TASK', targetId: 'HP-BATCH-B-04', plannedPortions: 12 },
    ],
  };
}
