/**
 * P2 deterministic impact calculations — pure functions over an OperationalSnapshot.
 *
 * Label: SIMULATED_CALCULATION (demo calculation, not an optimisation solver).
 * All quantities are integer thousandths of the base unit (kg-milli = grams).
 */
import type {
  BaseUnit,
  DataQualityStatus,
  LocalTime,
} from "../../types/common";
import type {
  ConfirmedOrder,
  DataQualityIssue,
  IngredientPosition,
  InventoryLot,
  MenuItem,
  OperationalSnapshot,
  PurchaseOrder,
  RecipeVersion,
  SupplierClaim,
} from "../../types/restaurant";
import { multiplyByPortions } from "../../utils/quantity";
import { isAtOrBefore } from "../../utils/time";
import { snapshotFingerprint } from "../../utils/snapshot";

/* 1. PO delivery difference ------------------------------------------------ */

export type PoDifference =
  | { status: "RESOLVED"; expectedKgMilli: number; claimedKgMilli: number; shortfallKgMilli: number }
  | { status: "UNRESOLVED"; reason: string };

/** Supplier-reported shortfall against a PO. Never invents a missing expected quantity. */
export function poDeliveryDifference(po: PurchaseOrder | undefined, claimedKgMilli: number | null): PoDifference {
  if (!po) return { status: "UNRESOLVED", reason: "Purchase order not found in snapshot" };
  if (po.expectedKgMilli === null) return { status: "UNRESOLVED", reason: `PO ${po.id} has no expected quantity` };
  if (claimedKgMilli === null) return { status: "UNRESOLVED", reason: `No supplier claim recorded for PO ${po.id}` };
  if (claimedKgMilli < 0) return { status: "UNRESOLVED", reason: "Claimed quantity cannot be negative" };
  return {
    status: "RESOLVED",
    expectedKgMilli: po.expectedKgMilli,
    claimedKgMilli,
    shortfallKgMilli: Math.max(po.expectedKgMilli - claimedKgMilli, 0),
  };
}

/* 2. Inventory eligibility ------------------------------------------------- */

export type LotEligibility = { eligible: true } | { eligible: false; reason: string };

export function lotEligibility(lot: InventoryLot, neededByLocal: LocalTime): LotEligibility {
  if (!lot.accepted) return { eligible: false, reason: "Quality not accepted" };
  if (lot.quarantined) return { eligible: false, reason: "Quarantined" };
  if (lot.expiresAtLocal && !isAtOrBefore(neededByLocal, lot.expiresAtLocal)) {
    return { eligible: false, reason: `Expires ${lot.expiresAtLocal}, before use at ${neededByLocal}` };
  }
  if (!isAtOrBefore(lot.availableAtLocal, neededByLocal)) {
    return { eligible: false, reason: `Available ${lot.availableAtLocal}, after ${neededByLocal}` };
  }
  return { eligible: true };
}

/* 12. Time-dependent supply eligibility ------------------------------------ */

/** Incoming supply only counts if it arrives by the cut-off. No ETA = not eligible. */
export function isSupplyTimeEligible(etaLocal: LocalTime | null, cutoffLocal: LocalTime): boolean {
  return etaLocal !== null && isAtOrBefore(etaLocal, cutoffLocal);
}

/* 4. Recipe / BOM expansion ------------------------------------------------ */

export type RecipeLookup =
  | { ok: true; recipe: RecipeVersion }
  | { ok: false; issue: DataQualityIssue };

/** The approved recipe whose version matches the menu item's current version. */
export function findApprovedRecipe(snapshot: OperationalSnapshot, menu: MenuItem): RecipeLookup {
  const recipe = snapshot.recipes.find((r) => r.menuId === menu.id && r.version === menu.recipeVersion);
  if (!recipe) {
    const other = snapshot.recipes.some((r) => r.menuId === menu.id);
    return {
      ok: false,
      issue: other
        ? issue("RECIPE_VERSION_MISMATCH", "UNVERIFIED", menu.id, `No recipe ${menu.recipeVersion} for ${menu.name}`)
        : issue("MISSING_RECIPE", "MISSING", menu.id, `No BOM for ${menu.name}`),
    };
  }
  if (!recipe.approvedInDemo || !menu.approvedInDemo) {
    return { ok: false, issue: issue("RECIPE_NOT_APPROVED", "UNVERIFIED", menu.id, `${menu.name} recipe ${recipe.version} not approved`) };
  }
  return { ok: true, recipe };
}

