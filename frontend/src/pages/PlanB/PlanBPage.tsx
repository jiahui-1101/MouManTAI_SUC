import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Drumstick, Utensils, Package, ShieldCheck, Soup, Layers } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { calculatePlanB } from "../../features/recovery/plan-b/planB";
import { preview } from "../../features/recovery/plan-b/preview";
import { kg, Pending, Table } from "../../features/recovery/plan-b/RecoveryView";
import "../../features/recovery/plan-b/recovery.css";

type Tab = "stock" | "orders" | "menu";

const defaultFries = preview.lots.find(lot => lot.ingredient === "fries")?.grams ?? 0;

function MenuUsageChart({ items }: { items: { name: string; grams: number; required: number; portions: number }[] }) {
  const step = Math.max(1, Math.ceil(Math.max(0, ...items.map(item => Math.max(item.grams, item.required))) / 4000));
  const scale = step * 4000;
  return <figure className="p4-usage-chart">
    <figcaption>Usage by menu · kg <small>Solid: planned · Outline: confirmed demand</small></figcaption>
    <div className="p4-usage-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map(tick => <span key={tick}>{tick * step}</span>)}</div>
    <ul className="p4-usage-plot">
      {items.map(item => <li key={item.name}>
        <div className="p4-usage-column"><div className="p4-usage-required" style={{ height: (item.required / scale * 100) + "%" }} /><div className="p4-usage-fill" style={{ height: (item.grams / scale * 100) + "%" }}>
          <strong>{kg(item.grams)}</strong>
        </div></div>
        <div className="p4-usage-category">{item.name}<small>{item.portions} planned · {kg(item.required)} required</small></div>
      </li>)}
    </ul>
  </figure>;
}

