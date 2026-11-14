import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { assessOffer, deriveRecoverySourcingNeed } from "../../src/features/recovery/plan-a/domain";
import { SupplierOfferComparison } from "../../src/features/recovery/plan-a/components/SupplierOfferComparison";
import { SupplyNeedSummary } from "../../src/features/recovery/plan-a/components/SupplyNeedSummary";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC } from "./domain/happyPotatoFactory";
afterEach(cleanup);
it("keeps PO shortfall, accepted stock and forecast gap separate", () => {
  const result = deriveRecoverySourcingNeed(makeCanonicalSourcingInput());
  if (!result.ok) throw Error(result.error.message);
  render(<SupplyNeedSummary need={result.value}/>);
  for (const [label, value] of [["Supplier-reported PO shortfall", "20kg"], ["Accepted physical stock", "10kg"], ["Forecast ingredient gap", "12kg"]]) {
    expect(screen.getByText(label!).parentElement?.textContent).toContain(value);
  }
});
it("shows calculated costs, permits inspection of C and disables its selection", () => {
  const input = makeCanonicalSourcingInput();
  const result = deriveRecoverySourcingNeed(input);
  if (!result.ok) throw Error(result.error.message);
  const inspect = vi.fn(); const select = vi.fn();
  render(<SupplierOfferComparison offers={[makeOfferB(), makeOfferC()].map(candidate => ({candidate, assessment: assessOffer({candidate, need: result.value, businessClock: input.businessClock})}))} supplierNames={{}} inspectedOfferId={null} selectedOfferId={null} onInspect={inspect} onSelect={select}/>);
  expect(within(screen.getByRole("article", {name:"HP-OFFER-002"})).getByText("RM255.00")).toBeTruthy();
  expect(within(screen.getByRole("article", {name:"HP-OFFER-003"})).getByText("RM220.00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Inspect HP-OFFER-003"}));
  expect(inspect).toHaveBeenCalledWith("HP-OFFER-003");
  expect(screen.getByRole("button", {name:"Select HP-OFFER-003"}).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", {name:"Select HP-OFFER-003"})); expect(select).not.toHaveBeenCalled();
});
