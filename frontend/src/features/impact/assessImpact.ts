/**
 * 15. ImpactSummary generation (SIMULATED_CALCULATION).
 *
 * Produces an authoritative summary only for a VERIFIED incident on a current,
 * complete snapshot. Otherwise returns PENDING_VERIFICATION / STALE_SNAPSHOT /
 * UNKNOWN with reasons and `summary: null` — never a guessed number.
 */
import type { LocalTime } from "../../types/common";
import type { ImpactAssessment, Incident, OperationalSnapshot } from "../../types/restaurant";
import { formatMilli } from "../../utils/quantity";
import {
  affectedConfirmedOrders,
  affectedMenus,
  confirmedDemandLines,
  confirmedIngredientRequirements,
  dataQualityWarnings,
  forecastDemandLines,
  forecastIngredientRequirements,
  ingredientGap,
  ingredientPosition,
  poDeliveryDifference,
  sharedIngredientDemand,
  verifySnapshotFreshness,
} from "./calculations";

export interface AssessOptions {
  /** Fingerprint the caller believes is current; mismatch → STALE_SNAPSHOT. */
  expectedFingerprint?: string;
  /** Time by which ingredient supply must be usable (incremental prep cut-off). */
  neededByLocal: LocalTime;
}

const BLOCKING_CODES = new Set(["MISSING_RECIPE", "RECIPE_NOT_APPROVED", "RECIPE_VERSION_MISMATCH", "UNIT_MISMATCH", "MISSING_PO_QUANTITY"]);
const VERIFIED_STATUSES = new Set<Incident["status"]>([
  "VERIFIED", "IMPACT_ASSESSED", "SCENARIOS_READY", "PENDING_APPROVAL", "APPROVED", "EXECUTING", "AWAITING_EVIDENCE", "CLOSED",
]);

