import type { DemoRole, EscalationRecord, RecoveryScenarioWithActions, SnapshotRef } from './p5Contracts';

export function buildEscalation(input: {
  incidentId: string;
  reason: string;
  scenarios: (RecoveryScenarioWithActions | null)[];
  snapshot: SnapshotRef;
  role: DemoRole;
  actorId: string;
  nowIso: string;
}): EscalationRecord {
  return {
    incidentId: input.incidentId,
    reason: input.reason,
    scenarioRefs: input.scenarios
      .filter((s): s is RecoveryScenarioWithActions => s !== null)
      .map((s) => ({ scenarioId: s.id, strategy: s.strategy, version: s.version, fingerprint: s.snapshotFingerprint })),
    snapshotFingerprint: input.snapshot.fingerprint,
    actorRole: input.role,
    actorId: input.actorId,
    atIso: input.nowIso,
  };
}
