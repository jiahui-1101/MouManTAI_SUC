import { useMemo, useState } from "react";
import { Mail, MessageCircle, Search, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { type InboxChannel, type InboxMessage, inboxStore, useInboxState } from "../../features/messaging/inboxStore";

type Filter = "ALL" | InboxChannel;
const filters: readonly { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" }, { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OUTLOOK", label: "Outlook" }, { value: "TELEGRAM", label: "Telegram" },
];

function ChannelIcon({ channel }: { channel: InboxChannel }) {
  if (channel === "OUTLOOK") return <Mail aria-hidden="true" size={17} />;
  if (channel === "TELEGRAM") return <Send aria-hidden="true" size={17} />;
  return <MessageCircle aria-hidden="true" size={17} />;
}

function stageLabel(stage: InboxMessage["stage"]) {
  const labels: Record<InboxMessage["stage"], string> = { LINKED: "Linked to incident", REVIEW_PENDING: "Review pending", PARSED: "Parsed", UNMATCHED: "Unmatched", UNVERIFIED: "Unverified sender" };
  return labels[stage];
}

function channelLabel(channel: InboxChannel) { return channel === "OUTLOOK" ? "Outlook" : channel[0] + channel.slice(1).toLowerCase(); }
function exactTime(iso: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Singapore" }).format(new Date(iso)) + " MYT"; }

export function InboxPage() {
  const { messages, selectedId, suppressedDuplicateCount, preferences, loadStatus, incident } = useInboxState();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => messages.filter((message) => {
    const matchesChannel = filter === "ALL" || message.channel === filter;
    const haystack = `${message.senderDisplay} ${message.subject ?? ""} ${message.poId ?? ""} ${message.rawText}`.toLowerCase();
    return matchesChannel && haystack.includes(query.trim().toLowerCase());
  }).sort((a, b) => preferences.unreadFirst ? Number(a.read) - Number(b.read) : 0), [filter, messages, preferences.unreadFirst, query]);
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0];

  if (loadStatus === "LOADING") return <PageContainer title={titleFor("/inbox")}><p role="status" aria-busy="true">Loading local mock fixture…</p><button onClick={() => inboxStore.setMockLoadStatus()}>Finish mock loading</button></PageContainer>;
  if (loadStatus === "ERROR") return <PageContainer title={titleFor("/inbox")}><p role="alert">Mock fixture loading failed. No provider was contacted.</p><button onClick={() => inboxStore.setMockLoadStatus()}>Retry local fixture</button></PageContainer>;

  if (!selected) return <PageContainer title={titleFor("/inbox")}><div className="inbox__empty"><strong>No fixture messages loaded</strong><p>SIMULATED_CHANNEL · Load a predefined scenario from Channels.</p><Link to="/channels">Choose a demo scenario</Link></div></PageContainer>;

  return <PageContainer title={titleFor("/inbox")}>
    <div className="inbox__intro">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{messages.length} simulated messages available; {messages.filter((message) => !message.read).length} unread.</p>
      <div><p className="inbox__eyebrow">Happy Potato • Demo data</p><p>Unified supplier messages from the shared offline scenario.</p></div>
      <span className="inbox__mode">Simulation only · no channels connected</span>
    </div>
    <div className="inbox__filters" aria-label="Inbox filters">
      {filters.map(({ value, label }) => <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{value === "ALL" ? messages.length : messages.filter((item) => item.channel === value).length}</span></button>)}
    </div>
    <label className="inbox__search"><Search aria-hidden="true" size={17} /><span className="sr-only">Search messages</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sender, subject, PO or message" /></label>
    <div className="inbox__notice" role="status"><strong>{suppressedDuplicateCount} duplicate{suppressedDuplicateCount === 1 ? "" : "s"} suppressed</strong><span>A repeated provider event was ignored using its channel, account and provider message ID.</span></div>
    <div className="inbox__workspace">
      <section className="inbox__list" aria-label="Messages">
        {visible.length === 0 ? <div className="inbox__empty"><strong>No messages found</strong><span>Try another channel or search term.</span></div> : visible.map((message, index) => <button type="button" key={message.id} className={`message-card ${selected.id === message.id ? "is-selected" : ""}`} onKeyDown={(event) => { const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0; if (offset) { event.preventDefault(); const target = visible[(index + offset + visible.length) % visible.length]!; inboxStore.select(target.id); const buttons = event.currentTarget.parentElement?.querySelectorAll("button"); buttons?.[(index + offset + visible.length) % visible.length]?.focus(); } }} onClick={() => inboxStore.select(message.id)} aria-pressed={selected.id === message.id}>
          <span className="message-card__icon"><ChannelIcon channel={message.channel} /></span>
          <span className="message-card__content"><span className="message-card__top"><strong>{message.senderDisplay}</strong><time dateTime={message.receivedAtIso}>{message.receivedAtIso.slice(11, 16)} MYT</time></span><span>{message.subject ?? message.poId ?? message.rawText}</span><span className="message-card__meta"><span>SIMULATED_CHANNEL</span><span className={`status-${message.stage.toLowerCase()}`}>{stageLabel(message.stage)}</span>{!message.read && <span className="message-card__unread">Unread</span>}</span></span>
        </button>)}
      </section>
      <article className="message-detail" aria-label="Selected message">
        <header><div><span className="message-detail__channel"><ChannelIcon channel={selected.channel} /> {channelLabel(selected.channel)}</span><h2>{selected.subject ?? selected.poId ?? "Unmatched supplier message"}</h2></div><span className={`message-detail__status status-${selected.stage.toLowerCase()}`}>{stageLabel(selected.stage)}</span></header>
        <dl className="message-detail__facts"><div><dt>Synthetic sender</dt><dd>{selected.senderDisplay} · {selected.verification === "VERIFIED_DEMO_CONTACT" ? "Verified demo contact" : "Unverified sender"}</dd></div><div><dt>Exact received time</dt><dd><time dateTime={selected.receivedAtIso}>{exactTime(selected.receivedAtIso)}</time></dd></div><div><dt>Provider ID</dt><dd>{selected.providerMessageId.replace(/(.{8}).+/, "$1••••")}</dd></div><div><dt>Provenance</dt><dd><strong>SIMULATED_CHANNEL</strong> · not live</dd></div></dl>
        <section className="message-detail__original" aria-labelledby="original-message-heading"><div><h3 id="original-message-heading">Immutable original message</h3><span>Read-only source evidence</span></div><p>{selected.rawText}</p></section>
        <div className="message-detail__extraction"><div><span>PO match</span><strong>{selected.poId ?? "No matched PO"}</strong></div><div><span>Extraction</span><strong>{selected.extraction}</strong></div><div><span>Linked incident</span><strong>{selected.linkedIncidentId ?? "Not linked"}</strong></div></div>
        {selected.poId && selected.kind !== "SUPPLIER_OFFER" && <div className="message-detail__extraction"><div><span>Expected</span><strong>20.000 kg</strong></div><div><span>Claimed today</span><strong>0.000 kg</strong></div><div><span>Delivery ETA</span><strong>Unknown</strong></div></div>}
        {preferences.showProcessingTimeline && <ol className="message-detail__timeline" aria-label="Processing timeline"><li className="is-done">Received</li><li className={selected.stage !== "UNMATCHED" && selected.stage !== "UNVERIFIED" ? "is-done" : ""}>Parsed</li><li className={selected.stage === "REVIEW_PENDING" || selected.stage === "LINKED" ? "is-done" : ""}>Review</li><li className={selected.stage === "LINKED" ? "is-done" : ""}>Linked to Incident</li></ol>}
        {selected.verification === "UNVERIFIED_SENDER" && <p className="message-detail__warning"><strong>Human review required.</strong> This synthetic sender is not allowlisted, so no verified incident or deficit can be published.</p>}
        {selected.kind === "SUPPLIER_OFFER" && <p className="message-detail__warning" data-testid="inbox-offer-note"><strong>Supplier offer claim ({selected.offerQualification}).</strong> 15.000 kg chilled chicken offer for P3 review — not goods received or confirmed procurement.</p>}
        {selected.extraction === "UNRESOLVED" && <p className="message-detail__warning"><strong>Unmatched message.</strong> No PO or disruption was inferred from the original text.</p>}
        <p className="message-detail__correlation" data-testid="inbox-incident-status">Canonical channel messages refer to one disruption. <strong>{incident.id}</strong> is {incident.status === "VERIFIED" ? "verified" : "pending verification"} with {incident.messageIds.length} linked message{incident.messageIds.length === 1 ? "" : "s"}; the {(incident.claimedShortfallKgMilli / 1000).toFixed(3)} kg PO shortfall is not multiplied.{incident.status === "VERIFIED" && <> P2 handoff: {incident.handoff.status === "ACKNOWLEDGED_BY_P2" ? "acknowledged" : "awaiting Impact consumer"}. <Link to="/impact">Impact Explorer</Link></>}</p>
        <Link className="message-detail__action" to={`/message-intelligence?message=${selected.id}`}>Open in Message Intelligence</Link>
      </article>
    </div>
  </PageContainer>;
}
