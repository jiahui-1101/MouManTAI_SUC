import type { Batch, PlanInput } from "./planB";

const station = "HP-FRY-CH-A";
const batch = (index: number, menu: string, start: number, end: number, portions: number, demand: Batch["demand"] = "Confirmed"): Batch => ({
  id: "HP-BATCH-B-0" + index, menuId: "HP-MENU-" + menu, station, start, end, portions, demand,
  deadline: demand === "Confirmed" ? 750 : 870, status: "PLANNED",
});

// Temporary P4 preview. Replace this input with P0/P2 selectors when available.
export const preview: PlanInput = {
  snapshotId: "HP-SNAP-001", fingerprint: "hp-local-preview-revision-1", revision: 1, date: "2026-11-21",
  incident: { id: "HP-INC-001", verified: true, po: "HP-PO-1042", ordered: 20000, claimed: 0 },
  lots: [
    { id: "HP-LOT-CH-001", ingredient: "chicken", grams: 10000, accepted: true },
    { id: "HP-LOT-FRIES-001", ingredient: "fries", grams: 30000, accepted: true },
  ],
  menus: [
    { id: "HP-MENU-CP", name: "Chicken Popcorn", short: "Popcorn", chicken: 150, fries: 0, forecast: 60, confirmed: 25, approved: true },
    { id: "HP-MENU-CT", name: "Chicken Tenders", short: "Tenders", chicken: 200, fries: 0, forecast: 40, confirmed: 15, approved: true },
    { id: "HP-MENU-HC", name: "Happy Combo — Chicken Popcorn", short: "Happy Combo", chicken: 100, fries: 180, forecast: 50, confirmed: 20, approved: true },
    { id: "HP-MENU-FR", name: "Flavoured Fries (Regular)", short: "Fries", chicken: 0, fries: 200, forecast: 90, confirmed: 35, approved: true },
  ],
  stations: [station, "HP-FRY-CH-B", "HP-FRY-FRIES-A"],
  batches: [batch(1, "CP", 655, 680, 25), batch(2, "HC", 680, 700, 20), batch(3, "CT", 700, 725, 15), batch(4, "HC", 725, 740, 12, "New")],
  holdingKnown: true,
};
