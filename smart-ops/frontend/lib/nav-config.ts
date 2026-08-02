import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  MessagesSquare,
  FileText,
  ListChecks,
  CalendarClock,
  Ruler,
  HardHat,
  BarChart3,
  BookOpen,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Organizations", href: "/organizations", icon: Building2 },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Communication", href: "/communication", icon: MessagesSquare },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
  { label: "Meetings", href: "/meetings", icon: CalendarClock },
  { label: "Engineering", href: "/engineering", icon: Ruler },
  { label: "Site Progress", href: "/site-progress", icon: HardHat },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];
