import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanAWorkspace, type PlanAWorkspaceProps } from "../../src/features/recovery/plan-a/components/PlanAWorkspace";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./domain/happyPotatoFactory";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => { cleanup(); vi.unstubAllGlobals(); if (clipboardDescriptor) Object.defineProperty(navigator,"clipboard",clipboardDescriptor); else Reflect.deleteProperty(navigator,"clipboard"); });
function props(): PlanAWorkspaceProps { return { source: makeCanonicalSourcingInput(), candidates: [makeOfferB(),makeOfferC()], scenarioMetadata: makePlanAScenarioInput().scenarioMetadata }; }
const view = (p: PlanAWorkspaceProps) => <MemoryRouter><PlanAWorkspace {...p}/></MemoryRouter>;
const click = (name: string) => fireEvent.click(screen.getByRole("button", {name}));
function selectAndPreview() { click("Select HP-OFFER-002"); click("Generate preview"); }
function text(name: string) { return (screen.getByRole("textbox",{name}) as HTMLTextAreaElement).value; }

it("creates and reopens separate idempotent draft records without supplier requests or input mutations",()=>{
  const p=props(); const before=structuredClone(p); const fetch=vi.fn(); vi.stubGlobal("fetch",fetch);
  const r=render(view(p)); selectAndPreview(); click("Create RFQ Draft");
  const rfq=text("RFQ Draft content"); expect(rfq).toContain("UNSENT RFQ"); expect(rfq).toContain("15kg CHILLED");
  click("Create RFQ Draft"); expect(text("RFQ Draft content")).toBe(rfq);
  r.rerender(view({...p})); expect(text("RFQ Draft content")).toBe(rfq);
  click("Close RFQ Draft"); expect(screen.queryByRole("textbox")).toBeNull(); click("Review RFQ Draft"); expect(text("RFQ Draft content")).toBe(rfq);
  click("Create Internal PO Draft"); const po=text("Internal PO Draft content"); expect(po).toContain("RM255.00"); expect(po).toContain("NOT_APPROVED / NOT_SENT"); expect(po).toContain("HP-PO-1042");
  click("Create Internal PO Draft"); expect(text("Internal PO Draft content")).toBe(po);
  expect(screen.getAllByRole("article",{name:"Internal PO Draft"}).length).toBe(1);
  expect(screen.getByText("Physical inventory is unchanged. Incoming stock is not yet received or quality accepted.")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled(); expect(p).toEqual(before);
});

it.each(["eta", "quantity", "price", "snapshot"])("invalidates drafts on changed %s and does not revive them when restored",kind=>{
  const original=props(); const r=render(view(original)); selectAndPreview(); click("Create RFQ Draft"); click("Create Internal PO Draft");
  const changed=props(); const offer=changed.candidates![0]!.offer;
  if(kind==="eta") offer.etaLocal="13:30";
  if(kind==="quantity") {offer.quantityKgMilli=5000;offer.landedTotalSen=9500;}
  if(kind==="price") {offer.pricePerKgSen=1700;offer.landedTotalSen=27000;}
  if(kind==="snapshot") {changed.source!.snapshot!.fingerprint="new";changed.source!.incident!.snapshotFingerprint="new";changed.source!.impact!.snapshotFingerprint="new";}
  r.rerender(view(changed)); expect(text("Internal PO Draft content")).toMatch(/^STALE/); expect(screen.getByRole("button",{name:"Copy Internal PO Draft"}).hasAttribute("disabled")).toBe(true);
  r.rerender(view(original)); expect(text("Internal PO Draft content")).toMatch(/^STALE/);
  click("Review RFQ Draft"); expect(text("RFQ Draft content")).toMatch(/^STALE/);
  click("Generate preview"); click("Regenerate Internal PO Draft"); expect(text("Internal PO Draft content")).not.toMatch(/^STALE/);
});

it("copies actual RFQ and PO text and reports permission failures and unavailable clipboard truthfully",async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});
  render(view(props())); selectAndPreview(); click("Create RFQ Draft"); const rfq=text("RFQ Draft content"); click("Copy RFQ Draft");
  await waitFor(()=>expect(screen.getByText("Draft text copied to clipboard.")).toBeTruthy()); expect(writeText).toHaveBeenLastCalledWith(rfq);
  click("Create Internal PO Draft"); const po=text("Internal PO Draft content"); click("Copy Internal PO Draft"); await waitFor(()=>expect(writeText).toHaveBeenLastCalledWith(po));
  writeText.mockRejectedValue(new Error("Permission denied")); click("Copy Internal PO Draft"); await waitFor(()=>expect(screen.getByText(/Copy failed or is unavailable/)).toBeTruthy());
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:undefined}); click("Copy Internal PO Draft"); await waitFor(()=>expect(screen.getByText(/Copy failed or is unavailable/)).toBeTruthy()); expect(text("Internal PO Draft content")).toBe(po);
});

it("requires a selected eligible supplier and current scenario for an internal PO",()=>{
  render(view(props())); expect(screen.getByRole("button",{name:"Create RFQ Draft"}).hasAttribute("disabled")).toBe(true);
  click("Inspect HP-OFFER-003"); expect(screen.getByRole("button",{name:"Create Internal PO Draft"}).hasAttribute("disabled")).toBe(true);
  click("Select HP-OFFER-002"); expect(screen.getByRole("button",{name:"Create RFQ Draft"}).hasAttribute("disabled")).toBe(false); expect(screen.getByRole("button",{name:"Create Internal PO Draft"}).hasAttribute("disabled")).toBe(true);
});
