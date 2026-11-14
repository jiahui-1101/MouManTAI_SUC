import type { PlanAScenarioCandidate, PlanAScenarioMetadata, RecoverySourcingNeedInput, SupplierOfferCandidateInput, SupplierOfferInput, SupplierRegistryStatus } from "../domain";

/** P3 injection seam, not an alternative root DemoState or shared domain model. */
export interface PlanAInputRead {
  source?: Partial<RecoverySourcingNeedInput>;
  offers?: SupplierOfferInput[];
  suppliers?: { id: string; status: SupplierRegistryStatus; name?: string }[];
  offerEvidence?: { offerId: string; specEvidenceStatus: SupplierOfferCandidateInput["specEvidenceStatus"]; availabilityStatus: SupplierOfferCandidateInput["availabilityStatus"] }[];
  scenarioMetadata?: PlanAScenarioMetadata;
}
export interface AdaptedPlanAInputs {
  source: RecoverySourcingNeedInput;
  candidates: SupplierOfferCandidateInput[];
  supplierNames: Record<string, string>;
  scenarioMetadata: PlanAScenarioMetadata;
}
export type IntegrationFailure = { ok: false; code: string; message: string };
export type IntegrationResult<T> = { ok: true; value: T } | IntegrationFailure;
/** Exact Markdown handoff fields projected from the P3 candidate, pending shared runtime types. */
export type PlanAHandoff = Pick<PlanAScenarioCandidate,
  "id" | "incidentId" | "strategy" | "snapshotFingerprint" | "version" | "feasibility" |
  "newPurchaseKgMilli" | "additionalCostSen" | "forecastChickenPortionsServed" |
  "forecastChickenPortionsUnmet" | "confirmedChickenPortionsProtected" |
  "assumptions" | "evidenceRefs" | "actionIds" | "simulatedCalculation">;
export interface ScenarioAReadyRequest {
  type: "SCENARIO_A_READY";
  scenario: PlanAHandoff;
  idempotencyKey: string;
  expectedSnapshotRevision: number;
  detail: Pick<PlanAScenarioCandidate, "conditions" | "sourceLabels" | "selectedOfferAssessment">;
}
export type ScenarioAReadyAcknowledgement =
  | { status: "STORED" | "ALREADY_STORED"; idempotencyKey: string; snapshotRevision: number; storedScenario: PlanAHandoff }
  | { status: "REJECTED"; message: string };
export interface PlanAPublisher {
  readCurrent(): PlanAInputRead;
  /** Root must atomically validate current inputs/version and store once per key. */
  commitScenarioA(request: ScenarioAReadyRequest): Promise<ScenarioAReadyAcknowledgement>;
}
