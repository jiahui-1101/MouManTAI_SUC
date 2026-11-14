import { decisionMemoryId, decisionMemoryKey } from '../approvals/idempotency';
import type {
  ApprovalRecord,
  DecisionMemoryEntry,
  EscalationRecord,
  EvidenceQuality,
  Lesson,
  RecoveryOutcome,
} from '../recovery/governance/p5Contracts';

export function evidenceQualityOf(outcome: RecoveryOutcome | null): EvidenceQuality {
  if (!outcome || outcome.evidenceIds.length === 0) return 'NONE';
  return outcome.missingEvidence.length === 0 ? 'COMPLETE' : 'PARTIAL';
}

const INTERPRETATION: Record<RecoveryOutcome['status'], string> = {
  SUCCESS: 'Demo interpretation: the approved recovery held under simulated evidence; reuse as a reference case.',
  PARTIAL: 'Demo interpretation: recovery was incomplete; review missing or below-plan evidence before reuse.',
  FAILED: 'Demo interpretation: a hard constraint failed; treat this strategy as risky under similar conditions.',
  UNVERIFIED: 'Demo interpretation: no outcome evidence yet; do not draw conclusions from this case.',
};

export function buildApprovedMemory(approval: ApprovalRecord, outcome: RecoveryOutcome | null, savedAtIso: string): DecisionMemoryEntry {
  const status = outcome?.status ?? 'UNVERIFIED';
  const key = decisionMemoryKey(approval.incidentId, approval.scenarioId, approval.scenarioVersion);
  const lessons: Lesson[] = [
    {
      kind: 'DETERMINISTIC_FACT',
      text: `Plan ${approval.selectedStrategy} (${approval.scenarioId} v${approval.scenarioVersion}) approved by ${approval.actorRole} at fingerprint ${approval.snapshotFingerprint}.`,
    },
    { kind: 'DETERMINISTIC_FACT', text: `Simulated outcome ${status} from ${outcome?.evidenceIds.length ?? 0} evidence record(s).` },
  ];
  if (outcome?.missingEvidence.length) {
    lessons.push({ kind: 'DETERMINISTIC_FACT', text: `Missing evidence: ${outcome.missingEvidence.join(', ')}.` });
  }
  if (outcome?.failures.length) {
    lessons.push({ kind: 'DETERMINISTIC_FACT', text: `Hard failures: ${outcome.failures.join(', ')}.` });
  }
  lessons.push({ kind: 'DEMO_INTERPRETATION', text: INTERPRETATION[status] });
  return {
    id: decisionMemoryId(key),
    incidentId: approval.incidentId,
    strategy: approval.selectedStrategy,
    scenarioId: approval.scenarioId,
    version: approval.scenarioVersion,
    fingerprint: approval.snapshotFingerprint,
    outcomeStatus: status,
    evidenceQuality: evidenceQualityOf(outcome),
    lessons,
    savedAtIso,
  };
}

export function buildEscalatedMemory(esc: EscalationRecord, savedAtIso: string): DecisionMemoryEntry {
  const scenarioId = esc.scenarioRefs.map((r) => r.scenarioId).join('+') || 'NONE';
  const version = esc.scenarioRefs.reduce((m, r) => Math.max(m, r.version), 0);
  const key = decisionMemoryKey(esc.incidentId, scenarioId, version);
  return {
    id: decisionMemoryId(key),
    incidentId: esc.incidentId,
    strategy: 'ESCALATED',
    scenarioId,
    version,
    fingerprint: esc.snapshotFingerprint,
    outcomeStatus: 'UNVERIFIED',
    evidenceQuality: 'NONE',
    lessons: [
      { kind: 'DETERMINISTIC_FACT', text: `Both plans rejected and escalated by ${esc.actorRole}: ${esc.reason}` },
      { kind: 'DEMO_INTERPRETATION', text: 'Demo interpretation: neither published plan was acceptable; constraints need revision.' },
    ],
    savedAtIso,
  };
}
