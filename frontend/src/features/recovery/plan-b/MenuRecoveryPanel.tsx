import { Fragment, useId, useState } from "react";
import { ChartNoAxesColumn, ChevronDown, ClipboardList, PauseCircle, SlidersHorizontal, Utensils } from "lucide-react";
import { AlertBanner, StatusBadge } from "../../../components/ui";
import { kg, Table } from "./RecoveryView";
import type { calculatePlanB } from "./planB";
import "./menuRecovery.css";

type Plan = Extract<ReturnType<typeof calculatePlanB>, { status: "READY" }>;
const actions = {
  pause: { label: "Pause New Orders", icon: PauseCircle, tone: "warning" },
  limit: { label: "Limited Menu", icon: SlidersHorizontal, tone: "info" },
  conditional: { label: "Conditionally Available", icon: Utensils, tone: "success" },
} as const;

export function MenuRecoveryPanel({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState<string>();
  const detailId = useId();
  const items = plan.rows.map(row => ({
    ...row,
    additionalDemand: Math.max(0, row.forecast - row.confirmed),
    gap: Math.max(0, row.forecast - row.confirmed - row.quota),
    action: row.quota <= 0 ? "pause" as const : row.chicken > 0 ? "limit" as const : "conditional" as const,
  }));
  const paused = items.filter(row => row.action === "pause");
  const limited = items.filter(row => row.action === "limit");
  const conditional = items.filter(row => row.action === "conditional");
  const friesShort = Math.max(0, plan.confirmedFries - plan.fries);
  const shortage = [plan.deficit && kg(plan.deficit) + " chicken", friesShort && kg(friesShort) + " fries"].filter(Boolean).join(" and ");
  const axisStep = Math.max(5, Math.ceil(Math.max(0, ...items.map(row => row.additionalDemand)) / 20) * 5);
  const axisMax = axisStep * 4;
  const largestGap = items.reduce<(typeof items)[number] | undefined>(
    (largest, row) => row.gap > (largest?.gap ?? 0) ? row : largest, undefined,
  );

  return <div className="p4-menu-recovery">
    <div className="p4-menu-heading">
      <div><h2>Menu Recovery</h2><p>Recommended menu availability after the supply disruption.</p></div>
      <StatusBadge tone="simulated">Draft Recommendations</StatusBadge>
    </div>
    <div className="p4-menu-kpis" aria-label="Recommendation counts">
      {Object.entries(actions).map(([key, action]) => <div key={key} data-action={key}>
        <action.icon size={20} aria-hidden="true" />
        <div><strong>{items.filter(row => row.action === key).length}</strong><span>{action.label}</span></div>
      </div>)}
    </div>
    {plan.blocked ? <AlertBanner tone="danger" title="Confirmed Order Risk">
      {shortage ? shortage + " missing for confirmed demand." : "Review confirmed commitments and recipe eligibility."}
    </AlertBanner> : plan.scenario.feasibility !== "FEASIBLE" && <AlertBanner tone="warning" title="Kitchen review needed">
      Quotas reflect modeled ingredients. Check prep timing before opening new orders.
    </AlertBanner>}
    {items.length > 0 && <div className="p4-menu-analysis">
      <figure className="p4-menu-demand-chart">
        <figcaption><ChartNoAxesColumn size={18} aria-hidden="true" /> <strong>How many new orders can we take?</strong></figcaption>
        <ul className="p4-menu-chart-legend">
          <li><i data-segment="quota" /> Proposed quota</li>
          <li><i data-segment="conditional" /> Conditional quota</li>
          <li><i data-segment="gap" /> Uncovered demand</li>
        </ul>
        <ul className="p4-menu-chart-rows">
          {items.map(row => <li key={row.id}>
            <div className="p4-menu-chart-label"><strong>{row.short}</strong><small>{row.confirmed} confirmed</small></div>
            <div>
              <div className="p4-menu-demand-track" aria-hidden="true">
                <span data-segment={row.action === "conditional" ? "conditional" : "quota"} style={{ width: row.quota / axisMax * 100 + "%" }} />
                <span data-segment="gap" style={{ width: row.gap / axisMax * 100 + "%" }} />
              </div>
              <small>{row.action === "conditional" ? "Up to " : ""}{row.quota} of {row.additionalDemand} potential new portions · {row.gap} uncovered</small>
            </div>
          </li>)}
        </ul>
        <div className="p4-menu-chart-axis" aria-hidden="true">
          <span>New portions</span>
          <div>{[0, 1, 2, 3, 4].map(tick => <span key={tick}>{tick * axisStep}</span>)}</div>
        </div>
      </figure>
      <aside className="p4-menu-insights" aria-label="Current scenario analysis">
        <h3>What the numbers mean</h3>
        {largestGap ? <div>
          <small>Largest gap · {largestGap.short}</small>
          <strong>{largestGap.gap} new portions</strong>
          <p>{largestGap.quota === 0 ? "Pause new orders for this item." : "Demand above the current proposed limit."}</p>
        </div> : <p>The proposed quotas cover all modeled new demand, subject to kitchen capacity.</p>}
        {limited.map(row => <div key={row.id}>
          <small>{row.short} · stock needed for extra orders</small>
          <strong>{kg(row.quota * row.chicken)} chicken</strong>
          {row.fries > 0 && <p>Plus {kg(row.quota * row.fries)} fries for {row.quota} extra portions.</p>}
        </div>)}
        {conditional.length > 0 && <div><small>Before opening fries orders</small><p>Check fryer capacity and other ingredients.</p></div>}
      </aside>
    </div>}
    {!items.length ? <p role="status">Menu availability is unavailable for this scenario.</p> : <Table caption="Menu availability" headers={["Menu Item", "Confirmed Portions", "Additional New-Order Quota", "Recommended Action"]}>
      {items.map(row => {
        const demandBreakdown = [
          { label: "Already confirmed", value: row.confirmed, segment: "confirmed" },
          { label: row.action === "conditional" ? "Conditional new quota" : "Proposed new quota", value: row.quota, segment: row.action === "conditional" ? "conditional" : "quota" },
          { label: "Uncovered new demand", value: row.gap, segment: "gap" },
        ];
        const detailScale = Math.max(1, ...demandBreakdown.map(item => item.value));
        const open = expanded === row.id;
        const id = detailId + "-" + row.id;
        const risk = row.protected < row.confirmed;
        const toggle = () => setExpanded(open ? undefined : row.id);
        return <Fragment key={row.id}>
          <tr className="p4-menu-action-row" data-open={open} onClick={toggle}>
            <th scope="row"><button type="button" aria-expanded={open} aria-controls={id} onClick={event => { event.stopPropagation(); toggle(); }}>
              <ChevronDown size={15} aria-hidden="true" />{row.name}
            </button></th>
            <td>{row.confirmed} {risk && <StatusBadge tone="danger">At risk</StatusBadge>}</td>
            <td>{row.action === "conditional" ? "Up to " + row.quota + "*" : row.quota}</td>
            <td><StatusBadge tone={actions[row.action].tone}>{actions[row.action].label}</StatusBadge></td>
          </tr>
          <tr hidden={!open} id={id} className="p4-menu-reason"><td colSpan={4}>
            <div className="p4-menu-detail">
              <figure className="p4-menu-demand-chart p4-menu-detail-chart">
                <figcaption><ChartNoAxesColumn size={16} aria-hidden="true" /><strong>Demand breakdown</strong><small>{row.forecast} forecast portions</small></figcaption>
                <ul className="p4-menu-chart-rows">
                  {demandBreakdown.map(item => <li key={item.segment}>
                    <span>{item.label}</span>
                    <div className="p4-menu-demand-track" aria-hidden="true">
                      <span data-segment={item.segment} style={{ width: item.value / detailScale * 100 + "%" }} />
                    </div>
                    <strong>{item.value}</strong>
                  </li>)}
                </ul>
              </figure>
              <div className="p4-menu-insights p4-menu-detail-insight">
                <h3>Why this recommendation?</h3>
                <p>{risk ? "Review confirmed commitments before accepting new orders." : row.action === "pause"
                  ? "The plan reserves stock for confirmed meals first. This item has no allocation for new orders."
                  : row.action === "limit" ? kg(row.quota * row.chicken) + " of chicken is allocated to additional portions. Availability also depends on fries stock and prep timing."
                  : "This item uses no chicken. Confirm fryer capacity and other ingredients before taking new orders."}</p>
                <dl className="p4-menu-evidence">
                  {row.chicken > 0 && <div><dt>Chicken / portion</dt><dd>{row.chicken} g</dd></div>}
                  {row.fries > 0 && <div><dt>Fries / portion</dt><dd>{row.fries} g</dd></div>}
                </dl>
              </div>
            </div>
          </td></tr>
        </Fragment>;
      })}
    </Table>}
    {conditional.length > 0 && <small>* Additional production is subject to kitchen capacity and other ingredient constraints.</small>}
    <section className="p4-menu-recommendation">
      <h3><ClipboardList size={18} aria-hidden="true" /> New-order action plan</h3>
      <div className="p4-menu-action-groups">
        {([
          { action: "pause", rows: paused, cue: "Pause new orders" },
          { action: "limit", rows: limited, cue: "Accept up to the quota" },
          { action: "conditional", rows: conditional, cue: "Check fryer capacity first" },
        ] as const).filter(group => group.rows.length > 0).map(group => {
          const Icon = actions[group.action].icon;
          return <section key={group.action} className="p4-menu-action-group">
            <h4><Icon size={15} aria-hidden="true" />{group.cue}</h4>
            <ul>{group.rows.map(row => <li key={row.id}>
              <span>{row.short}</span>
              <strong>{row.quota} new</strong>
            </li>)}</ul>
          </section>;
        })}
      </div>
      <small>Applies to new orders only. Manager review required before updating the POS.</small>
    </section>
  </div>;
}
