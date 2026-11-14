import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, ClipboardCheck, Package, PackageX, ShieldAlert, Target, Truck, UtensilsCrossed, Warehouse, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { HP_BUSINESS, HP_IDS } from "../../data/fixtures/happyPotato";
import chickenPopcorn from "../../assets/menu/chicken-popcorn.jpg";
import chickenTenders from "../../assets/menu/chicken-tenders.jpg";
import happyCombo from "../../assets/menu/happy-combo.jpg";
import flavouredFries from "../../assets/menu/flavoured-fries.jpg";
import { assessImpactAction, useRestaurantStore } from "../../services/mock/restaurantStore";
import { isImpactStale, selectCurrentImpact } from "../../services/mock/restaurantState";
import { verifySnapshotFreshness } from "../../features/impact/calculations";
import {
  isVerified,
  menuSummary,
  overviewActions,
  overviewCounts,
  primaryIncident,
  readinessRows,
  supplierName,
  type Metric,
} from "../../features/incidents/model";
import { ActivityList } from "../../features/incidents/components/ActivityList";
import { DemoControls } from "../../features/incidents/components/DemoControls";
import { NextActions } from "../../features/incidents/components/NextActions";
import { P2ErrorBoundary } from "../../features/incidents/components/P2ErrorBoundary";
import { Badge, Card, EmptyState, Notice, Qty, StatusBadge, fmtQty } from "../../features/incidents/components/ui";
import "../../features/incidents/p2.css";

export function OverviewPage() {
  return (
    <PageContainer title={titleFor("/overview")} actions={<DemoControls />}>
      <P2ErrorBoundary label="Operations overview">
        <OverviewContent />
      </P2ErrorBoundary>
    </PageContainer>
  );
}

