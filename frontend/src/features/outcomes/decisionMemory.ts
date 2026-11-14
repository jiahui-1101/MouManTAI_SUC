import { decisionMemoryId, decisionMemoryKey } from '../approvals/idempotency';
import type {
  ApprovalRecord,
  DecisionMemoryEntry,
  EscalationRecord,
  EvidenceQuality,
  Lesson,
  RecoveryOutcome,
  RecoveryScenarioWithActions,
  ScenarioStrategy,
  VerificationLevel,
} from '../recovery/governance/p5Contracts';
import type { ActiveIncidentRef } from '../recovery/governance/p5Deps';

export function evidenceQualityOf(outcome: RecoveryOutcome | null): EvidenceQuality {
  if (!outcome || outcome.evidenceIds.length === 0) return 'NONE';
  return outcome.missingEvidence.length === 0 ? 'COMPLETE' : 'PARTIAL';
}

export function verificationLevelOf(
  strategy: ScenarioStrategy | 'ESCALATED',
  outcome: RecoveryOutcome | null,
): VerificationLevel {
  if (strategy === 'ESCALATED') return 'ESCALATED';
  if (outcome?.status === 'SUCCESS') return 'SIMULATED_VERIFIED';
  if (outcome && outcome.evidenceIds.length > 0) return 'PARTIAL_EVIDENCE';
  return 'NO_EVIDENCE';
}

const INTERPRETATION: Record<RecoveryOutcome['status'], string> = {
  SUCCESS: 'Demo interpretation: The approved recovery held under simulated evidence; reuse as a reference case.',
  PARTIAL: 'Demo interpretation: Recovery was incomplete; review missing or below-plan evidence before reuse.',
  FAILED: 'Demo interpretation: A hard constraint failed; treat this strategy as risky under similar conditions.',
  UNVERIFIED: 'Demo interpretation: No outcome evidence yet; do not draw conclusions from this case.',
};

/**
 * Derives lessons for decision memory.
 * Pure function: DETERMINISTIC_FACT from scenario/outcome reasons only;
 * DEMO_INTERPRETATION explicitly labelled with prefix.
 * Never invents numbers.
 */
export function deriveLessons(
  outcome: RecoveryOutcome | null,
  approval: ApprovalRecord,
  scenario: RecoveryScenarioWithActions | null,
): Lesson[] {
  const lessons: Lesson[] = [];

  // Deterministic facts from scenario / approval
  if (approval.selectedStrategy === 'B') {
    const protectedPortions =
      scenario?.confirmedChickenPortionsProtected ?? approval.predicted.confirmedChickenPortionsProtected;
    lessons.push({
      kind: 'DETERMINISTIC_FACT',
      text: `Plan B protected ${protectedPortions} confirmed portions with 0kg new purchase.`,
    });
  } else if (approval.selectedStrategy === 'A') {
    const kg = (scenario?.newPurchaseKgMilli ?? approval.predicted.newPurchaseKgMilli) / 1000;
    const rm = ((scenario?.additionalCostSen ?? approval.predicted.additionalCostSen) / 100).toFixed(2);
    lessons.push({
      kind: 'DETERMINISTIC_FACT',
      text: `Plan A conditional purchase of ${kg}kg at RM${rm} landed cost.`,
    });
  }

  // Deterministic facts from outcome
  if (!outcome || outcome.status === 'UNVERIFIED') {
    lessons.push({
      kind: 'DETERMINISTIC_FACT',
      text: 'Outcome stayed UNVERIFIED because no evidence was recorded.',
    });
  } else {
    // Add reasons by kind
    const hardFailures = outcome.reasons.filter((r) => r.kind === 'HARD_FAILURE');
    for (const hf of hardFailures) {
      if (hf.code.startsWith('RECEIPT_LATE')) {
        lessons.push({
          kind: 'DETERMINISTIC_FACT',
          text: 'Plan A receipt after 10:45 prep cutoff makes the plan fail.',
        });
      } else if (hf.code === 'RECEIPT_REJECTED') {
        lessons.push({
          kind: 'DETERMINISTIC_FACT',
          text: 'Plan A receipt was rejected during simulated quality check.',
        });
      } else if (hf.code.startsWith('CONFIRMED_ORDERS_UNMET')) {
        const actual = outcome.actual?.confirmedFulfilled ?? 0;
        const req = outcome.actual?.confirmedRequired ?? 0;
        lessons.push({
          kind: 'DETERMINISTIC_FACT',
          text: `Confirmed orders shortfall (${actual} of ${req}) makes the plan fail.`,
        });
      } else {
        lessons.push({ kind: 'DETERMINISTIC_FACT', text: hf.text });
      }
    }

    const shortfalls = outcome.reasons.filter((r) => r.kind === 'SHORTFALL');
    for (const sf of shortfalls) {
      lessons.push({ kind: 'DETERMINISTIC_FACT', text: sf.text });
    }

    const missing = outcome.reasons.filter((r) => r.kind === 'MISSING' && r.code !== 'NO_EVIDENCE');
    for (const ms of missing) {
      lessons.push({ kind: 'DETERMINISTIC_FACT', text: ms.text });
    }

    if (outcome.status === 'SUCCESS') {
      lessons.push({
        kind: 'DETERMINISTIC_FACT',
        text: 'All required simulated execution tasks confirmed with passing evidence.',
      });
    }
  }

  // Demo interpretations
  if (approval.selectedStrategy === 'B') {
    lessons.push({
      kind: 'DEMO_INTERPRETATION',
      text: 'Demo interpretation: In this demo, the owner chose lower cash outlay over forecast coverage.',
    });
  } else if (approval.selectedStrategy === 'A') {
    lessons.push({
      kind: 'DEMO_INTERPRETATION',
      text: 'Demo interpretation: In this demo, the owner prioritized serving full forecast demand via external expedited supply.',
    });
  }

  lessons.push({
    kind: 'DEMO_INTERPRETATION',
    text: INTERPRETATION[outcome?.status ?? 'UNVERIFIED'],
  });

  return lessons;
}

