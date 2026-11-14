import { allocateDemoOrders } from "../../features/recovery/plan-b/orderCoverage";
import { preview } from "../../features/recovery/plan-b/preview";
import { eligibleLots, type Batch } from "../../features/recovery/plan-b/planB";

export const kitchenAssumptions = { maxPortions: 10, minutes: 6, earliest: 630 };
const stations = { chicken: preview.batches[0]?.station ?? "", fries: preview.stations.find(id => id === "HP-FRY-FRIES-A") ?? "" };
const stock = eligibleLots(preview);
const grams = (ingredient: string) => stock.filter(lot => lot.ingredient === ingredient).reduce((sum, lot) => sum + (lot.grams ?? 0), 0);
export const orders = (allocateDemoOrders(preview.menus, grams("chicken"), grams("fries")) ?? [])
  .map((order, index) => ({ ...order, deadline: 690 + Math.floor(index / 4) * 30 }));
export const readyTimes = [...new Set(orders.map(order => order.deadline))];
export type PrepBatch = Batch & { orderIds: string[]; ingredient: "chicken" | "fries" };

export function generateSchedule(): PrepBatch[] {
  const batches: PrepBatch[] = [];
  for (const ingredient of ["chicken", "fries"] as const) {
    let cursor = Infinity;
    for (const deadline of [...readyTimes].reverse()) {
      cursor = Math.min(cursor, deadline);
      for (const menu of preview.menus.filter(item => item[ingredient] > 0)) {
        const portions = orders.filter(order => order.deadline === deadline).flatMap(order =>
          Array.from({ length: order.items.find(item => item.menuId === menu.id)?.portions ?? 0 }, () => order.id));
        for (let offset = 0; offset < portions.length; offset += kitchenAssumptions.maxPortions) {
          const group = portions.slice(offset, offset + kitchenAssumptions.maxPortions);
          const end = cursor;
          const start = Math.max(kitchenAssumptions.earliest, end - kitchenAssumptions.minutes);
          batches.push({ id: "HP-SIM-B" + String(batches.length + 1).padStart(2, "0"),
            menuId: menu.id, station: stations[ingredient], ingredient, start, end, deadline, portions: group.length,
            orderIds: [...new Set(group)], demand: "Confirmed", status: "PLANNED" });
          cursor = start;
        }
      }
    }
  }
  return batches.sort((a, b) => a.start - b.start);
}

export function checkSchedule(batches: PrepBatch[]) {
  const issues: string[] = [];
  const affected = new Set<string>();
  for (const [index, batch] of batches.entries()) {
    if (!stations[batch.ingredient] || batch.station !== stations[batch.ingredient] || batch.portions > kitchenAssumptions.maxPortions ||
        !Number.isInteger(batch.start) || !Number.isInteger(batch.end) ||
        batch.start < kitchenAssumptions.earliest || batch.end <= batch.start) {
      issues.push(batch.id + " has invalid timing or station capacity.");
      batch.orderIds.forEach(id => affected.add(id));
    }
    for (const other of batches.slice(index + 1)) {
      const overlap = Math.min(batch.end, other.end) - Math.max(batch.start, other.start);
      if (batch.station === other.station && overlap > 0) {
        issues.push(batch.id + " overlaps " + other.id + " by " + overlap + " min.");
        [...batch.orderIds, ...other.orderIds].forEach(id => affected.add(id));
      }
    }
  }
  for (const order of orders) {
    const linked = batches.filter(batch => batch.orderIds.includes(order.id));
    const late = linked.filter(batch => batch.end > order.deadline);
    if (late.length) {
      issues.push(order.id + " misses its ready time by " + (Math.max(...late.map(batch => batch.end)) - order.deadline) + " min (" + late.map(batch => batch.id).join(", ") + ").");
      affected.add(order.id);
    }
  }
  return { issues, affected };
}
