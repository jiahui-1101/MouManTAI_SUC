import type { InboxMessage } from "../../store/demoStore";
import type { ReactNode } from "react";
export const DEFAULT_FILTERS = { channel: "ALL", stage: "ALL", verification: "ALL", read: "ALL", linked: "ALL", sort: "DEFAULT", category: "ALL" };
export type MessageFiltersValue = typeof DEFAULT_FILTERS;
export const matchesMessage = (m: InboxMessage, f: MessageFiltersValue) => (f.channel === "ALL" || m.channel === f.channel) && (f.stage === "ALL" || m.stage === f.stage) && (f.verification === "ALL" || m.verification === f.verification) && (f.read === "ALL" || m.read === (f.read === "READ")) && (f.linked === "ALL" || Boolean(m.linkedIncidentId) === (f.linked === "LINKED")) && (f.category === "ALL" || (m.kind === "SUPPLIER_OFFER") === (f.category === "OFFER"));
export const sortMessages = (a: InboxMessage, b: InboxMessage, f: MessageFiltersValue) => f.sort === "NEWEST" ? b.receivedAtIso.localeCompare(a.receivedAtIso) : f.sort === "OLDEST" ? a.receivedAtIso.localeCompare(b.receivedAtIso) : 0;
const groups = {
 channel: ["Channel", [["ALL", "All channels"], ["WHATSAPP", "WhatsApp"], ["OUTLOOK", "Outlook"], ["TELEGRAM", "Telegram"]]],
 stage: ["Processing status", [["ALL", "All"], ["PARSED", "Parsed"], ["REVIEW_PENDING", "Review pending"], ["LINKED", "Linked to incident"]]],
 verification: ["Sender verification", [["ALL", "All verification states"], ["VERIFIED_DEMO_CONTACT", "Verified demo contact"], ["UNVERIFIED_SENDER", "Unverified sender"]]],
 read: ["Read state", [["ALL", "All read states"], ["UNREAD", "Unread"], ["READ", "Opened"]]],
 linked: ["Incident association", [["ALL", "All incident associations"], ["LINKED", "Linked"], ["UNLINKED", "Not linked"]]],
 category: ["Message category", [["ALL", "All message categories"], ["INCIDENT", "Supplier messages"], ["OFFER", "Supplier offers"]]],
 sort: ["Sort messages", [["DEFAULT", "Default order"], ["NEWEST", "Newest first"], ["OLDEST", "Oldest first"]]],
} as const;
export function MessageFilters({ value, onChange, count, onClear, mode = "inbox", search, reviewControl }: { value: MessageFiltersValue; onChange: (value: MessageFiltersValue) => void; count: number; onClear: () => void; mode?: "inbox" | "review"; search?: ReactNode; reviewControl?: ReactNode }) {
 const active = (Object.keys(value) as (keyof MessageFiltersValue)[]).filter(key => value[key] !== DEFAULT_FILTERS[key]).length;
 const keys: (keyof MessageFiltersValue)[] = mode === "review" ? ["verification", "channel"] : ["channel", "read", "stage"];
 return <section className="message-filters" aria-label="Message filter panel"><div className="message-filters__search">{search}</div><div className="message-filters__grid">{reviewControl}{keys.map(key => <label key={key}><span>{groups[key][0]}</span><select value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}>{groups[key][1].map(([id, label]) => <option key={id} value={id}>{id === "ALL" ? "All" : label}</option>)}</select></label>)}</div><div className="message-filters__summary"><span role="status">{count} results · {active} filters applied</span><button type="button" onClick={onClear}>Reset filters</button></div></section>;
}
