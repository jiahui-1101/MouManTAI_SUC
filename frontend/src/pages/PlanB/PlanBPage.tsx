import { OrderProtection } from "../../features/recovery/plan-b/OrderProtection";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Drumstick, Utensils, Package, ShieldCheck, Soup, Layers } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { calculatePlanB } from "../../features/recovery/plan-b/planB";
import { preview as demoPreview } from "../../features/recovery/plan-b/preview";
import { useDemoState } from "../../store/demoStore";
import { selectPlanBInput } from "../../integration/planBShared";
import type { PlanInput } from "../../features/recovery/plan-b/planB";
import { kg, Pending, Table } from "../../features/recovery/plan-b/RecoveryView";
import "../../features/recovery/plan-b/recovery.css";

type Tab = "stock" | "orders" | "menu";

function MenuUsageChart({ items, available, shortageStock }: { available: number; shortageStock?: number; items: { name: string; grams: number; required: number; portions: number }[] }) {
  const step = Math.max(1, Math.ceil(Math.max(0, ...items.map(item => Math.max(item.grams, item.required))) / 4000));
  const scale = step * 4000;
  const required = items.reduce((sum, item) => sum + item.required, 0);
  const coverage = shortageStock !== undefined && required > 0;
  let cumulativeDemand = 0;
  let cumulativeCoverage = 0;
  return <figure className="p4-usage-chart">
    <figcaption>Usage by menu · kg <small>{coverage ? "Solid: proportional stock coverage · Outline: confirmed demand" : "Solid: planned · Outline: confirmed demand"}</small></figcaption>
    <div className="p4-chart-stock"><label>Available stock <strong>{kg(available)}</strong></label><meter aria-label="Available stock in grams" min={0} max={Math.max(available, required, 1) + required} value={available} /></div>
    <div className="p4-usage-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map(tick => <span key={tick}>{tick * step}</span>)}</div>
    <ul className="p4-usage-plot">
      {items.map(item => {
        cumulativeDemand += item.required;
        const covered = coverage ? Math.floor((shortageStock ?? 0) * cumulativeDemand / required) : 0;
        const grams = coverage ? covered - cumulativeCoverage : item.grams;
        cumulativeCoverage = covered;
        return <li key={item.name}>
        <div className="p4-usage-column"><div className="p4-usage-required" style={{ height: (item.required / scale * 100) + "%" }} /><div className="p4-usage-fill" style={{ height: (grams / scale * 100) + "%" }}>
          <strong>{kg(grams)}</strong>
        </div></div>
        <div className="p4-usage-category">{item.name}<small>{coverage ? "Coverage estimate" : item.portions + " planned"} · {kg(item.required)} required</small></div>
      </li>; })}
    </ul>
  </figure>;
}

export function PlanBPage() {
  const shared = selectPlanBInput(useDemoState());
  if (shared.status !== "READY") {
    const chicken = demoPreview.lots.find(lot => lot.ingredient === "chicken")?.grams ?? 0;
    return <PlanBWorkspace key="local-demo" preview={demoPreview} baselineChicken={chicken} demoReason={shared.reason} />;
  }
  return <PlanBWorkspace key={shared.input.fingerprint} preview={shared.input} baselineChicken={shared.sharedChickenGrams} />;
}

