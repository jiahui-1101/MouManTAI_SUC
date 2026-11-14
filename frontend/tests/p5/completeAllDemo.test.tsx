import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createMockWorld } from "../../src/__dev__/p5MockWorld";
import { CompleteAllDemoButton } from "../../src/features/recovery/governance/components/CompleteAllDemoButton";
import { P5RuntimeProvider, createP5Runtime, devMockDeps } from "../../src/features/recovery/governance/p5Store";

afterEach(cleanup);

function setup(strategy: "A" | "B") {
  const world = createMockWorld();
  const rt = createP5Runtime(devMockDeps(world));
  const p5 = () => rt.store.getState().p5;
  p5().chooseRecoveryScenario(strategy);
  const sel = p5().selection!;
  const res = p5().approveDemoScenario("demo approve", sel.version, sel.fingerprint);
  if (!res.ok) throw new Error(`${res.error}: ${res.detail}`);
  render(
    <MemoryRouter initialEntries={["/execution"]}>
      <P5RuntimeProvider runtime={rt}>
        <Routes>
          <Route path="/execution" element={<CompleteAllDemoButton />} />
          <Route path="/outcomes" element={<p>outcomes page</p>} />
        </Routes>
      </P5RuntimeProvider>
    </MemoryRouter>,
  );
  return { p5, world };
}

describe("Complete all (demo) shortcut", () => {
  it.each(["A", "B"] as const)("Plan %s: advances every task, records as-planned simulated evidence and verifies SUCCESS", (strategy) => {
    const { p5 } = setup(strategy);
    fireEvent.click(screen.getByTestId("p5-complete-all"));
    expect(screen.getByText("outcomes page")).toBeTruthy();
    const approval = p5().approvals.find((a) => a.state === "APPROVED")!;
    const tasks = p5().actions.filter((a) => a.approvalId === approval.id);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.state === "AWAITING_EVIDENCE")).toBe(true);
    expect(p5().outcomes[approval.incidentId]!.status).toBe("SUCCESS");
    expect(p5().evidence.every((e) => e.source === "SIMULATED_EVIDENCE")).toBe(true);
    // Uses the normal audited path: two simulated steps per task are logged.
    expect(p5().auditLog.filter((e) => tasks.some((t) => t.id === e.actionId)).length).toBe(tasks.length * 2);
  });

  it("is disabled before approval", () => {
    const world = createMockWorld();
    const rt = createP5Runtime(devMockDeps(world));
    render(<MemoryRouter><P5RuntimeProvider runtime={rt}><CompleteAllDemoButton /></P5RuntimeProvider></MemoryRouter>);
    expect((screen.getByTestId("p5-complete-all") as HTMLButtonElement).disabled).toBe(true);
  });
});
