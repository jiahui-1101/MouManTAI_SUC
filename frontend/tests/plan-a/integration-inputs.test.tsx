import { expect, it } from "vitest";
import { adaptPlanAInputs, validateScenarioFreshness } from "../../src/features/recovery/plan-a/integration";
import { buildPlanAScenario, deriveRecoverySourcingNeed } from "../../src/features/recovery/plan-a/domain";
import { makePlanAScenarioInput } from "./domain/happyPotatoFactory";
import { makeIntegrationRead } from "./integrationFactory";
function candidate() {const result=buildPlanAScenario(makePlanAScenarioInput());if(!result.ok) throw Error(result.error.message);return result.value;}
it("adapts canonical input without mutating stock, units, fingerprints or provenance",()=>{
  const read=makeIntegrationRead(); const before=structuredClone(read); const result=adaptPlanAInputs(read);
  expect(result.ok).toBe(true);if(!result.ok)return;
  const need=deriveRecoverySourcingNeed(result.value.source);expect(need).toMatchObject({ok:true,value:{poShortfallKgMilli:20000,forecastGapKgMilli:12000,acceptedOnHandKgMilli:10000}});
  expect(result.value.candidates[0]?.offer.provenance).toBe("SYNTHETIC_BUSINESS");expect(read).toEqual(before);expect(result.value.source).not.toBe(read.source);
  expect(validateScenarioFreshness(read,candidate()).ok).toBe(true);
});
it("reports missing inputs, unverified sources, ambiguous IDs and incident/PO mismatches",()=>{
  expect(adaptPlanAInputs({})).toMatchObject({ok:false,code:"INPUTS_PENDING"});
  const unverified=makeIntegrationRead();unverified.source!.incident!.status="PENDING_VERIFICATION";expect(adaptPlanAInputs(unverified)).toMatchObject({ok:false,code:"INCIDENT_NOT_VERIFIED"});
  const impact=makeIntegrationRead();impact.source!.impact!.incidentId="other";expect(adaptPlanAInputs(impact).ok).toBe(false);
  const po=makeIntegrationRead();po.source!.incident!.poId="other";expect(adaptPlanAInputs(po).ok).toBe(false);
  const duplicate=makeIntegrationRead();duplicate.suppliers!.push({...duplicate.suppliers![0]!});expect(adaptPlanAInputs(duplicate)).toMatchObject({ok:false,code:"AMBIGUOUS_IDENTITIES"});
});
it("rejects fingerprint/version changes and explicit prior invalidation, including restored inputs",()=>{
  const read=makeIntegrationRead();const old=candidate();const changed=structuredClone(old);changed.snapshotFingerprint="other";
  expect(validateScenarioFreshness(read,changed)).toMatchObject({ok:false,code:"SNAPSHOT_MISMATCH"});
  changed.snapshotFingerprint=old.snapshotFingerprint;changed.version=2;expect(validateScenarioFreshness(read,changed)).toMatchObject({ok:false,code:"VERSION_MISMATCH"});
  expect(validateScenarioFreshness(read,old,true)).toMatchObject({ok:false,code:"STALE_SCENARIO"});
});
it("recalculates 8kg stock using supplied new revision/version instead of retaining 25kg/3kg",()=>{
  const read=makeIntegrationRead();const old=candidate();const source=read.source!;
  source.snapshot!.ingredientLots[0]!.onHandMilli=8000;source.snapshot!.revision=2;source.snapshot!.fingerprint="snapshot-v2";
  source.incident!.snapshotFingerprint="snapshot-v2";source.impact!.snapshotFingerprint="snapshot-v2";source.impact!.chickenAvailableKgMilli=8000;source.impact!.demandGapKgMilli=14000;read.scenarioMetadata!.version=2;
  expect(validateScenarioFreshness(read,old).ok).toBe(false);
  const adapted=adaptPlanAInputs(read);if(!adapted.ok)throw Error(adapted.message);const need=deriveRecoverySourcingNeed(adapted.value.source);if(!need.ok)throw Error(need.error.message);
  const result=buildPlanAScenario({sourcingNeed:need.value,candidateOffers:adapted.value.candidates,selectedOfferId:"HP-OFFER-002",currentSnapshotFingerprint:source.snapshot!.fingerprint,currentSnapshotRevision:2,businessClock:adapted.value.source.businessClock,scenarioMetadata:adapted.value.scenarioMetadata});
  expect(result).toMatchObject({ok:true,value:{version:2,acceptedOnHandKgMilli:8000,projectedChickenAfterConditionalReceiptKgMilli:23000,projectedResidualKgMilli:1000,forecastChickenPortionsServed:150}});
});
it("blocks late global ETA and a demo clock past cutoff without using wall-clock time",()=>{
  const eta=makeIntegrationRead();eta.offers![0]!.etaLocal="13:30";expect(validateScenarioFreshness(eta,candidate()).ok).toBe(false);
  const clock=makeIntegrationRead();clock.source!.businessClock!.nowLocal="11:00";clock.source!.businessClock!.nowIso="2026-11-21T11:00:00+08:00";expect(validateScenarioFreshness(clock,candidate()).ok).toBe(false);
});
it("blocks a changed snapshot revision even if the fingerprint and scenario version were incorrectly reused",()=>{
  const read=makeIntegrationRead();read.source!.snapshot!.revision=2;
  expect(validateScenarioFreshness(read,candidate())).toMatchObject({ok:false,code:"SNAPSHOT_MISMATCH"});
});
