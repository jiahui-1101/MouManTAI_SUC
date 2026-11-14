/**
 * P2 → P3 / P4 / P5 handoff payloads (proposed contracts, pending team review).
 *
 * Every payload is bound to one snapshot fingerprint. A consumer must treat its
 * own scenario as STALE when `snapshot.fingerprint` changes. Builders return
 * `{ ready: false, reason }` instead of partial numbers when the impact is not
 * authoritative for the current snapshot.
 */
import type { DataQualityIssue, ImpactSummary, IncidentStatus, RecipeVersion } from "../../types/restaurant";
import type { LocalTime } from "../../types/common";
import type { RestaurantState } from "../../services/mock/restaurantState";
import { selectCurrentImpact } from "../../services/mock/restaurantState";
import { HP_BUSINESS, HP_INGREDIENTS } from "../../data/fixtures/happyPotato";
import { affectedConfirmedOrders, ingredientPosition, openConfirmedOrders, sharedIngredientDemand, forecastDemandLines } from "./calculations";

export interface SnapshotRef {
  id: string;
  revision: number;
  fingerprint: string;
}

interface Base {
  incidentId: string;
  incidentStatus: IncidentStatus;
  snapshot: SnapshotRef;
  dataQuality: DataQualityIssue[];
  source: "SIMULATED_CALCULATION";
  dataMode: "SYNTHETIC_BUSINESS";
}

export interface MenuDependency {
  menuId: string;
  recipeVersion: string;
  ingredientPerPortionMilli: number;
  forecastPortions: number;
  confirmedPortions: number;
}

/** For P3 (Plan A — external supply). */
export interface P3ImpactHandoff extends Base {
  ingredientId: string;
  requiredSpec: "CHILLED" | "FROZEN" | null;
  poShortfallKgMilli: number;
  forecastRequirementKgMilli: number;
  forecastGapKgMilli: number;
  confirmedRequirementKgMilli: number;
  physicalEligibleKgMilli: number;
  requiredByLocal: LocalTime;
  menuDependencies: MenuDependency[];
}

/** For P4 (Plan B — internal recovery). P4 must not keep its own inventory copy. */
export interface P4ImpactHandoff extends Base {
  ingredientId: string;
  eligibleStock: Array<{ lotId: string; onHandMilli: number; availableAtLocal: LocalTime }>;
  confirmedReservations: Array<{ orderId: string; menuId: string; portions: number; dueTimeLocal: LocalTime; ingredientMilli: number }>;
  sharedIngredientDemand: MenuDependency[];
  recipes: RecipeVersion[];
  resources: Array<{ id: string; name: string; capability: string }>;
  confirmedDeadlineLocal: LocalTime;
  forecastWindowEndLocal: LocalTime;
}

/** For P5 (compare / approve / verify). */
export interface P5ImpactHandoff extends Base {
  summary: ImpactSummary;
  impactStatus: "ASSESSED" | "BREACH_RISK";
  confirmedFulfilment: "CONDITIONAL" | "UNKNOWN" | "INFEASIBLE";
  evidenceRefs: string[];
  warnings: string[];
}

export type Handoff<T> = { ready: true; payload: T } | { ready: false; reason: string };

function common(state: RestaurantState, incidentId: string): Handoff<{ base: Base; impact: NonNullable<ReturnType<typeof selectCurrentImpact>> }> {
  const incident = state.incidents.find((i) => i.id === incidentId);
  if (!incident) return { ready: false, reason: `Incident ${incidentId} not found` };
  const impact = selectCurrentImpact(state, incidentId);
  if (!impact) return { ready: false, reason: "No impact assessed on the current snapshot (missing or stale)" };
  if (!impact.summary || (impact.status !== "ASSESSED" && impact.status !== "BREACH_RISK")) {
    return { ready: false, reason: `Impact is ${impact.status}: ${impact.reasons.join("; ")}` };
  }
  const s = state.snapshot;
  return {
    ready: true,
    payload: {
      impact,
      base: {
        incidentId,
        incidentStatus: incident.status,
        snapshot: { id: s.id, revision: s.revision, fingerprint: s.fingerprint },
        dataQuality: impact.dataQuality,
        source: "SIMULATED_CALCULATION",
        dataMode: "SYNTHETIC_BUSINESS",
      },
    },
  };
}

