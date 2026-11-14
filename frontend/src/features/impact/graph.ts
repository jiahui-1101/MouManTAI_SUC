/**
 * Supply-to-menu dependency graph built only from relationships present in the
 * snapshot: PO.supplierId, PO.ingredientId, lot.ingredientId, recipe components,
 * recipe→menu, menu demand, and the documented station rule below.
 *
 * Station rule (synthetic, transparent): a station serves a menu when the
 * station's capability ingredient is in that menu's approved recipe.
 *   DEMO_CHICKEN_BATCH → HP-ING-CHICKEN, DEMO_FROZEN_FRIES → HP-ING-FRIES.
 */
import type { OperationalSnapshot } from "../../types/restaurant";
import { HP_INGREDIENTS, HP_SUPPLIERS } from "../../data/fixtures/happyPotato";
import { findApprovedRecipe, openConfirmedOrders } from "./calculations";

export type NodeKind = "supplier" | "po" | "lot" | "ingredient" | "recipe" | "menu" | "demand" | "station";
export type NodeStatus = "DISRUPTED" | "AFFECTED" | "UNAFFECTED" | "UNKNOWN";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel: string;
  status: NodeStatus;
  /** Where the node comes from. */
  source: string;
  /** Underlying domain ID (menu ID, lot ID, ...). */
  refId: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface ImpactGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const COLUMNS: Array<{ kind: NodeKind; title: string }> = [
  { kind: "supplier", title: "Supplier" },
  { kind: "po", title: "Purchase order" },
  { kind: "lot", title: "Inventory" },
  { kind: "ingredient", title: "Ingredient" },
  { kind: "recipe", title: "Recipe / BOM" },
  { kind: "menu", title: "Menu item" },
  { kind: "demand", title: "Orders & forecast" },
  { kind: "station", title: "Kitchen station" },
];

export const CAPABILITY_INGREDIENT: Record<string, string> = {
  DEMO_CHICKEN_BATCH: "HP-ING-CHICKEN",
  DEMO_FROZEN_FRIES: "HP-ING-FRIES",
};

const SRC = "Synthetic fixture HP-SNAP-001";

