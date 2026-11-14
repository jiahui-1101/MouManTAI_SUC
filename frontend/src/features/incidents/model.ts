/**
 * P2 view-model projections. Pure functions over the shared state — pages never
 * keep their own incident/stock numbers.
 */
import type { ImpactAssessment, Incident, IncidentStatus } from "../../types/restaurant";
import type { RestaurantState } from "../../services/mock/restaurantState";
import { isImpactStale, selectCurrentImpact } from "../../services/mock/restaurantState";
import {
  affectedMenus,
  confirmedIngredientRequirements,
  forecastIngredientRequirements,
  ingredientGap,
  ingredientPosition,
} from "../impact/calculations";
import { HP_BUSINESS, HP_IDS, HP_INGREDIENTS, HP_SUPPLIERS } from "../../data/fixtures/happyPotato";

export const LIFECYCLE: IncidentStatus[] = [
  "DETECTED",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "IMPACT_ASSESSED",
  "SCENARIOS_READY",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "AWAITING_EVIDENCE",
  "CLOSED",
];

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  DETECTED: "Detected",
  PENDING_VERIFICATION: "Pending verification",
  VERIFIED: "Verified",
  IMPACT_ASSESSED: "Impact assessed",
  SCENARIOS_READY: "Scenarios ready",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  EXECUTING: "Executing (simulated)",
  AWAITING_EVIDENCE: "Awaiting evidence",
  CLOSED: "Closed",
};

export const INCIDENT_TYPE_LABEL: Record<Incident["type"], string> = {
  PARTIAL_DELIVERY: "Partial delivery",
  DELAY: "Delay",
  UNAVAILABLE: "Unavailable today",
  QUALITY_REJECTED: "Quality rejected",
  PRICE_CHANGE: "Price change",
  CANCELLED: "Cancelled",
  SPEC_CHANGE: "Specification change",
};

export const isVerified = (status: IncidentStatus) => LIFECYCLE.indexOf(status) >= LIFECYCLE.indexOf("VERIFIED");
export const isOpen = (status: IncidentStatus) => status !== "CLOSED";

export const supplierName = (id: string) => HP_SUPPLIERS.find((s) => s.id === id)?.name ?? id;
export const ingredientName = (id: string) => HP_INGREDIENTS.find((i) => i.id === id)?.name ?? id;

/* severity rubric (documented, not a score) --------------------------------- */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "UNASSESSED";

/**
 * - UNASSESSED: no current authoritative impact (pending, stale or unknown).
 * - CRITICAL: confirmed orders cannot be covered (BREACH_RISK).
 * - HIGH: forecast ingredient gap > 0 on ≥1 affected menu item.
 * - MEDIUM: assessed with no forecast gap.
 */
export function severityOf(impact: ImpactAssessment | null): Severity {
  if (!impact || !impact.summary) return "UNASSESSED";
  if (impact.status === "BREACH_RISK") return "CRITICAL";
  return impact.summary.demandGapKgMilli > 0 && impact.summary.affectedMenuIds.length > 0 ? "HIGH" : "MEDIUM";
}

export type ImpactState = "NOT_VERIFIED" | "NOT_ASSESSED" | "CURRENT" | "STALE" | "UNKNOWN";

export function impactStateOf(state: RestaurantState, incident: Incident): ImpactState {
  if (!isVerified(incident.status)) return "NOT_VERIFIED";
  if (isImpactStale(state, incident.id)) return "STALE";
  const impact = selectCurrentImpact(state, incident.id);
  if (!impact) return "NOT_ASSESSED";
  return impact.summary ? "CURRENT" : "UNKNOWN";
}

/* overview counts ------------------------------------------------------------ */

export type Metric =
  | { kind: "value"; value: number; note: string }
  /** A number that is true for ingredients only; fulfilment still depends on unverified conditions. */
  | { kind: "conditional"; value: number; qualifier: string; note: string }
  | { kind: "pending"; note: string }
  | { kind: "none"; note: string };

export interface OverviewCounts {
  activeIncidents: Metric;
  confirmedOrdersAtRisk: Metric;
  affectedMenuItems: Metric;
  pendingApprovals: Metric;
  awaitingEvidence: Metric;
  awaitingVerification: number;
}