function menuDependencies(state: RestaurantState, ingredientId: string): MenuDependency[] {
  const s = state.snapshot;
  return sharedIngredientDemand(s, ingredientId, forecastDemandLines(s)).map((row) => {
    const menu = s.menuItems.find((m) => m.id === row.menuId)!;
    const recipe = s.recipes.find((r) => r.menuId === menu.id && r.version === menu.recipeVersion)!;
    return {
      menuId: row.menuId,
      recipeVersion: recipe.version,
      ingredientPerPortionMilli: recipe.components.find((c) => c.ingredientId === ingredientId)!.quantityMilli,
      forecastPortions: row.portions,
      confirmedPortions: openConfirmedOrders(s).filter((o) => o.menuId === row.menuId).reduce((sum, o) => sum + o.portions, 0),
    };
  });
}

export function buildP3Handoff(state: RestaurantState, incidentId: string): Handoff<P3ImpactHandoff> {
  const c = common(state, incidentId);
  if (!c.ready) return c;
  const { base, impact } = c.payload;
  const incident = state.incidents.find((i) => i.id === incidentId)!;
  return {
    ready: true,
    payload: {
      ...base,
      ingredientId: incident.ingredientId,
      requiredSpec: HP_INGREDIENTS.find((i) => i.id === incident.ingredientId)?.requiredSpec ?? null,
      poShortfallKgMilli: impact.poShortfallKgMilli ?? 0,
      forecastRequirementKgMilli: impact.summary!.chickenForecastRequirementKgMilli,
      forecastGapKgMilli: impact.summary!.demandGapKgMilli,
      confirmedRequirementKgMilli: impact.confirmedRequirementKgMilli ?? 0,
      physicalEligibleKgMilli: impact.summary!.chickenAvailableKgMilli,
      requiredByLocal: HP_BUSINESS.prepCutoffLocal,
      menuDependencies: menuDependencies(state, incident.ingredientId),
    },
  };
}

export function buildP4Handoff(state: RestaurantState, incidentId: string): Handoff<P4ImpactHandoff> {
  const c = common(state, incidentId);
  if (!c.ready) return c;
  const { base, impact } = c.payload;
  const incident = state.incidents.find((i) => i.id === incidentId)!;
  const s = state.snapshot;
  const position = ingredientPosition(s, incident.ingredientId, { neededByLocal: HP_BUSINESS.prepCutoffLocal, applySupplierClaims: true });
  const eligibleLots = s.ingredientLots.filter((l) => l.ingredientId === incident.ingredientId && l.accepted && !l.quarantined);
  const perPortion = new Map(menuDependencies(state, incident.ingredientId).map((m) => [m.menuId, m.ingredientPerPortionMilli]));
  return {
    ready: true,
    payload: {
      ...base,
      ingredientId: incident.ingredientId,
      eligibleStock: position.eligibleOnHandMilli > 0 ? eligibleLots.map((l) => ({ lotId: l.id, onHandMilli: l.onHandMilli, availableAtLocal: l.availableAtLocal })) : [],
      confirmedReservations: affectedConfirmedOrders(s, impact.summary!.affectedMenuIds).map((o) => ({
        orderId: o.id,
        menuId: o.menuId,
        portions: o.portions,
        dueTimeLocal: o.dueTimeLocal,
        ingredientMilli: (perPortion.get(o.menuId) ?? 0) * o.portions,
      })),
      sharedIngredientDemand: menuDependencies(state, incident.ingredientId),
      recipes: s.recipes,
      resources: s.resources,
      confirmedDeadlineLocal: HP_BUSINESS.confirmedDeadlineLocal,
      forecastWindowEndLocal: HP_BUSINESS.forecastWindowEndLocal,
    },
  };
}

export function buildP5Handoff(state: RestaurantState, incidentId: string): Handoff<P5ImpactHandoff> {
  const c = common(state, incidentId);
  if (!c.ready) return c;
  const { base, impact } = c.payload;
  const incident = state.incidents.find((i) => i.id === incidentId)!;
  return {
    ready: true,
    payload: {
      ...base,
      summary: impact.summary!,
      impactStatus: impact.status as "ASSESSED" | "BREACH_RISK",
      confirmedFulfilment: impact.feasibilityOfConfirmed as "CONDITIONAL" | "UNKNOWN" | "INFEASIBLE",
      evidenceRefs: [...incident.messageIds, `snapshot:${state.snapshot.id}@r${state.snapshot.revision}`],
      warnings: [
        ...impact.dataQuality.map((q) => q.message),
        "Supplier claim is not a goods receipt",
        impact.feasibilityOfConfirmed === "INFEASIBLE"
          ? "Confirmed orders have an ingredient deficit"
          : "Confirmed fulfilment depends on a kitchen schedule not verified by P2",
      ],
    },
  };
}