export function assessImpact(snapshot: OperationalSnapshot, incident: Incident, options: AssessOptions): ImpactAssessment {
  const base: ImpactAssessment = {
    status: "UNKNOWN",
    incidentId: incident.id,
    snapshotId: snapshot.id,
    snapshotRevision: snapshot.revision,
    snapshotFingerprint: snapshot.fingerprint,
    summary: null,
    poShortfallKgMilli: null,
    confirmedRequirementKgMilli: null,
    discretionaryAfterConfirmedKgMilli: null,
    confirmedDeficitKgMilli: null,
    before: null,
    after: null,
    affectedConfirmedOrderIds: [],
    unaffectedMenuIds: [],
    feasibilityOfConfirmed: "UNKNOWN",
    dataQuality: [],
    reasons: [],
    source: "SIMULATED_CALCULATION",
  };

  if (!VERIFIED_STATUSES.has(incident.status)) {
    return { ...base, status: "PENDING_VERIFICATION", reasons: [`Incident ${incident.id} is ${incident.status}; supplier claim not yet verified`] };
  }

  const freshness = verifySnapshotFreshness(snapshot, options.expectedFingerprint);
  if (freshness.status === "STALE") return { ...base, status: "STALE_SNAPSHOT", reasons: freshness.reasons };

  const dataQuality = dataQualityWarnings(snapshot);
  const ingredientId = incident.ingredientId;
  const po = snapshot.purchaseOrders.find((p) => p.id === incident.poId);
  const claim = snapshot.supplierClaims.find((c) => c.poId === incident.poId);
  const poDiff = poDeliveryDifference(po, claim ? claim.claimedDeliveryTodayKgMilli : null);

  const forecastReq = forecastIngredientRequirements(snapshot);
  const confirmedReq = confirmedIngredientRequirements(snapshot);
  const menus = affectedMenus(snapshot, ingredientId);

  const blocking = [...dataQuality, ...forecastReq.issues, ...confirmedReq.issues].filter((i) => BLOCKING_CODES.has(i.code));
  const reasons: string[] = [];
  if (poDiff.status === "UNRESOLVED") reasons.push(poDiff.reason);
  for (const b of blocking) reasons.push(b.message);
  if (menus.unknownMenuIds.length) reasons.push(`Ingredient use unknown for: ${menus.unknownMenuIds.join(", ")}`);
  if (reasons.length) return { ...base, status: "UNKNOWN", dataQuality, reasons: dedupe(reasons) };

  const before = ingredientPosition(snapshot, ingredientId, { neededByLocal: options.neededByLocal, applySupplierClaims: false });
  const after = ingredientPosition(snapshot, ingredientId, { neededByLocal: options.neededByLocal, applySupplierClaims: true });
  // Supplier-claimed incoming is reported separately and never counted as available stock.
  const available = after.availableAfterReservationsMilli;

  const forecastKg = forecastReq.totals[ingredientId]?.quantityMilli ?? 0;
  const confirmedKg = confirmedReq.totals[ingredientId]?.quantityMilli ?? 0;
  const forecastGap = ingredientGap(forecastKg, available);
  const confirmedDeficit = ingredientGap(confirmedKg, available);
  const discretionary = Math.max(available - confirmedKg, 0);

  const forecastRows = sharedIngredientDemand(snapshot, ingredientId, forecastDemandLines(snapshot));
  const confirmedRows = sharedIngredientDemand(snapshot, ingredientId, confirmedDemandLines(snapshot));
  const forecastPortions = forecastRows.reduce((s, r) => s + r.portions, 0);
  const confirmedPortions = confirmedRows.reduce((s, r) => s + r.portions, 0);
  const affectedOrders = affectedConfirmedOrders(snapshot, menus.affectedMenuIds);
  const capacityKnown = snapshot.resources.length > 0;

  const shortfall = poDiff.status === "RESOLVED" ? poDiff.shortfallKgMilli : 0;
  const summaryReasons = [
    `Supplier-reported PO shortfall ${formatMilli(shortfall)} kg on ${incident.poId} (supplier claim, not a receipt)`,
    `Forecast requirement ${formatMilli(forecastKg)} kg vs ${formatMilli(available)} kg eligible → forecast ingredient gap ${formatMilli(forecastGap)} kg`,
    `Confirmed requirement ${formatMilli(confirmedKg)} kg (${confirmedPortions} portions, included within forecast)`,
    confirmedDeficit > 0
      ? `BREACH_RISK: ${formatMilli(confirmedDeficit)} kg short for confirmed orders — orders are not dropped automatically`
      : `Discretionary after protecting confirmed: ${formatMilli(discretionary)} kg`,
    `Physical stock unchanged by supplier message (${formatMilli(after.physicalOnHandMilli)} kg on hand)`,
  ];
  if (!capacityKnown) summaryReasons.push("Kitchen capacity unknown — production timing not assessed");

  return {
    ...base,
    status: confirmedDeficit > 0 ? "BREACH_RISK" : "ASSESSED",
    summary: {
      incidentId: incident.id,
      snapshotFingerprint: snapshot.fingerprint,
      affectedMenuIds: menus.affectedMenuIds,
      confirmedChickenPortions: confirmedPortions,
      chickenForecastPortions: forecastPortions,
      chickenForecastRequirementKgMilli: forecastKg,
      chickenAvailableKgMilli: available,
      demandGapKgMilli: forecastGap,
      reasons: summaryReasons,
    },
    poShortfallKgMilli: shortfall,
    confirmedRequirementKgMilli: confirmedKg,
    discretionaryAfterConfirmedKgMilli: discretionary,
    confirmedDeficitKgMilli: confirmedDeficit,
    before,
    after,
    affectedConfirmedOrderIds: affectedOrders.map((o) => o.id),
    unaffectedMenuIds: menus.unaffectedMenuIds,
    // Ingredient-sufficient confirmed demand is only CONDITIONAL: P2 does not schedule production.
    feasibilityOfConfirmed: confirmedDeficit > 0 ? "INFEASIBLE" : capacityKnown ? "CONDITIONAL" : "UNKNOWN",
    dataQuality,
    reasons: summaryReasons,
  };
}

/** An impact is current only for the exact snapshot fingerprint it was computed on. */
export function isImpactCurrent(impact: ImpactAssessment, snapshot: OperationalSnapshot): boolean {
  return impact.snapshotFingerprint === snapshot.fingerprint && impact.snapshotRevision === snapshot.revision;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
