/** Shared helpers for the current P1 UI (dropdown filters, table rows, multiple live regions). */
import { fireEvent, screen } from "@testing-library/react";

/** Inbox channel filter is a "Channel" dropdown. */
export function chooseInboxChannel(label: "All" | "WhatsApp" | "Outlook" | "Telegram") {
  const value = { All: "ALL", WhatsApp: "WHATSAPP", Outlook: "OUTLOOK", Telegram: "TELEGRAM" }[label];
  fireEvent.change(screen.getByLabelText("Channel"), { target: { value } });
}

/** Opens an inbox row by sender and HH:MM time (rows read "<sender> … <time> MYT"). */
export function openInboxRow(sender: string, time: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${sender}.*${time} MYT`) }));
}

/** Message Intelligence queue view: "Active reviews" / "Completed reviews". */
export function chooseReviewStatus(value: "ACTIVE" | "HISTORY") {
  fireEvent.change(screen.getByRole("combobox", { name: "Review status" }), { target: { value } });
}

/** The review action result line (separate from the evidence-analysis status). */
export const reviewStatusLine = () => document.querySelector<HTMLElement>(".mi__status, p.sr-only[role=status][aria-live=polite]");
