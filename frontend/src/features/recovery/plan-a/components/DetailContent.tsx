import type { ReactNode } from "react";

export function DetailFacts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="pa-detail-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function ReferenceTokens({ values }: { values: string[] }) {
  return <ul className="pa-reference-tokens" aria-label="Evidence references">{values.map(value => <li key={value}>{value}</li>)}</ul>;
}
export const conditionLabel: Record<string, [string, string]> = {
  SUPPLIER_CONFIRMATION_REQUIRED: ["Supplier confirmation", "Availability and ETA need confirmation"],
  QUALITY_ACCEPTANCE_REQUIRED: ["Receiving", "Check quantity, chilled specification and quality before acceptance"],
  QUOTE_VALIDITY_NOT_PROVIDED: ["Quote validity missing", "Refresh before approval"],
  CONDITIONAL_INCOMING_NOT_PHYSICAL_STOCK: ["Stock", "Incoming supply is conditional; stock changes only after accepted receipt"],
  KITCHEN_CAPACITY_NOT_RECOMPUTED: ["Scope", "Ingredient-only coverage; kitchen capacity and production feasibility not recalculated"],
};
