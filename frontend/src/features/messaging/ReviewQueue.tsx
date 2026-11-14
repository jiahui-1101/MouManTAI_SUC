import { DEFAULT_FILTERS, MessageFilters, matchesMessage, sortMessages } from "./MessageFilters";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { StatusBadge, type StatusTone } from "../../components/ui";
import { PAGE_SIZE, Pager, pageOf } from "./Pager";
import { selectExtractionVersions, type DemoState, type InboxMessage } from "../../store/demoStore";

type QueueTab = "ACTIVE" | "HISTORY";
interface QueueItem { message: InboxMessage; title: string; reason: string; detail: string; priority: "HIGH" | "MEDIUM" | "LOW"; status: string; tone: StatusTone; closed: boolean }

const PRIORITY_TONE: Record<QueueItem["priority"], StatusTone> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };
const CHANNEL: Record<InboxMessage["channel"], string> = { WHATSAPP: "WhatsApp", OUTLOOK: "Outlook", TELEGRAM: "Telegram" };

/** Derives the queue row from real shared state (stage, latest review decision, incident link). */
function toItem(state: DemoState, m: InboxMessage): QueueItem {
  const title = m.subject ?? (m.poId ? `${m.poId} delivery disruption` : m.kind === "SUPPLIER_OFFER" ? "Supplier offer claim" : "Unmatched supplier message");
  if (m.kind === "SUPPLIER_OFFER") {
    const q = m.offerQualification ?? "UNREVIEWED";
    const closed = q === "QUALIFIED_CONDITIONAL" || q === "REJECTED";
    return { message: m, title, priority: "MEDIUM", closed, reason: "Offer qualification required", detail: "Sender and offer claim must be qualified before P3 can use it as evidence.", status: q === "UNREVIEWED" ? "Needs review" : q.replaceAll("_", " ").toLowerCase(), tone: q === "QUALIFIED_CONDITIONAL" ? "success" : q === "REJECTED" ? "danger" : "warning" };
  }
  const latest = selectExtractionVersions(state, m.id).at(-1);
  if (m.linkedIncidentId) return { message: m, title, priority: "HIGH", closed: true, reason: `In incident ${m.linkedIncidentId}`, detail: "Confirmed evidence. Review history is preserved.", status: "Confirmed", tone: "success" };
  if (latest?.reviewStatus === "REJECTED") return { message: m, title, priority: "LOW", closed: true, reason: "Rejected by reviewer", detail: latest.note ?? "No incident was created.", status: "Rejected", tone: "neutral" };
  if (m.extraction === "UNRESOLVED") return { message: m, title, priority: "LOW", closed: false, reason: "No supported extraction", detail: "No PO or disruption could be grounded in the original text.", status: "Needs review", tone: "warning" };
  if (m.verification === "UNVERIFIED_SENDER") return { message: m, title, priority: "MEDIUM", closed: false, reason: "Sender not allowlisted", detail: "Identity must be resolved; field edits cannot verify the sender.", status: "Needs review", tone: "warning" };
  if (latest?.reviewStatus === "UNRESOLVED") return { message: m, title, priority: "HIGH", closed: false, reason: "Marked unresolved", detail: latest.note ?? "Reopen with a correction to continue.", status: "On hold", tone: "warning" };
  const corrected = latest?.method === "HUMAN_CORRECTION";
  return { message: m, title, priority: "HIGH", closed: false, reason: corrected ? "Correction awaiting decision" : "Supplier disruption reported", detail: state.incident.status === "VERIFIED" ? "Link this channel to the existing incident after review." : "Review the extraction and confirm the incident.", status: "Needs review", tone: "warning" };
}

export function ReviewQueue({ state, selectedId }: { state: DemoState; selectedId: string | null }) {
  const [tab, setTab] = useState<QueueTab>("ACTIVE");
  const [query, setQuery] = useState("");
  const [criteria, setCriteria] = useState(DEFAULT_FILTERS);
  const items = useMemo(() => state.messages.map((m) => toItem(state, m)), [state]);
  const active = items.filter((i) => !i.closed);
  const filtered = items
    .filter((i) => (tab === "ACTIVE" ? !i.closed : i.closed))
    .filter(i => matchesMessage(i.message, criteria))
    .sort((a, b) => sortMessages(a.message, b.message, criteria))
    .filter((i) => `${i.title} ${i.message.senderDisplay} ${i.reason} ${i.message.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const [page, setPage] = useState(() => pageOf(filtered.findIndex((i) => i.message.id === selectedId)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return <section className="rq" aria-labelledby="rq-title">
    <header className="rq__head">
      <div><p id="rq-title" className="rq__eyebrow">Human review</p></div>
      <span className="rq__count">{active.length} active</span>
    </header>
    <div className="rq__tools">


    </div>
    <MessageFilters search={<label className="rq__search"><Search aria-hidden="true" size={16} /><span className="sr-only">Search review queue</span><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search subject, sender, reason" /></label>} mode="review" reviewControl={<label><span>Review status</span><select value={tab} onChange={event => { setTab(event.target.value as QueueTab); setPage(1); }}><option value="ACTIVE">Active reviews</option><option value="HISTORY">Completed reviews</option></select></label>} value={criteria} count={filtered.length} onChange={value => { setCriteria(value); setPage(1); }} onClear={() => { setCriteria(DEFAULT_FILTERS); setQuery(""); setPage(1); setTab("ACTIVE"); }} />
    <ul className="rq__list" aria-label="Review queue items">
      {visible.length === 0 && <li className="rq__empty">{tab === "ACTIVE" ? "Nothing waiting for review." : "No completed reviews yet."}</li>}
      {visible.map((i) => <li key={i.message.id} className={`rq-card ${i.message.id === selectedId ? "is-selected" : ""}`}>
        <div className="rq-card__top">
          <h3 className="rq-card__title">{i.title}</h3>
          <Link className={`fm-btn fm-btn--sm ${i.message.id === selectedId ? "fm-btn--ghost" : "fm-btn--primary"}`} to={`/message-intelligence?message=${i.message.id}`} aria-label={`Open review ${i.message.id} · ${i.message.senderDisplay}`} aria-current={i.message.id === selectedId ? "page" : undefined}>{i.message.id === selectedId ? "Reviewing" : "Open review"}</Link>
        </div>
        <p className="rq-card__reason">{i.reason}</p>
        <p className="rq-card__sender">{i.message.senderDisplay} · {CHANNEL[i.message.channel]} · {i.message.id}</p>
        <p className="rq-card__detail">{i.detail}</p>
        <div className="rq-card__meta">
          <StatusBadge tone={PRIORITY_TONE[i.priority]}>{i.priority}</StatusBadge>
          <StatusBadge tone={i.tone}>{i.status}</StatusBadge>
          <StatusBadge tone="simulated">Simulated</StatusBadge>
          <time dateTime={i.message.receivedAtIso}>{i.message.receivedAtIso.slice(11, 16)} MYT</time>
        </div>
      </li>)}
    </ul>
    <Pager total={filtered.length} page={current} pageSize={PAGE_SIZE} onPage={setPage} label="Review queue pages" />
  </section>;
}
