import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Activity, ClipboardList, History, MessageSquare, Truck, X, type LucideIcon } from "lucide-react";
import type { Incident } from "../../../types/restaurant";
import { useRestaurantStore } from "../../../services/mock/restaurantStore";
import { selectCurrentImpact } from "../../../services/mock/restaurantState";
import { HP_BUSINESS } from "../../../data/fixtures/happyPotato";
import { dataQualityWarnings } from "../../impact/calculations";
import {
  INCIDENT_TYPE_LABEL,
  impactStateOf,
  ingredientName,
  menuSummary,
  nextActions,
  severityOf,
  supplierName,
} from "../model";
import { ActivityList } from "./ActivityList";
import { ImpactPreview } from "./ImpactPreview";
import { LifecycleStepper } from "./LifecycleStepper";
import { NextActions } from "./NextActions";
import { Badge, Qty, SeverityBadge, SimulatedTag, StatusBadge, SyntheticTag } from "./ui";

const CHANNEL_LABEL = { WHATSAPP: "WhatsApp", OUTLOOK: "Outlook", TELEGRAM: "Telegram" } as const;

type DrawerTab = "summary" | "supplier" | "impact" | "messages" | "history";

export function IncidentDetail({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const store = useRestaurantStore();
  const { restaurant } = store;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const impact = selectCurrentImpact(restaurant, incident.id);
  const impactState = impactStateOf(restaurant, incident);
  const po = restaurant.snapshot.purchaseOrders.find((p) => p.id === incident.poId);
  const claim = restaurant.snapshot.supplierClaims.find((c) => c.poId === incident.poId);
  const messages = store.messages.filter((m) => m.incidentId === incident.id);
  const events = store.activity.filter((e) => e.incidentId === incident.id);
  const menus = menuSummary(restaurant, incident.ingredientId);
  const quality = dataQualityWarnings(restaurant.snapshot);
  const [tab, setTab] = useState<DrawerTab>("summary");
  useEffect(() => setTab("summary"), [incident.id]);
  const TABS: Array<[DrawerTab, string, LucideIcon, number | null]> = [
    ["summary", "Summary", ClipboardList, null],
    ["supplier", "Supplier & PO", Truck, null],
    ["impact", "Impact", Activity, menus.filter((m) => m.dependency === "AFFECTED").length],
    ["messages", "Messages", MessageSquare, messages.length],
    ["history", "History", History, events.length],
  ];
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex(([id]) => id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : -1;
    const nextTab = TABS[next];
    if (!nextTab) return;
    e.preventDefault();
    setTab(nextTab[0]);
    document.getElementById(`incident-tab-${nextTab[0]}`)?.focus();
  };

  useEffect(() => {
    // Return focus to whatever opened the drawer when it closes.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [incident.id, onClose]);

  return (
    <div className="p2-drawer" role="dialog" aria-modal="false" aria-labelledby="incident-detail-title">
      <header className="p2-drawer__head">
        <div>
          <p className="p2-eyebrow">{INCIDENT_TYPE_LABEL[incident.type]} · {ingredientName(incident.ingredientId)}</p>
          <h2 id="incident-detail-title" className="p2-drawer__title" tabIndex={-1} ref={headingRef}>
            {incident.id}
          </h2>
          <div className="p2-badges">
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={severityOf(impact)} />
            <SyntheticTag />
          </div>
        </div>
        <button type="button" className="p2-icon-btn" onClick={onClose} aria-label="Close incident details">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <nav className="p2-drawer__tabs" role="tablist" aria-label="Incident details sections">
        {TABS.map(([id, label, Icon, count]) => (
          <button key={id} id={`incident-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`incident-panel-${id}`}
            tabIndex={tab === id ? 0 : -1} className="p2-drawer__tab" onClick={() => setTab(id)} onKeyDown={onTabKey}>
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
            {count !== null && <span className="p2-drawer__count">{count}</span>}
          </button>
        ))}
      </nav>

      <div className="p2-drawer__body" role="tabpanel" id={`incident-panel-${tab}`} aria-labelledby={`incident-tab-${tab}`}>
{tab === "summary" && (<>
        <section className="p2-section">
          <h3 className="p2-section__title">Lifecycle</h3>
          <LifecycleStepper status={incident.status} />
        </section>

        <section className="p2-section">
          <h3 className="p2-section__title">Next action</h3>
          <NextActions variant="queue" actions={nextActions(restaurant, incident)} />
        </section>
        </>)}

{tab === "supplier" && (<>
        <section className="p2-section">
          <h3 className="p2-section__title">Supplier and purchase order</h3>
          <dl className="p2-facts">
            <div><dt>Supplier</dt><dd>{supplierName(incident.supplierId)} <span className="p2-mono">{incident.supplierId}</span></dd></div>
            <div><dt>Purchase order</dt><dd className="p2-mono">{incident.poId}</dd></div>
            <div><dt>PO status</dt><dd className="p2-mono">{po?.state ?? "Not found"}</dd></div>
            <div><dt>PO due</dt><dd>{po?.dueTimeLocal ?? "—"} demo clock</dd></div>
            <div><dt>Expected</dt><dd>{po?.expectedKgMilli != null ? <Qty milli={po.expectedKgMilli} /> : "Unknown"}</dd></div>
            <div>
              <dt>Claimed today</dt>
              <dd>
                {claim ? <Qty milli={claim.claimedDeliveryTodayKgMilli} /> : "No verified claim"} <Badge tone="warn">Supplier claim</Badge>
              </dd>
            </div>
            <div><dt>Reported PO shortfall</dt><dd><Qty milli={incident.claimedShortfallKgMilli} /></dd></div>
            <div><dt>New ETA</dt><dd>{claim ? (claim.etaLocal ?? "Unknown — not promised") : "—"}</dd></div>
          </dl>
          <p className="p2-fineprint">A supplier message is evidence of a statement, not a goods receipt. Physical stock is unchanged.</p>
        </section>
        </>)}

{tab === "impact" && (<>
        <section className="p2-section">
          <h3 className="p2-section__title">Impact preview</h3>
          <ImpactPreview impact={impact} impactState={impactState} />
        </section>

        <section className="p2-section">
          <h3 className="p2-section__title">Related menus (from BOM)</h3>
          <div className="p2-table-wrap">
          <table className="p2-table p2-table--compact">
            <thead>
              <tr><th scope="col">Menu item</th><th scope="col">Chicken / portion</th><th scope="col">Forecast</th><th scope="col">Confirmed</th><th scope="col">Dependency</th></tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.menuId}>
                  <th scope="row">{m.name}</th>
                  <td>{m.chickenPerPortionMilli ? <Qty milli={m.chickenPerPortionMilli} /> : "—"}</td>
                  <td className="p2-num">{m.forecast}</td>
                  <td className="p2-num">{m.confirmed}</td>
                  <td>
                    {m.dependency === "AFFECTED" ? <Badge tone="warn">Uses chicken</Badge> : m.dependency === "UNAFFECTED" ? <Badge tone="ok">Unaffected</Badge> : <Badge tone="bad">Unknown BOM</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="p2-fineprint">Confirmed portions are part of forecast, not added to it.</p>
        </section>
        </>)}

{tab === "messages" && (<>
        <section className="p2-section">
          <h3 className="p2-section__title">Linked supplier messages ({messages.length})</h3>
          {messages.length === 0 ? (
            <p className="p2-muted">No messages in this local session. Real messages will come from the P1 inbox.</p>
          ) : (
            <ul className="p2-messages">
              {messages.map((m) => (
                <li key={m.id} className="p2-message">
                  <div className="p2-message__meta">
                    <Badge tone="info">{CHANNEL_LABEL[m.channel]}</Badge>
                    <SimulatedTag>Simulated channel</SimulatedTag>
                    <span className="p2-mono">{m.id}</span>
                  </div>
                  {m.subject && <p className="p2-message__subject">{m.subject}</p>}
                  <blockquote className="p2-message__text">{m.text}</blockquote>
                  <p className="p2-fineprint">{m.senderLabel} · recorded {new Date(m.receivedAtIso).toLocaleTimeString()}</p>
                </li>
              ))}
            </ul>
          )}
          {messages.length > 1 && <p className="p2-fineprint">{messages.length} reports linked to one incident — the 20 kg shortage is counted once.</p>}
        </section>
        </>)}

{tab === "history" && (<>
        <section className="p2-section">
          <h3 className="p2-section__title">Evidence and snapshot</h3>
          <dl className="p2-facts">
            <div><dt>Snapshot</dt><dd className="p2-mono">{restaurant.snapshot.id} · r{restaurant.snapshot.revision}</dd></div>
            <div><dt>Fingerprint</dt><dd className="p2-mono p2-wrap">{restaurant.snapshot.fingerprint}</dd></div>
            <div><dt>Incident bound to</dt><dd className="p2-mono p2-wrap">{incident.snapshotFingerprint}</dd></div>
            <div><dt>Business clock</dt><dd>{HP_BUSINESS.fixtureBusinessDate} · {HP_BUSINESS.simulationClockLocal} demo clock</dd></div>
            <div><dt>Evidence refs</dt><dd className="p2-mono p2-wrap">{incident.messageIds.join(", ") || "—"}</dd></div>
          </dl>
          {quality.length > 0 && (
            <ul className="p2-quality">
              {quality.map((q) => (
                <li key={`${q.code}-${q.subjectId}`}><Badge tone="warn">{q.status}</Badge> {q.message}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="p2-section">
          <h3 className="p2-section__title">Event history</h3>
          <ActivityList muted events={events} emptyText="No events recorded for this incident." />
        </section>
        </>)}
      </div>
    </div>
  );
}
