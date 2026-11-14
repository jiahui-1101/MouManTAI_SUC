import type { ImpactAssessment } from "../../../types/restaurant";
import { Badge, Notice, Qty, fmtQty } from "./ui";
import type { ImpactState } from "../model";

/**
 * Ingredient coverage and fulfilment are separate facts: having enough chicken
 * for confirmed orders does not prove the kitchen can produce them on time.
 */
export function ConfirmedCoverage({ impact }: { impact: ImpactAssessment }) {
  const deficit = impact.confirmedDeficitKgMilli ?? 0;
  const fulfilment = impact.feasibilityOfConfirmed;
  return (
    <div className="p2-coverage" aria-label="Confirmed order coverage">
      <span>
        Ingredient coverage:{" "}
        {deficit > 0 ? (
          <Badge tone="bad">Deficit {fmtQty(deficit)} kg</Badge>
        ) : (
          <Badge tone="ok">No ingredient deficit</Badge>
        )}
      </span>
      <span>
        Order fulfilment:{" "}
        <Badge tone={fulfilment === "INFEASIBLE" ? "bad" : fulfilment === "UNKNOWN" ? "neutral" : "warn"}>
          {fulfilment === "CONDITIONAL" ? "Conditional — kitchen schedule not verified" : fulfilment === "UNKNOWN" ? "Unknown — no capacity data" : "Breach risk"}
        </Badge>
      </span>
    </div>
  );
}

/** Authoritative only for a verified, current impact. Values come from Stage 1 `assessImpact`. */
export function ImpactPreview({ impact, impactState }: { impact: ImpactAssessment | null; impactState: ImpactState }) {
  if (impactState === "NOT_VERIFIED") {
    return (
      <Notice tone="warn" title="Impact withheld — incident not verified">
        The supplier report has not passed sender/PO verification, so no impact projection is shown.
      </Notice>
    );
  }
  if (impactState === "STALE") {
    return (
      <Notice tone="warn" title="Impact is stale">
        The operational snapshot changed after the last assessment. Re-assess before relying on these numbers.
      </Notice>
    );
  }
  if (impactState === "NOT_ASSESSED" || !impact) {
    return <Notice tone="info" title="Impact not assessed yet">Run the impact assessment on the current snapshot.</Notice>;
  }
  if (!impact.summary) {
    return (
      <Notice tone="bad" title="Impact unknown">
        {impact.reasons.join(" · ")}
      </Notice>
    );
  }
  const s = impact.summary;
  return (
    <div className="p2-impact">
      {impact.status === "BREACH_RISK" && (
        <Notice tone="bad" title="Breach risk on confirmed orders">
          <Qty milli={impact.confirmedDeficitKgMilli ?? 0} /> short for confirmed demand. Orders are not dropped automatically.
        </Notice>
      )}
      <dl className="p2-impact__grid">
        <div className="p2-impact__cell p2-impact__cell--supplier">
          <dt>Supplier PO change</dt>
          <dd><Qty milli={impact.poShortfallKgMilli ?? 0} /></dd>
          <span className="p2-impact__note">Supplier-reported, against the PO</span>
        </div>
        <div className="p2-impact__cell">
          <dt>Physical chicken</dt>
          <dd><Qty milli={s.chickenAvailableKgMilli} /></dd>
          <span className="p2-impact__note">Accepted on-hand, unchanged by message</span>
        </div>
        <div className="p2-impact__cell">
          <dt>Forecast requirement</dt>
          <dd><Qty milli={s.chickenForecastRequirementKgMilli} /></dd>
          <span className="p2-impact__note">{s.chickenForecastPortions} chicken portions</span>
        </div>
        <div className="p2-impact__cell p2-impact__cell--gap">
          <dt>Forecast ingredient gap</dt>
          <dd><Qty milli={s.demandGapKgMilli} /></dd>
          <span className="p2-impact__note">Demand vs physical — not the PO delta</span>
        </div>
        <div className="p2-impact__cell">
          <dt>Affected menu items</dt>
          <dd className="p2-num">{s.affectedMenuIds.length}</dd>
          <span className="p2-impact__note">Unaffected: {impact.unaffectedMenuIds.length} (fries-only)</span>
        </div>
        <div className="p2-impact__cell">
          <dt>Confirmed chicken portions</dt>
          <dd className="p2-num">{s.confirmedChickenPortions}</dd>
          <span className="p2-impact__note">
            Needs <Qty milli={impact.confirmedRequirementKgMilli ?? 0} />, included in forecast
          </span>
        </div>
      </dl>
      <ConfirmedCoverage impact={impact} />
      <p className="p2-fineprint">Demo calculation on synthetic data · snapshot r{impact.snapshotRevision} · {impact.snapshotFingerprint}</p>
    </div>
  );
}
