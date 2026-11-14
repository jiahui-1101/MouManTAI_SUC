import type { PlanAScenarioCandidate } from "../domain";
import { validateScenarioFreshness } from "./validateScenarioFreshness";
import { sameValue } from "./sameValue";
import type { IntegrationResult, PlanAHandoff, PlanAPublisher, ScenarioAReadyRequest } from "./types";

export function toPlanAHandoff(candidate: PlanAScenarioCandidate): PlanAHandoff {
  return structuredClone({
    id: candidate.id, incidentId: candidate.incidentId, strategy: candidate.strategy,
    snapshotFingerprint: candidate.snapshotFingerprint, version: candidate.version, feasibility: candidate.feasibility,
    newPurchaseKgMilli: candidate.newPurchaseKgMilli, additionalCostSen: candidate.additionalCostSen,
    forecastChickenPortionsServed: candidate.forecastChickenPortionsServed,
    forecastChickenPortionsUnmet: candidate.forecastChickenPortionsUnmet,
    confirmedChickenPortionsProtected: candidate.confirmedChickenPortionsProtected,
    assumptions: candidate.assumptions, evidenceRefs: candidate.evidenceRefs, actionIds: candidate.actionIds, simulatedCalculation: candidate.simulatedCalculation,
  });
}

export async function publishScenarioAReady(candidate: PlanAScenarioCandidate, publisher: PlanAPublisher | undefined, invalidated = false): Promise<IntegrationResult<{ status: "STORED" | "ALREADY_STORED"; scenario: PlanAHandoff }>> {
  if (!publisher) return { ok: false, code: "PUBLISHER_PENDING", message: "Shared scenario publication is not connected." };
  try {
    const proposed = structuredClone(candidate);
    const current = publisher.readCurrent();
    const validated = validateScenarioFreshness(current, proposed, invalidated);
    if (!validated.ok) return validated;
    if (!proposed.sourceLabels.some(label => label !== "SIMULATED_CALCULATION")) {
      return { ok: false, code: "PROVENANCE_MISSING", message: "The source offer needs explicit provenance before publication." };
    }
    const revision = current.source?.snapshot?.revision;
    if (!revision) return { ok: false, code: "INPUTS_PENDING", message: "The authoritative snapshot revision is unavailable." };
    const scenario = toPlanAHandoff(validated.value);
    const idempotencyKey = JSON.stringify(["SCENARIO_A_READY", scenario.incidentId, scenario.id, scenario.version, scenario.snapshotFingerprint, revision]);
    const request: ScenarioAReadyRequest = { type: "SCENARIO_A_READY", scenario, idempotencyKey, expectedSnapshotRevision: revision,
      detail: structuredClone({ conditions: proposed.conditions, sourceLabels: proposed.sourceLabels, selectedOfferAssessment: proposed.selectedOfferAssessment }) };
    // Dependency owns atomic freshness/version checks and idempotent authoritative storage.
    const ack = await publisher.commitScenarioA(structuredClone(request));
    if (!ack) return { ok: false, code: "PUBLICATION_UNCONFIRMED", message: "No storage acknowledgement was returned; publication cannot be confirmed." };
    if (ack.status === "REJECTED") return { ok: false, code: "PUBLICATION_REJECTED", message: ack.message };
    if ((ack.status !== "STORED" && ack.status !== "ALREADY_STORED") || ack.idempotencyKey !== idempotencyKey || ack.snapshotRevision !== revision || !sameValue(ack.storedScenario, scenario)) {
      return { ok: false, code: "PUBLICATION_UNCONFIRMED", message: "The storage acknowledgement does not match this proposal, revision and publication key." };
    }
    const after = validateScenarioFreshness(publisher.readCurrent(), proposed);
    if (!after.ok) return { ok: false, code: "INPUTS_CHANGED_DURING_PUBLICATION", message: "Inputs changed while publishing. The previous acknowledgement cannot establish a current proposal; regenerate with the shared owner." };
    return { ok: true, value: { status: ack.status, scenario } };
  } catch {
    return { ok: false, code: "PUBLICATION_FAILED", message: "The publication dependency failed. Stored state is unconfirmed; retry only through the same idempotent shared action." };
  }
}
