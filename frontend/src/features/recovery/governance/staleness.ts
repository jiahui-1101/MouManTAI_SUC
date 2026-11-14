import type { RecoveryScenario, SnapshotRef } from './p5Contracts';

/** STALE is never stored — always derived from the current snapshot fingerprint. */
export function isScenarioStale(
  scenario: Pick<RecoveryScenario, 'snapshotFingerprint'>,
  snapshot: Pick<SnapshotRef, 'fingerprint'>,
): boolean {
  return scenario.snapshotFingerprint !== snapshot.fingerprint;
}

/** 'HH:mm' strings compare lexicographically when zero-padded. */
export function isLocalTimeAfter(a: string, b: string): boolean {
  return a > b;
}

export const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
