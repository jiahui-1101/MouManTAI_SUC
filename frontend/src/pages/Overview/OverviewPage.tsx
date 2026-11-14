import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, ClipboardCheck, ShieldAlert, Target, UtensilsCrossed } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { HP_BUSINESS, HP_IDS } from "../../data/fixtures/happyPotato";
import chickenPopcorn from "../../assets/menu/chicken-popcorn.jpg";
import chickenTenders from "../../assets/menu/chicken-tenders.jpg";
import happyCombo from "../../assets/menu/happy-combo.jpg";
import flavouredFries from "../../assets/menu/flavoured-fries.jpg";
import { useRestaurantStore } from "../../services/mock/restaurantStore";
import { isImpactStale, selectCurrentImpact } from "../../services/mock/restaurantState";
import { verifySnapshotFreshness } from "../../features/impact/calculations";
import {
  INCIDENT_TYPE_LABEL,
  menuSummary,
  nextActions,
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
          <Card title="Critical supply disruption">
            {incident ? (
              <Link to={incidentLink} className="p2-disruption" aria-label={`Open incident ${incident.id}`}>
                <div className="p2-disruption__top">
                  <div>
                    <p className="p2-eyebrow">{INCIDENT_TYPE_LABEL[incident.type]} · Chilled chicken</p>
                    <p className="p2-disruption__id">{incident.id}</p>
                    <p className="p2-muted">{supplierName(incident.supplierId)} · PO <span className="p2-mono">{incident.poId}</span></p>
                  </div>
                  <StatusBadge status={incident.status} />
                </div>
                <div className="p2-split">
                  <div className="p2-split__col">
                    <p className="p2-split__label"><Badge tone="warn">Supplier claim</Badge></p>
                    <dl className="p2-mini">
                      <div><dt>Expected (PO)</dt><dd><Qty milli={snapshot.purchaseOrders.find((p) => p.id === incident.poId)?.expectedKgMilli ?? 0} /></dd></div>
                      <div>
                        <dt>Claimed delivery today</dt>
                        <dd>{claimFor(incident.poId) ? <Qty milli={claimFor(incident.poId)!.claimedDeliveryTodayKgMilli} /> : "Not applied (unverified)"}</dd>
                      </div>
                      <div><dt>Reported PO shortage</dt><dd className="p2-strong"><Qty milli={incident.claimedShortfallKgMilli} /></dd></div>
                    </dl>
                    {incident.status === "PENDING_VERIFICATION" && <p className="p2-fineprint">Not yet verified — claim not applied to the snapshot.</p>}
                  </div>
                  <div className="p2-split__col">
                    <p className="p2-split__label"><Badge tone="ok">Physical stock</Badge></p>
                    <dl className="p2-mini">
                      <div><dt>Accepted on-hand chicken</dt><dd><Qty milli={readinessRows(restaurant).find((r) => r.ingredientId === incident.ingredientId)?.physicalMilli ?? 0} /></dd></div>
                      <div><dt>Goods received from PO</dt><dd><Qty milli={0} /></dd></div>
                    </dl>
                    <p className="p2-fineprint">A supplier message does not prove receipt or change stock.</p>
                  </div>
                </div>
                <span className="p2-disruption__cta">Open incident <ChevronRight size={16} aria-hidden="true" /></span>
              </Link>
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
          <Card title="Action queue">
            {stale && incident ? (
              <NextActions actions={[{ kind: "assess", label: "Re-assess impact", description: "Snapshot changed since last assessment.", incidentId: incident.id }]} />
            ) : (
              <NextActions actions={nextActions(restaurant, incident)} />
            )}
            {counts.awaitingVerification > 0 && <p className="p2-fineprint">Verify the supplier report before assessing its impact.</p>}
            {impact?.status === "BREACH_RISK" && <Notice tone="bad" title="Confirmed demand exceeds eligible chicken">Escalate before accepting new chicken orders.</Notice>}
          </Card>
          <Card title="Recent incident activity">
            <ActivityList events={activity.slice(-8)} emptyText="No activity in this session yet." />
          </Card>
        </aside>
      </div>
    </div>
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

function Readiness() {
  const { restaurant } = useRestaurantStore();
  const rows = readinessRows(restaurant);
  return (
    <div className="p2-readiness">
      {rows.map((r) => {
        const supply = r.eligibleMilli + r.plannedIncomingMilli;
        const scale = Math.max(r.forecastMilli, r.confirmedMilli, supply, 1);
        return (
          <div key={r.ingredientId} className="p2-ready">
            <div className="p2-ready__head">
              <span className="p2-ready__name">{r.name}</span>
              {r.projectedGapMilli > 0 ? <Badge tone="bad">Gap <Qty milli={r.projectedGapMilli} unit={r.unit} /></Badge> : r.eligibleMilli < r.forecastMilli ? <Badge tone="warn">Depends on delivery</Badge> : <Badge tone="ok">Covered</Badge>}
            </div>
            <div className="p2-bar" role="img" aria-label={`${r.name}: eligible ${fmtQty(r.eligibleMilli)} ${r.unit}, planned incoming ${fmtQty(r.plannedIncomingMilli)} ${r.unit}, forecast need ${fmtQty(r.forecastMilli)} ${r.unit}, confirmed need ${fmtQty(r.confirmedMilli)} ${r.unit}`}>
              <span className="p2-bar__seg p2-bar__seg--stock" style={{ width: `${(r.eligibleMilli / scale) * 100}%` }} />
              <span className="p2-bar__seg p2-bar__seg--incoming" style={{ width: `${(r.plannedIncomingMilli / scale) * 100}%` }} />
              <span className="p2-bar__mark p2-bar__mark--confirmed" style={{ left: `${(r.confirmedMilli / scale) * 100}%` }} />
              <span className="p2-bar__mark p2-bar__mark--forecast" style={{ left: `${Math.min(r.forecastMilli / scale, 1) * 100}%` }} />
            </div>
            <dl className="p2-ready__stats">
              <div><dt>Physical eligible</dt><dd><Qty milli={r.eligibleMilli} unit={r.unit} /></dd></div>
              <div><dt>Planned PO incoming</dt><dd><Qty milli={r.plannedIncomingMilli} unit={r.unit} /></dd></div>
              <div><dt>Forecast need</dt><dd><Qty milli={r.forecastMilli} unit={r.unit} /></dd></div>
              <div><dt>Confirmed need</dt><dd><Qty milli={r.confirmedMilli} unit={r.unit} /></dd></div>
            </dl>
            {r.hasSupplierClaim && <p className="p2-fineprint">Supplier claims today's delivery will not arrive; the PO is no longer counted as incoming.</p>}
            {!r.confirmedCovered && <p className="p2-fineprint p2-fineprint--bad">Physical stock does not cover confirmed demand.</p>}
          </div>
        );
      })}
      <p className="p2-legend">
        <span className="p2-legend__key p2-legend__key--stock" /> Physical eligible
        <span className="p2-legend__key p2-legend__key--incoming" /> Planned PO (not stock)
        <span className="p2-legend__key p2-legend__key--confirmed" /> Confirmed need
        <span className="p2-legend__key p2-legend__key--forecast" /> Forecast need
      </p>
    </div>
  );
}

const MENU_PHOTOS: Partial<Record<string, string>> = {
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
