import { BriefcaseBusiness, DollarSign, FileText, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  {
    title: "Customers",
    value: "0",
    description: "Total active customers",
    icon: Users,
  },
  {
    title: "Jobs Today",
    value: "0",
    description: "Scheduled for today",
    icon: BriefcaseBusiness,
  },
  {
    title: "Pending Estimates",
    value: "0",
    description: "Awaiting customer action",
    icon: FileText,
  },
  {
    title: "Revenue",
    value: "$0",
    description: "This month",
    icon: DollarSign,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

        <p className="mt-1 text-muted-foreground">
          Overview of your business operations.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>

                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>

                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming jobs</CardTitle>
            <CardDescription>Your next scheduled service calls.</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No jobs scheduled yet.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest changes in your workspace.</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No activity yet.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
