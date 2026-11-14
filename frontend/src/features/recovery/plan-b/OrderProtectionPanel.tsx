import { useState } from "react";
import { Button, StatusBadge } from "../../../components/ui";
import { allocateDemoOrders } from "./orderCoverage";
import { kg, Table, time } from "./RecoveryView";
import type { calculatePlanB } from "./planB";
import "./orderProtection.css";

type Plan = Extract<ReturnType<typeof calculatePlanB>, { status: "READY" }>;
const pageSize = 6;

export function OrderProtection({ plan }: { plan: Plan }) {
  const [mode, setMode] = useState("confirmed");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("earliest");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string>();
  const orders = allocateDemoOrders(plan.rows, plan.chicken, plan.fries);
  const forecast = plan.rows.reduce((sum, row) => sum + row.forecast, 0);
  const confirmed = plan.rows.reduce((sum, row) => sum + row.confirmed, 0);
  const visible = (orders ?? []).filter(order =>
    [order.id, order.customer, ...order.items.map(item => item.name)].some(text => text.toLowerCase().includes(query.trim().toLowerCase())) &&
    (filter === "all" || (filter === "risk" ? order.atRisk : !order.atRisk)),
  ).sort((a, b) => sort === "portions" ? b.portions - a.portions :
    sort === "latest" ? b.deadline - a.deadline : sort === "id" ? a.id.localeCompare(b.id) : a.deadline - b.deadline);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / pageSize) - 1));
  const start = currentPage * pageSize;
  const pageOrders = visible.slice(start, start + pageSize);
  const active = pageOrders.find(order => order.id === selected) ?? pageOrders[0];
  const status = (risk: boolean) => risk ? "At Risk" : "Stock Covered · Schedule Pending";
  const cards = mode === "forecast"
    ? [["Forecast portions", forecast], ["Already confirmed", confirmed], ["Potential additional demand", forecast - confirmed],
      ["Unmet additional chicken forecast", plan.rows.reduce((sum, row) => sum + (row.chicken ? Math.max(0, row.forecast - row.confirmed - row.quota) : 0), 0)]]
    : [["Confirmed customer orders", orders?.length ?? "—"], ["Confirmed portions", confirmed],
      ["Chicken demand covered", plan.deficit ? "Partial" : kg(plan.confirmedChicken)],
      ["Orders at risk", orders?.filter(order => order.atRisk).length ?? "—"]];

  return <div className="p4-protection">
    <div className="p4-protection-header">
      <div className="p4-protection-toggle" role="group" aria-label="Demand view">
        <Button size="sm" variant={mode === "confirmed" ? "primary" : "secondary"} aria-pressed={mode === "confirmed"} onClick={() => setMode("confirmed")}>Confirmed Orders</Button>
        <Button size="sm" variant={mode === "forecast" ? "primary" : "secondary"} aria-pressed={mode === "forecast"} onClick={() => setMode("forecast")}>Forecast Demand</Button>
      </div>
      <StatusBadge tone="simulated">Demo Data</StatusBadge>
    </div>
    <div className="p4-protection-kpis">{cards.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    {mode === "forecast" ? <>
      <p>Forecast already includes confirmed meals. Additional fries capacity depends on fryer availability.</p>
      <Table caption="Forecast demand by menu" headers={["Menu", "Forecast mix", "Forecast", "Confirmed", "Potential new", "Plan B capacity", "Remaining gap"]}>
        {plan.rows.map(row => {
          const additional = Math.max(0, row.forecast - row.confirmed);
          const gap = Math.max(0, additional - row.quota);
          return <tr key={row.id}><th scope="row">{row.name}</th>
            <td><div className="p4-forecast-mix" aria-label={row.confirmed + " confirmed, " + row.quota + " additional capacity, " + gap + " remaining"}>
              {[row.confirmed, row.quota, gap].map((value, index) => <span key={index} style={{ flexGrow: value }} />)}
            </div></td><td>{row.forecast}</td><td>{row.confirmed}</td><td>{additional}</td><td>{row.quota}{!row.chicken && " conditional"}</td><td>{gap}</td></tr>;
        })}
      </Table>
    </> : <>
      <p>Demo tickets receive stock in acceptance order. Available: {kg(plan.chicken)} chicken · {kg(plan.fries)} fries.</p>
      {orders === null ? <p role="status">The synthetic ticket breakdown does not match the current confirmed menu totals.</p> : <>
        <div className="p4-protection-toolbar">
          <label>Search orders<input value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Order ID or menu item" /></label>
          <label>Status<select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>
            <option value="all">All Orders</option><option value="covered">Stock Covered</option><option value="risk">At Risk</option><option value="schedule">Needs Schedule Review</option>
          </select></label>
          <label>Sort by<select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}>
            <option value="earliest">Earliest deadline</option><option value="latest">Latest deadline</option><option value="portions">Most portions</option><option value="id">Order ID</option>
          </select></label>
        </div>
        <div className="p4-protection-columns">
          <div>
            {pageOrders.length ? <Table caption="Confirmed demo tickets" headers={["Order / customer", "Items", "Portions", "Chicken", "Due", "Protection"]}>
              {pageOrders.map(order => <tr key={order.id} data-active={active?.id === order.id} onClick={() => setSelected(order.id)}>
                <th scope="row"><Button size="sm" aria-pressed={active?.id === order.id} onClick={() => setSelected(order.id)}>{order.id}</Button><small>{order.customer}</small></th>
                <td>{order.items.length > 2 ? order.items.length + " items" : order.items.map(item => item.portions + "× " + item.name).join(" · ")}</td>
                <td>{order.portions}</td><td>{kg(order.requiredChicken)}</td><td>{time(order.deadline)}</td>
                <td><StatusBadge tone={order.atRisk ? "danger" : "warning"}>{status(order.atRisk)}</StatusBadge></td>
              </tr>)}
            </Table> : <p role="status">No orders match these filters.</p>}
            <div className="p4-protection-pagination"><Button size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Showing {visible.length ? start + 1 : 0}–{Math.min(start + pageSize, visible.length)} of {visible.length}</span><Button size="sm" disabled={start + pageSize >= visible.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
          </div>
          {active && <aside className="p4-order-inspector">
            <h3>{active.id}</h3><p>{active.customer} · Confirmed</p>
            <small>Accepted {active.accepted} · Due {time(active.deadline)} MYT</small>
            <ul>{active.items.map(item => <li key={item.name}><strong>{item.portions}× {item.name}</strong><small>{kg(item.chicken)} chicken · {kg(item.fries)} fries</small></li>)}</ul>
            <p>Requires {kg(active.requiredChicken)} chicken and {kg(active.requiredFries)} fries.</p>
            <StatusBadge tone={active.atRisk ? "danger" : "warning"}>{status(active.atRisk)}</StatusBadge>
            {active.atRisk && <p>{kg(active.chickenShort)} chicken short · {kg(active.friesShort)} fries short.</p>}
            <p>{active.requiredFries > 0 ? "Fries schedule needs verification." : "Ticket-level prep timing needs verification."}</p>
          </aside>}
        </div>
      </>}
    </>}
  </div>;
}
