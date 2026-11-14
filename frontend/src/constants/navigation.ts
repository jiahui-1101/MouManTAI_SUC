import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  Network,
  PlayCircle,
  PlugZap,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Soup,
  Target,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  /** Heading shown on the page itself. */
  title: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Single source of truth for navigation and page titles. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Command Center",
    items: [
      { path: "/overview", label: "Overview", title: "Overview", icon: LayoutDashboard },
      { path: "/inbox", label: "Unified Inbox", title: "Unified Supplier Inbox", icon: Inbox },
      { path: "/message-intelligence", label: "Message Intelligence", title: "Message Intelligence", icon: MessageSquareText },
      { path: "/incidents", label: "Incidents", title: "Incidents", icon: ShieldAlert },
    ],
  },
  {
    label: "Recovery Intelligence",
    items: [
      { path: "/impact", label: "Impact Explorer", title: "Impact Explorer", icon: Network },
      { path: "/recovery/plan-a", label: "Plan A — Supplier Recovery", title: "Plan A — Supplier Recovery", icon: ShoppingCart },
      { path: "/recovery/plan-b", label: "Plan B — Internal Recovery", title: "Plan B — Internal Recovery", icon: Soup },
      { path: "/prep-planning", label: "Prep Planning", title: "Recovery Prep Planning", icon: CalendarClock },
      { path: "/recovery/compare", label: "Recovery Comparison", title: "Recovery Comparison", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Operations",
    items: [
      { path: "/approvals", label: "Approvals", title: "Approvals", icon: ClipboardCheck },
      { path: "/execution", label: "Execution", title: "Execution", icon: PlayCircle },
      { path: "/outcomes", label: "Outcomes", title: "Outcomes", icon: Target },
      { path: "/decision-memory", label: "Decision Memory", title: "Decision Memory", icon: BookOpen },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/channels", label: "Channel Connections", title: "Channel Connections", icon: PlugZap },
      { path: "/settings", label: "Settings", title: "Settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function titleFor(path: string): string {
  const item = NAV_ITEMS.find((entry) => entry.path === path);
  if (!item) throw new Error(`No navigation entry for ${path}`);
  return item.title;
}