export interface IngredientLine {
  ingredientId: string;
  unit: BaseUnit;
  quantityMilli: number;
}

/** Ingredient quantities for `portions` of a recipe (exact integer). */
export function expandBom(recipe: RecipeVersion, portions: number): IngredientLine[] {
  return recipe.components.map((c) => ({
    ingredientId: c.ingredientId,
    unit: c.unit,
    quantityMilli: multiplyByPortions(c.quantityMilli, portions),
  }));
}

/* 5/6/7. Demand requirements ----------------------------------------------- */

export interface DemandLine {
  menuId: string;
  portions: number;
}

export interface MenuRequirement {
  menuId: string;
  portions: number;
  ingredientQuantityMilli: number;
}

export interface RequirementResult {
  /** Total per ingredient over menus with a known approved BOM. */
  totals: Record<string, { unit: BaseUnit; quantityMilli: number }>;
  /** Menus whose ingredient usage is unknown (missing / unapproved BOM). */
  unknownMenuIds: string[];
  issues: DataQualityIssue[];
}

export function ingredientRequirements(snapshot: OperationalSnapshot, demand: DemandLine[]): RequirementResult {
  const totals: RequirementResult["totals"] = {};
  const unknownMenuIds: string[] = [];
  const issues: DataQualityIssue[] = [];
  for (const line of demand) {
    const menu = snapshot.menuItems.find((m) => m.id === line.menuId);
    if (!menu) {
      unknownMenuIds.push(line.menuId);
      issues.push(issue("MISSING_RECIPE", "MISSING", line.menuId, `Demand references unknown menu ${line.menuId}`));
      continue;
    }
    const lookup = findApprovedRecipe(snapshot, menu);
    if (!lookup.ok) {
      unknownMenuIds.push(menu.id);
      issues.push(lookup.issue);
      continue;
    }
    for (const ing of expandBom(lookup.recipe, line.portions)) {
      const current = totals[ing.ingredientId];
      if (current && current.unit !== ing.unit) {
        issues.push(issue("UNIT_MISMATCH", "UNVERIFIED", ing.ingredientId, `${ing.ingredientId} used in ${current.unit} and ${ing.unit}`));
        continue;
      }
      totals[ing.ingredientId] = { unit: ing.unit, quantityMilli: (current?.quantityMilli ?? 0) + ing.quantityMilli };
    }
  }
  return { totals, unknownMenuIds, issues };
}

export function forecastDemandLines(snapshot: OperationalSnapshot): DemandLine[] {
  return snapshot.forecasts.map((f) => ({ menuId: f.menuId, portions: f.portions }));
}

/** Open confirmed commitments (CONFIRMED or AT_RISK). Already part of forecast — never added to it. */
export function openConfirmedOrders(snapshot: OperationalSnapshot): ConfirmedOrder[] {
  return snapshot.confirmedOrders.filter((o) => o.status === "CONFIRMED" || o.status === "AT_RISK");
}

export function confirmedDemandLines(snapshot: OperationalSnapshot): DemandLine[] {
  const byMenu = new Map<string, number>();
  for (const order of openConfirmedOrders(snapshot)) {
    byMenu.set(order.menuId, (byMenu.get(order.menuId) ?? 0) + order.portions);
  }
  return [...byMenu].map(([menuId, portions]) => ({ menuId, portions }));
}

export function forecastIngredientRequirements(snapshot: OperationalSnapshot): RequirementResult {
  return ingredientRequirements(snapshot, forecastDemandLines(snapshot));
}

export function confirmedIngredientRequirements(snapshot: OperationalSnapshot): RequirementResult {
  return ingredientRequirements(snapshot, confirmedDemandLines(snapshot));
}

