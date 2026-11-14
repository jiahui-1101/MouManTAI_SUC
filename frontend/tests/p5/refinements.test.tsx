import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createMockWorld, type MockWorld } from "../../src/__dev__/p5MockWorld";
import { ApprovalsView } from "../../src/features/recovery/governance/components/ApprovalsView";
import { ComparisonView } from "../../src/features/recovery/governance/components/ComparisonView";
import { DecisionMemoryView } from "../../src/features/recovery/governance/components/DecisionMemoryView";
import { ExecutionView } from "../../src/features/recovery/governance/components/ExecutionView";
import { OutcomesView } from "../../src/features/recovery/governance/components/OutcomesView";
import { runCheckpoint } from "../../src/features/recovery/governance/demoCheckpoints";
import { P5RuntimeProvider, createP5Runtime, devMockDeps, type P5Runtime } from "../../src/features/recovery/governance/p5Store";

afterEach(cleanup);

interface Ctx {
  world: MockWorld;
  rt: P5Runtime;
}

function setup(prep?: (w: MockWorld) => void): Ctx {
  const world = createMockWorld();
  prep?.(world);
  return { world, rt: createP5Runtime(devMockDeps(world)) };
}
const p5 = (ctx: Ctx) => ctx.rt.store.getState().p5;

function show(ctx: Ctx, view: ReactElement) {
  return render(
    <MemoryRouter>
      <P5RuntimeProvider runtime={ctx.rt}>{view}</P5RuntimeProvider>
    </MemoryRouter>,
  );
}

/** All five P5 pages under one router + one runtime, as in the app. */
function showApp(ctx: Ctx, path = "/recovery/compare") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <P5RuntimeProvider runtime={ctx.rt}>
        <Routes>
          <Route path="/recovery/compare" element={<ComparisonView />} />
          <Route path="/approvals" element={<ApprovalsView />} />
          <Route path="/execution" element={<ExecutionView />} />
          <Route path="/outcomes" element={<OutcomesView />} />
          <Route path="/decision-memory" element={<DecisionMemoryView />} />
        </Routes>
      </P5RuntimeProvider>
    </MemoryRouter>,
  );
}

const checkpoint = (ctx: Ctx, id: Parameters<typeof runCheckpoint>[0]) => {
  const r = runCheckpoint(id, ctx.rt);
  if (!r.ok) throw new Error(r.detail);
};
const btn = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const typeReason = (value: string, scope: HTMLElement) =>
  fireEvent.change(within(scope).getAllByRole("textbox")[0]!, { target: { value } });

/** Visible text: excludes audit Details disclosures (tooltips are attributes, so never in textContent). */
function visibleText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details.p5-details").forEach((d) => d.remove());
  return clone.textContent ?? "";
}

describe("Execution menu names (bug fix)", () => {
  it("uses data-driven menu names; never the old hardcoded ones", () => {
    const ctx = setup();
    checkpoint(ctx, "B_APPROVED");
    show(ctx, <ExecutionView />);
    const t = document.body.textContent ?? "";
    expect(t).toContain("Menu limit — Chicken Popcorn");
    expect(t).toContain("Menu limit — Chicken Tenders");
    expect(t).toContain("Menu limit — Happy Combo — Chicken Popcorn");
    expect(t).not.toMatch(/Poppers/);
    expect(t).not.toMatch(/Hot Crispy/);
    expect(t).not.toMatch(/Chicken Tender(?!s)/);
  });
});

