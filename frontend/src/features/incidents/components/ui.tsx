/** Small P2 presentation primitives. Candidates for components/ui/ after team review. */
import type { ReactNode } from "react";
import type { IncidentStatus } from "../../../types/restaurant";
import { formatMilli } from "../../../utils/quantity";
import { STATUS_LABEL, type Severity } from "../model";
import "../p2.css";
import "../../impact/p2-impact.css";

/** 20000 → "20", 8750 → "8.75", 150 → "0.15". Display only. */
export function fmtQty(valueMilli: number): string {
  return formatMilli(valueMilli).replace(/\.?0+$/, "");
}

export function Qty({ milli, unit = "kg" }: { milli: number; unit?: string }) {
  return (
    <span className="p2-num">
      {fmtQty(milli)}
      <span className="p2-unit">{unit}</span>
    </span>
  );
}

type Tone = "neutral" | "info" | "ok" | "warn" | "bad" | "sim" | "live";

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`p2-badge p2-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<IncidentStatus, Tone> = {
  DETECTED: "warn",
  PENDING_VERIFICATION: "warn",
  VERIFIED: "info",
  IMPACT_ASSESSED: "info",
  SCENARIOS_READY: "info",
  PENDING_APPROVAL: "warn",
  APPROVED: "info",
  EXECUTING: "info",
  AWAITING_EVIDENCE: "warn",
  CLOSED: "neutral",
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const SEVERITY_TONE: Record<Severity, Tone> = { CRITICAL: "bad", HIGH: "warn", MEDIUM: "info", UNASSESSED: "neutral" };
const SEVERITY_LABEL: Record<Severity, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", UNASSESSED: "Unassessed" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} title="Severity rubric: Critical = confirmed-order deficit; High = forecast gap on affected menus; Medium = assessed without gap; Unassessed = no current impact">
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

export function SyntheticTag() {
  return (
    <Badge tone="neutral" title="All restaurant operating data is fictional demo data">
      Synthetic data
    </Badge>
  );
}

export function SimulatedTag({ children = "Simulated" }: { children?: ReactNode }) {
  return <Badge tone="sim">{children}</Badge>;
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`p2-card ${className}`}>
      {(title || actions) && (
        <header className="p2-card__head">
          {title && <h2 className="p2-card__title">{title}</h2>}
          {actions && <div className="p2-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Notice({ tone, title, children }: { tone: "warn" | "info" | "bad"; title: string; children?: ReactNode }) {
  return (
    <div className={`p2-notice p2-notice--${tone}`} role={tone === "bad" ? "alert" : "status"}>
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="p2-empty">
      <p className="p2-empty__title">{title}</p>
      {children && <div className="p2-empty__body">{children}</div>}
    </div>
  );
}
