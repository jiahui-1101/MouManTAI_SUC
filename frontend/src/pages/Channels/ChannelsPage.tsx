import "../p1.css";
import { Mail, MessageCircle, RotateCcw, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { StatusBadge } from "../../components/ui";
import { DEMO_FIXTURES, type InboxChannel, inboxStore, useInboxState } from "../../features/messaging/inboxStore";

const sources: readonly { channel: InboxChannel; name: string; icon: typeof Mail; scenarios: string }[] = [
  { channel: "WHATSAPP", name: "WhatsApp", icon: MessageCircle, scenarios: "Canonical outage · Unverified sender" },
  { channel: "OUTLOOK", name: "Outlook", icon: Mail, scenarios: "Canonical outage with email subject" },
  { channel: "TELEGRAM", name: "Telegram", icon: Send, scenarios: "Canonical outage · Unmatched message" },
];

function fixtureTime(iso?: string) {
  if (!iso) return "No fixture event loaded";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" }).format(new Date(iso)) + " MYT";
}

export function ChannelsPage() {
  const { messages, activeFixture, loadStatus } = useInboxState();
  return <PageContainer title={titleFor("/channels")} actions={<StatusBadge tone="simulated">SIMULATED_CHANNEL only</StatusBadge>}>
    <div className="channels__hero"><p className="p1-lead">Explore predefined Happy Potato message fixtures without connecting provider accounts. No WhatsApp, Outlook or Telegram account is linked.</p></div>
    <div className="channels__grid">
      {sources.map(({ channel, name, icon: Icon, scenarios }) => {
        const sourceMessages = messages.filter((message) => message.channel === channel);
        const latest = [...sourceMessages].sort((a, b) => b.receivedAtIso.localeCompare(a.receivedAtIso))[0];
        return <article className="fm-panel source-card" key={channel}>
          <header><span className="source-card__icon"><Icon aria-hidden="true" size={20} /></span><div><h2>{name}</h2><p>Synthetic fixture source</p></div><StatusBadge tone="neutral">Not connected</StatusBadge></header>
          <dl><div><dt>Mock messages</dt><dd>{sourceMessages.length}</dd></div><div><dt>Last fixture event</dt><dd>{fixtureTime(latest?.receivedAtIso)}</dd></div><div><dt>Available scenarios</dt><dd>{scenarios}</dd></div><div><dt>Provenance</dt><dd>SIMULATED_CHANNEL</dd></div></dl>
        </article>;
      })}
    </div>
    <section className="fm-panel demo-controls" aria-labelledby="demo-controls-title">
      <div><p className="p1-eyebrow">Mock demo controls</p><h2 id="demo-controls-title">Load predefined messages</h2><p>Controls update the shared offline inbox store. They do not contact WhatsApp, Outlook or Telegram.</p></div>
      <div className="demo-controls__options">
        {(Object.entries(DEMO_FIXTURES) as [keyof typeof DEMO_FIXTURES, (typeof DEMO_FIXTURES)[keyof typeof DEMO_FIXTURES]][]).map(([id, fixture]) => <button type="button" key={id} className={activeFixture === id ? "is-active" : ""} aria-pressed={activeFixture === id} onClick={() => inboxStore.loadFixture(id)}><strong>{fixture.label}</strong><span>{fixture.description}</span></button>)}
      </div>
      <div className="demo-controls__actions"><button className="fm-btn fm-btn--primary demo-controls__reset" type="button" onClick={() => inboxStore.reset()}><RotateCcw aria-hidden="true" size={16} /> Reset shared demo</button>
      <button type="button" className="fm-btn fm-btn--ghost" onClick={() => inboxStore.setMockLoadStatus("LOADING")}>Show mock loading in Inbox</button>
      <button type="button" className="fm-btn fm-btn--ghost" onClick={() => inboxStore.setMockLoadStatus("ERROR")}>Show mock error in Inbox</button></div>
      <p className="demo-controls__status" role="status">Active fixture: <strong>{DEMO_FIXTURES[activeFixture].label}</strong> · {messages.length} messages loaded · Mock load state: <strong>{loadStatus ?? "READY"}</strong>{loadStatus && <> · <button type="button" className="fm-btn fm-btn--ghost fm-btn--sm" onClick={() => inboxStore.setMockLoadStatus()}>Clear mock state</button> · <Link className="p1-link" to="/inbox">View in Inbox</Link></>}</p>
    </section>
  </PageContainer>;
}
