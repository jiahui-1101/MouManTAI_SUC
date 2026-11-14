import { generateSchedule, checkSchedule, orders, readyTimes, kitchenAssumptions, type PrepBatch } from "./orderDrivenSchedule";
import { selectPlanBInput } from "../../integration/planBShared";
import { useDemoState } from "../../store/demoStore";
import { useState, type FormEvent } from "react";
import { AlertTriangle, CalendarClock, Clock, Layers, Utensils } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { AlertBanner, Button, DataPanel, StatusBadge, Tabs } from "../../components/ui";
import { calculatePlanB } from "../../features/recovery/plan-b/planB";
import { preview } from "../../features/recovery/plan-b/preview";
import { kg, Table, time } from "../../features/recovery/plan-b/RecoveryView";
import "./prepPlanning.css";

const baseline = calculatePlanB(preview);
const canonical = generateSchedule();
const firstStart = kitchenAssumptions.earliest;
const lastDeadline = Math.max(...readyTimes) + 90;
const clockValue = (minute: number) => [Math.floor(minute / 60), minute % 60].map(value => String(value).padStart(2, "0")).join(":");

export function PrepPlanningPage() {
  const linked = selectPlanBInput(useDemoState());
  const [recovery, setRecovery] = useState(true);
  const [editedBatches, setBatches] = useState(canonical);
  const [selection, setSelection] = useState(canonical[0]?.id);
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [draft, setDraft] = useState<{ start: string; duration: string }>();
  const [error, setError] = useState("");
  const batches = recovery ? editedBatches : canonical;
  const active = batches.find(batch => batch.id === selection) ?? batches[0];
  const title = "Recovery Prep Planning";
  const modeSwitch = <div className="prep-actions" role="group" aria-label="Incident comparison">
    <Button aria-pressed={!recovery} variant={!recovery ? "primary" : "secondary"} onClick={() => { setRecovery(false); setDraft(undefined); }}>Before Incident</Button>
    <Button aria-pressed={recovery} variant={recovery ? "primary" : "secondary"} onClick={() => setRecovery(true)}>After Incident</Button>
  </div>;
  if (baseline.status !== "READY" || baseline.scenario.feasibility !== "FEASIBLE" || !active) {
    return <PageContainer title={title}>
      {modeSwitch}
      <AlertBanner title="Recovery schedule unavailable" tone="warning">Review the Plan B proposal before scheduling production.</AlertBanner>
    </PageContainer>;
  }

  const sharedPlan = linked.status === "READY" ? calculatePlanB(linked.input) : undefined;
  const needsStockReview = linked.status === "STALE" || (sharedPlan !== undefined && (
    sharedPlan.status !== "READY" || sharedPlan.scenario.feasibility !== "FEASIBLE" ||
    sharedPlan.chicken !== baseline.chicken || sharedPlan.fries !== baseline.fries ||
    sharedPlan.rows.some(row => !baseline.rows.some(original =>
      original.id === row.id && original.confirmed === row.confirmed && original.quota === row.quota &&
      original.chicken === row.chicken && original.fries === row.fries))
  ));
  const rows = baseline.rows;
  const { issues, affected: affectedOrders } = checkSchedule(batches);
  const readyGroups = readyTimes.map(ready => {
    const group = orders.filter(order => order.deadline === ready);
    return {
      ready,
      orders: group.length,
      portions: group.reduce((sum, order) => sum + order.portions, 0),
      atRisk: group.filter(order => affectedOrders.has(order.id)).length,
    };
  });
  const peakPortions = Math.max(1, ...readyGroups.map(group => group.portions));
  const conflicts = issues.filter(issue => issue.includes(" overlaps ")).length;
  const deadline = Math.max(...readyTimes);
  const status = conflicts ? "Station Conflict" : issues.some(issue => issue.includes("misses")) ? "Deadline Risk" : issues.length || needsStockReview ? "Needs Review" : "Schedule Feasible";
  const total = batches.reduce((sum, batch) => sum + batch.portions, 0);
  const menu = (batch: PrepBatch) => rows.find(row => row.id === batch.menuId);
  const affected = (batch: PrepBatch) => issues.some(issue => issue.includes(batch.id));
  const trackStart = Math.floor(firstStart / 30) * 30;
  const trackEnd = Math.max(deadline + 10, ...batches.map(batch => batch.end + 5));
  const percent = (minutes: number) => minutes / (trackEnd - trackStart) * 100 + "%";
  const ticks = Array.from({ length: Math.ceil((trackEnd - trackStart) / 30) }, (_, index) => trackStart + index * 30);
  const stations = [...new Set(batches.map(batch => batch.station))];

  function select(id: string) {
    setSelection(id);
    setDraft(undefined);
    setError("");
  }

  const draftStart = draft && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(draft.start)
    ? Number(draft.start.slice(0, 2)) * 60 + Number(draft.start.slice(3)) : NaN;
  const draftDuration = Number(draft?.duration);
  const draftEnd = draftStart + draftDuration;
  const validDraft = Number.isInteger(draftDuration) && draftDuration > 0 &&
    draftStart >= trackStart && draftEnd <= lastDeadline;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (!validDraft) {
      setError("Enter a positive whole-minute duration within " + time(trackStart) + "–" + time(lastDeadline) + " MYT.");
      return;
    }
    setBatches(current => current.map(batch => batch.id === active?.id ? { ...batch, start: draftStart, end: draftEnd } : batch));
    setDraft(undefined);
    setError("");
  }

  const timeline = <div className="prep-scroll" tabIndex={0} role="region" aria-label="Kitchen timeline in MYT">
    <div className="prep-timeline">
      <div className="prep-axis">{ticks.map(tick => <span key={tick} style={{ left: percent(tick - trackStart) }}>{time(tick)}</span>)}</div>
      {stations.map(station => <section key={station} className="prep-station">
        <strong>{station}</strong>
        <div className="prep-track" style={{ height: 52 * batches.filter(batch => batch.station === station).length + 26 }}>
          {ticks.map(tick => <i key={tick} className="prep-gridline" style={{ left: percent(tick - trackStart) }} />)}
          {readyTimes.map(ready => <div key={ready} className="prep-deadline" style={{ left: percent(ready - trackStart) }}><span>{clockValue(ready)} due</span></div>)}
          {batches.filter(batch => batch.station === station).map((batch, index) => <div key={batch.id} className="prep-lane" style={{ top: 22 + index * 52 }}>
            <span className="prep-lane-label">
              <strong>{menu(batch)?.short}</strong>
              <span className="prep-lane-time">{time(batch.start)}–{time(batch.end)}</span>
              <small>{batch.portions} portions · {batch.demand === "New" ? "Extra" : "Confirmed"}</small>
            </span>
            <button key={batch.id} type="button"
            className="prep-bar" data-demand={batch.demand} data-risk={affected(batch)}
            aria-pressed={active.id === batch.id} onClick={() => select(batch.id)}
            style={{ left: percent(batch.start - trackStart), width: percent(batch.end - batch.start) }}
            aria-label={menu(batch)?.name + ", " + batch.portions + " " + batch.demand + " portions, " + time(batch.start) + " to " + time(batch.end)}
            title={batch.id + " · " + time(batch.start) + "–" + time(batch.end) + (affected(batch) ? " · Needs review" : "")}>
            {affected(batch) && <AlertTriangle size={13} aria-label="Needs review" />}
          </button></div>)}
        </div>
      </section>)}
    </div>
    <div className="prep-legend"><StatusBadge tone="info">Confirmed demand</StatusBadge><StatusBadge tone="simulated">Additional demand</StatusBadge></div>
  </div>;

  const list = <Table caption="Proposed chicken batches · MYT" headers={["Batch", "Menu", "Portions", "Station", "Related orders", "Ready by", "Start", "End", "Minutes", "Validation"]}>
    {batches.map(batch => <tr key={batch.id} onClick={() => select(batch.id)} data-selected={active.id === batch.id}>
      <th scope="row"><Button size="sm" aria-pressed={active.id === batch.id} onClick={() => select(batch.id)}>{batch.id}</Button></th>
      <td>{menu(batch)?.name}</td><td>{batch.portions}</td><td>{batch.station}</td><td>{batch.orderIds.map(id => "#" + id.slice(-3)).join(", ")}</td><td>{time(batch.deadline)}</td>
      <td>{time(batch.start)}</td><td>{time(batch.end)}</td><td>{batch.end - batch.start}</td><td>{affected(batch) ? "Needs review" : "Clear"}</td>
    </tr>)}
  </Table>;

  return <PageContainer title={title}>{modeSwitch}<div className="prep-workspace p4">
    <DataPanel>
      <div className="prep-header">
        <div><p><strong>Happy Potato</strong> · {preview.incident?.id} · {preview.date} MYT</p></div>
        <div className="prep-actions"><StatusBadge tone="simulated">{recovery ? "Plan B · Demo schedule" : "Illustrative original plan · Read-only"}</StatusBadge><StatusBadge tone={issues.length ? "danger" : needsStockReview ? "warning" : "success"}>{status}</StatusBadge></div>
      </div>
      <dl className="prep-supply-compare">
        <div><dt>Chicken on hand</dt><dd>{kg(baseline.chicken)}</dd></div>
        <div><dt>{recovery ? "Delivery unavailable" : "Expected delivery"}</dt><dd>{kg(preview.incident?.ordered ?? 0)}</dd>{!recovery && <small>Expected, pending receipt</small>}</div>
        <div><dt>{recovery ? "Additional Combo quota" : "Expected planning supply"}</dt><dd>{recovery ? (rows.find(row => row.id === "HP-MENU-HC")?.quota ?? 0) + " portions" : kg(baseline.chicken + (preview.incident?.ordered ?? 0))}</dd>
          <small>{recovery ? baseline.scenario.forecastChickenPortionsUnmet + " chicken forecast portions beyond Plan B capacity" : kg(baseline.chickenForecastGrams) + " required for the chicken forecast"}</small></div>
      </dl>
    </DataPanel>
    <div className="prep-kpis">
      <DataPanel><Layers size={17} /><span>Confirmed orders</span><strong>{orders.length}</strong></DataPanel>
      <DataPanel><Utensils size={17} /><span>Confirmed portions</span><strong>{orders.reduce((sum, order) => sum + order.portions, 0)}</strong><small>{total} with chicken</small></DataPanel>
      <DataPanel><AlertTriangle size={17} /><span>Schedule issues</span><strong>{issues.length}</strong><small>{conflicts} overlapping pairs</small></DataPanel>
      <DataPanel><Clock size={17} /><span>Generated batches</span><strong>{batches.length}</strong><small>Confirmed chicken queue</small></DataPanel>
    </div>
    <DataPanel title="Orders by ready time">
      <ul className="prep-ready-chart">
        {readyGroups.map(group => <li key={group.ready} data-risk={group.atRisk > 0}>
          <div className="prep-ready-heading">
            <strong>{time(group.ready)}</strong>
            {group.portions === peakPortions && <span>Peak</span>}
          </div>
          <div className="prep-ready-track" aria-hidden="true">
            <span style={{ width: group.portions / peakPortions * 100 + "%" }} />
          </div>
          <div className="prep-ready-counts">
            <strong>{group.portions} portions</strong><small>{group.orders} orders</small>
          </div>
          {group.atRisk > 0 && <small className="prep-error">{group.atRisk} {group.atRisk === 1 ? "order" : "orders"} at risk</small>}
        </li>)}
      </ul>
    </DataPanel>
    <div className="prep-columns">
      <DataPanel title="Kitchen schedule" actions={recovery && <Button size="sm" disabled={batches === canonical && !draft} onClick={() => { setBatches(canonical); select(canonical[0]!.id); }}>Reset Schedule</Button>}>
        <Tabs label="Schedule view" value={view} onChange={setView} tabs={[
          { id: "timeline", label: "Timeline", panel: timeline },
          { id: "list", label: "Batch List", panel: list },
        ]} />
      </DataPanel>
      <DataPanel title="Batch Inspector">
        <div className="prep-inspector">
          <StatusBadge tone="simulated">Proposed · {active.demand} demand</StatusBadge>
          <div className="prep-selected"><small>{active.id}</small><h3>{menu(active)?.name}</h3><strong>{active.portions} portions</strong></div>
          <dl>
            <dt>Station</dt><dd>{active.station}</dd>
            <dt>Start–end</dt><dd>{time(active.start)}–{time(active.end)}</dd>
            <dt>Duration</dt><dd>{active.end - active.start} min</dd>
            <dt>Target ready</dt><dd>{time(active.deadline)}</dd>
            <dt>Orders</dt><dd>{active.orderIds.join(", ")}</dd>
            <dt>Chicken</dt><dd>{kg(active.portions * (menu(active)?.chicken ?? 0))}</dd>
          </dl>
          {issues.filter(issue => issue.includes(active.id)).map(issue => <p key={issue} className="prep-error">{issue}</p>)}
          {recovery && (draft ? <form className="prep-edit" onSubmit={apply}>
            <label>Start time (MYT)<input required type="time" value={draft.start} onChange={event => setDraft({ ...draft, start: event.target.value })} /></label>
            <label>Duration (minutes)<input required type="number" min="1" step="1" value={draft.duration} onChange={event => setDraft({ ...draft, duration: event.target.value })} /></label>
            {validDraft && <output className="prep-end-preview">Proposed finish · {time(draftEnd)} MYT</output>}
            {error && <p role="alert" className="prep-error">{error}</p>}
            <div className="prep-actions"><Button size="sm" variant="primary" type="submit">Apply</Button><Button size="sm" onClick={() => select(active.id)}>Cancel</Button></div>
          </form> : <Button size="sm" onClick={() => setDraft({ start: clockValue(active.start), duration: String(active.end - active.start) })}><CalendarClock size={15} /> Edit Schedule</Button>)}
        </div>
      </DataPanel>
    </div>
    <AlertBanner title={status} tone={issues.length ? "danger" : needsStockReview ? "warning" : "info"}>
      {issues.length ? <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>Chicken batches meet their linked ready times with no detected station conflicts.</p>}
      {needsStockReview && <p>Shared stock or allocations changed. Review Plan B before using this baseline schedule.</p>}
      <p>Fries capacity pending validation, including Combo sides.</p>
      <p>Demo assumptions: {kitchenAssumptions.maxPortions} portions per chicken batch, {kitchenAssumptions.minutes} minutes per batch. Confirmed chicken: {kg(baseline.confirmedChicken)}. {baseline.rows.filter(row => row.chicken > 0).reduce((sum, row) => sum + row.quota, 0)} potential new portions are outside this confirmed queue.</p>
    </AlertBanner>
  </div></PageContainer>;
}
