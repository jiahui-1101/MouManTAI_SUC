import { deriveRecoverySourcingNeed } from "../domain";
import type { RecoverySourcingNeedInput } from "../domain";
import type { AdaptedPlanAInputs, IntegrationResult, PlanAInputRead } from "./types";

function completeSource(source: Partial<RecoverySourcingNeedInput> | undefined): source is RecoverySourcingNeedInput {
  return Boolean(source?.outletId && source.incident && source.snapshot && source.impact && source.ingredientPolicy && source.businessClock);
}

export function adaptPlanAInputs(read: PlanAInputRead): IntegrationResult<AdaptedPlanAInputs> {
  const partial = read?.source;
  const required = ["outletId", "incident", "snapshot", "impact", "ingredientPolicy", "businessClock"] as const;
  const missing = required.filter(key => !partial?.[key]);
  if (!completeSource(partial) || !read?.offers || !read.suppliers || !read.offerEvidence || !read.scenarioMetadata) {
    return { ok: false, code: "INPUTS_PENDING", message: `Shared Plan A inputs are incomplete: ${[...missing, ...(!read?.offers ? ["supplier offers"] : []), ...(!read?.suppliers ? ["supplier registry"] : []), ...(!read?.offerEvidence ? ["offer evidence"] : []), ...(!read?.scenarioMetadata ? ["authoritative scenario metadata"] : [])].join(", ")}.` };
  }
  // Construct only the existing domain seam; no fixture values or missing-field defaults.
  const source = partial;
  const need = deriveRecoverySourcingNeed(source);
  if (!need.ok) return { ok: false, code: need.error.code, message: need.error.message };
  if (!source.incident.messageIds.length || source.incident.messageIds.some(id => !id.trim())) {
    return { ok: false, code: "SOURCE_EVIDENCE_MISSING", message: "Verified incident source evidence references are required." };
  }
  const metadata = read.scenarioMetadata;
  if (!metadata.scenarioId?.trim() || !Number.isSafeInteger(metadata.version) || metadata.version < 1 ||
      !Array.isArray(metadata.evidenceRefs) || !Array.isArray(metadata.actionIds)) {
    return { ok: false, code: "VERSION_AUTHORITY_MISSING", message: "The shared owner must supply a scenario identity, positive version and evidence/action references." };
  }
  const uniqueIds = (values: string[]) => values.every(id => typeof id === "string" && id.trim().length > 0) && new Set(values).size === values.length;
  if (!uniqueIds(read.suppliers.map(s => s.id)) || !uniqueIds(read.offers.map(o => o.id)) || !uniqueIds(read.offerEvidence.map(e => e.offerId))) {
    return { ok: false, code: "AMBIGUOUS_IDENTITIES", message: "Supplier, offer and evidence identities must be present and unique." };
  }
  const candidates: AdaptedPlanAInputs["candidates"] = [];
  for (const offer of read.offers) {
    const supplier = read.suppliers.find(s => s.id === offer.supplierId);
    const evidence = read.offerEvidence.find(e => e.offerId === offer.id);
    if (!supplier || !evidence) return { ok: false, code: "OFFER_CONTEXT_MISSING", message: `Supply registry and explicit evidence/availability states for ${offer.id}.` };
    candidates.push({ offer, supplier: { id: supplier.id, status: supplier.status }, specEvidenceStatus: evidence.specEvidenceStatus, availabilityStatus: evidence.availabilityStatus });
  }
  return { ok: true, value: structuredClone({ source, candidates, supplierNames: Object.fromEntries(read.suppliers.flatMap(s => s.name ? [[s.id, s.name]] : [])), scenarioMetadata: metadata }) };
}