export function PlanBPage() {
  const [chickenGrams, setChickenGrams] = useState(10000);
  const [friesGrams, setFriesGrams] = useState(defaultFries);
  const [tab, setTab] = useState<Tab>("stock");
  const [query, setQuery] = useState("");
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const input = useMemo(() => ({
    ...preview,
    fingerprint: chickenGrams === 10000 && friesGrams === defaultFries ? preview.fingerprint : `${preview.fingerprint}-chicken-${chickenGrams}-fries-${friesGrams}`,
    lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, grams: chickenGrams } : lot.ingredient === "fries" ? { ...lot, grams: friesGrams } : lot),
  }), [chickenGrams, friesGrams]);
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
      <div className="p4-brandline"><span>HAPPY POTATO <span>/ OPERATIONS</span></span><span className="p4-demo-tag">DEMO DATA</span></div>
      <p className="p4-kicker">PLAN B · INTERNAL RECOVERY</p>
      <h2>Make the most of your available stock.</h2>
      <p>Chicken delivery disruption · {preview.incident?.id} · Happy Potato — Demo Outlet</p>
      <div className="p4-hero-status"><span><Package size={15}/> No new purchase</span><span>{breach ? <><AlertTriangle size={15}/> BREACH_RISK · review needed</> : <><Check size={15}/> {feasible ? "Plan feasible under demo assumptions" : "Schedule needs review"}</>}</span><span>Mock data · {preview.date} MYT</span></div>
    </header>

    {breach && <div className="p4-breach" role="alert"><AlertTriangle aria-hidden="true"/><div><strong>Confirmed demand is under-provisioned</strong><p>{protectedOrders.reduce((n, row) => n + row.confirmed, 0)} confirmed portions require {kg(result.confirmedChicken)}. Available stock is {kg(result.chicken)},.{result.deficit > 0 && <> Chicken has a {kg(result.deficit)} shortfall.</>}{friesDeficit > 0 && <> Frozen fries have a {kg(friesDeficit)} shortfall.</>} Full protection is not possible. Review and renegotiate affected orders manually.</p></div></div>}

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
      <div className="p4-stock-workspace p4-ingredient p4-ingredient--chicken"><div className="p4-stock-visual"><div className="p4-ingredient-heading"><h3 className="p4-ingredient-title"><Drumstick size={20} aria-hidden="true" /> Chicken stock<small className="p4-lot-label">Stock lot · {input.lots.filter(lot => lot.ingredient === "chicken").map(lot => lot.id).join(", ")}</small></h3></div>
      <div className="p4-stock-meter"><div className="p4-available"><strong>{kg(result.chicken)} <small>available</small></strong></div><div className="p4-meter-detail"><div className="p4-stock p4-stock-green" role="img" aria-label={`Chicken allocation: confirmed ${kg(confirmedAllocated)}, new ${kg(additionalAllocated)}, left ${kg(Math.max(0, result.residual))}`}>
        <span style={{ width: `${result.chicken ? confirmedAllocated / result.chicken * 100 : 0}%` }}/><span style={{ width: `${result.chicken ? additionalAllocated / result.chicken * 100 : 0}%` }}/>
      </div>
      <div className="p4-allocation-legend"><span><i className="is-confirmed"/>Confirmed orders <b>{kg(confirmedAllocated)}</b></span><span><i className="is-new"/>Additional combos <b>{kg(additionalAllocated)}</b></span><span><i className="is-left"/>Remaining <b>{kg(Math.max(0, result.residual))}</b></span></div></div></div>

      <MenuUsageChart items={protectedOrders.map(row => ({ name: row.short, portions: row.protected + row.quota, required: row.confirmed * row.chicken, grams: (row.protected + row.quota) * row.chicken }))} />
      </div>
      <aside className="p4-simulation"><h3>What if chicken stock changes?</h3>
        <label htmlFor="demo-chicken-stock">Accepted chicken stock <strong>{kg(chickenGrams)}</strong></label>
        <input id="demo-chicken-stock" type="range" min="0" max="15000" step="250" value={chickenGrams} onChange={event => setChickenGrams(Number(event.target.value))} aria-valuetext={kg(chickenGrams)}/>

      <div className="p4-fries-results" aria-live="polite">
        <div data-shortage={result.deficit > 0}><strong>{kg(result.deficit || result.residual)}</strong><span>{result.deficit > 0 ? "Short for confirmed orders" : "Left after planned use"}</span></div>
        <div><strong>+{combo?.quota ?? 0}</strong><span>Happy Combos</span></div>
        <div><strong>{kg(result.confirmedChicken)}</strong><span>Needed for confirmed meals</span></div>
      </div></aside></div>
      <div className="p4-stock-workspace p4-ingredient p4-ingredient--fries"><section className="p4-stock-visual" aria-labelledby="fries-allocation">
        <div className="p4-ingredient-heading"><h3 id="fries-allocation" className="p4-ingredient-title"><Utensils size={20} aria-hidden="true" /> Frozen fries stock</h3><small>Stock lot · {input.lots.filter(lot => lot.ingredient === "fries").map(lot => lot.id).join(", ")}</small></div>
        <div className="p4-stock-meter"><div className="p4-available"><strong>{kg(result.fries)} <small>available</small></strong></div><div className="p4-meter-detail"><div className="p4-stock p4-stock-green" aria-hidden="true">
          <span style={{ width: (result.fries ? friesReserved / result.fries * 100 : 0) + "%" }} />
          <span style={{ width: (result.fries ? friesExtra / result.fries * 100 : 0) + "%" }} />
        </div>
        <div className="p4-allocation-legend"><span><i className="is-confirmed"/>Confirmed <b>{kg(friesReserved)}</b></span><span><i className="is-new"/>New <b>{kg(friesExtra)}</b></span><span><i className="is-left"/>Remaining <b>{kg(friesRemaining)}</b></span></div></div></div>

        <MenuUsageChart items={friesRows.map(row => ({ name: row.short, portions: row.protected + row.quota, required: row.confirmed * row.fries, grams: (row.protected + row.quota) * row.fries }))} />
      </section>
      <aside className="p4-simulation" aria-labelledby="fries-what-if">
        <h3 id="fries-what-if">What if fries stock changes?</h3>
        <label htmlFor="demo-fries-stock">Accepted fries stock <strong>{kg(friesGrams)}</strong></label>
        <input id="demo-fries-stock" type="range" min="0" max="40000" step="50" value={friesGrams}
          onChange={event => setFriesGrams(Number(event.target.value))} aria-valuetext={kg(friesGrams)} />

        <div className="p4-fries-results" aria-live="polite">
          <div data-shortage={friesDeficit > 0}><strong>{kg(friesDeficit || friesRemaining)}</strong><span>{friesDeficit > 0 ? "Short for confirmed orders" : "Left after planned use"}</span></div>
          <div><strong>+{regularFries?.quota ?? 0}</strong><span>Regular Fries</span></div>
          <div><strong>+{combo?.quota ?? 0}</strong><span>Happy Combos</span></div>
        </div>
      </aside></div>
    </section>}

    {tab === "orders" && <section className="p4-panel p4-tab-panel" role="tabpanel" id="p4-panel-orders" aria-labelledby="p4-tab-orders">
      <div className="p4-section-heading"><div><p className="p4-kicker">CUSTOMER COMMITMENTS</p><h2>Confirmed order protection</h2><p>Confirmed demand is a subset of forecast. No orders are automatically changed.</p></div><span className={`p4-pill ${breach ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach ? "Full protection at risk" : "Protect confirmed first"}</span></div>
      <div className="p4-order-callout"><ShieldCheck/><div><strong>{protectedOrders.reduce((n, row) => n + row.confirmed, 0)} confirmed chicken portions</strong><p>{breach ? `Full order protection needs review.` : `${kg(result.confirmedChicken)} reserved from the shared chicken lot before any new demand.`}</p></div></div>
      <Table caption="Confirmed chicken orders" headers={["Menu", "Confirmed portions", "Chicken per portion", "Demand", "Status"]}>
        {protectedOrders.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.confirmed}</td><td>{row.chicken} g</td><td>{kg(row.confirmed * row.chicken)}</td><td><span className={`p4-pill ${breach ? "p4-risk-pill" : "p4-ready-pill"}`}>{breach ? "At risk · review" : "Planned for protection"}</span></td></tr>)}
      </Table>
      <h3>Frozen fries for confirmed orders</h3>
      <p><strong>{rows.reduce((sum, row) => sum + row.confirmed, 0)} confirmed portions across all menus.</strong></p>
      <p>{kg(result.confirmedFries)} required from {kg(result.fries)} accepted stock. Combo portions appear in both ingredient tables and count once in the order total.</p>
      <Table caption="Confirmed portions requiring fries" headers={["Menu item", "Confirmed portions", "Fries required"]}>
        {friesRows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.confirmed}</td><td>{kg(row.confirmed * row.fries)}</td></tr>)}
      </Table>
      <p className="p4-note">Supplier claim: 0 kg delivered today against PO HP-PO-1042 for 20 kg. Current physical accepted stock is shown separately above.</p>
    </section>}

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