function OverviewContent() {
  const { restaurant, activity } = useRestaurantStore();
  const snapshot = restaurant.snapshot;
  const incident = primaryIncident(restaurant);
  const counts = overviewCounts(restaurant);
  const freshness = verifySnapshotFreshness(snapshot);
  const stale = incident ? isImpactStale(restaurant, incident.id) : false;
  const impact = incident ? selectCurrentImpact(restaurant, incident.id) : null;
  const incidentLink = incident ? `/incidents?incident=${incident.id}` : "/incidents";
  const queue = overviewActions(restaurant, incident, assessImpactAction);
  // Severity of the queue: red only when confirmed orders are actually at risk.
  // Computed live from stock vs confirmed demand, so it updates without re-assessing.
  const incidentRow = incident ? readinessRows(restaurant).find((r) => r.ingredientId === incident.ingredientId) : undefined;
  const unverified = !!incident && (incident.status === "DETECTED" || incident.status === "PENDING_VERIFICATION");
  const urgency: "critical" | "high" | "low" | null = !queue.length
    ? null
    : unverified
      ? "low"
      : impact?.status === "BREACH_RISK" || (incidentRow && !incidentRow.confirmedCovered)
        ? "critical"
        : "high";
  const URGENCY_LABEL = { critical: "Urgent action", high: "Action required", low: "Review needed" } as const;
  const claimFor = (poId: string) => snapshot.supplierClaims.find((c) => c.poId === poId);

  return (
    <div className="p2">
      {freshness.status === "STALE" && <Notice tone="bad" title="Snapshot integrity warning">{freshness.reasons.join(" · ")}</Notice>}
      {stale && (
        <Notice tone="warn" title="Impact is stale">
          The snapshot changed to revision {snapshot.revision} after the last assessment. Figures below are withheld until re-assessed.
        </Notice>
      )}

      <div className="p2-kpis">
        <Kpi icon={<ShieldAlert size={18} />} label="Active supply incidents" metric={counts.activeIncidents} to="/incidents" />
        <Kpi icon={<AlertTriangle size={18} />} label="Confirmed orders at risk" metric={counts.confirmedOrdersAtRisk} to={incidentLink} />
        <Kpi icon={<UtensilsCrossed size={18} />} label="Affected menu items" metric={counts.affectedMenuItems} to="/impact" />
        <Kpi icon={<ClipboardCheck size={18} />} label="Pending recovery approvals" metric={counts.pendingApprovals} to="/approvals" />
        <Kpi icon={<Target size={18} />} label="Awaiting outcome evidence" metric={counts.awaitingEvidence} to="/outcomes" />
      </div>

      <div className="p2-grid">
        <div className="p2-grid__main">
          <Card title="Critical supply disruption" actions={incident ? <StatusBadge status={incident.status} /> : undefined}>
            {incident ? (
              <DisruptionPanel
                incident={incident}
                link={incidentLink}
                po={snapshot.purchaseOrders.find((p) => p.id === incident.poId)}
                claim={claimFor(incident.poId)}
                ready={readinessRows(restaurant).find((r) => r.ingredientId === incident.ingredientId)}
              />
            ) : (
              <EmptyState title="No supplier disruption reported">
                <p>The canonical PO <span className="p2-mono">HP-PO-1042</span> (20 kg chilled chicken, due {HP_BUSINESS.poDueLocal}) is open. Incidents appear here once a supplier message is received.</p>
              </EmptyState>
            )}
          </Card>

          <Card title="Operational readiness" actions={<span className="p2-fineprint">Projected to {HP_BUSINESS.prepCutoffLocal} prep cutoff</span>}>
            <Readiness />
          </Card>

          <Card title="Menu" actions={<Link to="/impact" className="p2-link">Impact Explorer</Link>}>
            <MenuCards />
          </Card>
        </div>

        <aside className="p2-grid__side">
          <Card
            title="Action queue"
            className={`p2-card--queue${urgency ? ` p2-card--attention p2-card--${urgency}` : ""}`}
            actions={urgency
              ? <span className={`p2-attn-badge p2-attn-badge--${urgency}`}><span className="p2-attn-badge__dot" aria-hidden="true" />{URGENCY_LABEL[urgency]}</span>
              : <Badge tone="ok">All clear</Badge>}
          >
            {impact?.status === "BREACH_RISK" && (
              <div className="p2-queue__alert" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <span className="p2-queue__alert-title">Confirmed demand exceeds eligible chicken</span>
                  <span className="p2-queue__alert-desc">Escalate before accepting new chicken orders.</span>
                </span>
              </div>
            )}
            {queue.length > 0 && <p className="p2-queue__intro">Choose a recovery plan for the supply disruption.</p>}
            <NextActions variant="queue" actions={queue} />
          </Card>
          <Card title="Recent incident activity">
            <ActivityList muted events={activity.slice(-8)} emptyText="No activity in this session yet." />
          </Card>
        </aside>
      </div>
    </div>
  );
}

type Incident = NonNullable<ReturnType<typeof primaryIncident>>;
type Snapshot = ReturnType<typeof useRestaurantStore>["restaurant"]["snapshot"];
type DisKey = "po" | "claim" | "short" | "stock";

