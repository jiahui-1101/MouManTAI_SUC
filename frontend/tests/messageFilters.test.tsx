import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_FILTERS, MessageFilters, matchesMessage, sortMessages } from "../src/features/messaging/MessageFilters";
import { demoStore } from "../src/store/demoStore";
afterEach(cleanup);
it("combines channel and verification conditions and orders fixture timestamps", () => {
 const messages = demoStore.getSnapshot().messages;
 const criteria = { ...DEFAULT_FILTERS, channel: "WHATSAPP", verification: "UNVERIFIED_SENDER", sort: "NEWEST" };
 const result = messages.filter(message => matchesMessage(message, criteria)).sort((a,b) => sortMessages(a,b,criteria));
 expect(result.length).toBeGreaterThan(0);
 expect(result.every(message => message.channel === "WHATSAPP" && message.verification === "UNVERIFIED_SENDER")).toBe(true);
 expect(messages.filter(message => matchesMessage(message, { ...criteria, channel: "OUTLOOK" }))).toHaveLength(0);
});
it("offers labelled filters and resets combined conditions", () => {
 function Consumer() { const [value, setValue] = useState(DEFAULT_FILTERS); return <MessageFilters value={value} onChange={setValue} count={2} onClear={() => setValue(DEFAULT_FILTERS)} />; }
 render(<Consumer />);
 fireEvent.change(screen.getByRole("combobox", { name: "Channel" }), { target: { value: "TELEGRAM" } });
 expect(screen.getByRole("status").textContent).toContain("1 filters applied");
 fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
 expect(screen.getByRole("status").textContent).toContain("0 filters applied");
});
