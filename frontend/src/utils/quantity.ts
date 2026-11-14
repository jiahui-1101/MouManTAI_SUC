/**
 * Exact integer quantity and money arithmetic. No binary floating point is
 * used to decide stock or plan quantities.
 */
import type { BaseUnit } from "../types/common";

export type InputUnit = "kg" | "g" | "L" | "ml" | "pcs";

const TO_BASE: Record<InputUnit, { base: BaseUnit; milliPerUnit: number }> = {
  kg: { base: "kg", milliPerUnit: 1000 },
  g: { base: "kg", milliPerUnit: 1 },
  L: { base: "L", milliPerUnit: 1000 },
  ml: { base: "L", milliPerUnit: 1 },
  pcs: { base: "pcs", milliPerUnit: 1000 },
};

export class UnitError extends Error {}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new UnitError(`${label} is not a safe integer: ${value}`);
}

/**
 * Parse a decimal string such as "0.150" into integer thousandths of the
 * base unit of `unit`. Rejects more precision than the base can hold.
 */
export function parseQuantity(decimal: string, unit: InputUnit): { valueMilli: number; unit: BaseUnit } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(decimal.trim());
  if (!match) throw new UnitError(`Not a non-negative decimal: "${decimal}"`);
  const { base, milliPerUnit } = TO_BASE[unit];
  const scaleDigits = Math.round(Math.log10(milliPerUnit));
  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";
  if (fraction.replace(/0+$/, "").length > scaleDigits) {
    throw new UnitError(`"${decimal} ${unit}" is more precise than 1/1000 ${base}`);
  }
  const padded = (fraction + "0".repeat(scaleDigits)).slice(0, scaleDigits);
  const valueMilli = Number(whole) * milliPerUnit + (padded ? Number(padded) : 0);
  assertSafeInteger(valueMilli, "Quantity");
  return { valueMilli, unit: base };
}

/** Convert between compatible units only (kg↔g, L↔ml). Returns integer milli of the target base. */
export function convertToBase(valueMilliOfUnit: number, from: InputUnit, to: BaseUnit): number {
  const source = TO_BASE[from];
  if (source.base !== to) throw new UnitError(`Cannot convert ${from} to ${to} without a conversion rule`);
  const result = (valueMilliOfUnit * source.milliPerUnit) / 1000;
  if (!Number.isInteger(result)) throw new UnitError(`Conversion of ${valueMilliOfUnit}/1000 ${from} is not exact`);
  return result;
}

/** Add quantities that must share a unit. */
export function addSameUnit(a: { valueMilli: number; unit: BaseUnit }, b: { valueMilli: number; unit: BaseUnit }) {
  if (a.unit !== b.unit) throw new UnitError(`Cannot add ${a.unit} and ${b.unit}`);
  return { valueMilli: a.valueMilli + b.valueMilli, unit: a.unit };
}

/** Per-portion quantity × whole portions, exact. */
export function multiplyByPortions(perPortionMilli: number, portions: number): number {
  assertSafeInteger(perPortionMilli, "Per-portion quantity");
  assertSafeInteger(portions, "Portions");
  if (portions < 0) throw new UnitError("Portions cannot be negative");
  const result = perPortionMilli * portions;
  assertSafeInteger(result, "Product");
  return result;
}

/** Display only: 3750 → "3.750". */
export function formatMilli(valueMilli: number): string {
  const sign = valueMilli < 0 ? "-" : "";
  const abs = Math.abs(valueMilli);
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
}

/** Display only: 25500 → "RM255.00". */
export function formatSen(amountSen: number): string {
  const sign = amountSen < 0 ? "-" : "";
  const abs = Math.abs(amountSen);
  return `${sign}RM${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
