import { describe, expect, it } from "vitest";
import {
  CANONICAL_MESSAGE,
  CANONICAL_PO_REGISTRY,
} from "../src/features/messaging/mockMessageRegistry";
import { parseMockSupplierMessage } from "../src/features/messaging/mockMessageRuleExtractor";

describe("parseMockSupplierMessage", () => {
  it("extracts the canonical unavailable-delivery claim without changing raw text", () => {
    const result = parseMockSupplierMessage({
      rawText: CANONICAL_MESSAGE,
      senderRegistryId: "HP-SUP-001",
    });

    expect(result.rawText).toBe(CANONICAL_MESSAGE);
    expect(result.senderVerification).toBe("VERIFIED_DEMO_CONTACT");
    expect(result.poMatch).toBe("MATCHED");
    expect(result.extraction).toMatchObject({
      incidentType: "UNAVAILABLE",
      poId: "HP-PO-1042",
      ingredientId: "HP-ING-CHICKEN",
      expectedKgMilli: 20_000,
      claimedDeliveryKgMilli: 0,
      shortfallKgMilli: 20_000,
      etaLocal: null,
      etaStatus: "UNKNOWN",
      method: "RULE_EXTRACTION",
      reviewStatus: "PENDING",
    });
  });

  it("returns exact evidence spans from the immutable raw text", () => {
    const result = parseMockSupplierMessage({
      rawText: CANONICAL_MESSAGE,
      senderRegistryId: "HP-SUP-001",
    });

    expect(result.extraction.evidenceSpans).toHaveLength(6);
    for (const span of result.extraction.evidenceSpans) {
      expect(CANONICAL_MESSAGE.slice(span.start, span.end)).toBe(span.text);
    }
    expect(result.extraction.evidenceSpans).toContainEqual({
      field: "claimedDeliveryKgMilli",
      start: CANONICAL_MESSAGE.lastIndexOf("0kg"),
      end: CANONICAL_MESSAGE.lastIndexOf("0kg") + "0kg".length,
      text: "0kg",
    });
    expect(result.extraction.evidenceSpans).toContainEqual({
      field: "etaStatus",
      start: CANONICAL_MESSAGE.indexOf("We will update you tomorrow"),
      end: CANONICAL_MESSAGE.indexOf("We will update you tomorrow") + "We will update you tomorrow".length,
      text: "We will update you tomorrow",
    });
  });

  it("keeps the PO shortfall separate from accepted physical stock", () => {
    const result = parseMockSupplierMessage({
      rawText: CANONICAL_MESSAGE,
      senderRegistryId: "HP-SUP-001",
    });

    expect(result.extraction.shortfallKgMilli).toBe(20_000);
    expect(CANONICAL_PO_REGISTRY["HP-PO-1042"].acceptedStockKgMilli).toBe(10_000);
    expect(result.extraction).not.toHaveProperty("physicalStockKgMilli");
  });

  it("extracts a known canonical message but blocks verification for an unknown sender", () => {
    const result = parseMockSupplierMessage({
      rawText: CANONICAL_MESSAGE,
      senderRegistryId: "UNKNOWN-SENDER",
    });

    expect(result.extraction.method).toBe("RULE_EXTRACTION");
    expect(result.extraction.reviewStatus).toBe("PENDING");
    expect(result.senderRegistryId).toBeNull();
    expect(result.senderVerification).toBe("UNVERIFIED_SENDER");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.reviewReasons.join(" ")).toContain("cannot auto-verify");
  });

  it.each([
    "PO HP-PO-1042 may be late today.",
    "PO HP-PO-1042 cannot deliver either 20kg or 10kg chilled chicken today.",
    "We will deliver 20kg chilled chicken tomorrow.",
  ])("fails closed for unsupported or ambiguous text: %s", (rawText) => {
    const result = parseMockSupplierMessage({ rawText, senderRegistryId: "HP-SUP-001" });

    expect(result.rawText).toBe(rawText);
    expect(result.extraction).toEqual({
      method: "UNRESOLVED",
      reviewStatus: "UNRESOLVED",
      evidenceSpans: [],
    });
    expect(result.requiresHumanReview).toBe(true);
    expect(result.poMatch).toBe("UNRESOLVED");
  });
});