function DisruptionPanel({ incident, link, po, claim, ready }: {
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

function Kpi({ icon, label, metric, to }: { icon: ReactNode; label: string; metric: Metric; to: string }) {
  return (
    <Link to={to} className={`p2-kpi p2-kpi--${metric.kind}`}>
      <svg className="p2-kpi__wave" viewBox="0 0 240 18" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0H240V8C193 1 151 17 106 13C63 9 27 3 0 9Z" />
        <path d="M0 9C27 3 63 9 106 13C151 17 193 1 240 8" />
      </svg>
      <span className="p2-kpi__icon" aria-hidden="true">{icon}</span>
      <span className="p2-kpi__label">{label}</span>
      <span className="p2-kpi__value">
        {metric.kind === "value" || metric.kind === "conditional" ? metric.value : metric.kind === "pending" ? "Pending" : "—"}
        {metric.kind === "conditional" && <span className="p2-kpi__qual">{metric.qualifier}</span>}
      </span>
      <span className="p2-kpi__note">{metric.note}</span>
    </Link>
  );
}

type ReadyTone = "bad" | "warn" | "ok";
const readyTone = (r: ReadinessRow): ReadyTone => (r.projectedGapMilli > 0 ? "bad" : r.eligibleMilli < r.forecastMilli ? "warn" : "ok");
const TONE_STATUS: Record<ReadyTone, string> = { bad: "disrupted", warn: "affected", ok: "unaffected" };

function ReadyBadge({ r }: { r: ReadinessRow }) {
  const tone = readyTone(r);
  return tone === "bad" ? <Badge tone="bad">Gap <Qty milli={r.projectedGapMilli} unit={r.unit} /></Badge> : tone === "warn" ? <Badge tone="warn">Depends on delivery</Badge> : <Badge tone="ok">Covered</Badge>;
}

function Readiness() {
  const { restaurant } = useRestaurantStore();
  const rows = readinessRows(restaurant);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.ingredientId === openId) ?? null;
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  return (
    <div className="p2-readiness">
      <div className={`p2-ready__stage${open ? " p2-ready__stage--open" : ""}`}>
        <div className="p2-ready__grid">
          {rows.map((r) => (
            <div key={r.ingredientId} className={`p2-ready p2-ready--clickable${r.ingredientId === openId ? " p2-ready--selected" : ""}`} role="button" tabIndex={0}
              aria-pressed={r.ingredientId === openId} aria-label={`Show details for ${r.name}`} onClick={() => toggle(r.ingredientId)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.ingredientId); } }}>
              <div className="p2-ready__head">
                <span className="p2-ready__name">{r.name}</span>
                <ReadyBadge r={r} />
              </div>
              <div className="p2-ready__body">
                <CoverageRing eligible={r.eligibleMilli} incoming={r.plannedIncomingMilli} forecast={r.forecastMilli} />
                <SupplyNeedChart r={r} />
              </div>
              {r.hasSupplierClaim && <p className="p2-fineprint">Supplier claims today's delivery will not arrive; the PO is no longer counted as incoming.</p>}
              {!r.confirmedCovered && <p className="p2-fineprint p2-fineprint--bad">Physical stock does not cover confirmed demand.</p>}
            </div>
          ))}
        </div>
        {open && <ReadinessDetail r={open} onClose={() => setOpenId(null)} />}
      </div>
      <p className="p2-legend">
        <span className="p2-legend__item"><span className="p2-legend__key p2-legend__key--stock" /> Physical eligible</span>
        <span className="p2-legend__item"><span className="p2-legend__key p2-legend__key--incoming" /> Planned PO (not stock)</span>
        <span className="p2-legend__item"><span className="p2-legend__key p2-legend__key--confirmed" /> Confirmed need</span>
        <span className="p2-legend__item"><span className="p2-legend__key p2-legend__key--forecastfill" /> Remaining forecast</span>
        <span className="p2-ready__hint">Click an ingredient for details</span>
      </p>
    </div>
  );
}

type ReadinessRow = ReturnType<typeof readinessRows>[number];

