/**
 * Canonical Happy Potato SUC fixture — SYNTHETIC_BUSINESS.
 *
 * Source of truth: docs SUC-SHARED-01 v1.0 §2 and §10. Every operating value here
 * (suppliers, recipes, gram weights, prices, demand, stock, POs) is fictional demo
 * data. It is NOT Happy Potato's real recipes, sales, inventory or suppliers, and
 * no FeedMe connection exists.
 *
 * Seed = the BEFORE-message state: PO HP-PO-1042 is OPEN, no supplier claim, no
 * incident. Changing any value here requires a reviewed contract revision.
 */
import type {
  ConfirmedOrder,
  ForecastDemand,
  Ingredient,
  InventoryLot,
  MenuItem,
  OperationalSnapshot,
  Outlet,
  ProductionResource,
  PurchaseOrder,
  RecipeVersion,
  Supplier,
  Tenant,
} from "../../types/restaurant";
import type { IncidentKind, LocalTime } from "../../types/common";
import { parseQuantity } from "../../utils/quantity";
import { snapshotFingerprint, type SnapshotContent } from "../../utils/snapshot";

export const HP_DATA_MODE = "SYNTHETIC_BUSINESS" as const;
export const HP_DATA_LABEL = "Happy Potato • Demo data";

export const HP_IDS = {
  tenant: "HP-TENANT-DEMO",
  outlet: "HP-OUTLET-001",
  snapshot: "HP-SNAP-001",
  incident: "HP-INC-001",
  po: "HP-PO-1042",
  supplierOriginal: "HP-SUP-001",
  chicken: "HP-ING-CHICKEN",
  fries: "HP-ING-FRIES",
  seasoning: "HP-ING-SEAS",
  oil: "HP-ING-OIL",
  menu: {
    chickenPopcorn: "HP-MENU-CP",
    chickenTenders: "HP-MENU-CT",
    happyCombo: "HP-MENU-HC",
    fries: "HP-MENU-FR",
  },
} as const;

export const HP_TENANT: Tenant = { id: HP_IDS.tenant, name: "Happy Potato — SUC Demo" };
export const HP_OUTLET: Outlet = {
  id: HP_IDS.outlet,
  tenantId: HP_IDS.tenant,
  name: "Happy Potato — Demo Outlet",
  isFictional: true,
};

export const HP_BUSINESS = {
  currency: "MYR",
  timezone: "Asia/Kuala_Lumpur",
  fixtureBusinessDate: "2026-11-21",
  simulationClockLocal: "09:00",
  poDueLocal: "10:00",
  alternateSupplierEtaLocal: "10:15",
  conditionalReceiptLocal: "10:30",
  prepCutoffLocal: "10:45",
  confirmedDeadlineLocal: "12:30",
  forecastWindowEndLocal: "14:30",
} as const satisfies Record<string, string>;

export const HP_SUPPLIERS: Supplier[] = [
  { id: "HP-SUP-001", name: "Demo Poultry Supply A", registryStatus: "VERIFIED_DEMO_CONTACT", synthetic: true },
  { id: "HP-SUP-002", name: "Demo Poultry Supply B", registryStatus: "APPROVED_DEMO_SUPPLIER", synthetic: true },
  { id: "HP-SUP-003", name: "Demo Budget Frozen Foods", registryStatus: "APPROVED_DEMO_CONTACT", synthetic: true },
  { id: "HP-SUP-004", name: "Demo Frozen Fries Distributor", registryStatus: "APPROVED_DEMO_CONTACT", synthetic: true },
];

export const HP_INGREDIENTS: Ingredient[] = [
  { id: HP_IDS.chicken, name: "Chilled chicken", unit: "kg", requiredSpec: "CHILLED" },
  { id: HP_IDS.fries, name: "Frozen potato fries", unit: "kg", requiredSpec: "FROZEN" },
  { id: HP_IDS.seasoning, name: "Seasoning", unit: "kg" },
  { id: HP_IDS.oil, name: "Frying oil", unit: "L" },
];

/**
 * Locked main demo message and its expected extraction (contract §1).
 * P1 owns parsing; this is reference data for tests and incident creation.
 */
