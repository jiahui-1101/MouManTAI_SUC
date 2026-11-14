/**
 * Read-only P1/P2 -> P5 evidence adapter. P5 approval, execution and outcome workflows
 * are not implemented on this branch; this exposes exactly what a P5 consumer may read.
 * Nothing here approves, receives goods, completes procurement or marks success.
 */
import { buildP5Handoff, type P5ImpactHandoff } from "../features/impact/handoff";
import { EVIDENCE_LIMITS, selectIncidentEvidence, selectSupplierOfferEvidence, type IncidentEvidence, type SupplierOfferEvidence } from "../features/messaging/evidenceSelectors";
import { selectPublishedEvents, type DemoState, type P1PublishedEvent } from "../store/demoStore";

export interface P5IncidentDossier {
  incidentId: string;
  /** Authoritative P2 business status (e.g. IMPACT_ASSESSED); never APPROVED/CLOSED from P1. */
  businessStatus: string | null;
  verification: IncidentEvidence | null;
  impact: { ready: true; payload: P5ImpactHandoff } | { ready: false; reason: string };
  supplierOffers: readonly SupplierOfferEvidence[];
  events: readonly P1PublishedEvent[];
  limits: typeof EVIDENCE_LIMITS;
  /** Workflow steps this branch cannot provide; the P5 owner must implement them. */
  pendingP5Capabilities: readonly ["APPROVAL", "EXECUTION", "GOODS_RECEIPT_EVIDENCE", "OUTCOME"];
}

export function selectP5IncidentDossier(state: DemoState, incidentId: string): P5IncidentDossier {
  const business = state.restaurant.incidents.find((i) => i.id === incidentId) ?? null;
  return {
    incidentId,
    businessStatus: business?.status ?? null,
    verification: selectIncidentEvidence(state, incidentId),
    impact: buildP5Handoff(state.restaurant, incidentId),
    supplierOffers: selectSupplierOfferEvidence(state),
    events: selectPublishedEvents(state).filter((e) => e.type !== "INCIDENT_VERIFIED" || e.incidentId === incidentId),
    limits: EVIDENCE_LIMITS,
    pendingP5Capabilities: ["APPROVAL", "EXECUTION", "GOODS_RECEIPT_EVIDENCE", "OUTCOME"],
  };
}
