import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, PackageX, Truck, Warehouse, X } from "lucide-react";
import { HP_BUSINESS } from "../../../data/fixtures/happyPotato";
import type { useRestaurantStore } from "../../../services/mock/restaurantStore";
import { isVerified, primaryIncident, readinessRows, supplierName } from "../model";
import { Qty, StatusBadge, fmtQty } from "./ui";

type ReadinessRow = ReturnType<typeof readinessRows>[number];

type Incident = NonNullable<ReturnType<typeof primaryIncident>>;
type Snapshot = ReturnType<typeof useRestaurantStore>["restaurant"]["snapshot"];
type DisKey = "po" | "claim" | "short" | "stock";

export function DisruptionPanel({ incident, link, po, claim, ready }: {
  incident: Incident;
  link: string;
  po: Snapshot["purchaseOrders"][number] | undefined;
  claim: Snapshot["supplierClaims"][number] | undefined;
  ready: ReadinessRow | undefined;
}) {
  const [openKey, setOpenKey] = useState<DisKey | null>(null);
  const expected = po?.expectedKgMilli ?? 0;
  const claimed = claim ? claim.claimedDeliveryTodayKgMilli : null;
  const shortfall = incident.claimedShortfallKgMilli;
  const onHand = ready?.physicalMilli ?? 0;
  const forecast = ready?.forecastMilli ?? 0;
  const ingredient = ready?.name ?? "Chilled chicken";
  const due = po?.dueTimeLocal ?? HP_BUSINESS.poDueLocal;
  const frac = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(a / b, 1)) : 0);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const tiles: Array<{ key: DisKey; icon: ReactNode; label: string; value: number | null; sub: ReactNode; meter: number | null; alert?: boolean }> = [
    { key: "po", icon: <Truck size={15} />, label: "PO expected", value: expected, sub: `Due ${due}`, meter: 1 },
    { key: "claim", icon: <PackageX size={15} />, label: "Claimed today", value: claimed, sub: claimed === null ? "Not applied yet" : `${pct(claimed, expected)}% of PO`, meter: claimed === null ? null : frac(claimed, expected) },
    { key: "short", icon: <AlertTriangle size={15} />, label: "PO shortage", value: shortfall, sub: `${pct(shortfall, expected)}% of the order`, meter: frac(shortfall, expected), alert: shortfall > 0 },
    { key: "stock", icon: <Warehouse size={15} />, label: "On-hand stock", value: onHand, sub: forecast > 0 ? `Covers ${pct(onHand, forecast)}% of forecast` : "Physical count", meter: frac(onHand, forecast) },
  ];
  const toggle = (k: DisKey) => setOpenKey((cur) => (cur === k ? null : k));
  const open = tiles.find((t) => t.key === openKey) ?? null;

  return (
    <div className="p2-dis">
      <div className="p2-dis__head">
        <div className="p2-dis__titles">
          <span className="p2-dis__id"><span className="p2-dis__id-label">Incident</span><span className="p2-mono">{incident.id}</span></span>
        </div>
        <Link to={link} className="p2-link p2-dis__open">Open incident <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>

      <div className="p2-dis__delivery" aria-label={`Today's delivery: ${claimed === null ? "claim not applied" : `${fmtQty(claimed)} of ${fmtQty(expected)} kg arriving`}, ${fmtQty(shortfall)} kg short`}>
        <div className="p2-dis__delivery-row">
          <span className="p2-dis__delivery-label">Today's delivery</span>
          <span className="p2-dis__delivery-val">
            {claimed === null ? "Claim not applied yet" : <><Qty milli={claimed} /> of <Qty milli={expected} /> arriving</>}
          </span>
          <span className="p2-dis__delivery-short"><Qty milli={shortfall} /> short</span>
        </div>
      </div>

      <div className={`p2-ready__stage${open ? " p2-ready__stage--open" : ""}`}>
        <div className="p2-dis__tiles">
          {tiles.map((t) => (
            <div key={t.key} role="button" tabIndex={0} aria-pressed={t.key === openKey} aria-label={`Show details: ${t.label}`}
              className={`p2-ready p2-ready--clickable p2-dtile${t.alert ? " p2-dtile--alert" : ""}${t.key === openKey ? " p2-ready--selected" : ""}`}
              onClick={() => toggle(t.key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(t.key); } }}>
              <span className="p2-dtile__label">{t.icon}{t.label}</span>
              <span className="p2-dtile__value">{t.value === null ? "—" : <Qty milli={t.value} />}</span>
              <span className="p2-dtile__meter" aria-hidden="true">
                {t.meter !== null && <span style={{ width: `${Math.max(t.meter * 100, t.meter > 0 ? 4 : 0)}%` }} />}
              </span>
              <span className="p2-dtile__sub">{t.sub}</span>
            </div>
          ))}
        </div>
        {open && (
          <DisruptionDetail title={open.label} icon={open.icon} alert={open.alert} link={link} onClose={() => setOpenKey(null)}>
            {open.key === "po" && (
              <dl className="p2-mini">
                <div><dt>Purchase order</dt><dd className="p2-mono">{incident.poId}</dd></div>
                <div><dt>Supplier</dt><dd>{supplierName(incident.supplierId)}</dd></div>
                <div><dt>Ingredient</dt><dd>{ingredient}</dd></div>
                <div><dt>Expected quantity</dt><dd><Qty milli={expected} /></dd></div>
                <div><dt>Due</dt><dd>{due}</dd></div>
                <div><dt>Received so far</dt><dd><Qty milli={0} /></dd></div>
              </dl>
            )}
            {open.key === "claim" && (
              <>
                <dl className="p2-mini">
                  <div><dt>Claimed delivery today</dt><dd>{claimed === null ? "—" : <Qty milli={claimed} />}</dd></div>
                  <div><dt>Expected (PO)</dt><dd><Qty milli={expected} /></dd></div>
                  <div><dt>Claim status</dt><dd>{claimed === null ? "Not applied" : "Applied to snapshot"}</dd></div>
                  <div><dt>Incident status</dt><dd><StatusBadge status={incident.status} /></dd></div>
                </dl>
                <p className="p2-fineprint">Comes from the supplier's message. It does not prove receipt or change stock.</p>
              </>
            )}
            {open.key === "short" && (
              <>
                <dl className="p2-mini">
                  <div><dt>Reported shortage</dt><dd className="p2-dis__neg"><Qty milli={shortfall} /></dd></div>
                  <div><dt>Share of order</dt><dd>{pct(shortfall, expected)}%</dd></div>
                  <div><dt>Forecast need</dt><dd><Qty milli={forecast} /></dd></div>
                  <div><dt>Eligible stock</dt><dd><Qty milli={ready?.eligibleMilli ?? 0} /></dd></div>
                  <div><dt>Projected gap</dt><dd><Qty milli={ready?.projectedGapMilli ?? 0} /></dd></div>
                </dl>
                <p className="p2-fineprint">{isVerified(incident.status) ? "Verified shortage." : "Not yet verified; treat as reported only."}</p>
              </>
            )}
            {open.key === "stock" && (
              <>
                <dl className="p2-mini">
                  <div><dt>Physical on hand</dt><dd><Qty milli={onHand} /></dd></div>
                  <div><dt>Eligible after reservations</dt><dd><Qty milli={ready?.eligibleMilli ?? 0} /></dd></div>
                  <div><dt>Received from this PO</dt><dd><Qty milli={0} /></dd></div>
                  <div><dt>Forecast need</dt><dd><Qty milli={forecast} /></dd></div>
                  <div><dt>Confirmed need</dt><dd><Qty milli={ready?.confirmedMilli ?? 0} /></dd></div>
                </dl>
                <p className="p2-fineprint">Physical stock is what is actually on hand, independent of supplier messages.</p>
              </>
            )}
          </DisruptionDetail>
        )}
      </div>
    </div>
  );
}

function DisruptionDetail({ title, icon, alert, link, onClose, children }: { title: string; icon: ReactNode; alert?: boolean; link: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 900px)").matches) panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [title]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <section ref={panelRef} className="p2-node-detail p2-ready__detail" aria-live="polite" aria-label={`Details for ${title}`}>
      <header className="p2-node-detail__head">
        <span className={`p2-node-detail__icon p2-node-detail__icon--${alert ? "disrupted" : "unknown"}`}>{icon}</span>
        <div className="p2-node-detail__name">
          <h3 className="p2-node-detail__title">{title}</h3>
          <p className="p2-eyebrow">Supply disruption</p>
        </div>
        <button type="button" className="p2-icon-btn" onClick={onClose} aria-label="Close details"><X size={16} aria-hidden="true" /></button>
      </header>
      {children}
      <Link to={link} className="p2-link p2-dis__open">Open incident <ChevronRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}
