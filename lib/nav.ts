import {
  CalendarDaysIcon,
  HouseIcon,
  InboxIcon,
  LightbulbIcon,
  MessageCircleIcon,
  ScanLineIcon,
  SettingsIcon,
  UsersIcon,
  WaypointsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Keyboard hint shown in the command menu. */
  keywords?: string[];
};

export const primaryNav: NavItem[] = [
  { href: "/home", label: "Home", icon: HouseIcon, keywords: ["dashboard", "follow-ups"] },
  { href: "/scan", label: "Scan cards", icon: ScanLineIcon, keywords: ["camera", "upload", "capture"] },
  { href: "/review", label: "Review", icon: InboxIcon, keywords: ["queue", "pending"] },
  { href: "/contacts", label: "Contacts", icon: UsersIcon, keywords: ["people", "network"] },
  { href: "/ask", label: "Ask", icon: MessageCircleIcon, keywords: ["chat", "question", "search"] },
  { href: "/graph", label: "Graph", icon: WaypointsIcon, keywords: ["network", "map", "connections"] },
  { href: "/events", label: "Events", icon: CalendarDaysIcon, keywords: ["meetups", "conferences"] },
  { href: "/insights", label: "Insights", icon: LightbulbIcon, keywords: ["stats", "trends"] },
];

export const secondaryNav: NavItem[] = [
  { href: "/settings", label: "Settings", icon: SettingsIcon, keywords: ["account", "security", "export"] },
];

const byHref = (href: string) => [...primaryNav, ...secondaryNav].find((i) => i.href === href)!;

/** The phone dock: Home, Contacts, Scan in the middle, Ask, and More for everything else. */
export const dockTabs = {
  left: [byHref("/home"), byHref("/contacts")],
  scan: byHref("/scan"),
  right: [byHref("/ask")],
};

/** What the phone's More sheet lists. */
export const moreNav: NavItem[] = ["/review", "/graph", "/events", "/insights", "/settings"].map(byHref);

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
