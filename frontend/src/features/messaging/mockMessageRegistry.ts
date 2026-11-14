export const CANONICAL_MESSAGE =
  "Hi Happy Potato, sorry. PO HP-PO-1042: we cannot deliver the 20kg chilled chicken scheduled for today. Delivered quantity today will be 0kg. We will update you tomorrow.";

export const CANONICAL_SUPPLIER_REGISTRY = {
  "HP-SUP-001": {
    id: "HP-SUP-001",
    displayName: "Demo Poultry Supply A",
    verification: "VERIFIED_DEMO_CONTACT",
  },
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