/** Per-menu demand for one shared ingredient (menus not using it are omitted). */
export function sharedIngredientDemand(
  snapshot: OperationalSnapshot,
  ingredientId: string,
  demand: DemandLine[],
): MenuRequirement[] {
  const rows: MenuRequirement[] = [];
  for (const line of demand) {
    const menu = snapshot.menuItems.find((m) => m.id === line.menuId);
    if (!menu) continue;
    const lookup = findApprovedRecipe(snapshot, menu);
    if (!lookup.ok) continue;
    const component = lookup.recipe.components.find((c) => c.ingredientId === ingredientId);
    if (!component) continue;
    rows.push({ menuId: menu.id, portions: line.portions, ingredientQuantityMilli: multiplyByPortions(component.quantityMilli, line.portions) });
  }
  return rows;
}

/* 8. Inventory position after reservations --------------------------------- */

export interface PositionOptions {
  neededByLocal: LocalTime;
  /** true = apply supplier claims in place of their POs (after-claim view). */
  applySupplierClaims: boolean;
}

/**
 * Stock buckets for one ingredient. Each lot is counted once; incoming goods are
 * never physical stock; reservations reduce availability but never below zero per lot.
 */
export function ingredientPosition(snapshot: OperationalSnapshot, ingredientId: string, options: PositionOptions): IngredientPosition {
  const unit = snapshot.ingredientLots.find((l) => l.ingredientId === ingredientId)?.unit ?? "kg";
  let physical = 0;
  let eligible = 0;
  let reserved = 0;
  const seen = new Set<string>();
  for (const lot of snapshot.ingredientLots) {
    if (lot.ingredientId !== ingredientId || seen.has(lot.id)) continue;
    seen.add(lot.id);
    physical += lot.onHandMilli;
    if (!lotEligibility(lot, options.neededByLocal).eligible) continue;
    eligible += lot.onHandMilli;
    const lotReserved = snapshot.reservations
      .filter((r) => r.lotId === lot.id)
      .reduce((sum, r) => sum + r.quantityMilli, 0);
    reserved += Math.min(lotReserved, lot.onHandMilli);
  }

  const claimsByPo = new Map<string, SupplierClaim>(
    options.applySupplierClaims ? snapshot.supplierClaims.map((c) => [c.poId, c]) : [],
  );
  let planned = 0;
  let claimed = 0;
  for (const po of snapshot.purchaseOrders) {
    if (po.ingredientId !== ingredientId || po.state === "RECEIVED") continue;
    const claim = claimsByPo.get(po.id);
    if (claim) {
      if (isSupplyTimeEligible(claim.etaLocal, options.neededByLocal)) claimed += claim.claimedDeliveryTodayKgMilli;
    } else if (
      // Before-claim view: the PO counts as planned even if its state now records the claim.
      (po.state === "OPEN" || !options.applySupplierClaims) &&
      po.expectedKgMilli !== null &&
      isAtOrBefore(po.dueTimeLocal, options.neededByLocal)
    ) {
      planned += po.expectedKgMilli;
    }
  }

  return {
    ingredientId,
    unit,
    physicalOnHandMilli: physical,
    eligibleOnHandMilli: eligible,
    ineligibleOnHandMilli: physical - eligible,
    reservedMilli: reserved,
    availableAfterReservationsMilli: eligible - reserved,
    plannedIncomingMilli: planned,
    supplierClaimedIncomingMilli: claimed,
  };
}

/* 9. Forecast ingredient gap ----------------------------------------------- */

export function ingredientGap(requirementMilli: number, availableMilli: number): number {
  return Math.max(requirementMilli - availableMilli, 0);
}

/* 10/11. Affected menus and confirmed orders ------------------------------- */

export interface AffectedMenus {
  affectedMenuIds: string[];
  unaffectedMenuIds: string[];
  unknownMenuIds: string[];
}

