import type { PlanAInputRead } from "../../src/features/recovery/plan-a/integration";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./domain/happyPotatoFactory";
export function makeIntegrationRead(): PlanAInputRead {
  const candidates = [makeOfferB(), makeOfferC()];
  return { source: makeCanonicalSourcingInput(), offers: candidates.map(c => c.offer), suppliers: candidates.map(c => c.supplier),
    offerEvidence: candidates.map(c => ({offerId:c.offer.id,specEvidenceStatus:c.specEvidenceStatus,availabilityStatus:c.availabilityStatus})),
    scenarioMetadata: makePlanAScenarioInput().scenarioMetadata };
}