export const HP_LOCKED_MESSAGE = {
  text: "Hi Happy Potato, sorry. PO HP-PO-1042: we cannot deliver the 20kg chilled chicken scheduled for today. Delivered quantity today will be 0kg. We will update you tomorrow.",
  outlookSubject: "HP-PO-1042 delivery update",
  expected: {
    poId: HP_IDS.po,
    ingredientId: HP_IDS.chicken,
    incidentType: "UNAVAILABLE" as IncidentKind,
    expectedKgMilli: 20000,
    claimedDeliveryTodayKgMilli: 0,
    claimedShortfallKgMilli: 20000,
    etaLocal: null as LocalTime | null,
  },
} as const;

const kg = (decimal: string) => parseQuantity(decimal, "kg").valueMilli;

const RECIPE_VERSION = "DEMO-v1";

const RECIPES: RecipeVersion[] = [
  {
    menuId: HP_IDS.menu.chickenPopcorn,
    version: RECIPE_VERSION,
    approvedInDemo: true,
    components: [{ ingredientId: HP_IDS.chicken, quantityMilli: kg("0.150"), unit: "kg" }],
  },
  {
    menuId: HP_IDS.menu.chickenTenders,
    version: RECIPE_VERSION,
    approvedInDemo: true,
    components: [{ ingredientId: HP_IDS.chicken, quantityMilli: kg("0.200"), unit: "kg" }],
  },
  {
    menuId: HP_IDS.menu.happyCombo,
    version: RECIPE_VERSION,
    approvedInDemo: true,
    components: [
      { ingredientId: HP_IDS.chicken, quantityMilli: kg("0.100"), unit: "kg" },
      { ingredientId: HP_IDS.fries, quantityMilli: kg("0.180"), unit: "kg" },
    ],
  },
  {
    menuId: HP_IDS.menu.fries,
    version: RECIPE_VERSION,
    approvedInDemo: true,
    components: [{ ingredientId: HP_IDS.fries, quantityMilli: kg("0.200"), unit: "kg" }],
  },
];

function perPortion(menuId: string, ingredientId: string): number {
  const recipe = RECIPES.find((r) => r.menuId === menuId);
  return recipe?.components.find((c) => c.ingredientId === ingredientId)?.quantityMilli ?? 0;
}

const MENU_BASE: Array<Pick<MenuItem, "id" | "name" | "priceSen">> = [
  { id: HP_IDS.menu.chickenPopcorn, name: "Chicken Popcorn", priceSen: 990 },
  { id: HP_IDS.menu.chickenTenders, name: "Chicken Tenders", priceSen: 1190 },
  { id: HP_IDS.menu.happyCombo, name: "Happy Combo — Chicken Popcorn", priceSen: 1590 },
  { id: HP_IDS.menu.fries, name: "Flavoured Fries (Regular)", priceSen: 790 },
];

/** Contract-shaped menu items; per-portion weights are derived from RECIPES (single source). */
const MENU_ITEMS: MenuItem[] = MENU_BASE.map((item) => ({
  ...item,
  chickenKgMilli: perPortion(item.id, HP_IDS.chicken),
  potatoFriesKgMilli: perPortion(item.id, HP_IDS.fries),
  recipeVersion: RECIPE_VERSION,
  approvedInDemo: true,
}));

const LOTS: InventoryLot[] = [
  // availableAtLocal: contract gives no time; on-hand lots are treated as available from the demo clock start (09:00).
  { id: "HP-LOT-CH-001", ingredientId: HP_IDS.chicken, onHandMilli: kg("10.000"), unit: "kg", accepted: true, availableAtLocal: "09:00" },
  { id: "HP-LOT-FRIES-001", ingredientId: HP_IDS.fries, onHandMilli: kg("30.000"), unit: "kg", accepted: true, availableAtLocal: "09:00" },
  { id: "HP-LOT-SEAS-001", ingredientId: HP_IDS.seasoning, onHandMilli: kg("3.000"), unit: "kg", accepted: true, availableAtLocal: "09:00" },
  { id: "HP-LOT-OIL-001", ingredientId: HP_IDS.oil, onHandMilli: parseQuantity("10.000", "L").valueMilli, unit: "L", accepted: true, availableAtLocal: "09:00" },
];

const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: HP_IDS.po,
    supplierId: HP_IDS.supplierOriginal,
    ingredientId: HP_IDS.chicken,
    expectedKgMilli: kg("20.000"),
    dueTimeLocal: HP_BUSINESS.poDueLocal,
    state: "OPEN",
  },
];

