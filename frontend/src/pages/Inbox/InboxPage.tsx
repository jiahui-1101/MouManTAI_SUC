import { useMemo, useState } from "react";
import { Mail, MessageCircle, Search, Send } from "lucide-react";
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
  return stage === "LINKED" ? "Linked to incident" : stage === "REVIEW_PENDING" ? "Review pending" : "Parsed";
}

export function InboxPage() {
  const { messages, selectedId } = useInboxState();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => messages.filter((message) => {
    const matchesChannel = filter === "ALL" || message.channel === filter;
    const haystack = `${message.senderDisplay} ${message.subject ?? ""} HP-PO-1042 ${message.rawText}`.toLowerCase();
    return matchesChannel && haystack.includes(query.trim().toLowerCase());
  }), [filter, messages, query]);
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0]!;

  return <PageContainer title={titleFor("/inbox")}>
    <div className="inbox__intro">
      <div><p className="inbox__eyebrow">Happy Potato • Demo data</p><p>Unified supplier messages from the shared offline scenario.</p></div>
      <span className="inbox__mode">Simulation only · no channels connected</span>
    </div>
    <div className="inbox__filters" aria-label="Inbox filters">
      {filters.map(({ value, label }) => <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{value === "ALL" ? messages.length : messages.filter((item) => item.channel === value).length}</span></button>)}
    </div>
    <label className="inbox__search"><Search aria-hidden="true" size={17} /><span className="sr-only">Search messages</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sender, subject, PO or message" /></label>
    <div className="inbox__workspace">
      <section className="inbox__list" aria-label="Messages">
        {visible.length === 0 ? <div className="inbox__empty"><strong>No messages found</strong><span>Try another channel or search term.</span></div> : visible.map((message) => <button type="button" key={message.id} className={`message-card ${selected.id === message.id ? "is-selected" : ""}`} onClick={() => inboxStore.select(message.id)} aria-pressed={selected.id === message.id}>
          <span className="message-card__icon"><ChannelIcon channel={message.channel} /></span>
          <span className="message-card__content"><span className="message-card__top"><strong>{message.senderDisplay}</strong><time dateTime={message.receivedAtIso}>{message.receivedAtIso.slice(11, 16)} MYT</time></span><span>{message.subject ?? "PO HP-PO-1042 delivery update"}</span><span className="message-card__meta"><span>Simulated inbound message</span><span>{stageLabel(message.stage)}</span>{!message.read && <span className="message-card__unread">Unread</span>}</span></span>
        </button>)}
      </section>
      <article className="message-detail" aria-label="Selected message">
        <header><div><span className="message-detail__channel"><ChannelIcon channel={selected.channel} /> {selected.channel === "OUTLOOK" ? "Outlook" : selected.channel[0] + selected.channel.slice(1).toLowerCase()}</span><h2>{selected.subject ?? "PO HP-PO-1042 delivery update"}</h2></div><span className="message-detail__status">{stageLabel(selected.stage)}</span></header>
        <dl className="message-detail__facts"><div><dt>From</dt><dd>{selected.senderDisplay} · Verified demo contact</dd></div><div><dt>Received</dt><dd><time dateTime={selected.receivedAtIso}>21 Nov 2026, {selected.receivedAtIso.slice(11, 16)} MYT</time></dd></div><div><dt>Provider ID</dt><dd>{selected.providerMessageId.replace(/(.{8}).+/, "$1••••")}</dd></div><div><dt>Source</dt><dd>SIMULATED_CHANNEL · not live</dd></div></dl>
        <div className="message-detail__body"><p>{selected.rawText}</p></div>
        <div className="message-detail__extraction"><div><span>Matched PO</span><strong>HP-PO-1042</strong></div><div><span>Rule extraction</span><strong>20.000 kg shortfall</strong></div><div><span>Delivery ETA</span><strong>Unknown</strong></div></div>
        <ol className="message-detail__timeline" aria-label="Processing timeline"><li className="is-done">Received</li><li className="is-done">Parsed</li><li className={selected.stage !== "PARSED" ? "is-done" : ""}>Review</li><li className={selected.stage === "LINKED" ? "is-done" : ""}>Linked to Incident</li></ol>
        <p className="message-detail__correlation">Three channel messages refer to one disruption. The shared incident remains <strong>HP-INC-001</strong>; the 20 kg PO shortfall is not multiplied.</p>
      </article>
    </div>
  </PageContainer>;
}
