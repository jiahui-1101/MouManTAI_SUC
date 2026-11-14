import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { ImpactAssessment, Incident, OperationalSnapshot } from "../../../types/restaurant";
import type { RestaurantState } from "../../../services/mock/restaurantState";
import type { SimulatedMessage } from "../../../services/mock/restaurantStore";
import { HP_BUSINESS } from "../../../data/fixtures/happyPotato";
import { localTimeToMinutes } from "../../../utils/time";
import {
  affectedMenus,
  confirmedIngredientRequirements,
  dataQualityWarnings,
  findApprovedRecipe,
  forecastIngredientRequirements,
  openConfirmedOrders,
} from "../calculations";
import { CAPABILITY_INGREDIENT } from "../graph";
import { INCIDENT_TYPE_LABEL, ingredientName, supplierName, type ImpactState } from "../../incidents/model";
import { Badge, Card, Notice, Qty, StatusBadge, SyntheticTag, fmtQty } from "../../incidents/components/ui";
import { ConfirmedCoverage } from "../../incidents/components/ImpactPreview";
import { multiplyByPortions } from "../../../utils/quantity";

/* A — incident context ---------------------------------------------------- */

export function ImpactContext({ incident, snapshot, messages, impactState }: { incident: Incident; snapshot: OperationalSnapshot; messages: SimulatedMessage[]; impactState: ImpactState }) {
  const po = snapshot.purchaseOrders.find((p) => p.id === incident.poId);
  const claim = snapshot.supplierClaims.find((c) => c.poId === incident.poId);
  const evidence =
    impactState === "NOT_VERIFIED" ? <Badge tone="warn">UNVERIFIED supplier claim</Badge> : <Badge tone="info">Verified sender · supplier claim (not a receipt)</Badge>;
  return (
    <Card title="Incident context" actions={<SyntheticTag />}>
      <div className="p2-context">
        <div>
          <p className="p2-eyebrow">{INCIDENT_TYPE_LABEL[incident.type]} · <span className="p2-mono">{incident.type}</span></p>
          <p className="p2-disruption__id">{incident.id}</p>
          <p className="p2-muted">
            {supplierName(incident.supplierId)} · PO <span className="p2-mono">{incident.poId}</span> · {ingredientName(incident.ingredientId)}
          </p>
          <div className="p2-badges"><StatusBadge status={incident.status} />{evidence}</div>
        </div>
        <dl className="p2-context__facts">
          <div><dt>Expected delivery</dt><dd>{po?.expectedKgMilli != null ? <Qty milli={po.expectedKgMilli} /> : "Unknown"}</dd></div>
          <div><dt>Claimed delivery today</dt><dd>{claim ? <Qty milli={claim.claimedDeliveryTodayKgMilli} /> : "Not applied"}</dd></div>
          <div><dt>Supplier-reported shortage</dt><dd><Qty milli={incident.claimedShortfallKgMilli} /></dd></div>
          <div><dt>Snapshot</dt><dd className="p2-mono">{snapshot.id} · r{snapshot.revision}</dd></div>
        </dl>
      </div>
      <details className="p2-evidence">
        <summary>Evidence details ({messages.length} linked message{messages.length === 1 ? "" : "s"})</summary>
        <ul className="p2-messages">
          {messages.map((m) => (
            <li key={m.id} className="p2-message">
              <div className="p2-message__meta"><Badge tone="info">{m.channel}</Badge><Badge tone="sim">SIMULATED_CHANNEL</Badge><span className="p2-mono">{m.id}</span></div>
              <blockquote className="p2-message__text">{m.text}</blockquote>
            </li>
          ))}
          {messages.length === 0 && <li className="p2-muted">No local messages; real messages come from the P1 inbox.</li>}
        </ul>
        <p className="p2-fineprint">Fingerprint {snapshot.fingerprint}. The message is evidence of a delivery claim, not of goods received.</p>
      </details>
    </Card>
  );
}

