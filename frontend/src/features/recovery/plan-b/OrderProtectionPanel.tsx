import { createHappyPotatoSeedSnapshot } from "../../../data/fixtures/happyPotato";
import popcorn from "../../../assets/menu/chicken-popcorn.jpg";
import tenders from "../../../assets/menu/chicken-tenders.jpg";
import fries from "../../../assets/menu/flavoured-fries.jpg";
import combo from "../../../assets/menu/happy-combo.jpg";
import { Search, UserRound } from "lucide-react";
import { useState } from "react";
import { Button, StatusBadge } from "../../../components/ui";
import { allocateDemoOrders } from "./orderCoverage";
import { kg, Table, time } from "./RecoveryView";
import type { calculatePlanB } from "./planB";
import "./orderProtection.css";

type Plan = Extract<ReturnType<typeof calculatePlanB>, { status: "READY" }>;
const pageSize = 6;
const menuPrices = new Map(createHappyPotatoSeedSnapshot().menuItems.map(item => [item.id, item.priceSen]));
const menuPhotos: Record<string, string> = {
  "HP-MENU-CP": popcorn,
  "HP-MENU-CT": tenders,
  "HP-MENU-FR": fries,
  "HP-MENU-HC": combo,
};

export function OrderProtection({ plan }: { plan: Plan }) {
  const [mode, setMode] = useState("confirmed");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("id");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string>();
  const orders = allocateDemoOrders(plan.rows, plan.chicken, plan.fries);
  const forecast = plan.rows.reduce((sum, row) => sum + row.forecast, 0);
  const confirmed = plan.rows.reduce((sum, row) => sum + row.confirmed, 0);
  const visible = (orders ?? []).filter(order =>
    [order.id, "#" + order.id.slice(-3), order.customer, ...order.items.map(item => item.name)].some(text => text.toLowerCase().includes(query.trim().toLowerCase())) &&
    (filter !== "risk" || !orders?.some(ticket => ticket.atRisk) || order.atRisk),
  ).sort((a, b) => sort === "portions" ? b.portions - a.portions :
    a.id.localeCompare(b.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / pageSize) - 1));
  const start = currentPage * pageSize;
  const pageOrders = visible.slice(start, start + pageSize);
  const active = pageOrders.find(order => order.id === selected) ?? pageOrders[0];
  const risks = orders?.filter(order => order.atRisk).length ?? 0;
  const spare = plan.chicken - plan.confirmedChicken;
  const quantity = (grams: number) => grams ? kg(grams) : "—";
  const ingredients = (chicken: number, fries: number) =>
    [chicken ? kg(chicken) + " chicken" : "", fries ? kg(fries) + " fries" : ""].filter(Boolean).join(" · ");
  const shortage = (order: NonNullable<typeof orders>[number]) =>
    "Missing " + ingredients(order.chickenShort, order.friesShort);
  const cards = mode === "forecast"
    ? [["Unmet chicken demand", plan.rows.reduce((sum, row) => sum + (row.chicken ? Math.max(0, row.forecast - row.confirmed - row.quota) : 0), 0)],
      ["Forecast portions", forecast], ["Already confirmed", confirmed], ["Potential additional demand", forecast - confirmed]]
    : [["Chicken coverage", (plan.confirmedChicken / 1000).toFixed(2) + " / " + kg(plan.chicken)],
      ["Confirmed orders", orders?.length ?? "—"], ["Confirmed portions", confirmed], ["Orders at risk", orders ? risks : "—"]];
  return <div className="p4-protection">
    <div className="p4-protection-header">
      <div className="p4-protection-toggle" role="group" aria-label="Demand view">
        <Button size="sm" variant={mode === "confirmed" ? "primary" : "secondary"} aria-pressed={mode === "confirmed"} onClick={() => setMode("confirmed")}>Confirmed Orders</Button>
        <Button size="sm" variant={mode === "forecast" ? "primary" : "secondary"} aria-pressed={mode === "forecast"} onClick={() => setMode("forecast")}>Forecast Demand</Button>
      </div>
      <StatusBadge tone="simulated">Demo Data</StatusBadge>
    </div>
    <div className="p4-protection-kpis">{cards.map(([label, value], index) => <div key={label} data-risk={label === "Orders at risk" && risks > 0}>
      <small>{label}</small><strong>{value}</strong>
      {mode === "confirmed" && index === 0 && <>
        <div className="p4-coverage-track" aria-hidden="true">
          <span style={{ flexGrow: Math.min(plan.chicken, plan.confirmedChicken) }} />
          <span data-short={spare < 0} style={{ flexGrow: Math.abs(spare) }} />
        </div>
        <small>{spare === 0 ? "Exactly enough" : kg(Math.abs(spare)) + (spare < 0 ? " short" : " to spare")}</small>
      </>}
      {label === "Orders at risk" && orders && (risks ? <Button size="sm" onClick={() => { setQuery(""); setFilter("risk"); setPage(0); }}>View short orders</Button> : <small>All orders have ingredients</small>)}
      {label === "Unmet chicken demand" && <small>Potential new portions beyond Plan B capacity</small>}
    </div>)}</div>
    {mode === "forecast" ? <>
      <p>Forecast already includes confirmed meals. Additional fries capacity depends on fryer availability.</p>
      <Table caption="Forecast demand by menu" headers={["Menu", "Forecast mix", "Forecast", "Confirmed", "Potential new", "Plan B capacity", "Remaining gap"]}>
        {plan.rows.map(row => {
          const additional = Math.max(0, row.forecast - row.confirmed);
          const gap = Math.max(0, additional - row.quota);
          return <tr key={row.id}><th scope="row">{row.name}</th>
            <td><div className="p4-forecast-mix" aria-label={row.confirmed + " confirmed, " + row.quota + " additional capacity, " + gap + " remaining"}>
              {[row.confirmed, row.quota, gap].map((value, index) => <span key={index} style={{ flexGrow: value }} />)}
            </div><small className="p4-forecast-labels">{row.confirmed} confirmed · {row.quota} extra · {gap} gap</small></td><td>{row.forecast}</td><td>{row.confirmed}</td><td>{additional}</td><td>{row.quota}{!row.chicken && " conditional"}</td><td>{gap}</td></tr>;
        })}
      </Table>
    </> : <>
      <p>Earlier orders get ingredients first. Stock on hand: {kg(plan.chicken)} chicken · {kg(plan.fries)} fries.</p>
      {orders === null ? <p role="status">The synthetic ticket breakdown does not match the current confirmed menu totals.</p> : <>
        <div className="p4-protection-toolbar">
          <label className="p4-filter-search"><Search size={16} aria-hidden="true" /><input aria-label="Search orders" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Search order # or item" /></label>
          <div className="p4-filter-segments" role="group" aria-label="Order status">
            {([["all", "All orders", orders.length], ["risk", "Missing ingredients", risks]] as const).filter(([value, , count]) => value === "all" || count > 0).map(([value, label, count]) =>
              <Button key={value} size="sm" aria-pressed={(risks ? filter : "all") === value} variant={(risks ? filter : "all") === value ? "primary" : "secondary"} onClick={() => { setFilter(value); setPage(0); }}>{label} <span className="p4-filter-count">{count}</span></Button>)}
          </div>
          <label className="p4-filter-sort"><span>Sort by</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}>
            <option value="portions">Most portions</option><option value="id">Order ID</option>
          </select></label>
        </div>
        <p className="p4-protection-muted">All orders due {time(orders[0]?.deadline ?? 750)} MYT</p>
        <div className="p4-protection-columns">
          <div className="p4-order-list">
            {pageOrders.length ? <Table caption="Today's customer orders" headers={["Order", "Total price", "Quantity", "Chicken", "Status"]}>
              {pageOrders.map(order => <tr key={order.id} data-active={active?.id === order.id} onClick={() => setSelected(order.id)}>
                <th scope="row"><div className="p4-order-customer"><span className="p4-order-avatar"><UserRound size={15} aria-hidden="true" /></span><div><button type="button" className="p4-order-id" aria-label={"View order #" + order.id.slice(-3)} aria-pressed={active?.id === order.id} onClick={() => setSelected(order.id)}>#{order.id.slice(-3)}</button><small>{order.customer}</small></div></div></th>
                <td className="p4-order-price">{order.items.every(item => menuPrices.has(item.menuId))
                  ? "RM" + (order.items.reduce((sum, item) => sum + item.portions * (menuPrices.get(item.menuId) ?? 0), 0) / 100).toFixed(2)
                  : "—"}</td>
                <td>{order.portions}</td><td>{quantity(order.requiredChicken)}</td>
                <td>{order.atRisk ? <StatusBadge tone="danger">{shortage(order)}</StatusBadge> : <span className="p4-reserved">Ingredients reserved</span>}</td>
              </tr>)}
            </Table> : <p role="status">No orders match these filters.</p>}
            <div className="p4-protection-pagination"><Button size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Showing {visible.length ? start + 1 : 0}–{Math.min(start + pageSize, visible.length)} of {visible.length}</span><Button size="sm" disabled={start + pageSize >= visible.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
          </div>
          {active && <aside className="p4-order-inspector">
            <header className="p4-receipt-heading"><h3>#{active.id.slice(-3)}</h3><small>{active.id}</small></header>
            {active.atRisk && <StatusBadge tone="danger">{shortage(active)}</StatusBadge>}
            <p>{active.customer} · Ordered {time(Number(active.accepted.slice(0, 2)) * 60 + Number(active.accepted.slice(-2)))} · Ready by {time(active.deadline)} MYT</p>
            <h4>Items</h4>
            <ul>{active.items.map(item => <li key={item.menuId} className="p4-order-item">{menuPhotos[item.menuId] && <img src={menuPhotos[item.menuId]} alt="" width={42} height={42} />}<div><strong>{item.portions} × {item.name}</strong><small>{ingredients(item.chicken, item.fries)}</small></div></li>)}</ul>
            <p className="p4-receipt-total">Total · {ingredients(active.requiredChicken, active.requiredFries)}</p>
            <h4>Checks</h4>
            <ul><li>✓ Order confirmed</li><li>{active.atRisk ? "○ Ingredients need review" : "✓ Ingredients reserved"}</li></ul>
        </aside>}
        </div>
      </>}
    </>}
  </div>;
}
