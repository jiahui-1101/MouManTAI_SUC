export type Menu = { id: string; name: string; short: string; chicken: number; fries: number; forecast: number; confirmed: number; approved: boolean };
export type Lot = { id: string; ingredient: "chicken" | "fries"; grams: number | null; accepted: boolean; expiresOn?: string };
export type Batch = { id: string; menuId: string; station: string; start: number; end: number; deadline: number; portions: number; demand: "Confirmed" | "New"; status: "PLANNED" };
export type PlanInput = {
  snapshotId: string; fingerprint: string; revision: number; date: string;
  incident: { id: string; verified: boolean; po: string; ordered: number; claimed: number } | null;
  menus: Menu[]; lots: Lot[]; stations: string[]; batches: Batch[]; holdingKnown: boolean;
};

export function eligibleLots(input: PlanInput) {
  return input.lots.filter(lot => lot.accepted && lot.grams !== null && Number.isSafeInteger(lot.grams) && lot.grams >= 0 &&
    (!lot.expiresOn || lot.expiresOn > input.date));
}

export function validatePlanB(input: PlanInput, batches: Batch[], rows: ReturnType<typeof allocate>["rows"]) {
  const issues: string[] = [];
  for (const [index, batch] of batches.entries()) {
    if (!input.stations.includes(batch.station)) issues.push(batch.id + " has no available station.");
    if (![batch.start, batch.end, batch.deadline, batch.portions].every(Number.isSafeInteger) ||
      batch.start < 0 || batch.start >= batch.end || batch.end > 1440 || batch.portions <= 0) issues.push(batch.id + " has invalid timing or quantity.");
    if (batch.end > Math.min(batch.deadline, batch.demand === "Confirmed" ? 750 : 1440)) issues.push(batch.id + " misses its service deadline.");
    if (!rows.some(row => row.id === batch.menuId && row.approved && row.chicken > 0)) issues.push(batch.id + " has no approved chicken recipe.");
    for (const other of batches.slice(index + 1)) {
      const overlap = Math.min(batch.end, other.end) - Math.max(batch.start, other.start);
      if (batch.station === other.station && overlap > 0) issues.push(batch.id + " overlaps " + other.id + " by " + overlap + " min.");
    }
  }
  for (const row of rows.filter(row => row.chicken > 0)) {
    const total = (demand: Batch["demand"]) => batches.filter(b => b.menuId === row.id && b.demand === demand).reduce((sum, b) => sum + b.portions, 0);
    if (total("Confirmed") !== row.protected || total("New") !== row.quota) issues.push(row.name + " batches differ from allocated portions.");
  }
  return issues;
}

function allocate(input: PlanInput) {
  const lots = eligibleLots(input);
  const grams = (ingredient: Lot["ingredient"]) => lots.filter(lot => lot.ingredient === ingredient).reduce((sum, lot) => sum + (lot.grams ?? 0), 0);
  const chicken = grams("chicken");
  const fries = grams("fries");
  const confirmedChicken = input.menus.reduce((sum, menu) => sum + menu.chicken * menu.confirmed, 0);
  const confirmedFries = input.menus.reduce((sum, menu) => sum + menu.fries * menu.confirmed, 0);
  const deficit = Math.max(0, confirmedChicken - chicken);
  const blocked = deficit > 0 || confirmedFries > fries || input.menus.some(menu => !menu.approved);
  const discretionary = Math.max(0, chicken - confirmedChicken);
  let friesLeft = Math.max(0, fries - confirmedFries);
  const combo = input.menus.find(menu => menu.id === "HP-MENU-HC");
  const comboQuota = !blocked && combo && combo.chicken > 0
    ? Math.max(0, Math.min(combo.forecast - combo.confirmed, Math.floor(discretionary / combo.chicken), combo.fries ? Math.floor(friesLeft / combo.fries) : Infinity))
    : 0;
  friesLeft -= comboQuota * (combo?.fries ?? 0);
  const rows = input.menus.map(menu => {
    let quota = 0;
    if (menu === combo) quota = comboQuota;
    else if (!blocked && !menu.chicken && menu.fries > 0) {
      quota = Math.max(0, Math.min(menu.forecast - menu.confirmed, Math.floor(friesLeft / menu.fries)));
      friesLeft -= quota * menu.fries;
    }
    return { ...menu, quota, protected: blocked ? 0 : menu.confirmed };
  });
  return { lots, rows, chicken, fries, confirmedChicken, confirmedFries, deficit, blocked, discretionary };
}

export function calculatePlanB(input: PlanInput, impact?: { incidentId: string; snapshotFingerprint: string }) {
  if (!input.incident?.verified || !input.fingerprint || !input.menus.length) return { status: "PENDING" } as const;
  if (impact && (impact.snapshotFingerprint !== input.fingerprint || impact.incidentId !== input.incident.id)) return { status: "STALE" } as const;
  const allocation = allocate(input);
  const { rows, lots } = allocation;
  if (input.lots.some(lot => lot.accepted && lot.grams === null)) return { status: "UNKNOWN" } as const;
  const batches = allocation.blocked ? [] : input.batches.filter(batch => batch.demand !== "New" || rows.some(row => row.id === batch.menuId && row.quota));
  const issues = validatePlanB(input, batches, rows);
  const sum = (measure: (row: typeof rows[number]) => number) => rows.reduce((total, row) => total + measure(row), 0);
  const chickenForecast = sum(row => row.chicken ? row.forecast : 0);
  const served = sum(row => row.chicken ? row.protected + row.quota : 0);
  const assigned = sum(row => (row.protected + row.quota) * row.chicken);
  const proposals = rows.filter(row => row.chicken > 0).map(row => ({
    id: "HP-SC-B-001-" + row.id, menuId: row.id, newOrderQuota: row.quota, state: "DRAFT" as const,
  }));
  const feasibility = allocation.blocked ? "BREACH_RISK" : issues.length ? "INFEASIBLE" : !input.holdingKnown ? "CONDITIONAL" : "FEASIBLE";
  return {
    status: "READY", ...allocation, issues, assigned, residual: allocation.chicken - assigned,
    chickenForecastGrams: sum(row => row.chicken * row.forecast),
    friesForecastGrams: sum(row => row.fries * row.forecast),
    friesAssigned: sum(row => row.fries * (row.quota + row.protected)),
    scenario: {
      id: "HP-SC-B-001", incidentId: input.incident.id, strategy: "B",
      snapshotFingerprint: input.fingerprint, version: input.revision, feasibility,
      newPurchaseKgMilli: 0, additionalCostSen: 0, forecastChickenPortionsServed: served,
      forecastChickenPortionsUnmet: chickenForecast - served, confirmedChickenPortionsProtected: sum(row => row.chicken ? row.protected : 0),
      simulatedCalculation: true, assumptions: ["Protect confirmed first", "Use approved recipes", "Synthetic station and holding assumptions"],
      evidenceRefs: [input.snapshotId, input.incident.po, ...lots.map(lot => lot.id)],
      actionIds: proposals.map(proposal => proposal.id), proposals, batches,
    },
  } as const;
}

export type RecoveryScenarioB = Extract<ReturnType<typeof calculatePlanB>, { status: "READY" }>["scenario"];
export const isCurrentScenario = (scenario: RecoveryScenarioB, input: PlanInput) =>
  scenario.snapshotFingerprint === input.fingerprint && scenario.version === input.revision &&
  !!input.incident?.verified && scenario.incidentId === input.incident.id;
