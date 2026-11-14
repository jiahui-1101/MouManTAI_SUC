import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanAWorkspace } from "../../src/features/recovery/plan-a/components/PlanAWorkspace";
import { PlanAProposeAction } from "../../src/features/recovery/plan-a/components/PlanAProposeAction";
import { adaptPlanAInputs, publishScenarioAReady } from "../../src/features/recovery/plan-a/integration";
import type { PlanAPublisher, ScenarioAReadyAcknowledgement, ScenarioAReadyRequest } from "../../src/features/recovery/plan-a/integration";
import { buildPlanAScenario } from "../../src/features/recovery/plan-a/domain";
import { makePlanAScenarioInput } from "./domain/happyPotatoFactory";
import { makeIntegrationRead } from "./integrationFactory";
afterEach(cleanup);
function candidate() { const r=buildPlanAScenario(makePlanAScenarioInput());if(!r.ok)throw Error(r.error.message);return r.value; }
function dependencies() {
  const read=makeIntegrationRead();
  const commitScenarioA=vi.fn(async (request:ScenarioAReadyRequest)=>({status:"STORED" as const,idempotencyKey:request.idempotencyKey,snapshotRevision:request.expectedSnapshotRevision,storedScenario:request.scenario}));
  return {read,publisher:{readCurrent:()=>read,commitScenarioA},commitScenarioA};
}
it("emits a standard Markdown-shaped conditional payload with a verified storage acknowledgement",async()=>{
  const {publisher,read,commitScenarioA}=dependencies(); const before=structuredClone(read);
  const result=await publishScenarioAReady(candidate(),publisher); expect(result).toMatchObject({ok:true,value:{status:"STORED",scenario:{strategy:"A",additionalCostSen:25500,newPurchaseKgMilli:15000,feasibility:"CONDITIONAL",simulatedCalculation:true}}});
  const event=commitScenarioA.mock.calls[0]![0];expect(event.type).toBe("SCENARIO_A_READY");
  expect(Object.keys(event.scenario).sort()).toEqual(["id","incidentId","strategy","snapshotFingerprint","version","feasibility","newPurchaseKgMilli","additionalCostSen","forecastChickenPortionsServed","forecastChickenPortionsUnmet","confirmedChickenPortionsProtected","assumptions","evidenceRefs","actionIds","simulatedCalculation"].sort());
  expect(event.detail.selectedOfferAssessment.deliveryWindow).toMatchObject({actualArrivalVerified:false,qualityAccepted:false});expect(read).toEqual(before);
});
it("rejects unverified incidents, stale versions/fingerprints, incompatible C and tampered conditions before dispatch",async()=>{
  for(const kind of ["incident","fingerprint","version","offer","evidence","assumptions"]) {
    const {publisher,read,commitScenarioA}=dependencies();const c=candidate();
    if(kind==="incident")read.source!.incident!.status="PENDING_VERIFICATION";
    if(kind==="fingerprint")c.snapshotFingerprint="other";
    if(kind==="version")c.version=2;
    if(kind==="offer")c.selectedOfferAssessment.offerId="HP-OFFER-003";
    if(kind==="evidence")c.evidenceRefs=[];
    if(kind==="assumptions")c.assumptions=[];
    expect((await publishScenarioAReady(c,publisher)).ok).toBe(false);expect(commitScenarioA).not.toHaveBeenCalled();
  }
});
it("does not report success for rejection, missing/mismatched acknowledgement, exceptions or an absent publisher",async()=>{
  const {publisher}=dependencies();const c=candidate();expect(await publishScenarioAReady(c,undefined)).toMatchObject({ok:false,code:"PUBLISHER_PENDING"});
  const rejected:PlanAPublisher={...publisher,commitScenarioA:async()=>({status:"REJECTED",message:"Version already consumed by another proposal"})};expect(await publishScenarioAReady(c,rejected)).toMatchObject({ok:false,code:"PUBLICATION_REJECTED"});
  // @ts-expect-error Deliberately model a legacy fire-and-forget dispatcher at runtime.
  const noAck:PlanAPublisher={...publisher,commitScenarioA:async()=>undefined};expect(await publishScenarioAReady(c,noAck)).toMatchObject({ok:false,code:"PUBLICATION_UNCONFIRMED"});
  const badAck:PlanAPublisher={...publisher,commitScenarioA:async r=>({status:"STORED",idempotencyKey:r.idempotencyKey,snapshotRevision:999,storedScenario:r.scenario})};expect((await publishScenarioAReady(c,badAck)).ok).toBe(false);
  const thrown:PlanAPublisher={...publisher,commitScenarioA:async()=>{throw Error("offline");}};expect(await publishScenarioAReady(c,thrown)).toMatchObject({ok:false,code:"PUBLICATION_FAILED"});
});
it("detects input changes during the async commit; duplicate logical effects require the injected owner",async()=>{
  const {publisher,read}=dependencies();
  const race:PlanAPublisher={...publisher,commitScenarioA:async r=>{read.offers![0]!.etaLocal="13:30";return {status:"STORED",idempotencyKey:r.idempotencyKey,snapshotRevision:r.expectedSnapshotRevision,storedScenario:r.scenario};}};
  expect(await publishScenarioAReady(candidate(),race)).toMatchObject({ok:false,code:"INPUTS_CHANGED_DURING_PUBLICATION"});
  const other=dependencies();const seen=new Set<string>();let effects=0;
  const idempotent:PlanAPublisher={...other.publisher,commitScenarioA:async r=>{const exists=seen.has(r.idempotencyKey);if(!exists){seen.add(r.idempotencyKey);effects++;}return {status:exists?"ALREADY_STORED":"STORED",idempotencyKey:r.idempotencyKey,snapshotRevision:r.expectedSnapshotRevision,storedScenario:r.scenario};}};
  await publishScenarioAReady(candidate(),idempotent);expect(await publishScenarioAReady(candidate(),idempotent)).toMatchObject({ok:true,value:{status:"ALREADY_STORED"}});expect(effects).toBe(1);
});
it("publishes only on explicit click, leaves PO drafts unsent and does not wire local sensitivity to the owner",async()=>{
  const {publisher,commitScenarioA,read}=dependencies();const adapted=adaptPlanAInputs(read);if(!adapted.ok)throw Error(adapted.message);
  render(<MemoryRouter><PlanAWorkspace {...adapted.value} publisher={publisher}/></MemoryRouter>);
  expect(commitScenarioA).not.toHaveBeenCalled();
  const click=(name:string)=>fireEvent.click(screen.getByRole("button",{name}));
  click("Select HP-OFFER-002");click("Generate preview");click("Create Internal PO Draft");
  expect(commitScenarioA).not.toHaveBeenCalled();click("Propose Plan A");
  await waitFor(()=>expect(screen.getByText(/Scenario storage acknowledged/)).toBeTruthy());
  expect((screen.getByRole("textbox",{name:"Internal PO Draft content"}) as HTMLTextAreaElement).value).toContain("NOT_APPROVED / NOT_SENT");
  click("Propose Plan A");expect(commitScenarioA).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("combobox"),{target:{value:"13:30"}});expect(screen.getByRole("button",{name:"Propose Plan A"}).hasAttribute("disabled")).toBe(true);expect(read.offers![0]!.etaLocal).toBe("10:15");expect(commitScenarioA).toHaveBeenCalledTimes(1);
});
it("shows publication pending instead of a fake proposal action without a dispatcher",()=>{
  const adapted=adaptPlanAInputs(makeIntegrationRead());if(!adapted.ok)throw Error(adapted.message);
  render(<MemoryRouter><PlanAWorkspace {...adapted.value}/></MemoryRouter>);expect(screen.getByText(/Shared comparison not connected yet/)).toBeTruthy();expect(screen.queryByRole("button",{name:"Propose Plan A"})).toBeNull();
});
it("does not revive an in-flight publication notice after inputs change and are restored",async()=>{
  const {publisher}=dependencies();
  const deferred: {resolve?: (ack:ScenarioAReadyAcknowledgement)=>void}={};
  const waiting=new Promise<ScenarioAReadyAcknowledgement>(resolve=>{deferred.resolve=resolve;});
  const commit=vi.fn((_request:ScenarioAReadyRequest)=>waiting);
  const deps={...publisher,commitScenarioA:commit};
  const r=render(<PlanAProposeAction candidate={candidate()} publisher={deps} contextKey="original" localSensitivityActive={false}/>);
  fireEvent.click(screen.getByRole("button",{name:"Propose Plan A"}));
  r.rerender(<PlanAProposeAction publisher={deps} contextKey="changed" localSensitivityActive={false}/>);
  r.rerender(<PlanAProposeAction publisher={deps} contextKey="original" localSensitivityActive={false}/>);
  const request=commit.mock.calls[0]![0];
  await act(async()=>{deferred.resolve?.({status:"STORED",idempotencyKey:request.idempotencyKey,snapshotRevision:request.expectedSnapshotRevision,storedScenario:request.scenario});await waiting;});
  expect(screen.queryByText(/Scenario storage acknowledged/)).toBeNull();
  expect(screen.getByText(/Previous publication result is stale/)).toBeTruthy();
});
it("preserves supplied Outlook offer provenance without claiming actual receipt (local contract only)",async()=>{
  const {publisher,read,commitScenarioA}=dependencies();
  read.offers![0]!.provenance="LIVE_CHANNEL";read.offers![0]!.evidenceRef="HP-MSG-OL-OFFER";
  const input=makePlanAScenarioInput();input.candidateOffers[0]!.offer={...read.offers![0]!};
  const built=buildPlanAScenario(input);if(!built.ok)throw Error(built.error.message);
  expect((await publishScenarioAReady(built.value,publisher)).ok).toBe(true);
  const event=commitScenarioA.mock.calls[0]![0];expect(event.scenario.evidenceRefs).toContain("HP-MSG-OL-OFFER");expect(event.detail.sourceLabels).toContain("LIVE_CHANNEL");
  expect(event.detail.selectedOfferAssessment.deliveryWindow).toMatchObject({actualArrivalVerified:false,qualityAccepted:false});
});
