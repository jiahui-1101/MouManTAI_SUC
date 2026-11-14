import { useState } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { preview } from "../../features/recovery/plan-b/preview";
import { demoPlan, kg, Metrics, Pending, Table, time } from "../../features/recovery/plan-b/RecoveryView";

export function PrepPlanningPage() {
  const [selected, setSelected] = useState<string>();
  const title = "Prep Planning";
  const plan = demoPlan;
  if (plan.status !== "READY") return <PageContainer title={title}><Pending status={plan.status} /></PageContainer>;
  const { batches, feasibility } = plan.scenario;
  const confirmed = batches.filter(batch => batch.demand === "Confirmed");
  const latest = Math.max(0, ...confirmed.map(batch => batch.end));
  const deadline = Math.min(750, ...confirmed.map(batch => batch.deadline));
  const start = Math.min(650, ...batches.map(batch => batch.start));
  const end = Math.max(755, ...batches.map(batch => batch.end));
  const position = (minute: number) => ((minute - start) / (end - start)) * 100 + "%";
  const stations = [...new Set(batches.map(batch => batch.station))];
  const active = batches.find(batch => batch.id === selected) ?? batches[0];
  const menu = (id: string) => plan.rows.find(row => row.id === id);
  return <PageContainer title={title}><div className="p4">
    <header className="p4-hero">
      <p className="p4-kicker">Synthetic business data · Demo schedule</p>
      <h2>Confirmed orders go first</h2>
      <p>See when each chicken batch is planned, then review the checks before using the proposal.</p>
      <small>{preview.date} · MYT · Planned kitchen work · Actual output and waste unknown</small>
    </header>
    <Metrics items={[
      ["Planned batches", batches.length, "Chicken production"],
      ["Chicken stations", stations.length, "Assigned in this schedule"],
      ["Confirmed portions", confirmed.reduce((total, batch) => total + batch.portions, 0), "Scheduled"],
      ["Last confirmed finish", latest ? time(latest) : "—", "Deadline " + time(deadline)],
    ]} />
    <section className="p4-panel"><h2>Station timeline</h2>
      <p className="p4-meta">Select a batch to inspect it. Scroll sideways on narrow screens.</p>
      {stations.length === 0 && <p className="p4-alert">No batches scheduled. Review accepted stock and original recipes.</p>}
      {stations.map(station => <div key={station}>
        <h3>{station}</h3>
        <div className="p4-scroll" tabIndex={0} role="region" aria-label={station + " timeline"}>
          <div className="p4-timeline">
            <div className="p4-deadline" style={{ left: position(deadline) }}><span>Confirmed deadline</span></div>
            {[660, 690, 720, 750].map(tick => <span className="p4-tick" key={tick} style={{ left: position(tick) }}>{time(tick)}</span>)}
            {batches.filter(batch => batch.station === station).map(batch => <button type="button" className="p4-batch"
              key={batch.id} data-new={batch.demand === "New"} aria-pressed={active?.id === batch.id}
              aria-label={menu(batch.menuId)?.name + ", " + batch.portions + " " + batch.demand + " portions, " + time(batch.start) + " to " + time(batch.end)}
              style={{ left: position(batch.start), width: (batch.end - batch.start) / (end - start) * 100 + "%" }}
              onClick={() => setSelected(batch.id)}>{menu(batch.menuId)?.short} · {batch.portions}</button>)}
          </div>
        </div>
      </div>)}
      {active && <div aria-live="polite"><h3>{active.id} · {menu(active.menuId)?.name}</h3>
        <p>{active.demand} demand · {active.portions} portions · {time(active.start)}–{time(active.end)} · Deadline {time(active.deadline)}</p>
        <p>{kg(active.portions * (menu(active.menuId)?.chicken ?? 0))} chicken under recipe {active.menuId}. Accepted chicken stock pool {plan.lots.filter(lot => lot.ingredient === "chicken").map(lot => lot.id).join(", ")}.</p>
      </div>}
      <p><span className="p4-pill">Confirmed demand</span> <span className="p4-pill" data-tone="warn">New demand</span></p>
    </section>
    <section className="p4-panel"><h2>Batch schedule</h2>
      <Table caption="Planned chicken batches in MYT" headers={["Batch", "Menu", "Demand", "Portions", "Start–finish", "Station", "Deadline", "Status"]}>
        {batches.map(batch => <tr key={batch.id}><th scope="row">{batch.id}</th><td>{menu(batch.menuId)?.name}</td>
          <td>{batch.demand}</td><td className="p4-number">{batch.portions}</td><td>{time(batch.start)}–{time(batch.end)}</td>
          <td>{batch.station}</td><td>{time(batch.deadline)}</td><td>Planned</td></tr>)}
      </Table>
    </section>
    <section className="p4-panel"><h2>Schedule validation</h2>
      {plan.issues.length > 0 && <ul role="alert" className="p4-alert">{plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {feasibility === "FEASIBLE" && <p>Stations are available, batches run without overlaps, confirmed batches finish by {time(deadline)}, and quantities match the accepted stock allocation under demo assumptions.</p>}
      {feasibility === "CONDITIONAL" && <p className="p4-alert">Holding safety data is unknown. Review holding requirements before proceeding.</p>}
      {feasibility === "BREACH_RISK" && <p className="p4-alert">Confirmed commitments need manual review before prep. Escalate affected orders for customer renegotiation.</p>}
      <p className="p4-meta">Batches are planned and await approval and recorded evidence. Actual cooking and food waste remain unknown.</p>
    </section>
  </div></PageContainer>;
}
