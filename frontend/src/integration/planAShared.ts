/**
 * Production P1/P2 -> P3 input mapping. Reads only the shared DemoState
 * (P1 messaging/evidence + P2-owned restaurant slice) and the single canonical
 * fixture. No P3 test factories, no derived defaults for missing authority.
 */
import { HP_BUSINESS, HP_IDS, HP_INGREDIENTS, HP_SUPPLIERS, HP_SUPPLIER_OFFERS } from "../data/fixtures/happyPotato";
import { selectCurrentImpact } from "../services/mock/restaurantState";
import { selectSupplierOfferEvidence } from "../features/messaging/evidenceSelectors";
import type { DemoState } from "../store/demoStore";
import type { PlanAInputRead } from "../features/recovery/plan-a/integration";
import type { SpecEvidenceStatus, SourcingSnapshotInput, SupplierRegistryStatus } from "../features/recovery/plan-a/domain";

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const OFFER_MESSAGE_SPEC: Record<string, SpecEvidenceStatus> = {
  QUALIFIED_CONDITIONAL: "SYNTHETIC_DEMO_APPROVED",
  UNREVIEWED: "UNVERIFIED",
  UNRESOLVED: "UNVERIFIED",
  REJECTED: "REJECTED",
};

/** Offer-evidence state per canonical offer, driven by P1's qualified message evidence when present. */
export function selectPlanAOfferEvidence(state: DemoState) {
  const messageEvidence = selectSupplierOfferEvidence(state);
  return HP_SUPPLIER_OFFERS.map((offer) => {
    const claims = messageEvidence.filter((e) => e.matchesCanonicalOfferId === offer.id);
    const latest = claims.at(-1);
    // Without a message claim the canonical SYNTHETIC_BUSINESS quote is its own evidence; an open,
    // rejected or unresolved message claim about the same offer overrides it until a human qualifies it.
    const specEvidenceStatus: SpecEvidenceStatus = latest ? OFFER_MESSAGE_SPEC[latest.qualification]! : "SYNTHETIC_DEMO_APPROVED";
    return { offerId: offer.id, specEvidenceStatus, availabilityStatus: "UNCONFIRMED" as const, evidenceRef: latest?.qualification === "QUALIFIED_CONDITIONAL" ? latest.evidenceRef : offer.id };
  });
}

export function selectPlanAInputRead(state: DemoState): PlanAInputRead {
  const restaurant = state.restaurant;
  const snap = restaurant.snapshot;
  const incident = restaurant.incidents.find((i) => i.id === state.incident.id);
  const impact = incident ? selectCurrentImpact(restaurant, incident.id) : null;
  const pos = snap.purchaseOrders;
  const snapshot: SourcingSnapshotInput | undefined = pos.every((p) => p.expectedKgMilli !== null)
    ? {
        id: snap.id, revision: snap.revision, fingerprint: snap.fingerprint, demoBusinessDate: snap.demoBusinessDate, dataMode: snap.dataMode,
        ingredientLots: snap.ingredientLots.map((l) => ({ ...l, availableAtLocal: l.availableAtLocal ?? HP_BUSINESS.simulationClockLocal })) as SourcingSnapshotInput["ingredientLots"],
        purchaseOrders: pos.map((p) => ({ ...p, expectedKgMilli: p.expectedKgMilli! })) as SourcingSnapshotInput["purchaseOrders"],
        menuItems: snap.menuItems, forecasts: snap.forecasts, confirmedOrders: snap.confirmedOrders as SourcingSnapshotInput["confirmedOrders"],
      }
    : undefined; // null PO quantity must block, never become zero
  const evidence = selectPlanAOfferEvidence(state);
  const ingredient = HP_INGREDIENTS.find((i) => i.id === HP_IDS.chicken)!;
  const offerReviewCount = state.offerReviews.length;
  return {
    source: {
      outletId: HP_IDS.outlet,
      incident: incident && incident.status !== "PENDING_VERIFICATION" && incident.status !== "DETECTED"
        ? { id: incident.id, poId: incident.poId, ingredientId: incident.ingredientId, type: incident.type, claimedShortfallKgMilli: incident.claimedShortfallKgMilli, status: incident.status, revision: incident.revision,
            // P2 refreshes Incident.snapshotFingerprint only on the first assessment; a current authoritative
            // reassessment is the evidence that the incident was evaluated on this snapshot.
            snapshotFingerprint: impact?.summary ? impact.snapshotFingerprint : incident.snapshotFingerprint, messageIds: [...incident.messageIds] }
        : undefined,
      snapshot,
      impact: impact?.summary ? { ...impact.summary, affectedMenuIds: [...impact.summary.affectedMenuIds], reasons: [...impact.summary.reasons] } : undefined,
      ingredientPolicy: ingredient.requiredSpec ? { ingredientId: ingredient.id, requiredSpecification: ingredient.requiredSpec, recipeQuantityField: "chickenKgMilli" } : undefined,
      businessClock: {
        businessDate: HP_BUSINESS.fixtureBusinessDate,
        timeZone: HP_BUSINESS.timezone,
        nowLocal: HP_BUSINESS.simulationClockLocal,
        nowIso: `${HP_BUSINESS.fixtureBusinessDate}T${HP_BUSINESS.simulationClockLocal}:00+08:00`,
        requiredReceiptCutoffLocal: HP_BUSINESS.prepCutoffLocal,
        receivingBufferMinutes: minutes(HP_BUSINESS.conditionalReceiptLocal) - minutes(HP_BUSINESS.alternateSupplierEtaLocal),
      },
    },
    offers: HP_SUPPLIER_OFFERS.map(({ qualification: _q, ...offer }) => ({ ...offer, evidenceRef: evidence.find((e) => e.offerId === offer.id)!.evidenceRef })),
    suppliers: HP_SUPPLIERS.map((s) => ({ id: s.id, name: s.name, status: s.registryStatus as SupplierRegistryStatus })),
    offerEvidence: evidence.map(({ evidenceRef: _r, ...e }) => e),
    scenarioMetadata: incident
      ? {
          scenarioId: "HP-SC-A-001",
          // Root version authority: advances on every material snapshot revision or offer-evidence decision.
          version: snap.revision + offerReviewCount,
          evidenceRefs: [...incident.messageIds, ...evidence.filter((e) => e.evidenceRef !== e.offerId).map((e) => e.evidenceRef)],
          actionIds: [],
          capacityStatus: "UNKNOWN",
        }
      : undefined,
  };
}
