/**
 * Shared primitive contracts (SUC-SHARED-01 §0.1, §3).
 * Owner: integration lead. Do not redefine in feature code.
 */

export type Channel = "WHATSAPP" | "OUTLOOK" | "TELEGRAM";
export type Provenance = "LIVE_CHANNEL" | "REPLAY_CHANNEL" | "SIMULATED_CHANNEL";
export type SourceKind =
  | Provenance
  | "SYNTHETIC_BUSINESS"
  | "SIMULATED_CALCULATION"
  | "SIMULATED_ACTION"
  | "SIMULATED_EVIDENCE";

export type IncidentKind =
  | "PARTIAL_DELIVERY"
  | "DELAY"
  | "UNAVAILABLE"
  | "QUALITY_REJECTED"
  | "PRICE_CHANGE"
  | "CANCELLED"
  | "SPEC_CHANGE";

export type Feasibility = "FEASIBLE" | "CONDITIONAL" | "INFEASIBLE" | "UNKNOWN";

/** Data-quality label for a critical input (P2 requirements §7.2). */
export type DataQualityStatus = "CURRENT" | "STALE" | "MISSING" | "UNVERIFIED";

/** Base units. Quantities are stored as integer thousandths of the base unit. */
export type BaseUnit = "kg" | "L" | "pcs";

/** Integer sen. 25500 = RM255.00. */
export interface Money {
  amountMinor: number;
  currency: "MYR";
}

/** Integer thousandths of `unit`: 10000 kg-milli = 10.000 kg = 10,000 g. */
export interface Quantity {
  valueMilli: number;
  unit: BaseUnit;
}

/** Local business time "HH:MM" in the tenant timezone (Asia/Kuala_Lumpur). */
export type LocalTime = string;
