import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  UserRound,
} from "lucide-react";

import { FollowUpsWorkQueue } from "@/components/follow-ups/follow-ups-work-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/authenticated-api";
import { getFollowUps, type FollowUp } from "@/lib/follow-ups-api";

export default async function FollowUpsPage() {
  const [followUps, currentUser] = await Promise.all([getFollowUps(), getCurrentUser()]);

  const openFollowUps = followUps.filter((followUp) => !followUp.completedAt);

  const myFollowUps = openFollowUps.filter(
    (followUp) => followUp.assignedTo?.id === currentUser.id,
  );

  const overdueFollowUps = openFollowUps.filter(isOverdue);

  const dueTodayFollowUps = openFollowUps.filter(isDueToday);

  const completedFollowUps = followUps.filter((followUp) =>
    Boolean(followUp.completedAt),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Follow-ups</h1>

        <p className="mt-1 text-muted-foreground">
          Customer follow-up work across your ContractFlow workspace.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Open" value={openFollowUps.length} icon={ListChecks} />

        <SummaryCard label="My follow-ups" value={myFollowUps.length} icon={UserRound} />

        <SummaryCard
          label="Overdue"
          value={overdueFollowUps.length}
          icon={AlertTriangle}
          warning={overdueFollowUps.length > 0}
        />

        <SummaryCard
          label="Due today"
          value={dueTodayFollowUps.length}
          icon={CalendarDays}
          warning={dueTodayFollowUps.length > 0}
        />

        <SummaryCard
          label="Completed"
          value={completedFollowUps.length}
          icon={CheckCircle2}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up work queue</CardTitle>
        </CardHeader>

        <CardContent>
          <FollowUpsWorkQueue followUps={followUps} currentUserId={currentUser.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
  warning?: boolean;
}) {
  return (
    <Card className={warning ? "border-amber-500/30" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>

            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>

          <Icon
            className={`h-5 w-5 ${warning ? "text-amber-600" : "text-muted-foreground"}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function isOverdue(followUp: FollowUp) {
  if (followUp.completedAt || !followUp.dueAt) {
    return false;
  }

  return dateKey(new Date(followUp.dueAt)) < dateKey(new Date());
}

function isDueToday(followUp: FollowUp) {
  if (followUp.completedAt || !followUp.dueAt) {
    return false;
  }

  return dateKey(new Date(followUp.dueAt)) === dateKey(new Date());
}

function dateKey(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
