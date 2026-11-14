import type { ReactNode } from "react";
import { calculatePlanB } from "./planB";
import { preview } from "./preview";
import "./recovery.css";

export const demoPlan = calculatePlanB(preview);
export const kg = (grams: number) => (grams / 1000).toFixed(2) + " kg";
export const time = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  return (hour % 12 || 12) + ":" + String(minutes % 60).padStart(2, "0") + (hour < 12 ? " AM" : " PM");
};

export function Metrics({ items }: { items: [string, ReactNode, string][] }) {
  return <dl className="p4-metrics">{items.map(([label, value, note]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd><small>{note}</small></div>,
  )}</dl>;
}

export function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return <div className="p4-scroll" tabIndex={0} role="region" aria-label={caption}>
    <table><caption>{caption}</caption><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}

export function Pending({ status }: { status: "PENDING" | "STALE" | "UNKNOWN" }) {
  const messages = {
    PENDING: "Waiting for a verified supplier incident and stock snapshot.",
    STALE: "The input snapshot changed. Reassess the impact to calculate a current proposal.",
    UNKNOWN: "Accepted stock quantity is unknown. Confirm physical stock before planning.",
  };
  return <p className="p4-alert" role="status">{messages[status]}</p>;
}
