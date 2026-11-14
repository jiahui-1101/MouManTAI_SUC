import type { PlanAScenarioCandidate, PlanAScenarioMetadata, RecoverySourcingNeedInput, SupplierOfferCandidateInput } from "../domain";

export interface DraftInput {
  source: RecoverySourcingNeedInput;
  candidate: SupplierOfferCandidateInput;
  supplierName?: string;
  contactAuthorization: "UNKNOWN" | "AUTHORIZED_DEMO_CONTACT";
}
export interface InternalPoInput extends DraftInput {
  proposal: PlanAScenarioCandidate;
  scenarioMetadata: PlanAScenarioMetadata;
  scenarioIsCurrent: boolean;
}
export interface PlanADraft {
  id: string;
  type: "RFQ_DRAFT" | "INTERNAL_PO_DRAFT";
  status: "DRAFT" | "NEEDS_REVIEW";
  simulated: true;
  approval: "NOT_APPROVED";
  transmission: "NOT_SENT";
  incidentId: string;
  originalPoId: string;
  supplierId: string;
  offerId: string;
  snapshotFingerprint: string;
  snapshotRevision: number;
  scenarioId?: string;
  scenarioVersion?: number;
  quantityKgMilli: number;
  pricePerKgSen: number | null;
  freightSen: number | null;
  landedCostSen: number | null;
  reviewRequirements: string[];
  evidenceRefs: string[];
  text: string;
}
export type DraftResult = { ok: true; value: PlanADraft } | { ok: false; error: { code: string; message: string; reasons?: string[] } };
