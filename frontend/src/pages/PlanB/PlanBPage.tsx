import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Package, RotateCcw, ShieldCheck, Soup, TrendingDown } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { calculatePlanB } from "../../features/recovery/plan-b/planB";
import { useDemoState } from "../../store/demoStore";
import { selectPlanBInput } from "../../integration/planBShared";
import type { PlanInput } from "../../features/recovery/plan-b/planB";
import { kg, Pending, Table } from "../../features/recovery/plan-b/RecoveryView";
import "../../features/recovery/plan-b/recovery.css";

type Tab = "stock" | "orders" | "menu";

export function PlanBPage() {
  const shared = selectPlanBInput(useDemoState());
  if (shared.status !== "READY") return <PageContainer title="Plan B — Internal Recovery"><Pending status={shared.status === "STALE" ? "STALE" : "PENDING"} /><p className="p4-alert" data-testid="plan-b-reason">{shared.reason} <Link to="/incidents">Open incidents</Link></p></PageContainer>;
  // Key the local what-if by snapshot fingerprint so a shared snapshot change discards stale local edits.
  return <PlanBWorkspace key={shared.input.fingerprint} preview={shared.input} sharedChickenGrams={shared.sharedChickenGrams} />;
}

/** Local what-if state never writes back to shared inventory. */
function PlanBWorkspace({ preview, sharedChickenGrams }: { preview: PlanInput; sharedChickenGrams: number }) {
  const [chickenGrams, setChickenGrams] = useState(sharedChickenGrams);
  const [tab, setTab] = useState<Tab>("stock");
  const [query, setQuery] = useState("");
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const input = useMemo(() => ({
    ...preview,
    fingerprint: chickenGrams === sharedChickenGrams ? preview.fingerprint : `${preview.fingerprint}-chicken-${chickenGrams}`,
    lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, grams: chickenGrams } : lot),
  }), [chickenGrams, preview, sharedChickenGrams]);
  const result = useMemo(() => calculatePlanB(input), [input]);
  if (result.status !== "READY") return <PageContainer title="Plan B — Internal Recovery"><Pending status={result.status} /></PageContainer>;

  const { scenario, rows } = result;
  const baseline = calculatePlanB(preview);
  const feasible = scenario.feasibility === "FEASIBLE";
  const breach = scenario.feasibility === "BREACH_RISK";
  const confirmedAllocated = breach ? 0 : result.confirmedChicken;
  const additionalAllocated = breach ? 0 : result.assigned - confirmedAllocated;
  const combo = rows.find(row => row.id === "HP-MENU-HC");
  const actions = scenario.proposals.filter(proposal => proposal.newOrderQuota > 0);
  const filteredRows = rows.filter(row => row.name.toLowerCase().includes(query.toLowerCase()));
  const protectedOrders = rows.filter(row => row.chicken > 0);
  const setPreset = (grams: number) => setChickenGrams(grams);

  return <PageContainer title="Plan B — Internal Recovery"><main className="p4 p4-dashboard">
    <header className="p4-green-hero">
      <div className="p4-brandline"><span>HAPPY POTATO <span>/ OPERATIONS</span></span><span className="p4-demo-tag">DEMO DATA</span></div>
      <p className="p4-kicker">PLAN B · INTERNAL RECOVERY</p>
      <h2>Make the most of your available stock.</h2>
      <p>Chicken delivery disruption · {preview.incident?.id} · Happy Potato — Demo Outlet</p>
      <div className="p4-hero-status"><span><Package size={15}/> No new purchase</span><span>{breach ? <><AlertTriangle size={15}/> BREACH_RISK · review needed</> : <><Check size={15}/> {feasible ? "Plan feasible under demo assumptions" : "Schedule needs review"}</>}</span><span>Mock data · {preview.date} MYT</span></div>
    </header>

    {breach && <div className="p4-breach" role="alert"><AlertTriangle aria-hidden="true"/><div><strong>Confirmed demand is under-provisioned</strong><p>{protectedOrders.reduce((n, row) => n + row.confirmed, 0)} confirmed portions require {kg(result.confirmedChicken)}. Available stock is {kg(result.chicken)}, leaving a {kg(result.deficit)} shortfall. Full protection is not possible. Review and renegotiate affected orders manually.</p></div></div>}

    <section className="p4-kpi-strip" aria-label="Plan B summary">
      <article><span className="p4-kpi-icon"><Package/></span><div><small>Available stock</small><strong>{kg(result.chicken)}</strong><span>Accepted chicken</span></div></article>
      <article><span className="p4-kpi-icon"><ShieldCheck/></span><div><small>Confirmed demand</small><strong>{protectedOrders.reduce((n, row) => n + row.confirmed, 0)}</strong><span>{breach ? "At risk · not fully protected" : "Portions planned for protection"}</span></div></article>
      <article><span className="p4-kpi-icon"><Soup/></span><div><small>Extra Happy Combos</small><strong>{combo?.quota ?? 0}</strong><span>Proposed additional quota</span></div></article>
      <article><span className="p4-kpi-icon"><TrendingDown/></span><div><small>Unmet forecast</small><strong>{scenario.forecastChickenPortionsUnmet}</strong><span>Potential portions, not cancellations</span></div></article>
    </section>

    <nav className="p4-tabs" role="tablist" aria-label="Plan B details">
      {([ ["stock", "Stock Allocation"], ["orders", "Order Protection"], ["menu", "Menu Recovery"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" id={`p4-tab-${id}`} aria-selected={tab === id} aria-controls={`p4-panel-${id}`} onClick={() => setTab(id)}>{label}</button>)}
    </nav>

    {tab === "stock" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-stock" aria-labelledby="p4-tab-stock">
      <div className="p4-section-heading"><div><p className="p4-kicker">SHARED CHICKEN LOT · HP-LOT-CH-001</p><h2>Chicken allocation</h2><p>Accepted physical stock only. The unreceived 20 kg purchase order is excluded.</p></div><span className={`p4-pill ${breach ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach ? "BREACH_RISK" : feasible ? "Plan Feasible*" : "Schedule needs review"}</span></div>
      <div className="p4-stock-workspace"><div className="p4-stock-visual">
      <div className="p4-stock-summary"><strong>{kg(result.chicken)} <small>available</small></strong><span>Confirmed {kg(confirmedAllocated)}</span><span>New {kg(additionalAllocated)}</span><span>Left {kg(Math.max(0, result.residual))}</span></div>
      <div className="p4-stock p4-stock-green" role="img" aria-label={`Chicken allocation: confirmed ${kg(confirmedAllocated)}, new ${kg(additionalAllocated)}, left ${kg(Math.max(0, result.residual))}`}>
        <span style={{ width: `${result.chicken ? confirmedAllocated / result.chicken * 100 : 0}%` }}/><span style={{ width: `${result.chicken ? additionalAllocated / result.chicken * 100 : 0}%` }}/>
      </div>
      <div className="p4-allocation-legend"><span><i className="is-confirmed"/>Confirmed orders <b>{kg(confirmedAllocated)}</b></span><span><i className="is-new"/>Additional combos <b>{kg(additionalAllocated)}</b></span><span><i className="is-left"/>Remaining <b>{kg(Math.max(0, result.residual))}</b></span></div>
      <p className="p4-note">Confirmed demand {kg(result.confirmedChicken)} · Allocated {kg(result.assigned)} · {scenario.forecastChickenPortionsServed} portions planned</p></div>
      <aside className="p4-simulation"><h3>What-if simulation</h3><p>Simulated only: change accepted chicken stock locally to compare with the {kg(sharedChickenGrams)} shared baseline. Shared inventory is never modified.</p>
        <label htmlFor="demo-chicken-stock">Accepted chicken stock <strong>{kg(chickenGrams)}</strong></label>
        <input id="demo-chicken-stock" type="range" min="0" max="15000" step="250" value={chickenGrams} onChange={event => setChickenGrams(Number(event.target.value))} aria-valuetext={kg(chickenGrams)}/>
        <div className="p4-range-labels"><span>0 kg</span><span>15 kg</span></div>
        <div className="p4-presets">{[8000, 10000, 12000].map(value => <button key={value} type="button" aria-pressed={chickenGrams === value} onClick={() => setPreset(value)}>{kg(value)}</button>)}<button type="button" className="p4-reset" onClick={() => setChickenGrams(sharedChickenGrams)} disabled={chickenGrams === sharedChickenGrams}><RotateCcw size={15}/>Reset Demo</button></div>
      <dl className="p4-impact" aria-live="polite"><div><dt>Extra combos</dt><dd>{combo?.quota ?? 0} <small>baseline {baseline.status === "READY" ? baseline.rows.find(row => row.id === "HP-MENU-HC")?.quota : "—"}</small></dd></div><div><dt>Confirmed shortfall</dt><dd>{kg(result.deficit)}</dd></div><div><dt>Unmet forecast</dt><dd>{scenario.forecastChickenPortionsUnmet} portions</dd></div></dl></aside></div>
      <Table caption="Chicken portions and shared lot allocation" headers={["Menu item", "Portions planned", "Chicken allocated"]}>
        {protectedOrders.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.protected + row.quota} <small>({row.protected} confirmed{row.quota ? ` + ${row.quota} new` : ""})</small></td><td>{kg((row.protected + row.quota) * row.chicken)}</td></tr>)}
      </Table>
      <details className="p4-fries-detail"><summary>Frozen fries detail</summary><p>{kg(result.fries)} accepted. Original forecast requirement: {kg(result.friesForecastGrams)}. Conditional Plan B planned use: {kg(result.friesAssigned)}, with {kg(result.fries - result.friesAssigned)} remaining.</p></details>

    </section>}

    {tab === "orders" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-orders" aria-labelledby="p4-tab-orders">
      <div className="p4-section-heading"><div><p className="p4-kicker">CUSTOMER COMMITMENTS</p><h2>Confirmed order protection</h2><p>Confirmed demand is a subset of forecast. No orders are automatically changed.</p></div><span className={`p4-pill ${breach ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach ? "Full protection at risk" : "Protect confirmed first"}</span></div>
      <div className="p4-order-callout"><ShieldCheck/><div><strong>{protectedOrders.reduce((n, row) => n + row.confirmed, 0)} confirmed chicken portions</strong><p>{breach ? `Demand is ${kg(result.deficit)} above stock. No full-fulfillment guarantee.` : `${kg(result.confirmedChicken)} reserved from the shared chicken lot before any new demand.`}</p></div></div>
      <Table caption="Confirmed chicken orders" headers={["Menu", "Confirmed portions", "Chicken per portion", "Demand", "Status"]}>
        {protectedOrders.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.confirmed}</td><td>{row.chicken} g</td><td>{kg(row.confirmed * row.chicken)}</td><td><span className={`p4-pill ${breach ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach ? "At risk · review" : "Planned for protection"}</span></td></tr>)}
      </Table>
      <p className="p4-note">Supplier claim: 0 kg delivered today against PO HP-PO-1042 for 20 kg. Current physical accepted stock is shown separately above.</p>
    </section>}

    {tab === "menu" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-menu" aria-labelledby="p4-tab-menu">
      <div className="p4-section-heading"><div><p className="p4-kicker">MANAGER REVIEW · PROPOSAL ONLY</p><h2>Menu recovery</h2><p>Suggested limits apply to new orders only. Existing customer commitments remain visible.</p></div><button className="p4-action-button" type="button" onClick={() => setActionsOpen(true)}>Preview proposed actions</button></div>
      <label className="p4-search-label" htmlFor="menu-search">Find a menu item</label><input className="p4-search" id="menu-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search menus"/>
      <Table caption="Menu availability and proposed new order limits" headers={["Menu item", "Confirmed", "New order limit", "Availability", "Suggested action"]}>
        {filteredRows.map(row => <tr key={row.id}><th scope="row"><button className="p4-row-detail" type="button" onClick={() => setSelectedMenu(row.id)}>{row.name}</button></th><td>{row.confirmed}{breach && row.chicken > 0 ? " · at risk" : ""}</td><td>{row.quota}</td><td><span className={`p4-pill ${breach && row.chicken ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach && row.chicken ? "At risk" : !row.chicken ? "Available · capacity conditional" : row.quota ? "Limited" : "Pause new orders"}</span></td><td>{breach && row.chicken ? "Review commitments" : row.chicken && !row.quota ? "Pause NEW orders" : row.quota ? `Allow up to ${row.quota} new` : "Capacity check"}</td></tr>)}
      </Table>
      <p className="p4-note">Flavoured Fries uses no chicken. Its availability depends on other ingredients and kitchen capacity.</p>
    </section>}

    <footer className="p4-footer"><span>* Synthetic demo feasibility · New external purchase: <strong>0 kg · RM0</strong></span><Link to="/prep-planning">View Prep Planning <span aria-hidden="true">→</span></Link></footer>

    {selectedMenu && <div className="p4-dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelectedMenu(null); }}><section className="p4-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title"><button type="button" className="p4-dialog-close" onClick={() => setSelectedMenu(null)} aria-label="Close menu details">×</button><p className="p4-kicker">MENU DETAIL</p><h2 id="menu-dialog-title">{rows.find(row => row.id === selectedMenu)?.name}</h2><p>Confirmed portions: {rows.find(row => row.id === selectedMenu)?.confirmed}. Proposed new order limit: {rows.find(row => row.id === selectedMenu)?.quota}.</p><p>Recipe unchanged. Manager review required before any manual menu update.</p></section></div>}
    {actionsOpen && <div className="p4-dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setActionsOpen(false); }}><section className="p4-dialog" role="dialog" aria-modal="true" aria-labelledby="actions-dialog-title"><button type="button" className="p4-dialog-close" onClick={() => setActionsOpen(false)} aria-label="Close proposed actions">×</button><p className="p4-kicker">DRAFT · NO MENU CHANGES MADE</p><h2 id="actions-dialog-title">Proposed recovery actions</h2>{breach ? <p>Current stock is insufficient. Pause new chicken orders and review confirmed commitments with a manager.</p> : actions.length ? <ul>{actions.map(action => <li key={action.id}>{rows.find(row => row.id === action.menuId)?.name}: allow up to {action.newOrderQuota} additional new portions.</li>)}</ul> : <p>No additional chicken menu portions are available at this stock level.</p>}<p>These suggestions require manager review and a manual update. This preview cannot approve, publish, or execute them.</p></section></div>}
  </main></PageContainer>;
}

