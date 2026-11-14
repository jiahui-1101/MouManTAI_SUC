/**
 * Production P1/P2 -> P4 input mapping through P2's approved buildP4Handoff contract.
 * Only stock eligibility, recipes, demand and identity come from shared state. The
 * prep batch schedule and holding assumption are P4-owned planning data (not part of
 * the shared snapshot) and are reused from the P4 module unchanged.
 */
import { buildP4Handoff } from "../features/impact/handoff";
import { isImpactStale } from "../services/mock/restaurantState";
import { preview as p4Schedule } from "../features/recovery/plan-b/preview";
import type { PlanInput } from "../features/recovery/plan-b/planB";
import type { DemoState } from "../store/demoStore";

export type SharedPlanBInput =
  | { status: "READY"; input: PlanInput; sharedChickenGrams: number }
  | { status: "PENDING" | "STALE"; reason: string };

export function selectPlanBInput(state: DemoState): SharedPlanBInput {
  const restaurant = state.restaurant;
  const incidentId = state.incident.id;
  if (isImpactStale(restaurant, incidentId)) return { status: "STALE", reason: "Snapshot changed after the last P2 impact assessment." };
  const handoff = buildP4Handoff(restaurant, incidentId);
  if (!handoff.ready) return { status: "PENDING", reason: handoff.reason };
  const h = handoff.payload;
  const snap = restaurant.snapshot;
  const incident = restaurant.incidents.find((i) => i.id === incidentId)!;
  const po = snap.purchaseOrders.find((p) => p.id === incident.poId);
  const claim = snap.supplierClaims.find((c) => c.poId === incident.poId);
  if (!po || po.expectedKgMilli === null || !claim) return { status: "PENDING", reason: "Verified PO quantity and supplier claim are required." };
  const chickenGrams = h.eligibleStock.reduce((sum, lot) => sum + lot.onHandMilli, 0);
  const fries = snap.ingredientLots.filter((l) => l.ingredientId === "HP-ING-FRIES" && l.accepted && !l.quarantined);
  const short = new Map(p4Schedule.menus.map((m) => [m.id, m.short]));
  const input: PlanInput = {
    snapshotId: snap.id,
    fingerprint: snap.fingerprint,
    revision: snap.revision,
    date: snap.demoBusinessDate,
    incident: { id: incident.id, verified: true, po: po.id, ordered: po.expectedKgMilli, claimed: claim.claimedDeliveryTodayKgMilli },
    lots: [
      ...h.eligibleStock.map((l) => ({ id: l.lotId, ingredient: "chicken" as const, grams: l.onHandMilli, accepted: true })),
      ...fries.map((l) => ({ id: l.id, ingredient: "fries" as const, grams: l.onHandMilli, accepted: l.accepted })),
    ],
    menus: snap.menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      short: short.get(m.id) ?? m.name,
      chicken: m.chickenKgMilli,
      fries: m.potatoFriesKgMilli,
      forecast: snap.forecasts.filter((f) => f.menuId === m.id).reduce((sum, f) => sum + f.portions, 0),
      confirmed: snap.confirmedOrders.filter((o) => o.menuId === m.id && o.status === "CONFIRMED").reduce((sum, o) => sum + o.portions, 0),
      approved: m.approvedInDemo,
    })),
    stations: h.resources.map((r) => r.id),
    batches: p4Schedule.batches,
    holdingKnown: p4Schedule.holdingKnown,
  };
  return { status: "READY", input, sharedChickenGrams: chickenGrams };
}