function PlanBWorkspace({ preview, baselineChicken, demoReason }: { preview: PlanInput; baselineChicken: number; demoReason?: string }) {
  const defaultFries = preview.lots.find(lot => lot.ingredient === "fries")?.grams ?? 0;
  const [chickenGrams, setChickenGrams] = useState(baselineChicken);
  const [friesGrams, setFriesGrams] = useState(defaultFries);
  const [tab, setTab] = useState<Tab>("stock");
  const [query, setQuery] = useState("");
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const input = useMemo(() => ({
    ...preview,
    fingerprint: chickenGrams === baselineChicken && friesGrams === defaultFries ? preview.fingerprint : `${preview.fingerprint}-chicken-${chickenGrams}-fries-${friesGrams}`,
    lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, grams: chickenGrams } : lot.ingredient === "fries" ? { ...lot, grams: friesGrams } : lot),
  }), [chickenGrams, friesGrams, preview, baselineChicken, defaultFries]);
  const result = useMemo(() => calculatePlanB(input), [input]);
  if (result.status !== "READY") return <PageContainer title="Plan B — Internal Recovery"><Pending status={result.status} /></PageContainer>;

  const { scenario, rows } = result;
  const feasible = scenario.feasibility === "FEASIBLE";
  const breach = scenario.feasibility === "BREACH_RISK";
  const confirmedAllocated = breach ? 0 : result.confirmedChicken;
  const additionalAllocated = breach ? 0 : result.assigned - confirmedAllocated;
  const combo = rows.find(row => row.id === "HP-MENU-HC");
  const actions = scenario.proposals.filter(proposal => proposal.newOrderQuota > 0);
  const filteredRows = rows.filter(row => row.name.toLowerCase().includes(query.toLowerCase()));
  const friesDeficit = Math.max(0, result.confirmedFries - result.fries);
  const regularFries = rows.find(row => row.id === "HP-MENU-FR");
  const friesRows = rows.filter(row => row.fries > 0);
  const friesReserved = friesRows.reduce((sum, row) => sum + row.fries * row.protected, 0);
  const friesExtra = result.friesAssigned - friesReserved;
  const friesRemaining = result.fries - result.friesAssigned;
  const protectedOrders = rows.filter(row => row.chicken > 0);

  return <PageContainer title="Plan B — Internal Recovery"><main className="p4 p4-dashboard">
    <header className="p4-green-hero">
      <div className="p4-brandline"><span>HAPPY POTATO <span>/ OPERATIONS</span></span><span className="p4-demo-tag">{demoReason ? "LOCAL DEMO" : "DEMO DATA"}</span></div>
      <p className="p4-kicker">PLAN B · INTERNAL RECOVERY</p>
      <h2>Make the most of your available stock.</h2>
      <p>Chicken delivery disruption · {preview.incident?.id} · Happy Potato — Demo Outlet</p>
      <div className="p4-hero-status"><span><Package size={15}/> No new purchase</span><span>{breach ? <><AlertTriangle size={15}/> BREACH_RISK · review needed</> : <><Check size={15}/> {feasible ? "Plan feasible under demo assumptions" : "Schedule needs review"}</>}</span><span>Mock data · {preview.date} MYT</span></div>
      {demoReason && <p data-testid="plan-b-reason">Local demo · {demoReason} · <Link to="/incidents" style={{ color: "inherit" }}>Open incidents</Link></p>}
    </header>


    <section className="p4-kpi-strip" aria-label="Plan B summary">
      <article><span className="p4-kpi-icon"><Package/></span><div><small>Available stock</small><strong>{kg(result.chicken)}</strong><span>Accepted chicken</span></div></article>
      <article><span className="p4-kpi-icon"><ShieldCheck/></span><div><small>Confirmed demand</small><strong>{protectedOrders.reduce((n, row) => n + row.confirmed, 0)}</strong><span>{breach ? "At risk · not fully protected" : "Portions planned for protection"}</span></div></article>
      <article><span className="p4-kpi-icon"><Soup/></span><div><small>Extra Happy Combos</small><strong>{combo?.quota ?? 0}</strong><span>Proposed additional quota</span></div></article>
      <article><span className="p4-kpi-icon"><Layers/></span><div><small>Confirmed chicken needed</small><strong>{kg(result.confirmedChicken)}</strong><span>Across confirmed meals</span></div></article>
    </section>

    <nav className="p4-tabs" role="tablist" aria-label="Plan B details">
      {([ ["stock", "Stock Allocation"], ["orders", "Order Protection"], ["menu", "Menu Recovery"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" id={`p4-tab-${id}`} aria-selected={tab === id} aria-controls={`p4-panel-${id}`} onClick={() => setTab(id)}>{label}</button>)}
    </nav>

    {tab === "stock" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-stock" aria-labelledby="p4-tab-stock">
      <div className="p4-section-heading"><div><h2>Stock Allocation</h2></div><span className={`p4-pill ${breach ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach ? "BREACH_RISK" : feasible ? "Plan Feasible*" : "Schedule needs review"}</span></div>
      <div className="p4-stock-workspace p4-ingredient p4-ingredient--chicken p4-ingredient-card"><div className="p4-stock-visual p4-ingredient-summary"><div className="p4-ingredient-heading"><h3 className="p4-ingredient-title"><Drumstick size={20} aria-hidden="true" /> Chicken stock<small className="p4-lot-label">Stock lot · {input.lots.filter(lot => lot.ingredient === "chicken").map(lot => lot.id).join(", ")}</small></h3></div>
      <div className="p4-stock-meter"><div className="p4-available"><strong>{kg(result.chicken)} <small>available</small></strong></div><div className="p4-meter-detail"><div className="p4-stock p4-stock-green" role="img" aria-label={`Chicken allocation: confirmed ${kg(confirmedAllocated)}, new ${kg(additionalAllocated)}, left ${kg(Math.max(0, result.residual))}`}>
        <span style={{ width: `${result.chicken ? confirmedAllocated / result.chicken * 100 : 0}%` }}/><span style={{ width: `${result.chicken ? additionalAllocated / result.chicken * 100 : 0}%` }}/>
      </div>
      <div className="p4-allocation-legend"><span><i className="is-confirmed"/>Confirmed orders <b>{kg(confirmedAllocated)}</b></span><span><i className="is-new"/>Additional combos <b>{kg(additionalAllocated)}</b></span><span><i className="is-left"/>Remaining <b>{kg(Math.max(0, result.residual))}</b></span></div></div></div>

      </div>
      {result.deficit > 0 && <div className="p4-ingredient-alert" role="status"><AlertTriangle size={16} aria-hidden="true" /><strong>Chicken shortfall · {kg(result.deficit)}</strong><span>Confirmed orders at risk</span></div>}
      <MenuUsageChart available={result.chicken} shortageStock={breach ? Math.min(result.chicken, result.confirmedChicken) : undefined} items={protectedOrders.map(row => ({ name: row.short, portions: row.protected + row.quota, required: row.confirmed * row.chicken, grams: (row.protected + row.quota) * row.chicken }))} />
      <aside className="p4-simulation p4-chicken-simulation">
        <h3>What if chicken stock changes?</h3>
        <label htmlFor="demo-chicken-stock">Simulated chicken stock <strong>{kg(chickenGrams)}</strong></label>
        <input id="demo-chicken-stock" type="range" min="0" max="15000" step="250" value={chickenGrams}
          onChange={event => setChickenGrams(Number(event.target.value))} aria-valuetext={kg(chickenGrams)} />
        <div className="p4-fries-results p4-five-results" aria-live="polite">
          <div><strong>{kg(result.deficit ? result.chicken : result.assigned)}</strong><span>{result.deficit ? "Stock available for confirmed demand" : "Planned Chicken Use"}</span></div>
          <div data-shortage={result.deficit > 0}><strong>{kg(result.deficit || result.residual)}</strong><span>{result.deficit ? "Chicken Shortfall" : "Stock Remaining"}</span></div>
          <div><strong>+{combo?.quota ?? 0}</strong><span>Extra Happy Combos</span><small>Up to {(combo?.forecast ?? 0) - (combo?.confirmed ?? 0)} new portions</small></div>
          <div data-estimate={chickenGrams > 10000}><strong>RM{(Math.max(0, chickenGrams - 10000) * 16 / 1000).toFixed(2)}</strong><span>Hypothetical Purchase Cost</span><small>RM16/kg above 10 kg</small></div>
          <div data-shortage={breach}><strong>{breach ? "At Risk" : "Covered"}</strong><span>Confirmed Orders Covered</span><small>{protectedOrders.reduce((sum, row) => sum + row.confirmed, 0)} chicken portions · {kg(result.confirmedChicken)} required</small></div>
        </div>
        <p className="p4-sim-note">{breach ? "Review confirmed orders. New chicken orders stay paused." : "Ingredients cover confirmed demand. Prep timing still needs to be checked."}</p>
      </aside></div>
      <div className="p4-stock-workspace p4-ingredient p4-ingredient--fries p4-ingredient-card"><section className="p4-stock-visual p4-ingredient-summary" aria-labelledby="fries-allocation">
        <div className="p4-ingredient-heading"><h3 id="fries-allocation" className="p4-ingredient-title"><Utensils size={20} aria-hidden="true" /> Frozen fries stock<small className="p4-lot-label">Stock lot · {input.lots.filter(lot => lot.ingredient === "fries").map(lot => lot.id).join(", ")}</small></h3></div>
        <div className="p4-stock-meter"><div className="p4-available"><strong>{kg(result.fries)} <small>available</small></strong></div><div className="p4-meter-detail"><div className="p4-stock p4-stock-green" aria-hidden="true">
          <span style={{ width: (result.fries ? friesReserved / result.fries * 100 : 0) + "%" }} />
          <span style={{ width: (result.fries ? friesExtra / result.fries * 100 : 0) + "%" }} />
        </div>
        <div className="p4-allocation-legend"><span><i className="is-confirmed"/>Confirmed <b>{kg(friesReserved)}</b></span><span><i className="is-new"/>New <b>{kg(friesExtra)}</b></span><span><i className="is-left"/>Remaining <b>{kg(friesRemaining)}</b></span></div></div></div>

      </section>
      {friesDeficit > 0 && <div className="p4-ingredient-alert" role="status"><AlertTriangle size={16} aria-hidden="true" /><strong>Fries shortfall · {kg(friesDeficit)}</strong><span>Confirmed orders at risk</span></div>}
              <MenuUsageChart available={result.fries} shortageStock={friesDeficit > 0 ? result.fries : undefined} items={friesRows.map(row => ({ name: row.short, portions: row.protected + row.quota, required: row.confirmed * row.fries, grams: (row.protected + row.quota) * row.fries }))} />
      <aside className="p4-simulation" aria-labelledby="fries-what-if">
        <h3 id="fries-what-if">What if fries stock changes?</h3>
        <label htmlFor="demo-fries-stock">Simulated fries stock <strong>{kg(friesGrams)}</strong></label>
        <input id="demo-fries-stock" type="range" min="0" max="40000" step="50" value={friesGrams}
          onChange={event => setFriesGrams(Number(event.target.value))} aria-valuetext={kg(friesGrams)} />

        <div className="p4-fries-results p4-five-results" aria-live="polite">
          <div data-shortage={friesDeficit > 0}><strong>{kg(friesDeficit || friesRemaining)}</strong><span>{friesDeficit > 0 ? "Short for confirmed orders" : "Left after planned use"}</span></div>
          <div><strong>{kg(friesDeficit > 0 ? result.fries : result.friesAssigned)}</strong><span>{friesDeficit > 0 ? "Stock available for confirmed demand" : "Planned Fries Use"}</span></div><div><strong>+{regularFries?.quota ?? 0}</strong><span>Regular Fries</span></div>
          <div><strong>+{combo?.quota ?? 0}</strong><span>Happy Combos</span></div><div data-shortage={friesDeficit > 0}><strong>{friesDeficit > 0 ? "At Risk" : "Covered"}</strong><span>Confirmed Fries Demand</span><small>{kg(result.confirmedFries)} required</small></div>
        </div>
      <p className="p4-sim-note">{friesDeficit > 0 ? "Review the confirmed Combo and Regular Fries commitments." : `${kg(result.confirmedFries)} required for confirmed meals. Extra portions depend on fryer capacity.`}</p></aside></div>
    </section>}

    {tab === "orders" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-orders" aria-labelledby="p4-tab-orders"><OrderProtection plan={result} /></section>}

    {tab === "menu" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-menu" aria-labelledby="p4-tab-menu">
      <div className="p4-section-heading"><div><p className="p4-kicker">MANAGER REVIEW · PROPOSAL ONLY</p><h2>Menu recovery</h2><p>Suggested limits apply to new orders only. Existing customer commitments remain visible.</p></div><button className="p4-action-button" type="button" onClick={() => setActionsOpen(true)}>Preview proposed actions</button></div>
      <label className="p4-search-label" htmlFor="menu-search">Find a menu item</label><input className="p4-search" id="menu-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search menus"/>
      <Table caption="Menu availability and proposed new order limits" headers={["Menu item", "Confirmed", "New order limit", "Availability", "Suggested action"]}>
        {filteredRows.map(row => <tr key={row.id}><th scope="row"><button className="p4-row-detail" type="button" onClick={() => setSelectedMenu(row.id)}>{row.name}</button></th><td>{row.confirmed}{row.protected < row.confirmed ? " · at risk" : ""}</td><td>{row.quota}</td><td><span className={`p4-pill ${row.protected < row.confirmed ? "p4-risk-pill" : "p4-ready-pill"}`}>{row.protected < row.confirmed ? "At risk" : !row.chicken ? "Available · capacity conditional" : row.quota ? "Limited" : "Pause new orders"}</span></td><td>{row.protected < row.confirmed ? "Review commitments" : row.chicken && !row.quota ? "Pause NEW orders" : row.quota ? `Allow up to ${row.quota} new` : "Capacity check"}</td></tr>)}
      </Table>
      <p className="p4-note">Flavoured Fries uses no chicken. Its availability depends on other ingredients and kitchen capacity.</p>
    </section>}

    <footer className="p4-footer"><span>* Synthetic demo feasibility · New external purchase: <strong>0 kg · RM0</strong></span><Link to="/prep-planning">View Prep Planning <span aria-hidden="true">→</span></Link></footer>

    {selectedMenu && <div className="p4-dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelectedMenu(null); }}><section className="p4-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title"><button type="button" className="p4-dialog-close" onClick={() => setSelectedMenu(null)} aria-label="Close menu details">×</button><p className="p4-kicker">MENU DETAIL</p><h2 id="menu-dialog-title">{rows.find(row => row.id === selectedMenu)?.name}</h2><p>Confirmed portions: {rows.find(row => row.id === selectedMenu)?.confirmed}. Proposed new order limit: {rows.find(row => row.id === selectedMenu)?.quota}.</p><p>Recipe unchanged. Manager review required before any manual menu update.</p></section></div>}
    {actionsOpen && <div className="p4-dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setActionsOpen(false); }}><section className="p4-dialog" role="dialog" aria-modal="true" aria-labelledby="actions-dialog-title"><button type="button" className="p4-dialog-close" onClick={() => setActionsOpen(false)} aria-label="Close proposed actions">×</button><p className="p4-kicker">DRAFT · NO MENU CHANGES MADE</p><h2 id="actions-dialog-title">Proposed recovery actions</h2>{breach ? <p>Current stock is insufficient. Pause new chicken orders and review confirmed commitments with a manager.</p> : actions.length ? <ul>{actions.map(action => <li key={action.id}>{rows.find(row => row.id === action.menuId)?.name}: allow up to {action.newOrderQuota} additional new portions.</li>)}</ul> : <p>No additional chicken menu portions are available at this stock level.</p>}<p>These suggestions require manager review and a manual update. This preview cannot approve, publish, or execute them.</p></section></div>}
  </main></PageContainer>;
}

