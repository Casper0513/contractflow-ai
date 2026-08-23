import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  MapPin,
  UserRound,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Job } from "@/lib/jobs-api";

type JobOverviewSectionProps = {
  job: Job;
};

export function JobOverviewSection({ job }: JobOverviewSectionProps) {
  const customerName = [job.customer.firstName, job.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const fullAddress = [
    job.addressLine1,
    job.addressLine2,
    job.city,
    job.province,
    job.postalCode,
    job.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Customer" value={customerName} icon={UserRound} />

        <SummaryItem
          label="Start date"
          value={
            job.startDate ? new Date(job.startDate).toLocaleDateString() : "Not scheduled"
          }
          icon={CalendarDays}
        />

        <SummaryItem
          label="Budget"
          value={job.budgetCents !== null ? formatMoney(job.budgetCents) : "Not set"}
          icon={CircleDollarSign}
        />

        <SummaryItem label="Location" value={job.city ?? "Not set"} icon={MapPin} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job overview</CardTitle>

            <CardDescription>Scope and project information.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <InfoRow label="Status" value={formatEnumLabel(job.status)} />

            <InfoRow label="Priority" value={formatEnumLabel(job.priority)} />

            <InfoRow
              label="Description"
              value={job.description ?? "No description yet."}
            />

            <InfoRow
              label="Created"
              value={new Date(job.createdAt).toLocaleDateString()}
            />

            <InfoRow
              label="Last updated"
              value={new Date(job.updatedAt).toLocaleDateString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer & location</CardTitle>

            <CardDescription>Customer and job-site information.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />

              <div>
                <p className="font-medium">{customerName}</p>

                {job.customer.companyName && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />

                    {job.customer.companyName}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />

              <p className="text-sm">{fullAddress || "No job-site address yet."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SummaryItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />

          <span className="text-sm">{label}</span>
        </div>

        <p className="mt-2 truncate font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}