/* B — before vs after ------------------------------------------------------ */

export function BeforeAfter({ impact }: { impact: ImpactAssessment }) {
  const before = impact.before!;
  const after = impact.after!;
  const s = impact.summary!;
  const projectedBefore = before.availableAfterReservationsMilli + before.plannedIncomingMilli;
  const scale = Math.max(projectedBefore, s.chickenForecastRequirementKgMilli, 1);
  const pct = (m: number) => `${(m / scale) * 100}%`;
  return (
    <Card title="Before vs after the supplier claim">
      <div className="p2-ba">
        <div className="p2-ba__col">
          <p className="p2-ba__title">Before disruption</p>
          <div className="p2-bar p2-bar--lg" role="img" aria-label={`Before: ${fmtQty(before.physicalOnHandMilli)} kg physical plus ${fmtQty(before.plannedIncomingMilli)} kg planned incoming; forecast need ${fmtQty(s.chickenForecastRequirementKgMilli)} kg`}>
            <span className="p2-bar__seg p2-bar__seg--stock" style={{ width: pct(before.availableAfterReservationsMilli) }} />
            <span className="p2-bar__seg p2-bar__seg--incoming" style={{ width: pct(before.plannedIncomingMilli) }} />
            <span className="p2-bar__mark p2-bar__mark--forecast" style={{ left: pct(s.chickenForecastRequirementKgMilli) }} />
          </div>
          <dl className="p2-mini">
            <div><dt>Physical accepted chicken</dt><dd><Qty milli={before.physicalOnHandMilli} /></dd></div>
            <div><dt>Planned incoming (PO, not stock)</dt><dd><Qty milli={before.plannedIncomingMilli} /></dd></div>
            <div><dt>Projected total if received</dt><dd><Qty milli={projectedBefore} /></dd></div>
          </dl>
        </div>
        <div className="p2-ba__col">
          <p className="p2-ba__title">After supplier claim</p>
          <div className="p2-bar p2-bar--lg" role="img" aria-label={`After: ${fmtQty(after.physicalOnHandMilli)} kg physical, ${fmtQty(after.supplierClaimedIncomingMilli)} kg claimed incoming; gap ${fmtQty(s.demandGapKgMilli)} kg to forecast need`}>
            <span className="p2-bar__seg p2-bar__seg--stock" style={{ width: pct(after.availableAfterReservationsMilli) }} />
            <span className="p2-bar__seg p2-bar__seg--gap" style={{ width: pct(s.demandGapKgMilli) }} />
            <span className="p2-bar__mark p2-bar__mark--forecast" style={{ left: pct(s.chickenForecastRequirementKgMilli) }} />
          </div>
          <dl className="p2-mini">
            <div><dt>Physical accepted chicken</dt><dd><Qty milli={after.physicalOnHandMilli} /></dd></div>
            <div><dt>Supplier-claimed incoming today</dt><dd><Qty milli={after.supplierClaimedIncomingMilli} /></dd></div>
            <div><dt>Conditional total (no-delivery scenario)</dt><dd><Qty milli={s.chickenAvailableKgMilli} /></dd></div>
            <div><dt>Full forecast requirement</dt><dd><Qty milli={s.chickenForecastRequirementKgMilli} /></dd></div>
            <div><dt>Forecast ingredient gap</dt><dd className="p2-strong"><Qty milli={s.demandGapKgMilli} /></dd></div>
          </dl>
        </div>
      </div>
      <p className="p2-legend">
        <span className="p2-legend__key p2-legend__key--stock" /> Physical eligible
        <span className="p2-legend__key p2-legend__key--incoming" /> Planned PO (never physical)
        <span className="p2-legend__key p2-legend__key--gap" /> Forecast gap
        <span className="p2-legend__key p2-legend__key--forecast" /> Forecast need
      </p>
      <p className="p2-fineprint">
        The {fmtQty(impact.poShortfallKgMilli ?? 0)} kg PO shortfall (supplier vs PO) and the {fmtQty(s.demandGapKgMilli)} kg forecast gap (demand vs physical stock) are different metrics.
      </p>
    </Card>
  );
}

