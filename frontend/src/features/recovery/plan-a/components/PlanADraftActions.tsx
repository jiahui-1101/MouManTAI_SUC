import { useEffect, useState } from "react";
import { createInternalPoDraft, createRfqDraft } from "../drafts";
import type { DraftInput, PlanADraft } from "../drafts";
import type { PlanAScenarioCandidate, PlanAScenarioMetadata, RecoverySourcingNeedInput, SupplierOfferCandidateInput } from "../domain";

type DraftType = PlanADraft["type"];
type LocalDraft = { value: PlanADraft; basis: string; invalidated: boolean };
interface Props {
  source: RecoverySourcingNeedInput;
  candidate?: SupplierOfferCandidateInput;
  supplierName?: string;
  proposal?: PlanAScenarioCandidate;
  scenarioMetadata?: PlanAScenarioMetadata;
  contextKey: string;
  contactAuthorization?: DraftInput["contactAuthorization"];
}
export function PlanADraftActions(props: Props) {
  const [drafts, setDrafts] = useState<Partial<Record<DraftType, LocalDraft>>>({});
  const [open, setOpen] = useState<DraftType | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ basis: string; type: DraftType; text: string } | null>(null);
  const contactAuthorization = props.contactAuthorization ?? "UNKNOWN";
  const basis = JSON.stringify([props.contextKey, contactAuthorization, props.proposal]);
  useEffect(() => {
    setDrafts(current => {
      let changed = false;
      const next = { ...current };
      for (const type of ["RFQ_DRAFT", "INTERNAL_PO_DRAFT"] as const) {
        const draft = current[type];
        if (draft && draft.basis !== basis && !draft.invalidated) {
          next[type] = { ...draft, invalidated: true };
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [basis]);
  const isStale = (draft: LocalDraft) => draft.invalidated || draft.basis !== basis;
  const create = (type: DraftType) => {
    setError(""); setFeedback(null);
    if (!props.candidate) { setError("Select a conditionally qualified supplier before creating a draft."); return; }
    const input: DraftInput = { source: props.source, candidate: props.candidate, supplierName: props.supplierName, contactAuthorization };
    const result = type === "RFQ_DRAFT" ? createRfqDraft(input) : props.proposal && props.scenarioMetadata
      ? createInternalPoDraft({ ...input, proposal: props.proposal, scenarioMetadata: props.scenarioMetadata, scenarioIsCurrent: true })
      : { ok: false as const, error: { message: "Generate a current Plan A proposal preview before creating an internal PO draft." } };
    if (!result.ok) { setError(result.error.message); return; }
    setDrafts(current => {
      const existing = current[type];
      return existing && !isStale(existing) ? current : { ...current, [type]: { value: result.value, basis, invalidated: false } };
    });
    setOpen(type);
  };
  const copy = async (draft: LocalDraft) => {
    if (isStale(draft)) return;
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(draft.value.text);
      setFeedback({ basis, type: draft.value.type, text: "Draft text copied to clipboard." });
    } catch {
      setFeedback({ basis, type: draft.value.type, text: "Copy failed or is unavailable. Select the readable draft text below and copy it manually." });
    }
  };
  return <section className="pa-panel" aria-labelledby="drafts-heading">
    <span className="pa-kicker">Demo only · Unsent local documents</span>
    <h2 id="drafts-heading">RFQ and internal purchase drafts</h2>
    <p>Drafts are separate from the proposal preview. They do not send messages, place orders, approve recovery or change accepted stock.</p>
    {!props.candidate && <p>Select a conditionally qualified supplier to create drafts.</p>}
    {!props.proposal && <p>A current Plan A preview is required for the internal PO draft.</p>}
    <p className="pa-muted">Contact authorization: {contactAuthorization === "UNKNOWN" ? "Unknown — review required" : "Authorized demo contact"}. No contact details are inferred.</p>
    {error && <p role="alert">{error}</p>}
    <div className="pa-columns">
      {(["RFQ_DRAFT", "INTERNAL_PO_DRAFT"] as const).map(type => {
        const draft = drafts[type];
        const stale = draft ? isStale(draft) : false;
        const name = type === "RFQ_DRAFT" ? "RFQ Draft" : "Internal PO Draft";
        return <article className="pa-offer" key={type} aria-label={name}>
          <h3>{name}</h3>
          <p className="pa-badge">{draft ? stale ? "STALE" : draft.value.status : "NOT_CREATED"}</p>
          {stale && <p>Inputs changed. Explicit review and regeneration are required; this document cannot support approval.</p>}
          <div className="pa-actions">
            <button type="button" disabled={!props.candidate || (type === "INTERNAL_PO_DRAFT" && !props.proposal)} onClick={() => create(type)}>{stale ? "Regenerate" : "Create"} {name}</button>
            {draft && <button type="button" aria-expanded={open === type} onClick={() => { setOpen(type); setFeedback(null); }}>Review {name}</button>}
          </div>
          {draft && open === type && <div className="pa-draft-panel">
            <p>Local reference: {draft.value.id}</p>
            <p>NOT_APPROVED · NOT_SENT · Synthetic business data</p>
            <label>{name} content<textarea readOnly rows={16} value={`${stale ? "STALE — DO NOT USE. Regenerate against current inputs.\n\n" : ""}${draft.value.text}`}/></label>
            <div className="pa-actions"><button type="button" disabled={stale} onClick={() => void copy(draft)}>Copy {name}</button><button type="button" onClick={() => { setOpen(null); setFeedback(null); }}>Close {name}</button></div>
            {feedback?.basis === basis && feedback.type === type && !stale && <p role="status">{feedback.text}</p>}
          </div>}
        </article>;
      })}
    </div>
  </section>;
}