export function buildApprovedMemory(
  approval: ApprovalRecord,
  outcome: RecoveryOutcome | null,
  scenario: RecoveryScenarioWithActions | null,
  incident: ActiveIncidentRef | null,
  savedAtIso: string,
): DecisionMemoryEntry {
  const status = outcome?.status ?? 'UNVERIFIED';
  const key = decisionMemoryKey(approval.incidentId, approval.scenarioId, approval.scenarioVersion);
  const lessons = deriveLessons(outcome, approval, scenario);

  return {
    id: decisionMemoryId(key),
    incidentId: approval.incidentId,
    incidentType: incident?.type ?? 'UNAVAILABLE',
    ingredientId: incident?.ingredientId ?? 'HP-ING-CHICKEN',
    strategy: approval.selectedStrategy,
    scenarioId: approval.scenarioId,
    version: approval.scenarioVersion,
    fingerprint: approval.snapshotFingerprint,
    outcomeStatus: status,
    verificationLevel: verificationLevelOf(approval.selectedStrategy, outcome),
    evidenceQuality: evidenceQualityOf(outcome),
    lessons,
    savedAtIso,
    predicted: approval.predicted,
    actual: outcome?.actual ?? null,
    evidenceIds: outcome?.evidenceIds ?? [],
  };
}

export function buildEscalatedMemory(
  esc: EscalationRecord,
  incident: ActiveIncidentRef | null,
  savedAtIso: string,
): DecisionMemoryEntry {
  const scenarioId = esc.scenarioRefs.map((r) => r.scenarioId).join('+') || 'NONE';
  const version = esc.scenarioRefs.reduce((m, r) => Math.max(m, r.version), 0);
  const key = decisionMemoryKey(esc.incidentId, scenarioId, version);
  return {
    id: decisionMemoryId(key),
    incidentId: esc.incidentId,
    incidentType: incident?.type ?? 'UNAVAILABLE',
    ingredientId: incident?.ingredientId ?? 'HP-ING-CHICKEN',
    strategy: 'ESCALATED',
    scenarioId,
    version,
    fingerprint: esc.snapshotFingerprint,
    outcomeStatus: 'UNVERIFIED',
    verificationLevel: 'ESCALATED',
    evidenceQuality: 'NONE',
    lessons: [
      { kind: 'DETERMINISTIC_FACT', text: `Both plans rejected and escalated by ${esc.actorRole}: ${esc.reason}` },
      { kind: 'DEMO_INTERPRETATION', text: 'Demo interpretation: neither published plan was acceptable; constraints need revision.' },
    ],
    savedAtIso,
    predicted: undefined,
    actual: null,
    evidenceIds: [],
  };
}