const ORDER_GROUPS: Array<[string, string, number]> = [
  ["HP-ORD-CP-01", HP_IDS.menu.chickenPopcorn, 10],
  ["HP-ORD-CP-02", HP_IDS.menu.chickenPopcorn, 8],
  ["HP-ORD-CP-03", HP_IDS.menu.chickenPopcorn, 7],
  ["HP-ORD-CT-01", HP_IDS.menu.chickenTenders, 5],
  ["HP-ORD-CT-02", HP_IDS.menu.chickenTenders, 5],
  ["HP-ORD-CT-03", HP_IDS.menu.chickenTenders, 5],
  ["HP-ORD-HC-01", HP_IDS.menu.happyCombo, 8],
  ["HP-ORD-HC-02", HP_IDS.menu.happyCombo, 6],
  ["HP-ORD-HC-03", HP_IDS.menu.happyCombo, 6],
  ["HP-ORD-FR-01", HP_IDS.menu.fries, 15],
  ["HP-ORD-FR-02", HP_IDS.menu.fries, 10],
  ["HP-ORD-FR-03", HP_IDS.menu.fries, 10],
];

/** Synthetic aggregate order groups — no customer identity. */
const CONFIRMED_ORDERS: ConfirmedOrder[] = ORDER_GROUPS.map(([id, menuId, portions]) => ({
  id,
  menuId,
  portions,
  dueTimeLocal: HP_BUSINESS.confirmedDeadlineLocal,
  agreedRecipeVersion: RECIPE_VERSION,
  status: "CONFIRMED",
}));

const FORECASTS: ForecastDemand[] = [
  { menuId: HP_IDS.menu.chickenPopcorn, portions: 60, windowEndLocal: HP_BUSINESS.forecastWindowEndLocal },
  { menuId: HP_IDS.menu.chickenTenders, portions: 40, windowEndLocal: HP_BUSINESS.forecastWindowEndLocal },
  { menuId: HP_IDS.menu.happyCombo, portions: 50, windowEndLocal: HP_BUSINESS.forecastWindowEndLocal },
  { menuId: HP_IDS.menu.fries, portions: 90, windowEndLocal: HP_BUSINESS.forecastWindowEndLocal },
];

const RESOURCES: ProductionResource[] = [
  { id: "HP-FRY-CH-A", name: "Chicken Fryer A", capability: "DEMO_CHICKEN_BATCH" },
  { id: "HP-FRY-CH-B", name: "Chicken Fryer B", capability: "DEMO_CHICKEN_BATCH" },
  { id: "HP-FRY-FRIES-A", name: "Fries Fryer A", capability: "DEMO_FROZEN_FRIES" },
];

/**
 * Canonical synthetic supplier offers (contract §2). Business reference quotes only:
 * never stock, never an accepted PO. HP-MSG-OL-OFFER is a separate message *claim*
 * that P1 must qualify before it can count as evidence for HP-OFFER-002.
 */
export const HP_SUPPLIER_OFFERS = [
  { id: "HP-OFFER-002", supplierId: "HP-SUP-002", ingredientId: HP_IDS.chicken, quantityKgMilli: kg("15.000"), pricePerKgSen: 1600, freightSen: 1500, landedTotalSen: 25500, etaLocal: "10:15", spec: "CHILLED", qualification: "QUALIFIED_CONDITIONAL", provenance: HP_DATA_MODE },
  { id: "HP-OFFER-003", supplierId: "HP-SUP-003", ingredientId: HP_IDS.chicken, quantityKgMilli: kg("15.000"), pricePerKgSen: 1400, freightSen: 1000, landedTotalSen: 22000, etaLocal: "13:30", spec: "FROZEN", qualification: "INCOMPATIBLE", provenance: HP_DATA_MODE },
] as const;

/** Fresh deep copy of the canonical seed snapshot HP-SNAP-001 revision 1. */
export function createHappyPotatoSeedSnapshot(): OperationalSnapshot {
  const content: SnapshotContent = structuredClone({
    demoBusinessDate: HP_BUSINESS.fixtureBusinessDate,
    dataMode: HP_DATA_MODE,
    ingredientLots: LOTS,
    menuItems: MENU_ITEMS,
    purchaseOrders: PURCHASE_ORDERS,
    confirmedOrders: CONFIRMED_ORDERS,
    forecasts: FORECASTS,
    resources: RESOURCES,
    recipes: RECIPES,
    reservations: [],
    supplierClaims: [],
  });
  return {
    id: HP_IDS.snapshot,
    revision: 1,
    fingerprint: snapshotFingerprint(content),
    capturedAtIso: `${HP_BUSINESS.fixtureBusinessDate}T${HP_BUSINESS.simulationClockLocal}:00+08:00`,
    ...content,
  };
}