function ReadinessDetail({ r, onClose }: { r: ReadinessRow; onClose: () => void }) {
  const { restaurant } = useRestaurantStore();
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // On narrow screens the panel stacks below the cards, so bring it into view.
    if (window.matchMedia?.("(max-width: 900px)").matches) panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [r.ingredientId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const reserved = Math.max(r.physicalMilli - r.eligibleMilli, 0);
  const supply = r.eligibleMilli + r.plannedIncomingMilli;
  const restForecast = Math.max(r.forecastMilli - r.confirmedMilli, 0);
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
  const menus = menuSummary(restaurant, r.ingredientId).filter((m) => m.dependency === "AFFECTED");
  const buffer = r.eligibleMilli - r.confirmedMilli;
  const status = TONE_STATUS[readyTone(r)];
  return (
    <section ref={panelRef} className="p2-node-detail p2-ready__detail" aria-live="polite" aria-label={`Details for ${r.name}`}>
      <header className="p2-node-detail__head">
        <span className={`p2-node-detail__icon p2-node-detail__icon--${status}`}><Package size={20} aria-hidden={true} /></span>
        <div className="p2-node-detail__name">
          <h3 className="p2-node-detail__title">{r.name}</h3>
          <p className="p2-eyebrow">Ingredient · {HP_BUSINESS.prepCutoffLocal} cutoff</p>
        </div>
        <button type="button" className="p2-icon-btn" onClick={onClose} aria-label="Close ingredient details"><X size={16} aria-hidden="true" /></button>
      </header>
      <ReadyBadge r={r} />
      <dl className="p2-tiles">
        <div className="p2-tile"><dt>Stock covers forecast</dt><dd>{pct(r.eligibleMilli, r.forecastMilli)}</dd></div>
        <div className="p2-tile"><dt>Stock + PO covers</dt><dd>{pct(supply, r.forecastMilli)}</dd></div>
        <div className="p2-tile"><dt>Eligible stock</dt><dd><Qty milli={r.eligibleMilli} unit={r.unit} /></dd></div>
        <div className="p2-tile"><dt>Forecast need</dt><dd><Qty milli={r.forecastMilli} unit={r.unit} /></dd></div>
      </dl>
      <div className="p2-node-detail__links">
        <div>
          <p className="p2-section__title">Supply</p>
          <dl className="p2-mini">
            <div><dt>Physical on hand</dt><dd><Qty milli={r.physicalMilli} unit={r.unit} /></dd></div>
            <div><dt>Reserved / ineligible</dt><dd><Qty milli={reserved} unit={r.unit} /></dd></div>
            <div><dt>Planned PO incoming</dt><dd><Qty milli={r.plannedIncomingMilli} unit={r.unit} /></dd></div>
            {r.hasSupplierClaim && <div><dt>Supplier-claimed delivery</dt><dd><Qty milli={r.claimedIncomingMilli} unit={r.unit} /></dd></div>}
            <div><dt>Total projected supply</dt><dd className="p2-strong"><Qty milli={supply} unit={r.unit} /></dd></div>
          </dl>
        </div>
        <div>
          <p className="p2-section__title">Need</p>
          <dl className="p2-mini">
            <div><dt>Confirmed orders</dt><dd><Qty milli={r.confirmedMilli} unit={r.unit} /></dd></div>
            <div><dt>Remaining forecast</dt><dd><Qty milli={restForecast} unit={r.unit} /></dd></div>
            <div><dt>Buffer vs confirmed</dt><dd className={buffer < 0 ? "p2-neg" : "p2-pos"}>{buffer < 0 ? "−" : "+"}<Qty milli={Math.abs(buffer)} unit={r.unit} /></dd></div>
            <div><dt>Projected gap</dt><dd className={r.projectedGapMilli > 0 ? "p2-neg" : "p2-pos"}><Qty milli={r.projectedGapMilli} unit={r.unit} /></dd></div>
          </dl>
        </div>
        <div>
          <p className="p2-section__title">Feeds ({menus.length})</p>
          {menus.length ? (
            <ul>
              {menus.map((m) => (
                <li key={m.menuId}>
                  <i className={`p2-dot p2-dot--${status}`} />
                  <span className="p2-strong">{m.name}</span>
                  <span className="p2-muted">{m.confirmed} confirmed · {m.forecast} forecast</span>
                </li>
              ))}
            </ul>
          ) : <p className="p2-muted">No menu items depend on this</p>}
        </div>
      </div>
      {r.hasSupplierClaim && <p className="p2-fineprint">Supplier claims today's delivery will not arrive; the PO is no longer counted as incoming.</p>}
      {!r.confirmedCovered && <p className="p2-fineprint p2-fineprint--bad">Eligible stock does not cover confirmed orders.</p>}
      {r.projectedGapMilli === 0 && r.eligibleMilli < r.forecastMilli && <p className="p2-fineprint">Forecast is only covered if the planned PO arrives before cutoff.</p>}
    </section>
  );
}

/** Donut: share of forecast need covered by physical stock, plus planned PO on top. */
function CoverageRing({ eligible, incoming, forecast }: { eligible: number; incoming: number; forecast: number }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const need = Math.max(forecast, 1);
  const stockPct = Math.min(eligible / need, 1);
  const poPct = Math.min(incoming / need, 1 - stockPct);
  const pct = Math.round((eligible / need) * 100);
  return (
    <figure className="p2-ring" aria-label={`Physical stock covers ${pct}% of forecast need`}>
      <svg viewBox="0 0 110 110" role="img">
        <circle cx="55" cy="55" r={R} className="p2-ring__track" />
        <circle cx="55" cy="55" r={R} className="p2-ring__po" strokeDasharray={`${poPct * C} ${C}`} strokeDashoffset={-stockPct * C} transform="rotate(-90 55 55)" />
        <circle cx="55" cy="55" r={R} className="p2-ring__stock" strokeDasharray={`${stockPct * C} ${C}`} transform="rotate(-90 55 55)" />
        <text x="55" y="55" className="p2-ring__pct">{Math.min(pct, 999)}%</text>
        <text x="55" y="71" className="p2-ring__sub">in stock</text>
      </svg>
      <figcaption><span className="p2-ring__cap-extra">In stock · </span>of forecast need</figcaption>
    </figure>
  );
}

/** Two stacked columns on a shared kg axis: what we have vs what we need. */
function SupplyNeedChart({ r }: { r: ReadinessRow }) {
  const W = 260, H = 170, top = 14, bottom = 26, left = 30;
  const plotH = H - top - bottom;
  const max = Math.max(r.eligibleMilli + r.plannedIncomingMilli, r.forecastMilli, r.confirmedMilli, 1);
  const step = niceStep(max / 1000);
  const axisMax = Math.ceil(max / 1000 / step) * step * 1000;
  const y = (v: number) => top + plotH - (v / axisMax) * plotH;
  const h = (v: number) => (v / axisMax) * plotH;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax / 1000 + 1e-9; t += step) ticks.push(t);
  const colW = 70;
  const sx = left + 30, nx = left + 30 + colW + 40;
  const restForecast = Math.max(r.forecastMilli - r.confirmedMilli, 0);
  const label = (v: number) => `${fmtQty(v)}`;
  return (
    <svg className="p2-sn" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${r.name}: supply ${fmtQty(r.eligibleMilli)} ${r.unit} in stock plus ${fmtQty(r.plannedIncomingMilli)} ${r.unit} planned PO; need ${fmtQty(r.confirmedMilli)} ${r.unit} confirmed of ${fmtQty(r.forecastMilli)} ${r.unit} forecast`}>
      <defs>
        <pattern id={`hatch-${r.ingredientId}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="p2-sn__hatchbg" />
          <rect width="3" height="6" className="p2-sn__hatch" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - 4} y1={y(t * 1000)} y2={y(t * 1000)} className="p2-sn__grid" />
          <text x={left - 6} y={y(t * 1000)} className="p2-sn__tick">{t}</text>
        </g>
      ))}
      {/* supply */}
      <rect x={sx} y={y(r.eligibleMilli)} width={colW} height={h(r.eligibleMilli)} className="p2-sn__stock" rx="3" />
      {r.plannedIncomingMilli > 0 && (
        <rect x={sx} y={y(r.eligibleMilli + r.plannedIncomingMilli)} width={colW} height={h(r.plannedIncomingMilli)} fill={`url(#hatch-${r.ingredientId})`} rx="3" />
      )}
      {h(r.eligibleMilli) > 14 && <text x={sx + colW / 2} y={y(r.eligibleMilli / 2)} className="p2-sn__in">{label(r.eligibleMilli)}</text>}
      {h(r.plannedIncomingMilli) > 14 && <text x={sx + colW / 2} y={y(r.eligibleMilli + r.plannedIncomingMilli / 2)} className="p2-sn__in p2-sn__in--dark">+{label(r.plannedIncomingMilli)}</text>}
      {/* need */}
      <rect x={nx} y={y(r.confirmedMilli)} width={colW} height={h(r.confirmedMilli)} className="p2-sn__confirmed" rx="3" />
      {restForecast > 0 && <rect x={nx} y={y(r.forecastMilli)} width={colW} height={h(restForecast)} className="p2-sn__forecast" rx="3" />}
      {h(r.confirmedMilli) > 14 && <text x={nx + colW / 2} y={y(r.confirmedMilli / 2)} className="p2-sn__in">{label(r.confirmedMilli)}</text>}
      {h(restForecast) > 14 && <text x={nx + colW / 2} y={y(r.confirmedMilli + restForecast / 2)} className="p2-sn__in p2-sn__in--dark">+{label(restForecast)}</text>}
      {/* totals */}
      <text x={sx + colW / 2} y={y(r.eligibleMilli + r.plannedIncomingMilli) - 4} className="p2-sn__total">{label(r.eligibleMilli + r.plannedIncomingMilli)} {r.unit}</text>
      <text x={nx + colW / 2} y={y(r.forecastMilli) - 4} className="p2-sn__total">{label(r.forecastMilli)} {r.unit}</text>
      {/* forecast reference line across both columns */}
      <line x1={sx - 6} x2={nx + colW + 6} y1={y(r.forecastMilli)} y2={y(r.forecastMilli)} className="p2-sn__ref" />
      <text x={sx + colW / 2} y={H - 8} className="p2-sn__cat">Supply</text>
      <text x={nx + colW / 2} y={H - 8} className="p2-sn__cat">Need</text>
    </svg>
  );
}

