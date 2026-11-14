import { Mail, MessageCircle, RotateCcw, Send } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
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
  const { messages, activeFixture } = useInboxState();
  return <PageContainer title={titleFor("/channels")}>
    <div className="channels__hero"><div><p className="inbox__eyebrow">Synthetic message sources</p><p>Explore predefined Happy Potato message fixtures without connecting provider accounts.</p></div><span className="inbox__mode">SIMULATED_CHANNEL only</span></div>
    <div className="channels__grid">
      {sources.map(({ channel, name, icon: Icon, scenarios }) => {
        const sourceMessages = messages.filter((message) => message.channel === channel);
        const latest = [...sourceMessages].sort((a, b) => b.receivedAtIso.localeCompare(a.receivedAtIso))[0];
        return <article className="source-card" key={channel}>
          <header><span className="source-card__icon"><Icon aria-hidden="true" size={20} /></span><div><h2>{name}</h2><p>Synthetic fixture source</p></div></header>
          <dl><div><dt>Mock messages</dt><dd>{sourceMessages.length}</dd></div><div><dt>Last fixture event</dt><dd>{fixtureTime(latest?.receivedAtIso)}</dd></div><div><dt>Available scenarios</dt><dd>{scenarios}</dd></div><div><dt>Provenance</dt><dd>SIMULATED_CHANNEL</dd></div></dl>
        </article>;
      })}
    </div>
    <section className="demo-controls" aria-labelledby="demo-controls-title">
      <div><p className="inbox__eyebrow">Mock demo controls</p><h2 id="demo-controls-title">Load predefined messages</h2><p>Controls update the shared offline inbox store. They do not contact WhatsApp, Outlook or Telegram.</p></div>
      <div className="demo-controls__options">
        {(Object.entries(DEMO_FIXTURES) as [keyof typeof DEMO_FIXTURES, (typeof DEMO_FIXTURES)[keyof typeof DEMO_FIXTURES]][]).map(([id, fixture]) => <button type="button" key={id} className={activeFixture === id ? "is-active" : ""} aria-pressed={activeFixture === id} onClick={() => inboxStore.loadFixture(id)}><strong>{fixture.label}</strong><span>{fixture.description}</span></button>)}
      </div>
      <button className="demo-controls__reset" type="button" onClick={() => inboxStore.reset()}><RotateCcw aria-hidden="true" size={16} /> Reset shared demo</button>
      <p className="demo-controls__status" role="status">Active fixture: <strong>{DEMO_FIXTURES[activeFixture].label}</strong> · {messages.length} messages loaded</p>
    </section>
  </PageContainer>;
}
