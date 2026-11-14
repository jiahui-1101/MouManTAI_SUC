import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Tabs } from "../src/components/ui";

afterEach(cleanup);

it("moves focus and selection with the keyboard and exposes only the labelled active panel", () => {
  function RecoveryTabs() {
    const [value, setValue] = useState<"stock" | "prep">("stock");
    return (
      <Tabs
        label="Recovery views"
        tabs={[
          { id: "stock", label: "Stock", panel: "Stock allocation" },
          { id: "prep", label: "Prep", panel: "Prep schedule" },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  }

  render(<RecoveryTabs />);
  const stock = screen.getByRole("tab", { name: "Stock" });
  const prep = screen.getByRole("tab", { name: "Prep" });
  expect(stock.tabIndex).toBe(0);
  expect(prep.tabIndex).toBe(-1);
  stock.focus();
  fireEvent.keyDown(stock, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(prep);
  expect(prep.getAttribute("aria-selected")).toBe("true");
  expect(prep.tabIndex).toBe(0);
  expect(stock.tabIndex).toBe(-1);
  const panel = screen.getByRole("tabpanel", { name: "Prep" });
  expect(panel.id).toBe(prep.getAttribute("aria-controls"));
  expect(panel.textContent).toBe("Prep schedule");
  expect(screen.queryByRole("tabpanel", { name: "Stock" })).toBeNull();
  fireEvent.keyDown(prep, { key: "Home" });
  expect(document.activeElement).toBe(stock);
  expect(screen.getByRole("tabpanel", { name: "Stock" })).toBeTruthy();
  fireEvent.keyDown(stock, { key: "End" });
  expect(document.activeElement).toBe(prep);
  fireEvent.keyDown(prep, { key: "ArrowRight" });
  expect(document.activeElement).toBe(stock);
});