export function overviewCounts(state: RestaurantState): OverviewCounts {
  const open = state.incidents.filter((i) => isOpen(i.status));
  const verified = open.filter((i) => isVerified(i.status));
  const pending = open.length - verified.length;
  const impacts = verified.map((i) => selectCurrentImpact(state, i.id));
  const allAssessed = verified.length > 0 && impacts.every((imp) => imp?.summary);

  let confirmedOrdersAtRisk: Metric;
  let affectedMenuItems: Metric;
  if (verified.length === 0) {
    const note = pending ? `${pending} report${pending > 1 ? "s" : ""} awaiting verification` : "No verified disruption";
    confirmedOrdersAtRisk = { kind: "none", note };
    affectedMenuItems = { kind: "none", note };
  } else if (!allAssessed) {
    confirmedOrdersAtRisk = { kind: "pending", note: "Impact not yet assessed on current snapshot" };
    affectedMenuItems = { kind: "pending", note: "Impact not yet assessed on current snapshot" };
  } else {
    const breach = impacts.filter((imp) => imp?.status === "BREACH_RISK");
    const groups = new Set(breach.flatMap((imp) => imp?.affectedConfirmedOrderIds ?? []));
    confirmedOrdersAtRisk = groups.size
      ? { kind: "value", value: groups.size, note: "Order groups with an ingredient deficit" }
      : {
          kind: "conditional",
          value: 0,
          qualifier: "Fulfilment conditional",
          note: "No ingredient deficit. Kitchen schedule and capacity not yet verified.",
        };
    const menus = new Set(impacts.flatMap((imp) => imp?.summary?.affectedMenuIds ?? []));
    affectedMenuItems = { kind: "value", value: menus.size, note: "Menu items using the disrupted ingredient" };
  }

  return {
    activeIncidents: { kind: "value", value: verified.length, note: pending ? `+${pending} awaiting verification` : "Verified, not closed" },
    confirmedOrdersAtRisk,
    affectedMenuItems,
    pendingApprovals: { kind: "value", value: open.filter((i) => i.status === "PENDING_APPROVAL").length, note: "Recovery plans awaiting a decision" },
    awaitingEvidence: { kind: "value", value: open.filter((i) => i.status === "AWAITING_EVIDENCE").length, note: "Simulated actions without evidence" },
    awaitingVerification: pending,
  };
}

/* next action ---------------------------------------------------------------- */

export type NextAction =
  | { kind: "navigate"; label: string; description: string; to: string; beforeNavigate?: () => void }
  | { kind: "assess"; label: string; description: string; incidentId: string };

export function nextActions(state: RestaurantState, incident: Incident | undefined): NextAction[] {
  if (!incident) {
    return [{ kind: "navigate", label: "Open supplier inbox", description: "No supplier incident yet. New supplier messages arrive in the inbox.", to: "/inbox" }];
  }
  const impactState = impactStateOf(state, incident);
  switch (incident.status) {
    case "DETECTED":
    case "PENDING_VERIFICATION":
      return [{ kind: "navigate", label: "Review supplier message", description: "Sender and PO must be verified before impact can be assessed.", to: "/message-intelligence" }];
    case "VERIFIED":
      return [{ kind: "assess", label: "Assess business impact", description: "Calculate stock, menu and order impact on the current snapshot.", incidentId: incident.id }];
    case "IMPACT_ASSESSED":
      if (impactState === "STALE") {
        return [{ kind: "assess", label: "Re-assess impact", description: "The snapshot changed since the last assessment.", incidentId: incident.id }];
      }
      return [
        { kind: "navigate", label: "Review Plan A", description: "External supplier recovery options.", to: "/recovery/plan-a" },
        { kind: "navigate", label: "Review Plan B", description: "No-purchase stock, menu and prep recovery.", to: "/recovery/plan-b" },
      ];
    case "SCENARIOS_READY":
      return [{ kind: "navigate", label: "Compare recovery plans", description: "Plan A and Plan B are ready on the same snapshot.", to: "/recovery/compare" }];
    case "PENDING_APPROVAL":
      return [{ kind: "navigate", label: "Await approval", description: "A recovery plan is waiting for an authorised decision.", to: "/approvals" }];
    case "APPROVED":
    case "EXECUTING":
      return [{ kind: "navigate", label: "Track execution", description: "Simulated execution tasks are in progress.", to: "/execution" }];
    case "AWAITING_EVIDENCE":
      return [{ kind: "navigate", label: "Record outcome evidence", description: "No outcome is verified until simulated evidence is recorded.", to: "/outcomes" }];
    case "CLOSED":
      return [{ kind: "navigate", label: "View decision memory", description: "Incident closed.", to: "/decision-memory" }];
  }
}

/**
 * Overview action queue: while an incident is still being worked out, go straight to the
 * two recovery plans (no separate "assess impact" step). Normal operation → no actions.
 */
