import {
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

export interface ModuleSpec {
  title: string;
  icon: LucideIcon;
  description: string;
  features: string[];
}

export const MODULE_SPECS: Record<string, ModuleSpec> = {
  communication: {
    title: "Communication",
    icon: MessagesSquare,
    description:
      "Real-time messaging between both organizations — channels, direct messages, and announcements in one shared space.",
    features: [
      "Channels",
      "Direct Messages",
      "Group Chats",
      "Announcements",
      "Mentions",
      "Reactions",
      "Threaded Replies",
      "Pinned Messages",
      "Shared Files",
      "Search",
      "Read Receipts",
      "Typing Indicators",
    ],
  },
  documents: {
    title: "Documents",
    icon: FileText,
    description:
      "Centralized document repository with version control and approval workflows shared across both organizations.",
    features: [
      "Folders",
      "Drag & Drop Upload",
      "Version Control",
      "Approvals",
      "Comments",
      "Preview",
      "History",
      "Archive",
      "Permissions",
      "Favorites",
      "Tags",
      "Search",
    ],
  },
  tasks: {
    title: "Tasks",
    icon: ListChecks,
    description:
      "Track and coordinate cross-organization work with flexible views for planning and execution.",
    features: [
      "Kanban View",
      "Table View",
      "Calendar View",
      "Timeline View",
      "Title & Description",
      "Priority",
      "Owner / Assignee",
      "Due Date",
      "Status",
      "Checklist",
      "Dependencies",
    ],
  },
  meetings: {
    title: "Meetings",
    icon: CalendarClock,
    description:
      "Schedule, run, and document joint meetings — from agenda setting to action item follow-up.",
    features: [
      "Calendar",
      "Meeting Requests",
      "Agenda",
      "Minutes",
      "Attendance",
      "Action Items",
      "Decisions",
      "Recurring Meetings",
    ],
  },
  engineering: {
    title: "Engineering",
    icon: Ruler,
    description:
      "Manage technical drawings, specifications, and design review workflows for infrastructure works.",
    features: [
      "Technical Drawings",
      "CAD Uploads",
      "Design Reviews",
      "Comments",
      "Revision History",
      "Specifications",
      "Approval Workflow",
      "Drawing Comparison",
      "Issue Tracking",
    ],
  },
  "site-progress": {
    title: "Site Progress",
    icon: HardHat,
    description:
      "Capture on-the-ground progress with structured field reports, media, and inspection records.",
    features: [
      "Daily Reports",
      "Weekly Reports",
      "Monthly Reports",
      "Photos",
      "Videos",
      "Inspections",
      "Issues",
      "Progress %",
      "GPS Tagging",
      "Weather Conditions",
    ],
  },
  reports: {
    title: "Reports",
    icon: BarChart3,
    description:
      "Generate cross-module reports for stakeholders and export them in the format they need.",
    features: [
      "Progress Reports",
      "Task Reports",
      "Meeting Reports",
      "Document Reports",
      "Engineering Reports",
      "Activity Reports",
      "Risk Reports",
      "Decision Logs",
      "Export to PDF",
      "Export to Excel",
      "Export to Word",
    ],
  },
  "knowledge-base": {
    title: "Knowledge Base",
    icon: BookOpen,
    description:
      "A shared library of institutional knowledge — standards, guidance, and lessons learned from past projects.",
    features: [
      "SOPs",
      "Policies",
      "Guidelines",
      "Templates",
      "Lessons Learned",
      "Manuals",
      "FAQs",
      "Search",
      "Categories",
      "Bookmarks",
    ],
  },
  notifications: {
    title: "Notifications",
    icon: Bell,
    description:
      "A unified notification center covering activity from every module across both organizations.",
    features: [
      "All Notifications",
      "Mentions",
      "Task Assignments",
      "Approvals",
      "Meeting Reminders",
      "Document Updates",
      "Type Filters",
      "Mark All as Read",
    ],
  },
  settings: {
    title: "Settings",
    icon: Settings,
    description:
      "Configure your profile, organization, and portal-wide preferences and security controls.",
    features: [
      "Profile",
      "Organization Settings",
      "Roles",
      "Permissions",
      "Authentication",
      "Notification Preferences",
      "Audit Logs",
      "Integrations",
      "Theme",
      "Language",
      "Security",
    ],
  },
};
