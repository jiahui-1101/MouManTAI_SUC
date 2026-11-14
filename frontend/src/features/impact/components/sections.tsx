import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useState, type ReactNode } from "react";
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
import { DisruptionPanel } from "../../incidents/components/DisruptionPanel";
import { useRestaurantStore } from "../../../services/mock/restaurantStore";
import { readinessRows } from "../../incidents/model";
import { ConfirmedCoverage } from "../../incidents/components/ImpactPreview";
import { multiplyByPortions } from "../../../utils/quantity";

/* A — incident context ---------------------------------------------------- */

export function ImpactContext({ incident, snapshot, messages, impactState }: { incident: Incident; snapshot: OperationalSnapshot; messages: SimulatedMessage[]; impactState: ImpactState }) {
  const po = snapshot.purchaseOrders.find((p) => p.id === incident.poId);
  const claim = snapshot.supplierClaims.find((c) => c.poId === incident.poId);
  const { restaurant } = useRestaurantStore();
  const ready = readinessRows(restaurant).find((r) => r.ingredientId === incident.ingredientId);
  return (
    <Card title="Incident context" actions={<StatusBadge status={incident.status} />}>
      <DisruptionPanel incident={incident} link={`/incidents?incident=${incident.id}`} po={po} claim={claim} ready={ready} />
      <details className="p2-evidence">
        <summary>Evidence details ({messages.length} linked message{messages.length === 1 ? "" : "s"})</summary>
        <ul className="p2-messages">
          {messages.map((m) => (
            <li key={m.id} className="p2-message">
              <div className="p2-message__meta"><Badge tone="neutral">{m.channel}</Badge><Badge tone="neutral">Simulated channel</Badge><span className="p2-mono">{m.id}</span></div>
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

type CoverKey = "before" | "after";

/** Ring showing how much of the forecast need a supply covers. */
function NeedRing({ parts, need, tone }: { parts: Array<{ milli: number; cls: string }>; need: number; tone: "ok" | "bad" }) {
  const R = 48, C = 2 * Math.PI * R;
  const total = parts.reduce((n, p) => n + p.milli, 0);
  const pct = need > 0 ? Math.round((total / need) * 100) : 0;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" className="p2-cc__ring" aria-hidden="true">
      <circle cx="60" cy="60" r={R} className="p2-cc__track" />
      {parts.map((p) => {
        const f = need > 0 ? Math.min(p.milli / need, Math.max(1 - acc, 0)) : 0;
        const el = <circle key={p.cls} cx="60" cy="60" r={R} className={p.cls} strokeDasharray={`${f * C} ${C}`} strokeDashoffset={-acc * C} transform="rotate(-90 60 60)" />;
        acc += f;
        return el;
      })}
      <text x="60" y="58" className={`p2-cc__pct p2-cc__pct--${tone}`}>{pct}%</text>
      <text x="60" y="76" className="p2-cc__of">of need</text>
    </svg>
  );
}

function CoverageCompare({ stock, physical, incoming, claimed, after, need }: { stock: number; physical: number; incoming: number; claimed: number; after: number; need: number }) {
  const [open, setOpen] = useState<CoverKey | null>(null);
  const toggle = (k: CoverKey) => setOpen((c) => (c === k ? null : k));
  const projected = stock + incoming;
  const missing = Math.max(need - after, 0);
  const cards: Array<{ key: CoverKey; title: string; total: number; sub: string; tone: "ok" | "bad"; parts: Array<{ milli: number; cls: string }>; badge: ReactNode }> = [
    { key: "before", title: "Before the claim", total: projected, sub: `${fmtQty(stock)} kg stock + ${fmtQty(incoming)} kg PO`, tone: "ok",
      parts: [{ milli: stock, cls: "p2-cc__stock" }, { milli: incoming, cls: "p2-cc__po" }], badge: <Badge tone="ok">Covered</Badge> },
    { key: "after", title: "After the claim", total: after, sub: `${fmtQty(after)} kg stock · ${fmtQty(missing)} kg missing`, tone: "bad",
      parts: [{ milli: after, cls: "p2-cc__stock" }], badge: <Badge tone="bad">Short {fmtQty(missing)} kg</Badge> },
  ];
  const sel = cards.find((c) => c.key === open) ?? null;
  return (
    <div className="p2-cc-wrap">
      <div className={`p2-ready__stage${sel ? " p2-ready__stage--open" : ""}`}>
        <div className="p2-cc">
          {cards.map((c) => (
            <div key={c.key} role="button" tabIndex={0} aria-pressed={open === c.key} aria-label={`Show details: ${c.title}`}
              className={`p2-ready p2-ready--clickable p2-cc__card${open === c.key ? " p2-ready--selected" : ""}`}
              onClick={() => toggle(c.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(c.key); } }}>
              <div className="p2-ready__head"><span className="p2-ready__name">{c.title}</span>{c.badge}</div>
              <div className="p2-cc__body">
                <NeedRing parts={c.parts} need={need} tone={c.tone} />
                <div className="p2-cc__text">
                  <span className="p2-cc__total"><Qty milli={c.total} /></span>
                  <span className="p2-cc__sub">{c.sub}</span>
                  <span className="p2-cc__sub">Need {fmtQty(need)} kg for forecast</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {sel && (
          <section className="p2-node-detail p2-ready__detail" aria-live="polite" aria-label={`Details: ${sel.title}`}>
            <header className="p2-node-detail__head">
              <div className="p2-node-detail__name">
                <h3 className="p2-node-detail__title">{sel.title}</h3>
                <p className="p2-eyebrow">Chicken vs forecast need</p>
              </div>
              <button type="button" className="p2-icon-btn" onClick={() => setOpen(null)} aria-label="Close details"><X size={16} aria-hidden="true" /></button>
            </header>
            {sel.badge}
            <dl className="p2-mini">
              <div><dt>Physical on hand</dt><dd><Qty milli={physical} /></dd></div>
              <div><dt>Eligible stock</dt><dd><Qty milli={sel.key === "before" ? stock : after} /></dd></div>
              {sel.key === "before"
                ? <div><dt>Planned PO incoming</dt><dd><Qty milli={incoming} /></dd></div>
                : <div><dt>Supplier-claimed today</dt><dd><Qty milli={claimed} /></dd></div>}
              <div><dt>Total supply</dt><dd className="p2-strong"><Qty milli={sel.total} /></dd></div>
              <div><dt>Forecast need</dt><dd><Qty milli={need} /></dd></div>
              <div><dt>{sel.total >= need ? "Surplus" : "Missing"}</dt><dd className={sel.total >= need ? "p2-pos" : "p2-neg"}><Qty milli={Math.abs(sel.total - need)} /></dd></div>
            </dl>
            <p className="p2-fineprint">{sel.key === "before" ? "Assumes the planned PO arrives in full before the prep cutoff." : "The supplier says nothing arrives today; only physical stock counts."}</p>
          </section>
        )}
      </div>
      <p className="p2-legend p2-cc__legend">
        <span className="p2-legend__item"><span className="p2-cc__key p2-cc__key--stock" /> Physical stock</span>
        <span className="p2-legend__item"><span className="p2-cc__key p2-cc__key--po" /> Planned PO</span>
        <span className="p2-legend__item"><span className="p2-cc__key p2-cc__key--miss" /> Missing vs need</span>
        <span className="p2-ready__hint">Click a card for details</span>
      </p>
    </div>
  );
}

export function BeforeAfter({ impact }: { impact: ImpactAssessment }) {
  const before = impact.before!;
  const after = impact.after!;
  const s = impact.summary!;
  const projectedBefore = before.availableAfterReservationsMilli + before.plannedIncomingMilli;
  const afterTotal = s.chickenAvailableKgMilli;
  const need = s.chickenForecastRequirementKgMilli;
  return (
    <Card title="Before vs after the supplier claim" className="p2-ba-card">
      <CoverageCompare stock={before.availableAfterReservationsMilli} physical={before.physicalOnHandMilli} incoming={before.plannedIncomingMilli} claimed={after.supplierClaimedIncomingMilli} after={afterTotal} need={need} />
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
    <Card title="Confirmed order protection" className="p2-cop">
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
    </Card>
  );
}

/* G — kitchen and time --------------------------------------------------------- */

export function KitchenTime({ state, incident, onSelectStation, selectedId }: { state: RestaurantState; incident: Incident; onSelectStation?: (nodeId: string) => void; selectedId?: string | null }) {
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
            <li key={r.id} className={`p2-station${onSelectStation ? " p2-station--clickable" : ""}${selectedId === `station:${r.id}` ? " p2-station--selected" : ""}`}
              role={onSelectStation ? "button" : undefined} tabIndex={onSelectStation ? 0 : undefined}
              aria-label={onSelectStation ? `Show ${r.name} in the dependency graph` : undefined}
              onClick={onSelectStation ? () => onSelectStation(`station:${r.id}`) : undefined}
              onKeyDown={onSelectStation ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectStation(`station:${r.id}`); } } : undefined}>
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
  const items: Array<{ badge: string; label: string; desc: string; to: string; enabled: boolean; reason: string }> = [
    { badge: "A", label: "Plan A · External supplier", desc: "Source the missing chicken from alternative suppliers.", to: "/recovery/plan-a", enabled: impactReady, reason: "Needs a current, verified impact" },
    { badge: "B", label: "Plan B · Internal recovery", desc: "No purchase: reallocate stock, adjust menu and prep.", to: "/recovery/plan-b", enabled: impactReady, reason: "Needs a current, verified impact" },
    { badge: "⇄", label: "Compare recovery plans", desc: "Plan A and Plan B side by side on the same snapshot.", to: "/recovery/compare", enabled: scenariosReady, reason: "Plan A and Plan B scenarios are not ready yet" },
    { badge: "i", label: "View incident", desc: `Lifecycle and evidence for ${incident.id}.`, to: `/incidents?incident=${incident.id}`, enabled: true, reason: "" },
    { badge: "✉", label: "Original supplier message", desc: "The message this incident was raised from.", to: "/message-intelligence", enabled: hasMessages, reason: "No linked message in this session" },
  ];
  return (
    <Card title="Recovery navigation">
      <ul className="p2-queue p2-queue--grid">
        {items.slice(0, 3).map((i) => {
          const body = (
            <>
              <span className={`p2-queue__num${i.badge === "A" || i.badge === "B" ? " p2-queue__num--plan" : ""}`} aria-hidden="true">{i.badge}</span>
              <span className="p2-queue__text">
                <span className="p2-queue__label">{i.label}</span>
                <span className="p2-queue__desc">{i.enabled ? i.desc : i.reason}</span>
              </span>
              {i.enabled && <span className="p2-queue__cta"><span className="p2-queue__cta-text">Open</span><ArrowRight size={14} aria-hidden="true" /></span>}
            </>
          );
          return (
            <li key={i.label}>
              {i.enabled
                ? <Link to={i.to} className="p2-queue__row">{body}</Link>
                : <div className="p2-queue__row p2-queue__row--disabled" aria-disabled="true">{body}</div>}
            </li>
          );
        })}
      </ul>
      <div className="p2-navlinks">
        <span className="p2-navlinks__label">Related</span>
        {items.slice(3).map((i) => i.enabled
          ? <Link key={i.label} to={i.to} className="p2-navlinks__link">{i.label} <ArrowRight size={13} aria-hidden="true" /></Link>
          : <span key={i.label} className="p2-navlinks__link p2-navlinks__link--off" title={i.reason}>{i.label}</span>)}
      </div>
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