describe("Compare decision strip", () => {
  it("shows the four lines from the scenario, and Choose lives in the strip", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    const strip = screen.getByTestId("p5-decision-strip");
    expect(screen.getByTestId("strip-A-spend").textContent).toBe("RM255.00 (projected)");
    expect(screen.getByTestId("strip-B-spend").textContent).toBe("RM0.00 new purchase");
    expect(screen.getByTestId("strip-A-coverage").textContent).toBe("150 of 150 portions (conditional)");
    expect(screen.getByTestId("strip-B-coverage").textContent).toBe("72 of 150 portions");
    expect(screen.getByTestId("strip-A-confirmed").textContent).toBe("60 protected (conditional)");
    expect(screen.getByTestId("strip-B-confirmed").textContent).toBe("60 protected");
    expect(screen.getByTestId("strip-A-giveup").textContent).toBe(
      "RM255.00 and depends on 15kg chilled chicken arriving and passing checks by 10:45",
    );
    expect(screen.getByTestId("strip-B-giveup").textContent).toBe(
      "78 forecast portions can't be offered today (forecast, not customer orders)",
    );
    expect(within(strip).getByText("Conditional — depends on supplier delivery")).toBeTruthy();
    expect(within(strip).getByText("Feasible with current stock")).toBeTruthy();
    expect(within(strip).getByRole("button", { name: "Choose Plan A" })).toBeTruthy();
    expect(within(strip).getByRole("button", { name: "Choose Plan B" })).toBeTruthy();
    // The long table is collapsed below the strip
    const details = screen.getByTestId("p5-full-comparison") as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it("mutating the store numbers changes the strip (nothing hardcoded)", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    act(() =>
      ctx.world.update((s) => {
        s.scenarios.A!.additionalCostSen = 31000;
        s.scenarios.A!.newPurchaseKgMilli = 18000;
        s.scenarios.B!.forecastChickenPortionsServed = 80;
        s.scenarios.B!.forecastChickenPortionsUnmet = 70;
        s.scenarios.B!.confirmedChickenPortionsProtected = 55;
      }),
    );
    expect(screen.getByTestId("strip-A-spend").textContent).toBe("RM310.00 (projected)");
    expect(screen.getByTestId("strip-A-giveup").textContent).toContain("RM310.00 and depends on 18kg chilled chicken");
    expect(screen.getByTestId("strip-B-coverage").textContent).toBe("80 of 150 portions");
    expect(screen.getByTestId("strip-B-confirmed").textContent).toBe("55 protected");
    expect(screen.getByTestId("strip-B-giveup").textContent).toContain("70 forecast portions");
  });
});

describe("Presentation mode", () => {
  it("hides dev controls and audit details, keeps truth labels, and survives in-app navigation", () => {
    const ctx = setup();
    showApp(ctx);
    expect(screen.getByTestId("p5-dev-controls")).toBeTruthy();
    expect(screen.getByTestId("p5-context-details")).toBeTruthy();

    fireEvent.click(screen.getByTestId("p5-presentation-toggle"));
    expect(screen.queryByTestId("p5-dev-controls")).toBeNull();
    expect(screen.queryByTestId("p5-context-details")).toBeNull();
    expect(screen.getByTestId("p5-presentation-toggle").getAttribute("aria-pressed")).toBe("true");
    // truth labels still visible
    expect(screen.getByTitle(/^SIMULATED_CALCULATION/).textContent).toBe("Simulated");
    expect(screen.getByText("Not a production food-safety or procurement authorization system.")).toBeTruthy();

    // Navigate with on-page CTA only
    fireEvent.click(btn("Choose Plan B"));
    fireEvent.click(screen.getByRole("link", { name: "Continue to Approval →" }));
    expect(screen.getByRole("heading", { name: /Approval request — Plan B/ })).toBeTruthy();
    expect(screen.queryByTestId("p5-dev-controls")).toBeNull();
    expect(screen.getByTestId("p5-presentation-toggle").getAttribute("aria-pressed")).toBe("true");
  });

  it("Shift+P toggles it and '?' lists the shortcuts including the demo checkpoints", () => {
    const ctx = setup();
    showApp(ctx);
    fireEvent.keyDown(window, { key: "P", shiftKey: true });
    expect(ctx.rt.ui.getState().presentationMode).toBe(true);
    fireEvent.keyDown(window, { key: "?" });
    const list = screen.getByTestId("p5-shortcuts-list");
    expect(list.textContent).toContain("Toggle presentation mode");
    expect(list.textContent).toContain("Jump to demo state: Plan B approved");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByTestId("p5-shortcuts-list")).toBeNull();
  });

  it("Shift+3 jumps to 'Plan B approved' through real slice actions", () => {
    const ctx = setup();
    showApp(ctx);
    act(() => {
      fireEvent.keyDown(window, { key: "#", code: "Digit3", shiftKey: true });
    });
    expect(p5(ctx).approvals).toMatchObject([{ state: "APPROVED", selectedStrategy: "B", actorRole: "Owner" }]);
    expect(p5(ctx).actions).toHaveLength(7);
  });
});