export function overviewActions(state: RestaurantState, incident: Incident | undefined, assess: (incidentId: string) => void): NextAction[] {
  if (!incident || incident.status === "CLOSED") return [];
  const early: IncidentStatus[] = ["DETECTED", "PENDING_VERIFICATION", "VERIFIED", "IMPACT_ASSESSED", "SCENARIOS_READY"];
  if (!early.includes(incident.status)) return nextActions(state, incident);
  const needsAssess = incident.status === "VERIFIED" || (incident.status === "IMPACT_ASSESSED" && impactStateOf(state, incident) === "STALE");
  const beforeNavigate = needsAssess ? () => assess(incident.id) : undefined;
  return [
    { kind: "navigate", label: "Plan A · External supplier", description: "Source the missing chicken from alternative suppliers.", to: "/recovery/plan-a", beforeNavigate },
    { kind: "navigate", label: "Plan B · Internal recovery", description: "No purchase: reallocate stock, adjust menu and prep.", to: "/recovery/plan-b", beforeNavigate },
  ];
}

/* readiness ------------------------------------------------------------------ */

export interface ReadinessRow {
  ingredientId: string;
  name: string;
  unit: string;
  physicalMilli: number;
  eligibleMilli: number;
  plannedIncomingMilli: number;
  claimedIncomingMilli: number;
  hasSupplierClaim: boolean;
  forecastMilli: number;
  confirmedMilli: number;
  /** Forecast requirement minus (eligible + planned PO due by cutoff). Claims never count. */
  projectedGapMilli: number;
  confirmedCovered: boolean;
}

/** Snapshot projection for ingredients that menus use. Not an incident impact. */
export function readinessRows(state: RestaurantState): ReadinessRow[] {
  const snapshot = state.snapshot;
  const forecast = forecastIngredientRequirements(snapshot).totals;
  const confirmed = confirmedIngredientRequirements(snapshot).totals;
  return HP_INGREDIENTS.filter((ing) => forecast[ing.id]).map((ing) => {
    const position = ingredientPosition(snapshot, ing.id, { neededByLocal: HP_BUSINESS.prepCutoffLocal, applySupplierClaims: true });
    const forecastMilli = forecast[ing.id]?.quantityMilli ?? 0;
    const confirmedMilli = confirmed[ing.id]?.quantityMilli ?? 0;
    const supply = position.availableAfterReservationsMilli + position.plannedIncomingMilli;
    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      physicalMilli: position.physicalOnHandMilli,
      eligibleMilli: position.availableAfterReservationsMilli,
      plannedIncomingMilli: position.plannedIncomingMilli,
      claimedIncomingMilli: position.supplierClaimedIncomingMilli,
      hasSupplierClaim: snapshot.supplierClaims.some((c) => c.ingredientId === ing.id),
      forecastMilli,
      confirmedMilli,
      projectedGapMilli: ingredientGap(forecastMilli, supply),
      confirmedCovered: position.availableAfterReservationsMilli >= confirmedMilli,
    };
  });
}

/* menu summary ---------------------------------------------------------------- */

export interface MenuSummaryRow {
  menuId: string;
  name: string;
  forecast: number;
  confirmed: number;
  chickenPerPortionMilli: number;
  dependency: "AFFECTED" | "UNAFFECTED" | "UNKNOWN";
}

/** Menu dependency on the disrupted ingredient (chicken by default), from the BOM. */
export function menuSummary(state: RestaurantState, ingredientId: string = HP_IDS.chicken): MenuSummaryRow[] {
  const snapshot = state.snapshot;
  const menus = affectedMenus(snapshot, ingredientId);
  return snapshot.menuItems.map((m) => ({
    menuId: m.id,
    name: m.name,
    forecast: snapshot.forecasts.filter((f) => f.menuId === m.id).reduce((s, f) => s + f.portions, 0),
    confirmed: snapshot.confirmedOrders.filter((o) => o.menuId === m.id && o.status !== "FULFILLED").reduce((s, o) => s + o.portions, 0),
    chickenPerPortionMilli: m.chickenKgMilli,
    dependency: menus.affectedMenuIds.includes(m.id) ? "AFFECTED" : menus.unaffectedMenuIds.includes(m.id) ? "UNAFFECTED" : "UNKNOWN",
  }));
}

export function primaryIncident(state: RestaurantState): Incident | undefined {
  return state.incidents.find((i) => i.id === HP_IDS.incident) ?? state.incidents[0];
}
