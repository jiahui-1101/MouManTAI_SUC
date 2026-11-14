/**
 * Shared restaurant / incident / impact contracts (SUC-SHARED-01 §3).
 *
 * Fields marked "P2 addition" are not in the illustrative contract sketch and
 * need integration-lead review before other parts rely on them.
 */
import type {
  BaseUnit,
  DataQualityStatus,
  Feasibility,
  IncidentKind,
  LocalTime,
} from "./common";

export interface Tenant {
  id: string;
  name: string;
}

export interface Outlet {
  id: string;
  tenantId: string;
  name: string;
  isFictional: true;
}

export interface Supplier {
  id: string;
  name: string;
  registryStatus: "VERIFIED_DEMO_CONTACT" | "APPROVED_DEMO_SUPPLIER" | "APPROVED_DEMO_CONTACT";
  synthetic: true;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: BaseUnit;
  requiredSpec?: "CHILLED" | "FROZEN";
}

export interface InventoryLot {
  id: string;
  ingredientId: string;
  onHandMilli: number;
  unit: "kg" | "L";
  /** Quality accepted. Unaccepted lots are physical but not eligible. */
  accepted: boolean;
  availableAtLocal: LocalTime;
  expiresAtLocal?: LocalTime;
  /** P2 addition: quarantined stock is never eligible. */
  quarantined?: boolean;
}

export type PurchaseOrderState = "OPEN" | "SUPPLIER_CLAIMED_UNAVAILABLE_TODAY" | "RECEIVED";

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  ingredientId: string;
  /** null = expected quantity unknown (must not be invented). */
  expectedKgMilli: number | null;
  dueTimeLocal: LocalTime;
  state: PurchaseOrderState;
}

/** P2 addition: one BOM line of an approved recipe version. */
export interface RecipeComponent {
  ingredientId: string;
  quantityMilli: number;
  unit: BaseUnit;
}

/** P2 addition: the recipe/BOM is the source of per-portion ingredient usage. */
export interface RecipeVersion {
  menuId: string;
  version: string;
  approvedInDemo: boolean;
  components: RecipeComponent[];
}

export interface MenuItem {
  id: string;
  name: string;
  priceSen: number;
  /** Derived from the menu item's recipe at fixture build time; never edited separately. */
  chickenKgMilli: number;
  potatoFriesKgMilli: number;
  recipeVersion: string;
  approvedInDemo: boolean;
}

export interface ConfirmedOrder {
  id: string;
  menuId: string;
  portions: number;
  dueTimeLocal: LocalTime;
  agreedRecipeVersion: string;
  status: "CONFIRMED" | "FULFILLED" | "AT_RISK";
}

export interface ForecastDemand {
  menuId: string;
  /** Total expected portions. Confirmed orders are a subset of this, not additional. */
  portions: number;
  windowEndLocal: LocalTime;
}

export interface ProductionResource {
  id: string;
  name: string;
  capability: string;
}

/** P2 addition: stock already promised elsewhere (none in the canonical seed). */
export interface Reservation {
  id: string;
  lotId: string;
  quantityMilli: number;
  reason: string;
}

/**
 * P2 addition: a supplier statement about incoming goods. Never physical stock.
 * At most one active claim per PO, so repeated reports cannot double-subtract.
 */
export interface SupplierClaim {
  poId: string;
  supplierId: string;
  ingredientId: string;
  claimedDeliveryTodayKgMilli: number;
  /** null = no promised time (e.g. "we will update you tomorrow"). */
  etaLocal: LocalTime | null;
  incidentId: string;
}

export interface OperationalSnapshot {
  id: string;
  revision: number;
  /** Deterministic content fingerprint; see utils/fingerprint.ts. */
  fingerprint: string;
  capturedAtIso: string;
  demoBusinessDate: string;
  dataMode: "SYNTHETIC_BUSINESS";
  ingredientLots: InventoryLot[];
  menuItems: MenuItem[];
  purchaseOrders: PurchaseOrder[];
  confirmedOrders: ConfirmedOrder[];
  forecasts: ForecastDemand[];
  resources: ProductionResource[];
  /** P2 addition */
  recipes: RecipeVersion[];
  /** P2 addition */
  reservations: Reservation[];
  /** P2 addition */
  supplierClaims: SupplierClaim[];
}

export type IncidentStatus =
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

export interface Incident {
  id: string;
  poId: string;
  ingredientId: string;
  type: IncidentKind;
  /** Distinct source messages (one per channel event); all retained. */
  messageIds: string[];
  claimedShortfallKgMilli: number;
  status: IncidentStatus;
  revision: number;
  snapshotFingerprint: string;
  /** P2 addition */
  supplierId: string;
}

export interface ImpactSummary {
  incidentId: string;
  snapshotFingerprint: string;
  affectedMenuIds: string[];
  confirmedChickenPortions: number;
  chickenForecastPortions: number;
  chickenForecastRequirementKgMilli: number;
  chickenAvailableKgMilli: number;
  demandGapKgMilli: number;
  reasons: string[];
}

/** P2 addition: impact verdict wrapper. `summary` is null unless the result is authoritative. */
export type ImpactStatus =
  | "ASSESSED"
  | "BREACH_RISK"
  | "PENDING_VERIFICATION"
  | "STALE_SNAPSHOT"
  | "UNKNOWN";

export interface DataQualityIssue {
  code:
    | "MISSING_RECIPE"
    | "RECIPE_NOT_APPROVED"
    | "RECIPE_VERSION_MISMATCH"
    | "MISSING_PO_QUANTITY"
    | "UNIT_MISMATCH"
    | "MISSING_DEADLINE"
    | "MISSING_CAPACITY"
    | "SNAPSHOT_STALE";
  status: DataQualityStatus;
  subjectId: string;
  message: string;
}

export interface IngredientPosition {
  ingredientId: string;
  unit: BaseUnit;
  physicalOnHandMilli: number;
  eligibleOnHandMilli: number;
  ineligibleOnHandMilli: number;
  reservedMilli: number;
  availableAfterReservationsMilli: number;
  /** Open PO quantity due by the cut-off with no supplier claim against it. */
  plannedIncomingMilli: number;
  /** What the supplier says will arrive; a claim, not stock. */
  supplierClaimedIncomingMilli: number;
}

export interface ImpactAssessment {
  status: ImpactStatus;
  incidentId: string;
  snapshotId: string;
  snapshotRevision: number;
  snapshotFingerprint: string;
  /** Present only when status is ASSESSED or BREACH_RISK. */
  summary: ImpactSummary | null;
  poShortfallKgMilli: number | null;
  confirmedRequirementKgMilli: number | null;
  discretionaryAfterConfirmedKgMilli: number | null;
  confirmedDeficitKgMilli: number | null;
  before: IngredientPosition | null;
  after: IngredientPosition | null;
  affectedConfirmedOrderIds: string[];
  unaffectedMenuIds: string[];
  feasibilityOfConfirmed: Feasibility;
  dataQuality: DataQualityIssue[];
  reasons: string[];
  source: "SIMULATED_CALCULATION";
}
