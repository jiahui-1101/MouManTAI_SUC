import { beforeEach, describe, expect, it } from "vitest";
import { demoStore, fingerprint, selectActiveIncident } from "../src/store/demoStore";
import { selectIncidentEvidence, selectMessageEvidence, selectSupplierOfferEvidence } from "../src/features/messaging/evidenceSelectors";
import { CANONICAL_OFFER_MESSAGE } from "../src/features/messaging/supplierOffer";

const s = () => demoStore.getSnapshot();
beforeEach(() => { demoStore.dispatch({ type: "DEMO_RESET" }); demoStore.loadFixture("SUPPLIER_OFFER"); });

describe("P3 supplier-offer evidence", () => {
  it("loads the exact offer fixture and extracts only grounded values", () => {
    const msg = s().messages.find((m) => m.id === "HP-MSG-OL-OFFER")!;
    expect(msg).toMatchObject({ rawText: CANONICAL_OFFER_MESSAGE, kind: "SUPPLIER_OFFER", senderRegistryId: "HP-SUP-002", verification: "UNVERIFIED_SENDER", poId: null, offerQualification: "UNREVIEWED" });
    const [offer] = selectSupplierOfferEvidence(s());
    expect(offer!.claim).toEqual({ rfqId: "HP-RFQ-1042", supplierId: "HP-SUP-002", ingredientId: "HP-ING-CHICKEN", spec: "CHILLED", quantityKgMilli: 15000, pricePerKgSen: 1600, freightSen: 1500, statedEtaLocal: "10:15", conditional: true });
    offer!.evidenceSpans.forEach((sp) => expect(CANONICAL_OFFER_MESSAGE.slice(sp.start, sp.end)).toBe(sp.text));
    expect(offer!.evidenceSpans.map((sp) => sp.text)).toContain("subject to confirmation");
    const business = s().business.supplierOffers.find((o) => o.id === "HP-OFFER-002")!;
    expect(offer!.matchesCanonicalOfferId).toBe(business.id);
    expect(offer!.status).toBe("OFFER_CLAIM");
    expect(offer!.limits).toMatchObject({ isReceiptProof: false, isConfirmedProcurement: false, isCompletedSupplierAction: false });
  });

  it("requires explicit qualification, versions it, and never touches business offers, stock or incident", () => {
    const businessBefore = s().business;
    const lotsBefore = JSON.stringify(s().business.inventoryLots);
    expect(() => demoStore.reviewSupplierOffer("HP-MSG-OL-OFFER", "QUALIFIED", " ")).toThrow(/reason/);
    expect(() => demoStore.reviewSupplierOffer("HP-MSG-WA-001", "QUALIFIED", "x")).toThrow(/Not a supplier offer/);
    demoStore.reviewSupplierOffer("HP-MSG-OL-OFFER", "QUALIFIED", "Approved alternate supplier", "2026-11-21T09:20:00+08:00");
    demoStore.reviewSupplierOffer("HP-MSG-OL-OFFER", "QUALIFIED", "repeat");
    const [offer] = selectSupplierOfferEvidence(s());
    expect(offer!.qualification).toBe("QUALIFIED_CONDITIONAL");
    expect(offer!.reviewVersions.map((v) => `${v.version}:${v.decision}`)).toEqual(["1:EXTRACTED", "2:QUALIFIED"]);
    expect(offer!.reviewVersions[1]).toMatchObject({ actor: "Demo operator (demo-reviewer-01)", createdAtIso: "2026-11-21T09:20:00+08:00" });
    expect(s().messages.find((m) => m.id === "HP-MSG-OL-OFFER")!.verification).toBe("VERIFIED_DEMO_CONTACT");
    expect(s().business).toBe(businessBefore);
    expect(s().business.supplierOffers).toHaveLength(2);
    expect(JSON.stringify(s().business.inventoryLots)).toBe(lotsBefore);
    expect(() => demoStore.linkMessageToIncident("HP-MSG-OL-OFFER")).toThrow();
    expect(selectActiveIncident(s()).messageIds).toEqual([]);
    expect(Object.isFrozen(offer)).toBe(true);
  });

  it("refuses to qualify an offer from a non-approved sender", () => {
    demoStore.ingestMockMessage({ id: "HP-MSG-OFFER-X", channel: "OUTLOOK", channelAccountId: "demo-outlook", providerMessageId: "sim:outlook:offer-x", senderRegistryId: null, receivedAtIso: "2026-11-21T09:13:00+08:00", rawText: CANONICAL_OFFER_MESSAGE });
    expect(() => demoStore.reviewSupplierOffer("HP-MSG-OFFER-X", "QUALIFIED", "try")).toThrow(/Unsafe sender identity/);
    expect(selectSupplierOfferEvidence(s()).find((o) => o.messageId === "HP-MSG-OFFER-X")!.matchesCanonicalOfferId).toBeNull();
  });
});

