import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { preview } from "../../features/recovery/plan-b/preview";
import { demoPlan, kg, Metrics, Pending, Table } from "../../features/recovery/plan-b/RecoveryView";

export function PlanBPage() {
  const title = "Plan B — Internal Recovery";
  const plan = demoPlan;
  if (plan.status !== "READY") return <PageContainer title={title}><Pending status={plan.status} /></PageContainer>;
  const { scenario, rows } = plan;
  const confirmedAssigned = plan.blocked ? 0 : plan.confirmedChicken;
  const extra = plan.assigned - confirmedAssigned;
  const combo = rows.find(row => row.id === "HP-MENU-HC");
  const incident = preview.incident!;
  return <PageContainer title={title}><div className="p4">
    <header className="p4-hero">
      <p className="p4-kicker">Synthetic business data · Demo calculation · Proposal only</p>
      <h2>Recover using existing stock</h2>
      <p>The supplier expects to deliver {kg(incident.claimed)} against the {kg(incident.ordered)} chicken purchase order. The kitchen has {kg(plan.chicken)} of accepted chicken on hand.</p>
      <p><span className="p4-pill">Zero new purchases · RM0 external purchase cost</span></p>
      <small>{incident.id} · {preview.snapshotId} rev {preview.revision} · {preview.date} MYT · Temporary preview</small>
    </header>
    {scenario.feasibility === "BREACH_RISK" && <p className="p4-alert" role="alert">Confirmed orders are at risk. Chicken deficit {kg(plan.deficit)}. Review stock and recipes, then escalate affected orders for manual customer renegotiation.</p>}
    {scenario.feasibility === "INFEASIBLE" && <p className="p4-alert" role="alert">The stock allocation has a schedule conflict. Review prep planning before relying on these projections.</p>}
    <Metrics items={[
      ["Usable chicken", kg(plan.chicken), "Accepted physical stock"],
      ["Confirmed chicken portions", scenario.confirmedChickenPortionsProtected, "Protected in allocation"],
      ["More Happy Combos", combo?.quota ?? 0, "Proposed new-order quota"],
      ["Chicken forecast unmet", scenario.forecastChickenPortionsUnmet, "Projected portions"],
    ]} />
    <div className="p4-split">
      <section className="p4-panel"><h2>Chicken stock allocation</h2>
        <div className="p4-stock" aria-hidden="true">
          <span style={{ width: (plan.chicken ? confirmedAssigned / plan.chicken * 100 : 0) + "%" }} />
          <span style={{ width: (plan.chicken ? extra / plan.chicken * 100 : 0) + "%" }} />
        </div>
        <ul className="p4-legend">{[
          ["Confirmed reserved", confirmedAssigned], ["After confirmed demand", plan.discretionary],
          ["Additional allocation", extra], ["Total assigned", plan.assigned], ["Left", plan.residual],
        ].map(([label, grams]) => <li key={label}><b>{kg(Number(grams))}</b>{label}</li>)}</ul>
      </section>
      <section className="p4-panel"><h2>Frozen fries</h2>
        <p><strong>{kg(plan.fries)}</strong> accepted · {kg(plan.friesForecastGrams)} forecast requirement</p>
        <p>{kg(plan.friesAssigned)} planned for combo sides and regular fries. Regular fries availability depends on kitchen capacity.</p>
      </section>
    </div>
    <section className="p4-panel"><h2>Confirmed orders and menu recovery</h2>
      <p>Reserve stock for existing orders first. Proposed limits apply to new orders only.</p>
      <Table caption="Menu availability proposal" headers={["Menu", "Confirmed demand", "Protected", "New limit", "Chicken per portion", "Chicken assigned", "Proposed action"]}>
        {rows.map(row => <tr key={row.id}>
          <th scope="row">{row.name}</th><td className="p4-number">{row.confirmed}</td><td className="p4-number">{row.protected}</td>
          <td className="p4-number">{row.quota}</td><td className="p4-number">{row.chicken} g</td>
          <td className="p4-number">{kg((row.protected + row.quota) * row.chicken)}</td>
          <td><span className="p4-pill" data-tone={row.quota ? undefined : "warn"}>{plan.blocked ? "Review required" : !row.quota ? "Pause new orders" : row.chicken ? "Limited" : "Available with capacity"}</span></td>
        </tr>)}
      </Table>
      <details><summary>Preview proposed menu changes</summary>
        <p>Awaiting manager review. The proposal applies to the {preview.date} demo service window. POS changes require a separate manual update.</p>
        <ul>{scenario.proposals.map(proposal => <li key={proposal.id}>{rows.find(row => row.id === proposal.menuId)?.name} · {proposal.newOrderQuota} new portions</li>)}</ul>
      </details>
      <details><summary>Stock source and service window</summary>
        <p>Confirmed service deadline 12:30 PM MYT. Additional combo deadline 2:30 PM MYT.</p>
        <ul>{plan.lots.map(lot => <li key={lot.id}>{lot.id} · {kg(lot.grams ?? 0)}</li>)}</ul>
      </details>
    </section>
    <section className="p4-panel"><h2>Service tradeoff</h2>
      <p>{plan.blocked ? "Review confirmed obligations before opening new orders." : "The allocation protects " + scenario.confirmedChickenPortionsProtected + " confirmed chicken portions and leaves " + scenario.forecastChickenPortionsUnmet + " forecast-only chicken portions unmet."}</p>
      <Link to="/prep-planning">View the kitchen prep plan</Link>
    </section>
  </div></PageContainer>;
}