/* D — inventory impact ------------------------------------------------------ */

export function InventoryImpact({ impact, snapshot }: { impact: ImpactAssessment; snapshot: OperationalSnapshot }) {
  const s = impact.summary!;
  const lots = snapshot.ingredientLots.filter((l) => l.ingredientId === impact.after?.ingredientId);
  const noExpiry = lots.filter((l) => !l.expiresAtLocal).length;
  const confirmed = impact.confirmedRequirementKgMilli ?? 0;
  const max = Math.max(s.chickenForecastRequirementKgMilli, (impact.before?.plannedIncomingMilli ?? 0) + s.chickenAvailableKgMilli, 1);
  const rows: Array<[string, number, string, string]> = [
    ["Accepted on hand", s.chickenAvailableKgMilli, "stock", "Physical, quality accepted"],
    ["Incoming before disruption", impact.before?.plannedIncomingMilli ?? 0, "incoming", "Planned PO — never counted as stock"],
    ["Supplier-reported incoming now", impact.after?.supplierClaimedIncomingMilli ?? 0, "claim", "Supplier claim"],
    ["Confirmed-order demand", confirmed, "confirmed", `${s.confirmedChickenPortions} portions, subset of forecast`],
    ["Forecast demand", s.chickenForecastRequirementKgMilli, "forecast", `${s.chickenForecastPortions} chicken portions`],
    ["Available after protecting confirmed", impact.discretionaryAfterConfirmedKgMilli ?? 0, "stock", "For new / forecast orders"],
    ["Forecast ingredient gap", s.demandGapKgMilli, "gap", "Forecast need minus physical"],
  ];
  return (
    <Card title="Inventory impact · chilled chicken">
      <ul className="p2-hbars">
        {rows.map(([label, milli, tone, note]) => (
          <li key={label} className="p2-hbar">
            <span className="p2-hbar__label">{label}</span>
            <span className="p2-hbar__track" aria-hidden="true"><span className={`p2-hbar__fill p2-hbar__fill--${tone}`} style={{ width: `${(milli / max) * 100}%` }} /></span>
            <span className="p2-hbar__value"><Qty milli={milli} /></span>
            <span className="p2-hbar__note">{note}</span>
          </li>
        ))}
      </ul>
      <div className="p2-badges">
        {impact.dataQuality.length === 0 ? <Badge tone="ok">Data CURRENT</Badge> : impact.dataQuality.map((q) => <Badge key={q.code + q.subjectId} tone="warn">{q.status}: {q.code}</Badge>)}
        {impact.after && impact.after.ineligibleOnHandMilli > 0 && <Badge tone="bad">Ineligible stock <Qty milli={impact.after.ineligibleOnHandMilli} /> excluded</Badge>}
        {noExpiry > 0 && <Badge tone="neutral">{noExpiry} lot{noExpiry > 1 ? "s" : ""} without recorded expiry (UNVERIFIED)</Badge>}
      </div>
    </Card>
  );
}

/* E — menu impact ------------------------------------------------------------ */

