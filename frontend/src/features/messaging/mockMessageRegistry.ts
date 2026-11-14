export const CANONICAL_MESSAGE =
  "Hi Happy Potato, sorry. PO HP-PO-1042: we cannot deliver the 20kg chilled chicken scheduled for today. Delivered quantity today will be 0kg. We will update you tomorrow.";

export const CANONICAL_SUPPLIER_REGISTRY = {
  "HP-SUP-001": {
    id: "HP-SUP-001",
    displayName: "Demo Poultry Supply A",
    verification: "VERIFIED_DEMO_CONTACT",
  },
  "HP-SUP-002": { id: "HP-SUP-002", displayName: "Demo Poultry Supply B", verification: "APPROVED_DEMO_SUPPLIER" },
  "HP-SUP-003": { id: "HP-SUP-003", displayName: "Demo Budget Frozen Foods", verification: "APPROVED_DEMO_CONTACT" },
  "HP-SUP-004": { id: "HP-SUP-004", displayName: "Demo Frozen Fries Distributor", verification: "DEMO_SOURCE" },
} as const;

export const CANONICAL_RULE_SUMMARY = {
  method: "RULE_EXTRACTION",
  supportedMessage: "Canonical PO delivery unavailable sentence",
  matchedPoId: "HP-PO-1042",
  incidentType: "UNAVAILABLE",
  expectedKgMilli: 20_000,
  claimedDeliveryKgMilli: 0,
  etaStatus: "UNKNOWN",
  failClosed: true,
} as const;

export const CANONICAL_PO_REGISTRY = {
  "HP-PO-1042": {
    id: "HP-PO-1042",
    supplierId: "HP-SUP-001",
    ingredientId: "HP-ING-CHICKEN",
    expectedKgMilli: 20_000,
    acceptedStockKgMilli: 10_000,
    state: "OPEN",
  },
} as const;

export type CanonicalSupplierId = keyof typeof CANONICAL_SUPPLIER_REGISTRY;

