import { buildPlanAScenario, deriveRecoverySourcingNeed } from "../domain";
import type { PlanAScenarioCandidate } from "../domain";
import { adaptPlanAInputs } from "./adaptPlanAInputs";
import type { IntegrationResult, PlanAInputRead } from "./types";

export function validateScenarioFreshness(read: PlanAInputRead, candidate: PlanAScenarioCandidate, invalidated = false): IntegrationResult<PlanAScenarioCandidate> {
  if (invalidated) return { ok: false, code: "STALE_SCENARIO", message: "This proposal was invalidated. Regenerate against the current authoritative version." };
  const adapted = adaptPlanAInputs(read);
  if (!adapted.ok) return adapted;
  const { source, candidates, scenarioMetadata } = adapted.value;
  if (!candidate || candidate.strategy !== "A") return { ok: false, code: "INVALID_STRATEGY", message: "Only a Plan A scenario can be published by P3." };
  if (candidate.snapshotFingerprint !== source.snapshot.fingerprint || candidate.incidentId !== source.incident.id) {
    return { ok: false, code: "SNAPSHOT_MISMATCH", message: "The proposal belongs to a different incident or snapshot." };
  }
  if (candidate.id !== scenarioMetadata.scenarioId || candidate.version !== scenarioMetadata.version) {
    return { ok: false, code: "VERSION_MISMATCH", message: "The proposal must use the scenario identity and version assigned by the shared owner." };
  }
  if (!candidate.selectedOfferAssessment?.offerId) return { ok: false, code: "OFFER_SELECTION_REQUIRED", message: "A source supplier offer must be selected." };
  const need = deriveRecoverySourcingNeed(source);
  if (!need.ok) return { ok: false, code: need.error.code, message: need.error.message };
  const result = buildPlanAScenario({ sourcingNeed: need.value, candidateOffers: candidates, selectedOfferId: candidate.selectedOfferAssessment.offerId,
    currentSnapshotFingerprint: source.snapshot.fingerprint, currentSnapshotRevision: source.snapshot.revision, businessClock: source.businessClock, scenarioMetadata });
  if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
  // Compare the complete derived detail, including evidence, assumptions and time results.
  if (JSON.stringify(candidate) !== JSON.stringify(result.value)) return { ok: false, code: "SCENARIO_CHANGED", message: "Current stock, demand, quote or conditions differ from this proposal. Regenerate it." };
  return result;
}
