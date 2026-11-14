import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanAWorkspace, type PlanAWorkspaceProps } from "../../src/features/recovery/plan-a/components/PlanAWorkspace";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./domain/happyPotatoFactory";
afterEach(cleanup);
function props(): PlanAWorkspaceProps { return {source:makeCanonicalSourcingInput(), candidates:[makeOfferB(),makeOfferC()], scenarioMetadata:makePlanAScenarioInput().scenarioMetadata, supplierNames:{"HP-SUP-002":"Demo Poultry Supply B", "HP-SUP-003":"Demo Budget Frozen Foods"}, impactAvailable:true, comparisonAvailable:true, evidenceAvailable:true}; }
const view = (p: PlanAWorkspaceProps) => <MemoryRouter><PlanAWorkspace {...p}/></MemoryRouter>;
function generate() { fireEvent.click(screen.getByRole("button",{name:"Select HP-OFFER-002"})); fireEvent.click(screen.getByRole("button",{name:"Generate preview"})); }
it("shows an honest integration waiting state without seeding business data",()=>{render(view({})); expect(screen.getByText(/Missing:/i)).toBeTruthy(); expect(screen.queryByText("HP-INC-001")).toBeNull();});
it("identifies the unavailable P2 impact input",()=>{const p=props(); delete p.source!.impact; render(view(p)); expect(screen.getByRole("status").textContent).toContain("P2 impact assessment");});
it("blocks an unverified incident",()=>{const p=props(); p.source!.incident!.status="PENDING_VERIFICATION"; render(view(p)); expect(screen.getByRole("alert").textContent).toContain("verified incident"); expect(screen.queryByRole("button",{name:"Generate preview"})).toBeNull();});
it("requires a selection before preview generation",()=>{render(view(props())); expect(screen.getByRole("button",{name:"Generate preview"}).hasAttribute("disabled")).toBe(true);});
it("inspects incompatible C without selecting it and exposes specification and timing blockers", () => {
  render(view(props()));
  fireEvent.click(screen.getByRole("button", {name:"Inspect HP-OFFER-003"}));
  fireEvent.click(screen.getByText("Eligibility, conditions and evidence"));
  expect(screen.getAllByText(/Frozen chicken does not meet/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Quoted arrival plus/)).toBeTruthy();
  expect(screen.getByText(/Arrival and receiving checks miss/)).toBeTruthy();
  expect(screen.getByRole("button", {name:"Select HP-OFFER-003"}).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", {name:"Generate preview"}).hasAttribute("disabled")).toBe(true);
  const inspectB = screen.getByRole("button", {name:"Inspect HP-OFFER-002"});
  inspectB.focus(); fireEvent.click(inspectB);
  expect(document.activeElement).toBe(inspectB);
  expect(screen.queryByText(/Quoted arrival plus/)).toBeNull();
  expect(screen.getByRole("button", {name:"Select HP-OFFER-002"}).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", {name:"Select HP-OFFER-002"}).getAttribute("aria-pressed")).toBe("false");
});

it("generates the canonical conditional preview with exact costs and portion labels",()=>{const p=props(); const before=structuredClone(p); const callback=vi.fn(); p.onPreview=callback; render(view(p)); generate(); expect(screen.getByRole("heading",{name:"Recovery preview"})).toBeTruthy(); for(const [label,value] of [["Projected stock","25kg"],["Forecast requirement","22kg"],["Projected residual","3kg"],["Potential forecast portions","150"],["Confirmed portions protected (potential)","60"],["Additional landed cost","RM255.00"],["Accepted existing chicken","10kg"]]) expect(screen.getByText(label!).parentElement?.textContent).toContain(value); expect(screen.getByText(/Physical inventory is unchanged/)).toBeTruthy(); expect(screen.getByText(/Ingredient coverage only/)).toBeTruthy(); expect(callback).toHaveBeenCalledOnce(); expect(p.source).toEqual(before.source); expect(p.candidates).toEqual(before.candidates);});
it("shows claimed, hypothetical and required delivery milestones",()=>{render(view(props())); fireEvent.click(screen.getByRole("button",{name:"Select HP-OFFER-002"})); const timeline=screen.getByRole("list",{name:"Delivery timeline"}); expect(timeline).toBeTruthy(); expect(screen.getByText("10:30")).toBeTruthy(); expect(screen.getByText(/Hypothetical receipt/)).toBeTruthy(); expect(screen.getByText(/No verified goods receipt/)).toBeTruthy();});
it("invalidates preview immediately when a timing sensitivity becomes late",()=>{render(view(props())); generate(); fireEvent.change(screen.getByRole("combobox"),{target:{value:"13:30"}}); expect(screen.getByText(/STALE/)).toBeTruthy(); expect(screen.queryByRole("heading",{name:"Recovery preview"})).toBeNull(); expect(screen.getByRole("button",{name:"Select HP-OFFER-002"}).hasAttribute("disabled")).toBe(true);});
it("invalidates a preview when the supplied snapshot fingerprint changes",()=>{const p=props(); const r=render(view(p)); generate(); const changed=props(); changed.source!.snapshot!.fingerprint="snapshot-new"; changed.source!.incident!.snapshotFingerprint="snapshot-new"; changed.source!.impact!.snapshotFingerprint="snapshot-new"; r.rerender(view(changed)); expect(screen.getByText(/STALE/)).toBeTruthy(); expect(screen.queryByText("25kg")).toBeNull();});
it("does not preserve full coverage after the quote quantity drops to 5kg",()=>{const p=props(); const r=render(view(p)); generate(); const changed=props(); changed.candidates=[makeOfferB({offer:{quantityKgMilli:5000,landedTotalSen:9500}})]; r.rerender(view(changed)); expect(screen.queryByText("150")).toBeNull(); expect(screen.queryByText("RM255.00")).toBeNull(); expect(screen.getByRole("button",{name:"Generate preview"}).hasAttribute("disabled")).toBe(true);});
it("shows useful empty supplier state with internal recovery navigation",()=>{const p=props(); p.candidates=[]; render(view(p)); expect(screen.getByText(/No supplier offers available/)).toBeTruthy(); expect(screen.getByRole("link",{name:"internal recovery"}).getAttribute("href")).toBe("/recovery/plan-b?incidentId=HP-INC-001");});
it.each([
  makeOfferB({offer:{spec:null}}), makeOfferB({offer:{etaLocal:null}}), makeOfferB({offer:{freightSen:null}}), makeOfferB({offer:{quoteValidUntilIso:"2026-11-21T08:00:00+08:00"}}), makeOfferB({supplierStatus:"UNVERIFIED"}), makeOfferB({availabilityStatus:"DENIED"}), makeOfferC(),
])("does not enable an unsupported quote %#",candidate=>{const p=props(); p.candidates=[candidate]; render(view(p)); expect(screen.getByRole("button",{name:`Select ${candidate.offer.id}`}).hasAttribute("disabled")).toBe(true); expect(screen.getByText(/No eligible supplier offers/)).toBeTruthy();});
it("uses existing routes and preserves selected incident/evidence context",()=>{render(view(props())); fireEvent.click(screen.getByRole("button",{name:"Select HP-OFFER-002"})); fireEvent.click(screen.getByText("Eligibility, conditions and evidence")); fireEvent.click(screen.getByText("Affected menus and related workspaces")); expect(screen.getByRole("link",{name:"View impact"}).getAttribute("href")).toBe("/impact?incident=HP-INC-001"); expect(screen.getByRole("link",{name:"View offer evidence"}).getAttribute("href")).toContain("evidenceRef=HP-OFFER-002"); expect(screen.getByRole("link",{name:"Open comparison workspace"}).getAttribute("href")).toBe("/recovery/compare?incidentId=HP-INC-001");});
it("labels synthetic quotes and calculation, and exposes no purchasing or approval controls",()=>{render(view(props())); generate(); expect(screen.getByText(/Synthetic business data/)).toBeTruthy(); expect(screen.getByRole("heading", {name:"Recovery preview"})).toBeTruthy(); expect(screen.queryByRole("button",{name:/approve|purchase|send|create po/i})).toBeNull(); for(const button of screen.getAllByRole("button")) expect(button.getAttribute("type")).toBe("button");});
it("reports loading and error states",()=>{const r=render(view({loading:true})); expect(screen.getByRole("status").textContent).toContain("Loading"); r.rerender(view({error:"Snapshot service unavailable"})); expect(screen.getByRole("alert").textContent).toContain("Snapshot service unavailable");});
it("surfaces scenario calculation errors without success projections",()=>{const p=props(); p.scenarioMetadata!.version=0; render(view(p)); generate(); expect(screen.getByRole("alert").textContent).toContain("SCENARIO_METADATA_MISSING"); expect(screen.queryByText("25kg")).toBeNull();});

it("keeps invalidated preview stale after resetting ETA until regenerated",()=>{render(view(props())); generate(); fireEvent.change(screen.getByRole("combobox"),{target:{value:"13:30"}}); fireEvent.change(screen.getByRole("combobox"),{target:{value:"quoted"}}); expect(screen.getByText(/STALE/)).toBeTruthy(); expect(screen.queryByText("25kg")).toBeNull(); fireEvent.click(screen.getByRole("button",{name:"Generate preview"})); expect(screen.getByText("25kg")).toBeTruthy();});

it("keeps eligibility checks collapsed and inspection separate from selection", () => {
  render(view(props()));
  fireEvent.click(screen.getByRole("button", { name: "Inspect HP-OFFER-002" }));
  const checks = screen.getByText("Eligibility, conditions and evidence").closest("details");
  expect(checks?.open).toBe(false);
  expect(screen.getByRole("button", { name: "Generate preview" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("textbox")).toBeNull();
});
