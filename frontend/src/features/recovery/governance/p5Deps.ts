import type { DemoRole, ImpactSummaryLike, P5Event, RecoveryScenarioWithActions, ScenarioStrategy, SnapshotRef } from './p5Contracts';

/**
 * Dependency ports. The root demoStore wires these at integration; tests inject fakes.
 * All time comes from here — P5 business logic never reads the wall clock.
 */
export interface P5Deps {
  getSnapshot(): SnapshotRef;
  /** Published by P3 (A) / P4 (B). */
  getScenario(strategy: ScenarioStrategy): RecoveryScenarioWithActions | null;
  getActiveIncidentId(): string | null;
  /** P2's impact summary, display only. TODO(G0): add getImpact to the root-store port. */
  getImpact(): ImpactSummaryLike | null;
  /** 'HH:mm' MYT demo clock. TODO(G0): demoClockLocal + ADVANCE_DEMO_CLOCK in root store. */
  getDemoClockLocal(): string;
  getCurrentRole(): { role: DemoRole; actorId: string };
  /** Audit timestamps only. */
  nowIso(): string;
  emit(event: P5Event): void;
}
