import type { OperationalSnapshot } from "../types/restaurant";
import { fingerprint } from "./fingerprint";

/** The material content of a snapshot — exactly what the fingerprint covers. */
export type SnapshotContent = Omit<OperationalSnapshot, "id" | "revision" | "fingerprint" | "capturedAtIso">;

/**
 * Fingerprint of material content only. Identity, revision and capture time are
 * excluded, so re-reading or re-rendering never changes it.
 */
export function snapshotFingerprint(content: SnapshotContent): string {
  const { demoBusinessDate, dataMode, ingredientLots, menuItems, purchaseOrders, confirmedOrders, forecasts, resources, recipes, reservations, supplierClaims } = content;
  return fingerprint({ demoBusinessDate, dataMode, ingredientLots, menuItems, purchaseOrders, confirmedOrders, forecasts, resources, recipes, reservations, supplierClaims });
}
