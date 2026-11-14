/** Narrow P3 input and output boundaries; shared application contracts remain integration-owned. */
export type DomainFailureCode =
  | "INVALID_INPUT"
  | "INVALID_AMOUNT"
  | "MISSING_COST"
  | "COST_OVERFLOW"
  | "INCIDENT_NOT_VERIFIED"
  | "UNSUPPORTED_INCIDENT"
  | "MISSING_PURCHASE_ORDER"
  | "PURCHASE_ORDER_MISMATCH"
  | "PURCHASE_ORDER_ALREADY_RECEIVED"
  | "SNAPSHOT_FINGERPRINT_MISSING"
  | "SNAPSHOT_MISMATCH"
  | "IMPACT_MISMATCH"
  | "MISSING_MENU_DATA"
  | "UNAPPROVED_RECIPE"
  | "UNSUPPORTED_INGREDIENT"
  | "NO_SUPPLIER_OFFERS"
  | "NO_ELIGIBLE_OFFERS"
  | "OFFER_NOT_ELIGIBLE"
  | "NEEDS_RECALCULATION"
  | "SCENARIO_METADATA_MISSING"
  | "KITCHEN_CAPACITY_INSUFFICIENT";

export interface DomainFailure {
  code: DomainFailureCode;
  message: string;
  details?: string[];
}

export type DomainResult<T> = { ok: true; value: T } | { ok: false; error: DomainFailure };

export type IncidentLifecycleStatus =
  | "DETECTED"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "IMPACT_ASSESSED"
  | "SCENARIOS_READY"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "AWAITING_EVIDENCE"
  | "CLOSED";

export interface SourcingIncidentInput {
  id: string;
  poId: string;
  ingredientId: string;
  type: "PARTIAL_DELIVERY" | "DELAY" | "UNAVAILABLE" | "QUALITY_REJECTED" | "PRICE_CHANGE" | "CANCELLED" | "SPEC_CHANGE";
  claimedShortfallKgMilli: number;
  status: IncidentLifecycleStatus;
  revision: number;
  snapshotFingerprint: string;
  messageIds: string[];
}

export interface InventoryLotInput {
  id: string;
  ingredientId: string;
  onHandMilli: number;
  unit: "kg" | "L";
  accepted: boolean;
  availableAtLocal: string;
}

export interface PurchaseOrderInput {
  id: string;
  supplierId: string;
  ingredientId: string;
  expectedKgMilli: number;
  dueTimeLocal: string;
  state: "OPEN" | "SUPPLIER_CLAIMED_UNAVAILABLE_TODAY" | "RECEIVED";
}

export interface MenuItemInput {
  id: string;
  name: string;
  priceSen: number;
  chickenKgMilli: number;
  potatoFriesKgMilli: number;
  recipeVersion: string;
  approvedInDemo: boolean;
}

export interface ForecastInput {
  menuId: string;
  portions: number;
  windowEndLocal: string;
}

export interface ConfirmedOrderInput {
  id: string;
  menuId: string;
  portions: number;
  dueTimeLocal: string;
  agreedRecipeVersion: string;
  status: "CONFIRMED" | "FULFILLED" | "AT_RISK";
}

export interface SourcingSnapshotInput {
  id: string;
  revision: number;
  fingerprint: string;
  demoBusinessDate: string;
  dataMode: "SYNTHETIC_BUSINESS";
  ingredientLots: InventoryLotInput[];
  purchaseOrders: PurchaseOrderInput[];
  menuItems: MenuItemInput[];
  forecasts: ForecastInput[];
  confirmedOrders: ConfirmedOrderInput[];
}

export interface ImpactInput {
  incidentId: string;
  snapshotFingerprint: string;
  affectedMenuIds: string[];
  confirmedChickenPortions: number;
  chickenForecastPortions: number;
  chickenForecastRequirementKgMilli: number;
  chickenAvailableKgMilli: number;
  demandGapKgMilli: number;
  reasons?: string[];
}

export type RecipeQuantityField = "chickenKgMilli" | "potatoFriesKgMilli";

export interface IngredientPolicyInput {
  ingredientId: string;
  requiredSpecification: string;
  recipeQuantityField: RecipeQuantityField;
}

export interface BusinessClockContext {
  businessDate: string;
  timeZone: string;
  nowLocal: string;
  nowIso?: string;
  requiredReceiptCutoffLocal: string;
  receivingBufferMinutes: number;
}

export interface RecoverySourcingNeedInput {
  outletId: string;
  incident: SourcingIncidentInput;
  snapshot: SourcingSnapshotInput;
  impact: ImpactInput;
  ingredientPolicy: IngredientPolicyInput;
  businessClock: BusinessClockContext;
}

export interface RecoverySourcingNeed {
  readinessStatus: "READY";
  outletId: string;
  incidentId: string;
  poId: string;
  originalSupplierId: string;
  ingredientId: string;
  originalExpectedKgMilli: number;
  claimedIncomingKgMilli: number;
  poShortfallKgMilli: number;
  acceptedOnHandKgMilli: number;
  forecastRequirementKgMilli: number;
  forecastGapKgMilli: number;
  confirmedRequirementKgMilli: number;
  confirmedChickenPortions: number;
  forecastChickenPortions: number;
  affectedMenuIds: string[];
  requiredSpecification: string;
  requiredReceiptCutoffLocal: string;
  receivingBufferMinutes: number;
  businessDate: string;
  timeZone: string;
  snapshotRevision: number;
  snapshotFingerprint: string;
  evidenceRefs: string[];
}