describe("Bulk advance on Execution", () => {
  it("requires a reason, respects the role, and reports what was skipped", () => {
    const ctx = setup();
    checkpoint(ctx, "B_APPROVED");
    act(() => ctx.world.setRole("KitchenLead"));
    show(ctx, <ExecutionView />);
    const advance = btn("Advance all tasks I can do as Kitchen Lead (4)");
    fireEvent.click(advance);
    const d = screen.getByRole("dialog");
    fireEvent.click(within(d).getByRole("button", { name: "Advance tasks" }));
    expect(within(d).getByRole("alert").textContent).toContain("A reason is required.");
    expect(p5(ctx).auditLog).toHaveLength(0);

    typeReason("Kitchen started all prep batches", d);
    fireEvent.click(within(d).getByRole("button", { name: "Advance tasks" }));
    expect(screen.getByTestId("p5-advance-summary").textContent).toBe(
      "Advanced 4 tasks · 3 skipped (not allowed for Kitchen Lead)",
    );
    expect(p5(ctx).auditLog).toHaveLength(4);
    expect(p5(ctx).auditLog.every((e) => e.actorRole === "KitchenLead")).toBe(true);
    expect(p5(ctx).actions.filter((a) => a.state === "SIMULATED_EXECUTION").map((a) => a.actionType)).toEqual(
      Array(4).fill("PREP_BATCH_TASK"),
    );
    expect(p5(ctx).actions.some((a) => a.state === "VERIFIED")).toBe(false);
  });
});

describe("Staged blocker cards", () => {
  it("execution role refusal: human headline, allowed roles, no raw code visible", () => {
    const ctx = setup();
    checkpoint(ctx, "B_APPROVED");
    act(() => ctx.world.setRole("ProcurementOfficer"));
    ctx.rt.ui.getState().setPresentationMode(true);
    show(ctx, <ExecutionView />);
    const card = screen.getByTestId("p5-execution-role-refusal");
    expect(card.textContent).toContain("Procurement Officer can't do any of the remaining tasks");
    expect(card.textContent).toContain("Menu limits: Owner or Operations Manager");
    expect(card.textContent).toContain("Prep batches: Owner, Operations Manager or Kitchen Lead");
    expect(card.textContent).not.toMatch(/DEMO_FORBIDDEN|MENU_LIMIT_TASK|PREP_BATCH_TASK|ProcurementOfficer/);
  });

  it("stale numbers: full-width card with a Back to Comparison CTA", () => {
    const ctx = setup();
    checkpoint(ctx, "B_CHOSEN");
    show(ctx, <ApprovalsView />);
    act(() => ctx.world.changeFingerprint());
    const card = screen.getByTestId("approval-blocker");
    expect(card.textContent).toContain("The numbers changed — this plan must be recalculated before it can be approved");
    expect(card.textContent).toContain("data is now at version 2");
    expect(within(card).getByRole("link", { name: "Back to Comparison" })).toBeTruthy();
  });
});

describe("Outcome hero", () => {
  it("UNVERIFIED is neutral with an x-of-n count; complete evidence stays UNVERIFIED until Verify; then SUCCESS keeps the prefix", () => {
    const ctx = setup();
    checkpoint(ctx, "ALL_AWAITING_EVIDENCE");
    const view = show(ctx, <OutcomesView />);
    const hero = screen.getByTestId("p5-outcome-hero");
    expect(hero.getAttribute("data-tone")).toBe("neutral");
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: UNVERIFIED");
    expect(screen.getByTestId("p5-outcome-why").textContent).toBe("waiting for evidence (0 of 8 items recorded)");
    // Checklist sits directly under the hero
    expect(hero.nextElementSibling?.getAttribute("data-testid")).toBe("p5-missing-evidence-list");
    view.unmount();

    checkpoint(ctx, "EVIDENCE_COMPLETE");
    show(ctx, <OutcomesView />);
    expect(screen.getByTestId("p5-outcome-hero").getAttribute("data-tone")).toBe("neutral");
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: UNVERIFIED");
    expect(screen.getByTestId("p5-outcome-why").textContent).toContain("all 8 evidence items recorded");

    fireEvent.click(btn("Verify simulated outcome"));
    expect(screen.getByTestId("p5-outcome-hero").getAttribute("data-tone")).toBe("success");
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: SUCCESS");
    expect(screen.getByTestId("p5-success-subtext").textContent).toBe("Demo evidence only — not real Happy Potato operations");
  });

  it("Plan A late delivery checkpoint shows FAILED with the human reason", () => {
    const ctx = setup();
    checkpoint(ctx, "A_LATE_FAILED");
    show(ctx, <OutcomesView />);
    expect(screen.getByTestId("p5-outcome-hero").getAttribute("data-tone")).toBe("danger");
    expect(screen.getByTestId("p5-outcome-why").textContent).toBe("Chicken arrived 11:00 — after the 10:45 cutoff");
  });
});

