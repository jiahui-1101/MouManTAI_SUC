import "../p1.css";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { StatusBadge } from "../../components/ui";
import { inboxStore, useInboxState } from "../../features/messaging/inboxStore";
import { CANONICAL_RULE_SUMMARY, CANONICAL_SUPPLIER_REGISTRY } from "../../features/messaging/mockMessageRegistry";

export function SettingsPage() {
  const { activeFixture, messages, preferences } = useInboxState();
  return <PageContainer title={titleFor("/settings")} actions={<StatusBadge tone="simulated">No credentials used or requested</StatusBadge>}>
    <div className="settings__hero"><p className="p1-lead">Review offline demo contacts, deterministic rules and local display preferences for the synthetic Happy Potato scenario.</p></div>
    <div className="settings__grid">
      <section className="fm-panel settings-card" aria-labelledby="supplier-registry-title"><header><ShieldCheck aria-hidden="true" size={20} /><div><h2 id="supplier-registry-title">Synthetic supplier contact registry</h2><p>Fictional identities from the shared mock-data contract.</p></div></header><div className="registry-list">
        {Object.values(CANONICAL_SUPPLIER_REGISTRY).map((supplier) => <article key={supplier.id}><div><strong>{supplier.displayName}</strong><span>{supplier.id}</span></div><StatusBadge tone={supplier.verification === "VERIFIED_DEMO_CONTACT" || supplier.verification === "APPROVED_DEMO_SUPPLIER" ? "success" : "neutral"}>{supplier.verification.replaceAll("_", " ")}</StatusBadge></article>)}
      </div></section>
      <section className="fm-panel settings-card" aria-labelledby="rule-summary-title"><header><div><h2 id="rule-summary-title">Rule extraction summary</h2><p>Deterministic and fail-closed; no AI or provider call.</p></div></header><dl className="rule-summary"><div><dt>Method</dt><dd>{CANONICAL_RULE_SUMMARY.method}</dd></div><div><dt>Supported rule</dt><dd>{CANONICAL_RULE_SUMMARY.supportedMessage}</dd></div><div><dt>Matched PO</dt><dd>{CANONICAL_RULE_SUMMARY.matchedPoId}</dd></div><div><dt>Result</dt><dd>{CANONICAL_RULE_SUMMARY.incidentType} · 20.000 kg expected · 0.000 kg claimed</dd></div><div><dt>ETA</dt><dd>{CANONICAL_RULE_SUMMARY.etaStatus}</dd></div><div><dt>Unsupported text</dt><dd>UNRESOLVED · human review</dd></div></dl></section>
    </div>
    <section className="fm-panel settings-card settings-card--preferences" aria-labelledby="demo-preferences-title"><header><div><h2 id="demo-preferences-title">Mock demo preferences</h2><p>Stored only in the current shared offline demo state.</p></div></header>
      <label className="setting-toggle"><span><strong>Show unread messages first</strong><small>Changes ordering in the shared inbox.</small></span><input type="checkbox" checked={preferences.unreadFirst} onChange={(event) => inboxStore.setPreference("unreadFirst", event.target.checked)} /></label>
      <label className="setting-toggle"><span><strong>Show processing timeline</strong><small>Displays Received → Parsed → Review → Incident in message detail.</small></span><input type="checkbox" checked={preferences.showProcessingTimeline} onChange={(event) => inboxStore.setPreference("showProcessingTimeline", event.target.checked)} /></label>
      <div className="settings__reset"><div><strong>Reset mock demo</strong><p>Restore the review-state fixture, read states and default display preferences.</p></div><button type="button" className="fm-btn fm-btn--ghost" onClick={() => inboxStore.reset()}><RotateCcw aria-hidden="true" size={16} /> Reset demo</button></div>
      <p role="status" className="demo-controls__status">Fixture: <strong>{activeFixture}</strong> · {messages.length} messages · preferences saved in memory</p>
    </section>
    <p className="fm-banner fm-banner--info p1-banner settings__privacy"><strong>Mock-only boundary:</strong> this page never stores, displays, validates or requests phone numbers, email accounts, access tokens, passwords, OAuth grants, webhook secrets or provider credentials.</p>
  </PageContainer>;
}
