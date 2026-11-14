import { useDemoState } from "../../store/demoStore";
import { selectMessageEvidence } from "./evidenceSelectors";

/** Shows the exact P5 audit evidence record produced for a message. */
export function EvidencePanel({ messageId }: { messageId: string }) {
  const state = useDemoState();
  const ev = selectMessageEvidence(state, messageId);
  if (!ev) return null;
  const decisions = ev.kind === "SUPPLIER_OFFER" ? ev.offerReviewVersions.length : ev.extractionVersions.length;
  return <section className="mi-handoff" aria-label="Audit evidence">
    <h3>Audit evidence (P5)</h3>
    <dl>
      <div><dt>Evidence ref</dt><dd data-testid="evidence-ref">{ev.evidenceRef}</dd></div>
      <div><dt>Raw message</dt><dd>{ev.raw.messageId} · {ev.raw.provenance} · {ev.raw.channel} · <code>{ev.raw.contentHash}</code></dd></div>
      <div><dt>Versions / decisions</dt><dd>{decisions}</dd></div>
      <div><dt>Incident link</dt><dd data-testid="evidence-link">{ev.incidentLink ? `${ev.incidentLink.incidentId} · ${ev.incidentLink.linkedAtIso} · ${ev.incidentLink.linkedBy}` : "Not linked"}</dd></div>
      <div><dt>Limits</dt><dd>Not approval authorization · not receipt proof · not outcome success</dd></div>
    </dl>
  </section>;
}