/** Menus whose approved BOM uses the ingredient. Missing BOM = unknown, never "unaffected". */
export function affectedMenus(snapshot: OperationalSnapshot, ingredientId: string): AffectedMenus {
  const result: AffectedMenus = { affectedMenuIds: [], unaffectedMenuIds: [], unknownMenuIds: [] };
  for (const menu of snapshot.menuItems) {
    const lookup = findApprovedRecipe(snapshot, menu);
    if (!lookup.ok) result.unknownMenuIds.push(menu.id);
    else if (lookup.recipe.components.some((c) => c.ingredientId === ingredientId)) result.affectedMenuIds.push(menu.id);
    else result.unaffectedMenuIds.push(menu.id);
  }
  return result;
}

export function affectedConfirmedOrders(snapshot: OperationalSnapshot, affectedMenuIds: string[]): ConfirmedOrder[] {
  const set = new Set(affectedMenuIds);
  return openConfirmedOrders(snapshot).filter((o) => set.has(o.menuId));
}

/* 13. Data-quality warnings ------------------------------------------------ */

export function dataQualityWarnings(snapshot: OperationalSnapshot): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const demandMenuIds = new Set([
    ...snapshot.forecasts.map((f) => f.menuId),
    ...openConfirmedOrders(snapshot).map((o) => o.menuId),
  ]);
  for (const menu of snapshot.menuItems) {
    if (!demandMenuIds.has(menu.id)) continue;
    const lookup = findApprovedRecipe(snapshot, menu);
    if (!lookup.ok) issues.push(lookup.issue);
  }
  for (const order of openConfirmedOrders(snapshot)) {
    if (!order.dueTimeLocal) issues.push(issue("MISSING_DEADLINE", "MISSING", order.id, `Order ${order.id} has no deadline`));
    const menu = snapshot.menuItems.find((m) => m.id === order.menuId);
    if (menu && order.agreedRecipeVersion !== menu.recipeVersion) {
      issues.push(issue("RECIPE_VERSION_MISMATCH", "UNVERIFIED", order.id, `Order ${order.id} agreed ${order.agreedRecipeVersion}, menu is ${menu.recipeVersion}`));
    }
  }
  for (const po of snapshot.purchaseOrders) {
    if (po.expectedKgMilli === null) issues.push(issue("MISSING_PO_QUANTITY", "MISSING", po.id, `PO ${po.id} has no expected quantity`));
  }
  if (snapshot.resources.length === 0) {
    issues.push(issue("MISSING_CAPACITY", "MISSING", snapshot.id, "No kitchen production resources in snapshot"));
  }
  return issues;
}

/* 14. Snapshot freshness --------------------------------------------------- */

export interface FreshnessResult {
  status: Extract<DataQualityStatus, "CURRENT" | "STALE">;
  reasons: string[];
}

/**
 * CURRENT only if (a) the stored fingerprint still matches the snapshot content,
 * (b) it equals the fingerprint a caller computed against, and (c) the optional
 * age limit holds.
 */
export function verifySnapshotFreshness(
  snapshot: OperationalSnapshot,
  expectedFingerprint?: string,
  age?: { nowIso: string; maxAgeMinutes: number },
): FreshnessResult {
  const reasons: string[] = [];
  const actual = snapshotFingerprint(snapshot);
  if (actual !== snapshot.fingerprint) reasons.push("Snapshot content changed without a new revision");
  if (expectedFingerprint !== undefined && expectedFingerprint !== snapshot.fingerprint) {
    reasons.push(`Calculated against ${expectedFingerprint}; current is ${snapshot.fingerprint} (revision ${snapshot.revision})`);
  }
  if (age) {
    const ageMinutes = (Date.parse(age.nowIso) - Date.parse(snapshot.capturedAtIso)) / 60000;
    if (!(ageMinutes <= age.maxAgeMinutes)) reasons.push(`Snapshot is older than ${age.maxAgeMinutes} minutes`);
  }
  return { status: reasons.length ? "STALE" : "CURRENT", reasons };
}

/* helpers ------------------------------------------------------------------ */

function issue(code: DataQualityIssue["code"], status: DataQualityStatus, subjectId: string, message: string): DataQualityIssue {
  return { code, status, subjectId, message };
}