describe("Decision Memory case card", () => {
  it("shows chose / gave up / owner's reason / lesson from the store", () => {
    const ctx = setup();
    checkpoint(ctx, "EVIDENCE_COMPLETE");
    p5(ctx).verifyDemoOutcome("HP-INC-001");
    p5(ctx).saveDemoDecisionMemory("HP-INC-001");
    show(ctx, <DecisionMemoryView />);
    const card = screen.getByTestId("p5-case-cards");
    expect(card.textContent).toContain("Chicken delivery cancelled → Plan B → Simulated Outcome: SUCCESS");
    expect(card.textContent).toContain("RM0.00 new spend · 60 confirmed portions protected");
    expect(card.textContent).toContain("78 forecast portions (forecast, not customer orders)");
    expect(card.textContent).toContain("Owner's reason:");
    expect(card.textContent).toContain("Lesson (demo interpretation):");
  });
});

describe("Banned wording and raw codes across all five pages", () => {
  const BANNED: RegExp[] = [
    /AI recommends/i,
    /best plan/i,
    /optimal/i,
    /\bsaved\b/i,
    /savings/i,
    /\bROI\b/,
    /profit/i,
    /synced/i,
    /Chicken Rice/i,
    /orders breached/i,
    /verified (outcome|success)/i,
    /DEMO_FORBIDDEN/,
    /STALE_SCENARIO/,
    /APPROVAL_EXPIRED/,
    /AWAITING_MANUAL_UPDATE/,
    /KgMilli/,
  ];
  const check = (where: string) => {
    const t = visibleText();
    for (const re of BANNED) expect(t, `${where}: banned ${re}`).not.toMatch(re);
  };

  const PAGES: [string, ReactElement][] = [
    ["compare", <ComparisonView />],
    ["approvals", <ApprovalsView />],
    ["execution", <ExecutionView />],
    ["outcomes", <OutcomesView />],
    ["memory", <DecisionMemoryView />],
  ];

  type Scenario = [string, (ctx: Ctx) => void];
  const STATES: Scenario[] = [
    ["ready", () => {}],
    ["B chosen", (c) => checkpoint(c, "B_CHOSEN")],
    ["B approved", (c) => checkpoint(c, "B_APPROVED")],
    ["awaiting evidence", (c) => checkpoint(c, "ALL_AWAITING_EVIDENCE")],
    [
      "success saved",
      (c) => {
        checkpoint(c, "EVIDENCE_COMPLETE");
        p5(c).verifyDemoOutcome("HP-INC-001");
        p5(c).saveDemoDecisionMemory("HP-INC-001");
      },
    ],
    ["A failed", (c) => checkpoint(c, "A_LATE_FAILED")],
    [
      "viewer blocked",
      (c) => {
        checkpoint(c, "B_CHOSEN");
        c.world.setRole("ViewerAuditor");
      },
    ],
    [
      "ops blocked",
      (c) => {
        checkpoint(c, "B_APPROVED");
        c.world.setRole("ProcurementOfficer");
      },
    ],
    [
      "stale",
      (c) => {
        checkpoint(c, "B_APPROVED");
        c.world.changeFingerprint();
      },
    ],
    [
      "expired",
      (c) => {
        checkpoint(c, "A_LATE_FAILED");
        c.world.setClock("10:50");
      },
    ],
  ];

  it.each(STATES)("state: %s", (_name, prep) => {
    for (const [page, el] of PAGES) {
      const ctx = setup();
      prep(ctx);
      const v = show(ctx, el);
      check(`${page} (dev mode)`);
      act(() => ctx.rt.ui.getState().setPresentationMode(true));
      check(`${page} (presentation mode)`);
      v.unmount();
    }
  });
});
