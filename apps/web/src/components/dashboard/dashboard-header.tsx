import { UserButton } from "@clerk/nextjs";

import { MobileSidebar } from "./mobile-sidebar";
import { NotificationBell } from "./notification-bell";

type DashboardHeaderProps = {
  organizationName: string;
};

export function DashboardHeader({ organizationName }: DashboardHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileSidebar organizationName={organizationName} />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{organizationName}</p>

          <p className="hidden text-xs text-muted-foreground sm:block">
            Contractor operations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <UserButton />
      </div>
    </header>
  );
}