export function MenuImpact({ state, ingredientId, impact, selectedMenuId, onSelectMenu }: { state: RestaurantState; ingredientId: string; impact: ImpactAssessment | null; selectedMenuId: string | null; onSelectMenu: (menuId: string) => void }) {
  const snap = state.snapshot;
  const menus = affectedMenus(snap, ingredientId);
  const forecastTotals = forecastIngredientRequirements(snap).totals;
  const confirmedTotals = confirmedIngredientRequirements(snap).totals;
  let chickenForecast = 0;
  let chickenConfirmed = 0;
  return (
    <Card title="Menu impact">
      <div className="p2-table-wrap" role="region" aria-label="Menu dependencies" tabIndex={0}>
        <table className="p2-table">
          <caption className="p2-sr">Menu items and chilled chicken requirement</caption>
          <thead>
            <tr>
              <th scope="col">Menu item</th><th scope="col">Recipe</th><th scope="col">Chicken / portion</th>
              <th scope="col">Forecast</th><th scope="col">Confirmed</th><th scope="col">Forecast need</th><th scope="col">Confirmed need</th><th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {snap.menuItems.map((m) => {
              const lookup = findApprovedRecipe(snap, m);
              const per = lookup.ok ? lookup.recipe.components.find((c) => c.ingredientId === ingredientId)?.quantityMilli ?? 0 : 0;
              const forecast = snap.forecasts.filter((f) => f.menuId === m.id).reduce((s, f) => s + f.portions, 0);
              const confirmed = openConfirmedOrders(snap).filter((o) => o.menuId === m.id).reduce((s, o) => s + o.portions, 0);
              const affected = menus.affectedMenuIds.includes(m.id);
              if (affected) {
                chickenForecast += forecast;
                chickenConfirmed += confirmed;
              }
              return (
                <tr key={m.id} className={selectedMenuId === m.id ? "p2-row--selected" : undefined} onClick={() => onSelectMenu(m.id)}>
                  <th scope="row">
                    <button type="button" className="p2-linkbtn" onClick={(e) => { e.stopPropagation(); onSelectMenu(m.id); }}>{m.name}</button>
                  </th>
                  <td className="p2-mono">{lookup.ok ? lookup.recipe.version : "—"}</td>
                  <td>{per ? <Qty milli={per} /> : "—"}</td>
                  <td className="p2-num">{forecast}</td>
                  <td className="p2-num">{confirmed}</td>
                  <td>{per ? <Qty milli={multiplyByPortions(per, forecast)} /> : "—"}</td>
                  <td>{per ? <Qty milli={multiplyByPortions(per, confirmed)} /> : "—"}</td>
                  <td>
                    {!lookup.ok ? <Badge tone="bad">UNKNOWN — {lookup.issue.code}</Badge> : affected ? <Badge tone="warn">Affected</Badge> : <Badge tone="ok">Unaffected — no chicken in BOM</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Chicken-bearing total</th><td /><td />
              <td className="p2-num">{chickenForecast}</td>
              <td className="p2-num">{chickenConfirmed}</td>
              <td><Qty milli={forecastTotals[ingredientId]?.quantityMilli ?? 0} /></td>
              <td><Qty milli={confirmedTotals[ingredientId]?.quantityMilli ?? 0} /></td>
              <td>
                {impact?.summary ? (
                  <span>Physical <Qty milli={impact.summary.chickenAvailableKgMilli} /> · gap <Qty milli={impact.summary.demandGapKgMilli} /></span>
                ) : (
                  <span className="p2-muted">Gap withheld until assessed</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="p2-fineprint">Recipe weights and demand are synthetic demo assumptions, not Happy Potato data. Confirmed portions are included in forecast.</p>
    </Card>
  );
}

/* F — confirmed order protection ---------------------------------------------- */

export function ConfirmedProtection({ state, impact }: { state: RestaurantState; impact: ImpactAssessment }) {
  const snap = state.snapshot;
  const affectedIds = new Set(impact.affectedConfirmedOrderIds);
  const orders = openConfirmedOrders(snap);
  const forecastChicken = impact.summary!.chickenForecastPortions;
  const confirmedChicken = impact.summary!.confirmedChickenPortions;
  return (
    <Card title="Confirmed order protection">
      <ConfirmedCoverage impact={impact} />
      <dl className="p2-facts p2-facts--4">
        <div><dt>Confirmed chicken portions</dt><dd className="p2-num">{confirmedChicken}</dd></div>
        <div><dt>Uncommitted forecast portions</dt><dd className="p2-num">{forecastChicken - confirmedChicken}</dd></div>
        <div><dt>Confirmed requirement</dt><dd><Qty milli={impact.confirmedRequirementKgMilli ?? 0} /></dd></div>
        <div><dt>Potential confirmed shortage</dt><dd><Qty milli={impact.confirmedDeficitKgMilli ?? 0} /></dd></div>
        <div><dt>Deadline</dt><dd>{HP_BUSINESS.confirmedDeadlineLocal} demo clock</dd></div>
        <div><dt>Production readiness</dt><dd>Not scheduled — owned by P4</dd></div>
      </dl>
      <div className="p2-table-wrap" role="region" aria-label="Confirmed orders" tabIndex={0}>
        <table className="p2-table p2-table--compact">
          <caption className="p2-sr">Confirmed order groups</caption>
          <thead><tr><th scope="col">Order group</th><th scope="col">Menu</th><th scope="col">Portions</th><th scope="col">Due</th><th scope="col">Ingredient</th><th scope="col">Fulfilment</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <th scope="row" className="p2-mono">{o.id}</th>
                <td>{snap.menuItems.find((m) => m.id === o.menuId)?.name}</td>
                <td className="p2-num">{o.portions}</td>
                <td>{o.dueTimeLocal}</td>
                <td>{affectedIds.has(o.id) ? <Badge tone="warn">Uses chicken</Badge> : <Badge tone="ok">No chicken</Badge>}</td>
                <td>
                  {affectedIds.has(o.id)
                    ? impact.status === "BREACH_RISK" ? <Badge tone="bad">BREACH_RISK</Badge> : <Badge tone="warn">CONDITIONAL</Badge>
                    : <Badge tone="neutral">Not affected by this incident</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="p2-fineprint">Synthetic aggregate order groups — no customer data. No order is marked fulfilled or dropped by P2.</p>
    </Card>
  );
}

/* G — kitchen and time --------------------------------------------------------- */

export function KitchenTime({ state, incident }: { state: RestaurantState; incident: Incident }) {
  const snap = state.snapshot;
  const claim = snap.supplierClaims.find((c) => c.poId === incident.poId);
  const po = snap.purchaseOrders.find((p) => p.id === incident.poId);
  const start = localTimeToMinutes(HP_BUSINESS.simulationClockLocal);
  const end = localTimeToMinutes(HP_BUSINESS.forecastWindowEndLocal);
  const pos = (t: string) => `${((localTimeToMinutes(t) - start) / (end - start)) * 100}%`;
  const markers: Array<[string, string, string]> = [
    [HP_BUSINESS.simulationClockLocal, "Demo clock · on-hand lots available", "stock"],
    [po?.dueTimeLocal ?? HP_BUSINESS.poDueLocal, claim ? "PO due — supplier claims 0 kg today" : "PO due (planned)", claim ? "bad" : "info"],
    [HP_BUSINESS.prepCutoffLocal, "Prep cutoff for incremental supply", "warn"],
    [HP_BUSINESS.confirmedDeadlineLocal, "Confirmed orders due", "confirmed"],
    [HP_BUSINESS.forecastWindowEndLocal, "Forecast window ends", "neutral"],
  ];
  const quality = dataQualityWarnings(snap);
  return (
    <Card title="Kitchen and time impact">
      <div className="p2-timeline" role="list" aria-label={`Demo service day ${HP_BUSINESS.simulationClockLocal} to ${HP_BUSINESS.forecastWindowEndLocal}`}>
        <div className="p2-timeline__axis" aria-hidden="true" />
        {markers.map(([t, label, tone]) => (
          <div key={label} role="listitem" className={`p2-timeline__mark p2-timeline__mark--${tone}`} style={{ left: pos(t) }}>
            <span className="p2-timeline__time">{t}</span>
            <span className="p2-timeline__label">{label}</span>
          </div>
        ))}
      </div>
      <ul className="p2-stations">
        {snap.resources.map((r) => {
          const ing = CAPABILITY_INGREDIENT[r.capability];
          const served = snap.menuItems.filter((m) => {
            const l = findApprovedRecipe(snap, m);
            return l.ok && ing && l.recipe.components.some((c) => c.ingredientId === ing);
          });
          return (
            <li key={r.id} className="p2-station">
              <div className="p2-station__head"><span className="p2-strong">{r.name}</span><span className="p2-mono p2-muted">{r.id}</span></div>
              <p className="p2-muted">{r.capability} · {served.length ? served.map((m) => m.name).join(", ") : "No menus in current BOM"}</p>
              {ing === incident.ingredientId ? <Badge tone="warn">Chicken supply constrained</Badge> : <Badge tone="ok">Unaffected ingredient</Badge>}
            </li>
          );
        })}
      </ul>
      <ul className="p2-warnings">
        <li>Supply arriving after {HP_BUSINESS.prepCutoffLocal} cannot feed batches that must start earlier.</li>
        <li>{claim ? `No ETA was promised ("${claim.etaLocal ?? "update tomorrow"}" is not a delivery time).` : "No supplier claim recorded yet."}</li>
        <li>Station capacity, batch sizes and staffing are not in the synthetic snapshot: production timing is UNKNOWN to P2. Batch scheduling is owned by P4.</li>
        {quality.map((q) => <li key={q.code + q.subjectId}>{q.status}: {q.message}</li>)}
      </ul>
    </Card>
  );
}

/* H — recovery navigation -------------------------------------------------------- */

export function RecoveryNav({ incident, impactState, hasMessages }: { incident: Incident; impactState: ImpactState; hasMessages: boolean }) {
  const impactReady = impactState === "CURRENT";
  const scenariosReady = ["SCENARIOS_READY", "PENDING_APPROVAL", "APPROVED", "EXECUTING", "AWAITING_EVIDENCE", "CLOSED"].includes(incident.status);
  const items: Array<{ label: string; to: string; enabled: boolean; reason: string }> = [
    { label: "Explore Plan A", to: "/recovery/plan-a", enabled: impactReady, reason: "Needs a current, verified impact" },
    { label: "Explore Plan B", to: "/recovery/plan-b", enabled: impactReady, reason: "Needs a current, verified impact" },
    { label: "Compare recovery plans", to: "/recovery/compare", enabled: scenariosReady, reason: "Plan A and Plan B scenarios are not ready yet" },
    { label: "View incident", to: `/incidents?incident=${incident.id}`, enabled: true, reason: "" },
    { label: "View original supplier message", to: "/message-intelligence", enabled: hasMessages, reason: "No linked message in this session" },
  ];
  return (
    <Card title="Recovery navigation">
      <ul className="p2-nav-ctas">
        {items.map((i) => (
          <li key={i.label}>
            {i.enabled ? (
              <Link to={i.to} className="p2-btn p2-btn--primary">{i.label} <ArrowRight size={16} aria-hidden="true" /></Link>
            ) : (
              <>
                <button type="button" className="p2-btn" disabled aria-describedby={`why-${i.to}`}>{i.label}</button>
                <span id={`why-${i.to}`} className="p2-muted">{i.reason}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="p2-fineprint">P2 does not calculate or choose a recovery plan. Same snapshot fingerprint is passed to Plan A and Plan B.</p>
    </Card>
  );
}

export function WithheldNotice({ impactState }: { impactState: ImpactState }) {
  if (impactState === "NOT_VERIFIED") return <Notice tone="warn" title="Impact withheld — incident not verified">Dependencies below are structural only. Quantified impact appears after P1 verification and assessment.</Notice>;
  if (impactState === "STALE") return <Notice tone="warn" title="Impact is stale">The snapshot changed since the last assessment. Re-assess to refresh all figures.</Notice>;
  if (impactState === "UNKNOWN") return <Notice tone="bad" title="Impact unknown">Required data is missing; no authoritative figures are shown.</Notice>;
  if (impactState === "NOT_ASSESSED") return <Notice tone="info" title="Impact not assessed yet">Run the assessment on the current snapshot to see quantified impact.</Notice>;
  return null;
}
