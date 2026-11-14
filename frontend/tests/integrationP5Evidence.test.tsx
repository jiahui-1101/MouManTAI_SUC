import { beforeEach, expect, it } from "vitest";
import { demoStore, fingerprint } from "../src/store/demoStore";
import { assessImpactAction } from "../src/services/mock/restaurantStore";
import { selectP5IncidentDossier } from "../src/integration/p5Evidence";

const s = () => demoStore.getSnapshot();
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));

it("E: P5 dossier exposes immutable P1 review history and P2 impact without fabricated approval", () => {
  const empty = selectP5IncidentDossier(s(), "HP-INC-001");
  expect(empty).toMatchObject({ businessStatus: null, impact: { ready: false } });
  expect(empty.verification!.messages).toHaveLength(0);

  demoStore.confirmExtractionReview("HP-MSG-WA-001", "2026-11-21T09:16:00+08:00");
  demoStore.linkMessageToIncident("HP-MSG-OL-001", "2026-11-21T09:17:00+08:00");
  assessImpactAction("HP-INC-001");
  const d = selectP5IncidentDossier(s(), "HP-INC-001");
  expect(d.businessStatus).toBe("IMPACT_ASSESSED");
  expect(d.impact.ready).toBe(true);
  expect(d.verification!.messages.map((m) => m.raw.messageId)).toEqual(["HP-MSG-WA-001", "HP-MSG-OL-001"]);
  for (const m of d.verification!.messages) {
    expect(m.raw.contentHash).toBe(fingerprint(m.raw.rawText));
    expect(m.incidentLink).toMatchObject({ incidentId: "HP-INC-001", linkedBy: "Demo operator (demo-reviewer-01)" });
    expect(m.extractionVersions[0]!.method).toBe("RULE_EXTRACTION");
  }
  expect(d.events.filter((e) => e.type === "INCIDENT_VERIFIED")).toHaveLength(2);
  expect(Object.values(d.limits).every((v) => v === false)).toBe(true);
  expect(d.pendingP5Capabilities).toContain("APPROVAL");
  expect(JSON.stringify(d)).not.toMatch(/"(APPROVED|CLOSED|RECEIVED|SUCCESS)"/);
});

it("F: rejected message is never part of the P5 dossier", () => {
  demoStore.decideExtractionReview("HP-MSG-WA-001", "REJECTED", "not ours");
  const d = selectP5IncidentDossier(s(), "HP-INC-001");
  expect(d.verification!.messages).toHaveLength(0);
  expect(d.businessStatus).toBeNull();
});
