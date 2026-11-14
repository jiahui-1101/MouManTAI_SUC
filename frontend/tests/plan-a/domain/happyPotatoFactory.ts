/**
 * Test-only copy of the authoritative Happy Potato fixture values.
 * Production code must consume the shared runtime fixture when the integrator adds it.
 */
import type { RecoverySourcingNeedInput, SupplierOfferCandidateInput } from "../../../src/features/recovery/plan-a/domain/types";
import { deriveRecoverySourcingNeed } from "../../../src/features/recovery/plan-a/domain";

const CANONICAL_NEED_INPUT: RecoverySourcingNeedInput = {
  outletId: "HP-OUTLET-001",
  incident: {
    id: "HP-INC-001",
    poId: "HP-PO-1042",
    ingredientId: "HP-ING-CHICKEN",
    type: "UNAVAILABLE",
    claimedShortfallKgMilli: 20_000,
    status: "IMPACT_ASSESSED",
    revision: 1,
    snapshotFingerprint: "fixture-snapshot-version-1",
    messageIds: ["HP-MSG-WA-001"],
  },
  snapshot: {
    id: "HP-SNAP-001",
    revision: 1,
    fingerprint: "fixture-snapshot-version-1",
    demoBusinessDate: "2026-11-21",
    dataMode: "SYNTHETIC_BUSINESS",
    ingredientLots: [
      { id: "HP-LOT-CH-001", ingredientId: "HP-ING-CHICKEN", onHandMilli: 10_000, unit: "kg", accepted: true, availableAtLocal: "09:00" },
      { id: "HP-LOT-FRIES-001", ingredientId: "HP-ING-FRIES", onHandMilli: 30_000, unit: "kg", accepted: true, availableAtLocal: "09:00" },
      { id: "HP-LOT-SEAS-001", ingredientId: "HP-ING-SEAS", onHandMilli: 3_000, unit: "kg", accepted: true, availableAtLocal: "09:00" },
      { id: "HP-LOT-OIL-001", ingredientId: "HP-ING-OIL", onHandMilli: 10_000, unit: "L", accepted: true, availableAtLocal: "09:00" },
    ],
    purchaseOrders: [
      { id: "HP-PO-1042", supplierId: "HP-SUP-001", ingredientId: "HP-ING-CHICKEN", expectedKgMilli: 20_000, dueTimeLocal: "10:00", state: "SUPPLIER_CLAIMED_UNAVAILABLE_TODAY" },
    ],
    menuItems: [
      { id: "HP-MENU-CP", name: "Chicken Popcorn", priceSen: 990, chickenKgMilli: 150, potatoFriesKgMilli: 0, recipeVersion: "DEMO-v1", approvedInDemo: true },
      { id: "HP-MENU-CT", name: "Chicken Tenders", priceSen: 1_190, chickenKgMilli: 200, potatoFriesKgMilli: 0, recipeVersion: "DEMO-v1", approvedInDemo: true },
      { id: "HP-MENU-HC", name: "Happy Combo — Chicken Popcorn", priceSen: 1_590, chickenKgMilli: 100, potatoFriesKgMilli: 180, recipeVersion: "DEMO-v1", approvedInDemo: true },
      { id: "HP-MENU-FR", name: "Flavoured Fries (Regular)", priceSen: 790, chickenKgMilli: 0, potatoFriesKgMilli: 200, recipeVersion: "DEMO-v1", approvedInDemo: true },
    ],
    forecasts: [
      { menuId: "HP-MENU-CP", portions: 60, windowEndLocal: "14:30" },
      { menuId: "HP-MENU-CT", portions: 40, windowEndLocal: "14:30" },
      { menuId: "HP-MENU-HC", portions: 50, windowEndLocal: "14:30" },
      { menuId: "HP-MENU-FR", portions: 90, windowEndLocal: "14:30" },
    ],
    confirmedOrders: [
      { id: "HP-ORD-CP-01", menuId: "HP-MENU-CP", portions: 10, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-CP-02", menuId: "HP-MENU-CP", portions: 8, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-CP-03", menuId: "HP-MENU-CP", portions: 7, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-CT-01", menuId: "HP-MENU-CT", portions: 5, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-CT-02", menuId: "HP-MENU-CT", portions: 5, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-CT-03", menuId: "HP-MENU-CT", portions: 5, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-HC-01", menuId: "HP-MENU-HC", portions: 8, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-HC-02", menuId: "HP-MENU-HC", portions: 6, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-HC-03", menuId: "HP-MENU-HC", portions: 6, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-FR-01", menuId: "HP-MENU-FR", portions: 15, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-FR-02", menuId: "HP-MENU-FR", portions: 10, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
      { id: "HP-ORD-FR-03", menuId: "HP-MENU-FR", portions: 10, dueTimeLocal: "12:30", agreedRecipeVersion: "DEMO-v1", status: "CONFIRMED" },
    ],
  },
  impact: {
    incidentId: "HP-INC-001",
    snapshotFingerprint: "fixture-snapshot-version-1",
    affectedMenuIds: ["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC"],
    confirmedChickenPortions: 60,
    chickenForecastPortions: 150,
    chickenForecastRequirementKgMilli: 22_000,
    chickenAvailableKgMilli: 10_000,
    demandGapKgMilli: 12_000,
    reasons: ["SYNTHETIC_BUSINESS fixture calculation"],
  },
  ingredientPolicy: {
    ingredientId: "HP-ING-CHICKEN",
    requiredSpecification: "CHILLED",
    recipeQuantityField: "chickenKgMilli",
  },
  businessClock: {
    businessDate: "2026-11-21",
    timeZone: "Asia/Kuala_Lumpur",
    nowLocal: "09:00",
    nowIso: "2026-11-21T09:00:00+08:00",
    requiredReceiptCutoffLocal: "10:45",
    receivingBufferMinutes: 15,
  },
};

export function makeCanonicalSourcingInput() {
  return structuredClone(CANONICAL_NEED_INPUT);
}

type CandidateOverrides = {
  offer?: Partial<SupplierOfferCandidateInput["offer"]>;
  supplierStatus?: SupplierOfferCandidateInput["supplier"]["status"];
  specEvidenceStatus?: SupplierOfferCandidateInput["specEvidenceStatus"];
  availabilityStatus?: SupplierOfferCandidateInput["availabilityStatus"];
};

export function makeOfferB(overrides: CandidateOverrides = {}): SupplierOfferCandidateInput {
  const { offer: offerOverrides, supplierStatus, specEvidenceStatus, availabilityStatus } = overrides;
  return {
    offer: {
      id: "HP-OFFER-002",
      supplierId: "HP-SUP-002",
      ingredientId: "HP-ING-CHICKEN",
      quantityKgMilli: 15_000,
      pricePerKgSen: 1_600,
      freightSen: 1_500,
      landedTotalSen: 25_500,
      etaLocal: "10:15",
      spec: "CHILLED",
      evidenceRef: "HP-OFFER-002",
      provenance: "SYNTHETIC_BUSINESS",
      ...offerOverrides,
    },
    supplier: {
      id: "HP-SUP-002",
      status: supplierStatus ?? "APPROVED_DEMO_SUPPLIER",
    },
    specEvidenceStatus: specEvidenceStatus ?? "SYNTHETIC_DEMO_APPROVED",
    availabilityStatus: availabilityStatus ?? "UNCONFIRMED",
  };
}

export function makeOfferC(overrides: CandidateOverrides = {}): SupplierOfferCandidateInput {
  const { offer: offerOverrides, supplierStatus, specEvidenceStatus, availabilityStatus } = overrides;
  return {
    offer: {
      id: "HP-OFFER-003",
      supplierId: "HP-SUP-003",
      ingredientId: "HP-ING-CHICKEN",
      quantityKgMilli: 15_000,
      pricePerKgSen: 1_400,
      freightSen: 1_000,
      landedTotalSen: 22_000,
      etaLocal: "13:30",
      spec: "FROZEN",
      evidenceRef: "HP-OFFER-003",
      provenance: "SYNTHETIC_BUSINESS",
      ...offerOverrides,
    },
    supplier: {
      id: "HP-SUP-003",
      status: supplierStatus ?? "APPROVED_DEMO_CONTACT",
    },
    specEvidenceStatus: specEvidenceStatus ?? "SYNTHETIC_DEMO_APPROVED",
    availabilityStatus: availabilityStatus ?? "UNCONFIRMED",
  };
}

type ScenarioOverrides = {
  sourcingInput?: ReturnType<typeof makeCanonicalSourcingInput>;
  candidateOffers?: SupplierOfferCandidateInput[];
  selectedOfferId?: string | null;
  currentSnapshotFingerprint?: string;
  currentSnapshotRevision?: number;
  scenarioId?: string;
  version?: number;
  evidenceRefs?: string[];
  actionIds?: string[];
  capacityStatus?: "UNKNOWN" | "INSUFFICIENT";
};

export function makePlanAScenarioInput(overrides: ScenarioOverrides = {}) {
  const sourcingInput = overrides.sourcingInput ?? makeCanonicalSourcingInput();
  const needResult = deriveRecoverySourcingNeed(sourcingInput);
  if (!needResult.ok) throw new Error(`${needResult.error.code}: ${needResult.error.message}`);

  return {
    sourcingNeed: needResult.value,
    candidateOffers: overrides.candidateOffers ?? [makeOfferB(), makeOfferC()],
    selectedOfferId: overrides.selectedOfferId === undefined ? "HP-OFFER-002" : overrides.selectedOfferId,
    currentSnapshotFingerprint: overrides.currentSnapshotFingerprint ?? sourcingInput.snapshot.fingerprint,
    currentSnapshotRevision: overrides.currentSnapshotRevision ?? sourcingInput.snapshot.revision,
    businessClock: sourcingInput.businessClock,
    scenarioMetadata: {
      scenarioId: overrides.scenarioId ?? "HP-SC-A-001",
      version: overrides.version ?? 1,
      evidenceRefs: overrides.evidenceRefs ?? ["HP-MSG-WA-001"],
      actionIds: overrides.actionIds ?? [],
      capacityStatus: overrides.capacityStatus ?? "UNKNOWN",
    },
  };
}