describe("P5 audit evidence", () => {
  it("exposes raw refs, corrections, decisions and incident links by message and incident id", () => {
    const base = demoStore.getSnapshot();
    const values = { ...selectMessageEvidence(base, "HP-MSG-WA-001")!.extractionVersions[0]!.values, etaStatus: "KNOWN" as const, etaLocal: "2026-11-22T10:00" };
    demoStore.saveExtractionCorrection("HP-MSG-WA-001", values, { at: "2026-11-21T09:15:00+08:00", note: "Called supplier" });
    demoStore.confirmExtractionReview("HP-MSG-WA-001", "2026-11-21T09:16:00+08:00");
    demoStore.linkMessageToIncident("HP-MSG-OL-001", "2026-11-21T09:17:00+08:00");

    const ev = selectMessageEvidence(s(), "HP-MSG-WA-001")!;
    expect(ev.raw.contentHash).toBe(fingerprint(ev.raw.rawText));
    expect(ev.raw).toMatchObject({ provenance: "SIMULATED_CHANNEL", providerMessageId: "sim:whatsapp:001", channel: "WHATSAPP" });
    expect(ev.extractionVersions.map((v) => `${v.method}/${v.decision}`)).toEqual(["RULE_EXTRACTION/EXTRACTED", "HUMAN_CORRECTION/CORRECTED", "HUMAN_CORRECTION/CONFIRMED"]);
    expect(ev.extractionVersions[1]).toMatchObject({ actor: "Demo operator (demo-reviewer-01)", createdAtIso: "2026-11-21T09:15:00+08:00", note: "Called supplier" });
    expect(ev.incidentLink).toEqual({ incidentId: "HP-INC-001", linkedAtIso: "2026-11-21T09:16:00+08:00", linkedBy: "Demo operator (demo-reviewer-01)" });
    expect(ev.evidenceRef).toBe("HP-MSG-WA-001#HP-MSG-WA-001-EXT-v3");
    expect(ev.limits).toMatchObject({ isApprovalAuthorization: false, isReceiptProof: false, isOutcomeSuccess: false });
    expect(Object.isFrozen(ev.raw)).toBe(true);

    const inc = selectIncidentEvidence(s(), selectActiveIncident(s()).id)!;
    expect(inc.messages.map((m) => m.raw.messageId)).toEqual(selectActiveIncident(s()).messageIds);
    expect(inc).toMatchObject({ status: "VERIFIED", snapshotId: "HP-SNAP-001", claimedShortfallKgMilli: selectActiveIncident(s()).claimedShortfallKgMilli });
    expect(selectIncidentEvidence(s(), "HP-INC-999")).toBeNull();
    expect(selectMessageEvidence(s(), "nope")).toBeNull();
    expect(selectMessageEvidence(s(), "HP-MSG-TG-001")!.incidentLink).toBeNull();

    // evidence is derived from the shared store and survives unrelated state changes (navigation/selection)
    demoStore.select("HP-MSG-TG-001");
    expect(selectMessageEvidence(s(), "HP-MSG-WA-001")).toEqual(ev);
  });
});