function niceStep(maxKg: number) {
  const raw = maxKg / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 0.001)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const MENU_PHOTOS:Partial<Record<string, string>> = {
  [HP_IDS.menu.chickenPopcorn]: chickenPopcorn,
  [HP_IDS.menu.chickenTenders]: chickenTenders,
  [HP_IDS.menu.happyCombo]: happyCombo,
  [HP_IDS.menu.fries]: flavouredFries,
};

const MENU_FILTERS = [
  ["ALL", "All"],
  ["AFFECTED", "Affected"],
  ["UNAFFECTED", "Unaffected"],
] as const;

function MenuCards() {
  const { restaurant } = useRestaurantStore();
  const menus = menuSummary(restaurant);
  const [filter, setFilter] = useState<(typeof MENU_FILTERS)[number][0]>("ALL");
  const visibleMenus = menus.filter((menu) => filter === "ALL" || menu.dependency === filter);

  return (
    <>
      <div className="p2-menu__toolbar">
        <div className="p2-menu__filters" role="group" aria-label="Filter menu by chicken impact">
          {MENU_FILTERS.map(([value, label]) => (
            <button key={value} type="button" className="p2-btn p2-btn--sm" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <p className="p2-muted" role="status">{visibleMenus.length} of {menus.length} items</p>
      </div>
      {visibleMenus.length === 0 ? <EmptyState title="No menu items match this filter" /> : (
        <ul className="p2-menus">
          {visibleMenus.map((m) => {
            const photo = MENU_PHOTOS[m.menuId];
            return (
              <li key={m.menuId}>
                <Link to="/impact" className="p2-menu" aria-label={`${m.name}: ${m.dependency === "AFFECTED" ? "uses chilled chicken" : m.dependency === "UNAFFECTED" ? "unaffected" : "unknown BOM"}`}>
                  <div className="p2-menu__photo">
                    {photo && <img src={photo} alt="" width={768} height={512} loading="lazy" />}
                  </div>
                  <div className="p2-menu__body">
                    <h3 className="p2-menu__name">{m.name}</h3>
                    <div className="p2-menu__dep">
                      {m.dependency === "AFFECTED" ? <Badge tone="warn">Affected</Badge> : m.dependency === "UNAFFECTED" ? <Badge tone="ok">Unaffected</Badge> : <Badge tone="bad">Recipe unknown</Badge>}
                    </div>
                    <dl className="p2-menu__stats">
                      <div className="p2-menu__row"><dt>Forecast portions</dt><dd className="p2-num">{m.forecast}</dd></div>
                      <div className="p2-menu__row"><dt>Confirmed portions</dt><dd className="p2-num">{m.confirmed}</dd></div>
                      <div className="p2-menu__row"><dt>Chicken per portion</dt><dd>{m.chickenPerPortionMilli ? <Qty milli={m.chickenPerPortionMilli} /> : "—"}</dd></div>
                    </dl>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
