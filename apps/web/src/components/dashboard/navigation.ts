import {
  Bot,
  CalendarDays,
  FileText,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  Users,
  Wrench,
} from "lucide-react";

export const dashboardNavigation = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
  },
  {
    title: "Follow-ups",
    href: "/follow-ups",
    icon: ListChecks,
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: Wrench,
  },
  {
    title: "Estimates",
    href: "/estimates",
    icon: FileText,
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    title: "AI Assistant",
    href: "/ai",
    icon: Bot,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
] as const;