export function buildImpactGraph(snapshot: OperationalSnapshot, disruptedPoId: string, disruptedIngredientId: string): ImpactGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const add = (n: GraphNode) => nodes.push(n);
  const kgText = (milli: number) => `${(milli / 1000).toFixed(3).replace(/\.?0+$/, "")} kg`;

  for (const po of snapshot.purchaseOrders) {
    const supplier = HP_SUPPLIERS.find((s) => s.id === po.supplierId);
    const disrupted = po.id === disruptedPoId;
    if (!nodes.some((n) => n.id === `supplier:${po.supplierId}`)) {
      add({ id: `supplier:${po.supplierId}`, kind: "supplier", label: supplier?.name ?? po.supplierId, sublabel: po.supplierId, status: disrupted ? "DISRUPTED" : "UNAFFECTED", source: "Synthetic supplier registry", refId: po.supplierId });
    }
    add({ id: `po:${po.id}`, kind: "po", label: po.id, sublabel: `${po.expectedKgMilli === null ? "?" : kgText(po.expectedKgMilli)} due ${po.dueTimeLocal}`, status: disrupted ? "DISRUPTED" : "UNAFFECTED", source: SRC, refId: po.id });
    edges.push({ from: `supplier:${po.supplierId}`, to: `po:${po.id}`, relation: "supplies" });
    edges.push({ from: `po:${po.id}`, to: `ingredient:${po.ingredientId}`, relation: "planned incoming" });
  }

  const usedIngredients = new Set(snapshot.recipes.flatMap((r) => r.components.map((c) => c.ingredientId)));
  for (const ingId of usedIngredients) {
    const ing = HP_INGREDIENTS.find((i) => i.id === ingId);
    add({ id: `ingredient:${ingId}`, kind: "ingredient", label: ing?.name ?? ingId, sublabel: ingId, status: ingId === disruptedIngredientId ? "AFFECTED" : "UNAFFECTED", source: SRC, refId: ingId });
    for (const lot of snapshot.ingredientLots.filter((l) => l.ingredientId === ingId)) {
      add({ id: `lot:${lot.id}`, kind: "lot", label: lot.id, sublabel: `${kgText(lot.onHandMilli)} physical${lot.accepted ? "" : " · not accepted"}`, status: ingId === disruptedIngredientId ? "AFFECTED" : "UNAFFECTED", source: SRC, refId: lot.id });
      edges.push({ from: `lot:${lot.id}`, to: `ingredient:${ingId}`, relation: "on hand" });
    }
  }

  for (const menu of snapshot.menuItems) {
    const lookup = findApprovedRecipe(snapshot, menu);
    const usesDisrupted = lookup.ok && lookup.recipe.components.some((c) => c.ingredientId === disruptedIngredientId);
    const status: NodeStatus = !lookup.ok ? "UNKNOWN" : usesDisrupted ? "AFFECTED" : "UNAFFECTED";
    const recipeId = `recipe:${menu.id}`;
    add({ id: recipeId, kind: "recipe", label: `${menu.name} BOM`, sublabel: lookup.ok ? lookup.recipe.version : "Missing / unapproved", status, source: SRC, refId: menu.id });
    add({ id: `menu:${menu.id}`, kind: "menu", label: menu.name, sublabel: menu.id, status, source: SRC, refId: menu.id });
    const forecast = snapshot.forecasts.filter((f) => f.menuId === menu.id).reduce((s, f) => s + f.portions, 0);
    const confirmed = openConfirmedOrders(snapshot).filter((o) => o.menuId === menu.id).reduce((s, o) => s + o.portions, 0);
    add({ id: `demand:${menu.id}`, kind: "demand", label: `${confirmed} confirmed · ${forecast} forecast`, sublabel: menu.name, status, source: SRC, refId: menu.id });
    edges.push({ from: recipeId, to: `menu:${menu.id}`, relation: "defines" });
    edges.push({ from: `menu:${menu.id}`, to: `demand:${menu.id}`, relation: "demand" });
    if (lookup.ok) {
      for (const c of lookup.recipe.components) {
        edges.push({ from: `ingredient:${c.ingredientId}`, to: recipeId, relation: `${kgText(c.quantityMilli)} / portion` });
      }
      for (const res of snapshot.resources) {
        const capIng = CAPABILITY_INGREDIENT[res.capability];
        if (capIng && lookup.recipe.components.some((c) => c.ingredientId === capIng)) {
          edges.push({ from: `menu:${menu.id}`, to: `station:${res.id}`, relation: "prepared on" });
        }
      }
    }
  }

  for (const res of snapshot.resources) {
    const capIng = CAPABILITY_INGREDIENT[res.capability];
    add({ id: `station:${res.id}`, kind: "station", label: res.name, sublabel: res.id, status: capIng === disruptedIngredientId ? "AFFECTED" : "UNAFFECTED", source: "Synthetic kitchen model", refId: res.id });
  }

  return { nodes, edges: edges.filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to)) };
}

/** All nodes reachable upstream and downstream of `nodeId`, including itself. */
export function connectedNodeIds(graph: ImpactGraph, nodeId: string): Set<string> {
  const result = new Set<string>([nodeId]);
  const walk = (start: string, next: (e: GraphEdge) => string | null) => {
    const stack = [start];
    while (stack.length) {
      const current = stack.pop()!;
      for (const e of graph.edges) {
        const n = next(e) === current ? (e.from === current ? e.to : e.from) : null;
        if (n && !result.has(n)) {
          result.add(n);
          stack.push(n);
        }
      }
    }
  };
  walk(nodeId, (e) => e.from); // downstream: follow edges whose from === current
  walk(nodeId, (e) => e.to); // upstream: follow edges whose to === current
  return result;
}
