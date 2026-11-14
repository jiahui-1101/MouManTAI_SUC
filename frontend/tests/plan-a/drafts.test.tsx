import { expect, it } from "vitest";
import { buildPlanAScenario } from "../../src/features/recovery/plan-a/domain";
import { createInternalPoDraft, createRfqDraft } from "../../src/features/recovery/plan-a/drafts";
import type { InternalPoInput } from "../../src/features/recovery/plan-a/drafts";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./domain/happyPotatoFactory";
export function draftInput(): InternalPoInput {
  const input = makePlanAScenarioInput(); const result = buildPlanAScenario(input);
  if (!result.ok) throw Error(result.error.message);
  return {source:makeCanonicalSourcingInput(), candidate:makeOfferB(), supplierName:"Demo Poultry Supply B", contactAuthorization:"UNKNOWN", proposal:result.value, scenarioMetadata:input.scenarioMetadata, scenarioIsCurrent:true};
}
it("creates distinct, deterministic unsent RFQ and RM255 internal PO drafts without changing inputs",()=>{
  const input=draftInput(); const before=structuredClone(input); const rfq=createRfqDraft(input); const po=createInternalPoDraft(input);
  expect(rfq.ok && po.ok).toBe(true); if(!rfq.ok || !po.ok) return;
  expect(rfq.value.text).toContain("15kg CHILLED"); expect(rfq.value.text).toContain("UNSENT RFQ");
  for(const field of ["MYR/kg", "MOQ", "Freight", "earliest delivery", "Quote validity", "storage/handling", "10:45", "HP-PO-1042"]) expect(rfq.value.text).toContain(field);
  expect(po.value).toMatchObject({type:"INTERNAL_PO_DRAFT",landedCostSen:25500,pricePerKgSen:1600,freightSen:1500,quantityKgMilli:15000,approval:"NOT_APPROVED",transmission:"NOT_SENT",status:"NEEDS_REVIEW"});
  expect(po.value.id).not.toBe("HP-PO-1042"); expect(po.value.id).not.toBe(rfq.value.id); expect(po.value.text).toContain("RM255.00");
  expect(createInternalPoDraft(input)).toEqual(po); expect(createRfqDraft(input)).toEqual(rfq); expect(input).toEqual(before);
});
it("blocks frozen/late, unqualified, insufficient and expired quotes",()=>{
  for(const candidate of [makeOfferC(),makeOfferB({supplierStatus:"UNVERIFIED"}),makeOfferB({offer:{quantityKgMilli:5000}}),makeOfferB({offer:{quoteValidUntilIso:"2026-11-21T08:00:00+08:00"}})]) expect(createInternalPoDraft({...draftInput(),candidate}).ok).toBe(false);
});
it("asks for missing RFQ prices without substituting zero; PO generation stays blocked",()=>{
  const input={...draftInput(),candidate:makeOfferB({offer:{pricePerKgSen:null,freightSen:null}})}; const result=createRfqDraft(input);
  expect(result.ok).toBe(true); if(!result.ok) return; expect(result.value.pricePerKgSen).toBeNull(); expect(result.value.landedCostSen).toBeNull(); expect(result.value.text).toContain("Not estimable"); expect(createInternalPoDraft(input).ok).toBe(false);
});
it("rejects unverified incidents and mismatched snapshot context",()=>{
  const input=draftInput(); input.source.incident.status="PENDING_VERIFICATION"; expect(createRfqDraft(input).ok).toBe(false);
  const changed=draftInput(); changed.source.snapshot.fingerprint="changed"; expect(createInternalPoDraft(changed).ok).toBe(false);
});
it("blocks stale or modified proposals rather than preserving obsolete totals",()=>{
  const input=draftInput(); expect(createInternalPoDraft({...input,scenarioIsCurrent:false})).toMatchObject({ok:false,error:{code:"STALE_SCENARIO"}});
  input.proposal.additionalCostSen=1; expect(createInternalPoDraft(input)).toMatchObject({ok:false,error:{code:"STALE_SCENARIO"}});
});