export interface LandedCostInput {
  quantityKgMilli: number;
  pricePerKgSen: number | null | undefined;
  freightSen: number | null | undefined;
}

export interface LandedCost {
  quantityKgMilli: number;
  pricePerKgSen: number;
  itemCostSen: number;
  freightSen: number;
  landedCostSen: number;
  roundingPolicy: "HALF_UP_TO_SEN";
  roundingApplied: boolean;
}

export type SupplierRegistryStatus =
  | "APPROVED_DEMO_SUPPLIER"
  | "APPROVED_DEMO_CONTACT"
  | "VERIFIED_DEMO_CONTACT"
  | "UNVERIFIED"
  | "UNKNOWN";

export type SpecEvidenceStatus = "SYNTHETIC_DEMO_APPROVED" | "MISSING" | "UNVERIFIED" | "REJECTED";
export type OfferAvailabilityStatus = "UNCONFIRMED" | "CONFIRMED" | "DENIED";

export interface SupplierOfferInput {
  id: string;
  supplierId: string;
  ingredientId: string;
  quantityKgMilli: number;
  pricePerKgSen?: number | null;
  freightSen?: number | null;
  landedTotalSen?: number | null;
  etaLocal?: string | null;
  spec?: string | null;
  evidenceRef?: string | null;
  provenance?: "LIVE_CHANNEL" | "REPLAY_CHANNEL" | "SIMULATED_CHANNEL" | "SYNTHETIC_BUSINESS";
  minimumOrderKgMilli?: number | null;
  quoteValidUntilIso?: string | null;
}

export interface SupplierOfferCandidateInput {
  offer: SupplierOfferInput;
  supplier: { id: string; status: SupplierRegistryStatus };
  specEvidenceStatus: SpecEvidenceStatus;
  availabilityStatus: OfferAvailabilityStatus;
}

export type DeliveryWindowStatus = "TIME_CONDITIONALLY_ELIGIBLE" | "MISSED_PREP_CUTOFF" | "UNKNOWN";
export type DeliveryWindowReasonCode =
  | "NONE"
  | "ETA_UNKNOWN"
  | "BUSINESS_CONTEXT_UNKNOWN"
  | "ETA_BEFORE_DEMO_CLOCK"
  | "CROSS_DAY_ETA_UNSUPPORTED"
  | "MISSED_PREP_CUTOFF";

export interface DeliveryWindowInput extends BusinessClockContext {
  etaLocal: string | null | undefined;
}

export interface DeliveryWindowAssessment {
  status: DeliveryWindowStatus;
  reasonCode: DeliveryWindowReasonCode;
  etaLocal: string | null;
  expectedAcceptanceLocal: string | null;
  actualArrivalVerified: false;
  qualityAccepted: false;
}

export type OfferReasonCode =
  | "SUPPLIER_IDENTITY_UNVERIFIED"
  | "OFFER_EVIDENCE_MISSING"
  | "SUPPLIER_AVAILABILITY_UNKNOWN"
  | "SUPPLIER_ID_MISMATCH"
  | "SUPPLIER_NOT_APPROVED_FOR_SOURCING"
  | "INGREDIENT_MISMATCH"
  | "SPEC_MISMATCH"
  | "SPECIFICATION_UNKNOWN"
  | "SPEC_EVIDENCE_MISSING"
  | "SPEC_EVIDENCE_UNVERIFIED"
  | "SPEC_EVIDENCE_REJECTED"
  | "INSUFFICIENT_QUANTITY"
  | "MOQ_NOT_MET"
  | "QUOTE_EXPIRED"
  | "QUOTE_VALIDITY_UNKNOWN"
  | "ETA_UNKNOWN"
  | "MISSED_PREP_CUTOFF"
  | "MISSING_COST"
  | "INVALID_COST"
  | "INVALID_OFFER_QUANTITY"
  | "INVALID_MOQ"
  | "LANDED_TOTAL_MISMATCH"
  | "SUPPLIER_DENIED"
  | "BUSINESS_CONTEXT_MISMATCH";

export type OfferConditionCode =
  | "SUPPLIER_CONFIRMATION_REQUIRED"
  | "QUALITY_ACCEPTANCE_REQUIRED"
  | "QUOTE_VALIDITY_NOT_PROVIDED";

export interface OfferCondition {
  code: OfferConditionCode;
  description: string;
}

export interface OfferAssessment {
  offerId: string;
  supplierId: string;
  status: "QUALIFIED_CONDITIONAL" | "INCOMPATIBLE" | "UNKNOWN";
  isSelectableForConditionalPlan: boolean;
  reasonCodes: OfferReasonCode[];
  conditions: OfferCondition[];
  landedCostSen: number | null;
  deliveryWindow: DeliveryWindowAssessment;
  physicalInventoryEffect: "NONE_UNTIL_ACCEPTED_RECEIPT";
  evidenceRefs: string[];
}

export interface AssessOfferInput {
  candidate: SupplierOfferCandidateInput;
  need: RecoverySourcingNeed;
  businessClock: BusinessClockContext;
}
