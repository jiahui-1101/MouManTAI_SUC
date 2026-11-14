import { instantMatchesBusinessClock, isCalendarDate, isValidTimeZone, parseLocalMinutes } from "./timeUtils";
import type { DomainFailureCode, DomainResult, RecoverySourcingNeed, RecoverySourcingNeedInput } from "./types";

const VERIFIED_INCIDENT_STATES = new Set(["VERIFIED", "IMPACT_ASSESSED", "SCENARIOS_READY"]);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function failure<T>(code: DomainFailureCode, message: string): DomainResult<T> {
  return { ok: false, error: { code, message } };
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function safeSum(left: number, right: number): number | null {
  const sum = BigInt(left) + BigInt(right);
  return sum > MAX_SAFE ? null : Number(sum);
}

function safeProduct(left: number, right: number): number | null {
  const product = BigInt(left) * BigInt(right);
  return product > MAX_SAFE ? null : Number(product);
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

export function deriveRecoverySourcingNeed(input: RecoverySourcingNeedInput): DomainResult<RecoverySourcingNeed> {
  if (!input || !input.incident || !input.snapshot || !input.impact || !input.ingredientPolicy || !input.businessClock) {
    return failure("INVALID_INPUT", "Incident, snapshot, impact, ingredient policy, and business clock are required.");
  }

  const { incident, snapshot, impact, ingredientPolicy, businessClock } = input;
  if (typeof input.outletId !== "string" || input.outletId.trim().length === 0 || typeof snapshot.id !== "string" || snapshot.id.trim().length === 0 || typeof incident.id !== "string" || incident.id.trim().length === 0) {
    return failure("INVALID_INPUT", "Outlet, incident, and snapshot IDs must be present.");
  }
  if (!VERIFIED_INCIDENT_STATES.has(incident.status)) {
    return failure("INCIDENT_NOT_VERIFIED", "P3 requires a P1-verified incident before deriving a sourcing need.");
  }
  if (incident.type !== "UNAVAILABLE" && incident.type !== "PARTIAL_DELIVERY" && incident.type !== "DELAY" && incident.type !== "CANCELLED" && incident.type !== "QUALITY_REJECTED") {
    return failure("UNSUPPORTED_INCIDENT", "This P3 sourcing calculation does not support the supplied incident type.");
  }
  if (incident.ingredientId !== "HP-ING-CHICKEN" || ingredientPolicy.ingredientId !== incident.ingredientId || ingredientPolicy.recipeQuantityField !== "chickenKgMilli") {
    return failure("UNSUPPORTED_INGREDIENT", "The shared impact shape currently exposes chicken-specific demand; this incident needs a compatible shared impact contract.");
  }
  if (snapshot.dataMode !== "SYNTHETIC_BUSINESS") {
    return failure("INVALID_INPUT", "Plan A demo sourcing accepts only the synthetic business snapshot.");
  }
  if (typeof ingredientPolicy.requiredSpecification !== "string" || ingredientPolicy.requiredSpecification.trim().length === 0) {
    return failure("INVALID_INPUT", "A required product specification must be supplied from the synthetic approved product master.");
  }
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1 || !Number.isSafeInteger(incident.revision) || incident.revision < 1) {
    return failure("INVALID_INPUT", "Snapshot and incident revisions must be positive integers.");
  }
  if (typeof snapshot.fingerprint !== "string" || snapshot.fingerprint.trim().length === 0 ||
      typeof incident.snapshotFingerprint !== "string" || incident.snapshotFingerprint.trim().length === 0 ||
      typeof impact.snapshotFingerprint !== "string" || impact.snapshotFingerprint.trim().length === 0) {
    return failure("SNAPSHOT_FINGERPRINT_MISSING", "A supplied snapshot fingerprint is required; P3 will not create one.");
  }
  if (snapshot.fingerprint !== incident.snapshotFingerprint || snapshot.fingerprint !== impact.snapshotFingerprint) {
    return failure("SNAPSHOT_MISMATCH", "Incident, impact, and snapshot must refer to the same supplied fingerprint.");
  }
  if (impact.incidentId !== incident.id) {
    return failure("IMPACT_MISMATCH", "ImpactSummary belongs to a different incident.");
  }
  if (
    !isCalendarDate(snapshot.demoBusinessDate) ||
    businessClock.businessDate !== snapshot.demoBusinessDate ||
    !isCalendarDate(businessClock.businessDate) ||
    !isValidTimeZone(businessClock.timeZone) ||
    parseLocalMinutes(businessClock.nowLocal) === null ||
    parseLocalMinutes(businessClock.requiredReceiptCutoffLocal) === null ||
    !isSafeNonNegativeInteger(businessClock.receivingBufferMinutes)
  ) {
    return failure("INVALID_INPUT", "Business date, timezone, local clock, cutoff, or receiving buffer is missing or invalid.");
  }
  if (businessClock.nowIso && !instantMatchesBusinessClock(businessClock.nowIso, businessClock.businessDate, businessClock.nowLocal, businessClock.timeZone)) {
    return failure("INVALID_INPUT", "The supplied offset-aware instant does not match the explicit demo business clock.");
  }

  if (!Array.isArray(snapshot.purchaseOrders) || !Array.isArray(snapshot.ingredientLots) || !Array.isArray(snapshot.menuItems) || !Array.isArray(snapshot.forecasts) || !Array.isArray(snapshot.confirmedOrders)) {
    return failure("INVALID_INPUT", "Snapshot sourcing, inventory, recipe, forecast, and order collections are required.");
  }
  if (!Array.isArray(incident.messageIds) || !Array.isArray(impact.affectedMenuIds)) {
    return failure("INVALID_INPUT", "Incident evidence and impact menu references must be arrays.");
  }

  const matchingOrders = snapshot.purchaseOrders.filter((order) => order.id === incident.poId);
  if (matchingOrders.length !== 1) return failure("MISSING_PURCHASE_ORDER", "Exactly one source purchase order must match the incident.");
  const purchaseOrder = matchingOrders[0];
  if (!purchaseOrder) return failure("MISSING_PURCHASE_ORDER", "No source purchase order matches the incident.");
  if (purchaseOrder.ingredientId !== incident.ingredientId || typeof purchaseOrder.supplierId !== "string" || purchaseOrder.supplierId.length === 0) {
    return failure("PURCHASE_ORDER_MISMATCH", "Purchase order ingredient or original supplier does not match the incident context.");
  }
  if (purchaseOrder.state === "RECEIVED") {
    return failure("PURCHASE_ORDER_ALREADY_RECEIVED", "The source PO is marked received while the incident reports an unavailable delivery.");
  }
  if (!isSafeNonNegativeInteger(purchaseOrder.expectedKgMilli) || !isSafeNonNegativeInteger(incident.claimedShortfallKgMilli) || incident.claimedShortfallKgMilli > purchaseOrder.expectedKgMilli) {
    return failure("INVALID_INPUT", "PO expected quantity and claimed shortfall must be valid non-negative KgMilli values.");
  }
  if (incident.type === "UNAVAILABLE" && incident.claimedShortfallKgMilli !== purchaseOrder.expectedKgMilli) {
    return failure("PURCHASE_ORDER_MISMATCH", "An unavailable-today incident must report the full expected PO quantity as shortfall.");
  }

  let acceptedOnHandKgMilli = 0;
  const acceptedLotIds: string[] = [];
  for (const lot of snapshot.ingredientLots) {
    if (lot.ingredientId !== incident.ingredientId) continue;
    if (typeof lot.id !== "string" || lot.id.length === 0 || typeof lot.accepted !== "boolean" || !isSafeNonNegativeInteger(lot.onHandMilli) || lot.unit !== "kg") {
      return failure("INVALID_INPUT", "Matching inventory lots must contain valid kilogram quantities.");
    }
    if (!lot.accepted) continue;
    const availableMinutes = parseLocalMinutes(lot.availableAtLocal);
    if (availableMinutes === null) return failure("INVALID_INPUT", "Accepted inventory lot availability must use an explicit local HH:mm time.");
    if (availableMinutes > (parseLocalMinutes(businessClock.nowLocal) ?? 0)) continue;
    const nextTotal = safeSum(acceptedOnHandKgMilli, lot.onHandMilli);
    if (nextTotal === null) return failure("INVALID_INPUT", "Accepted physical inventory exceeds the safe integer range.");
    acceptedOnHandKgMilli = nextTotal;
    acceptedLotIds.push(lot.id);
  }

  const menuById = new Map<string, (typeof snapshot.menuItems)[number]>();
  for (const menu of snapshot.menuItems) {
    if (!menu.id || menuById.has(menu.id)) return failure("MISSING_MENU_DATA", "Menu IDs must be present and unique in the snapshot.");
    if (!isSafeNonNegativeInteger(menu.chickenKgMilli) || !isSafeNonNegativeInteger(menu.potatoFriesKgMilli)) {
      return failure("MISSING_MENU_DATA", "Menu BOM quantities must be non-negative KgMilli integers.");
    }
    menuById.set(menu.id, menu);
  }

  let forecastRequirementKgMilli = 0;
  let forecastChickenPortions = 0;
  const affectedMenuIds = new Set<string>();
  for (const forecast of snapshot.forecasts) {
    const menu = menuById.get(forecast.menuId);
    if (!menu) return failure("MISSING_MENU_DATA", `Forecast menu ${forecast.menuId} has no recipe in this snapshot.`);
    if (!isSafeNonNegativeInteger(forecast.portions)) return failure("INVALID_INPUT", "Forecast portions must be non-negative safe integers.");
    if (forecast.portions > 0 && menu.chickenKgMilli > 0) {
      if (menu.approvedInDemo !== true) return failure("UNAPPROVED_RECIPE", `Menu ${menu.id} is not approved in the synthetic demo master.`);
      const requirement = safeProduct(forecast.portions, menu.chickenKgMilli);
      const nextRequirement = requirement === null ? null : safeSum(forecastRequirementKgMilli, requirement);
      const nextPortions = safeSum(forecastChickenPortions, forecast.portions);
      if (nextRequirement === null || nextPortions === null) return failure("INVALID_INPUT", "Forecast requirement exceeds the safe integer range.");
      forecastRequirementKgMilli = nextRequirement;
      forecastChickenPortions = nextPortions;
      affectedMenuIds.add(menu.id);
    }
  }

  let confirmedRequirementKgMilli = 0;
  let confirmedChickenPortions = 0;
  for (const order of snapshot.confirmedOrders) {
    if (order.status === "FULFILLED") continue;
    const menu = menuById.get(order.menuId);
    if (!menu) return failure("MISSING_MENU_DATA", `Confirmed order menu ${order.menuId} has no recipe in this snapshot.`);
    if (!isSafeNonNegativeInteger(order.portions)) return failure("INVALID_INPUT", "Confirmed portions must be non-negative safe integers.");
    if (menu.chickenKgMilli === 0 || order.portions === 0) continue;
    if (menu.approvedInDemo !== true || order.agreedRecipeVersion !== menu.recipeVersion) {
      return failure("UNAPPROVED_RECIPE", `Confirmed order ${order.id} references a missing or changed approved recipe.`);
    }
    const requirement = safeProduct(order.portions, menu.chickenKgMilli);
    const nextRequirement = requirement === null ? null : safeSum(confirmedRequirementKgMilli, requirement);
    const nextPortions = safeSum(confirmedChickenPortions, order.portions);
    if (nextRequirement === null || nextPortions === null) return failure("INVALID_INPUT", "Confirmed requirement exceeds the safe integer range.");
    confirmedRequirementKgMilli = nextRequirement;
    confirmedChickenPortions = nextPortions;
    affectedMenuIds.add(menu.id);
  }

  const forecastGapKgMilli = Math.max(forecastRequirementKgMilli - acceptedOnHandKgMilli, 0);
  const expectedAffectedMenuIds = [...affectedMenuIds].sort();
  if (
    !isSafeNonNegativeInteger(impact.chickenForecastRequirementKgMilli) ||
    !isSafeNonNegativeInteger(impact.chickenAvailableKgMilli) ||
    !isSafeNonNegativeInteger(impact.demandGapKgMilli) ||
    !isSafeNonNegativeInteger(impact.chickenForecastPortions) ||
    !isSafeNonNegativeInteger(impact.confirmedChickenPortions) ||
    impact.chickenForecastRequirementKgMilli !== forecastRequirementKgMilli ||
    impact.chickenAvailableKgMilli !== acceptedOnHandKgMilli ||
    impact.demandGapKgMilli !== forecastGapKgMilli ||
    impact.chickenForecastPortions !== forecastChickenPortions ||
    impact.confirmedChickenPortions !== confirmedChickenPortions ||
    !sameStringSet(impact.affectedMenuIds, expectedAffectedMenuIds)
  ) {
    return failure("IMPACT_MISMATCH", "P2 impact does not match the supplied accepted stock, BOM, forecast, confirmed orders, or affected menus.");
  }

  const evidenceRefs = [...new Set([
    incident.id,
    ...incident.messageIds.filter(Boolean),
    snapshot.id,
    purchaseOrder.id,
    ...acceptedLotIds,
  ])];

  return {
    ok: true,
    value: {
      readinessStatus: "READY",
      outletId: input.outletId,
      incidentId: incident.id,
      poId: purchaseOrder.id,
      originalSupplierId: purchaseOrder.supplierId,
      ingredientId: incident.ingredientId,
      originalExpectedKgMilli: purchaseOrder.expectedKgMilli,
      claimedIncomingKgMilli: purchaseOrder.expectedKgMilli - incident.claimedShortfallKgMilli,
      poShortfallKgMilli: incident.claimedShortfallKgMilli,
      acceptedOnHandKgMilli,
      forecastRequirementKgMilli,
      forecastGapKgMilli,
      confirmedRequirementKgMilli,
      confirmedChickenPortions,
      forecastChickenPortions,
      affectedMenuIds: expectedAffectedMenuIds,
      requiredSpecification: ingredientPolicy.requiredSpecification,
      requiredReceiptCutoffLocal: businessClock.requiredReceiptCutoffLocal,
      receivingBufferMinutes: businessClock.receivingBufferMinutes,
      businessDate: businessClock.businessDate,
      timeZone: businessClock.timeZone,
      snapshotRevision: snapshot.revision,
      snapshotFingerprint: snapshot.fingerprint,
      evidenceRefs,
    },
  };
}
