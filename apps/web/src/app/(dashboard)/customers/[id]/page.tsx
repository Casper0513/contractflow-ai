import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

import { ActivitySummary } from "@/components/customers/activity-summary";
import { CustomerActivityTimeline } from "@/components/customers/customer-activity-timeline";
import { CustomerHealth } from "@/components/customers/customer-health";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomer, getCustomerActivity } from "@/lib/customers-api";
import { getCustomerJobs, type Job } from "@/lib/jobs-api";

import { CustomerStatusActions } from "./customer-status-actions";

type CustomerDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const { id } = await params;

  const [customer, activities, jobs] = await Promise.all([
    getCustomer(id),
    getCustomerActivity(id),
    getCustomerJobs(id),
  ]);

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-8">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Link>
        }
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>

          {customer.companyName && (
            <p className="mt-1 text-muted-foreground">{customer.companyName}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!customer.archivedAt && (
            <Button
              nativeButton={false}
              render={<Link href={`/customers/${customer.id}/edit`}>Edit customer</Link>}
            />
          )}

          <CustomerStatusActions
            customerId={customer.id}
            customerName={name}
            archived={Boolean(customer.archivedAt)}
          />
        </div>
      </div>

      {customer.archivedAt && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="font-medium">Archived customer</p>

          <p className="mt-1 text-sm text-muted-foreground">
            This customer was archived on{" "}
            {new Date(customer.archivedAt).toLocaleDateString()}.
          </p>
        </div>
      )}

      <CustomerHealth customer={customer} activities={activities} jobs={jobs} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {customer.email ? (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />

                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No email address.</p>
            )}

            {customer.phone ? (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />

                <a href={`tel:${customer.phone}`} className="hover:underline">
                  {customer.phone}
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No phone number.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="whitespace-pre-wrap text-sm">
              {customer.notes || "No notes yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Jobs</CardTitle>

              <CardDescription className="mt-1">
                Jobs connected to this customer.
              </CardDescription>
            </div>

            {!customer.archivedAt && (
              <Button
                nativeButton={false}
                render={<Link href={`/jobs/new?customerId=${customer.id}`}>New job</Link>}
              />
            )}
          </div>
        </CardHeader>

        <CardContent>
          {jobs.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-sm px-6 text-center">
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">No jobs yet</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Jobs created for this customer will appear here.
                </p>

                {!customer.archivedAt && (
                  <Button
                    className="mt-4"
                    nativeButton={false}
                    render={<Link href="/jobs/new">Create job</Link>}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {jobs.map((job) => (
                <CustomerJobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer information</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Status" value={customer.archivedAt ? "Archived" : "Active"} />

          <InfoItem
            label="Created"
            value={new Date(customer.createdAt).toLocaleDateString()}
          />

          <InfoItem
            label="Last updated"
            value={new Date(customer.updatedAt).toLocaleDateString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <CardTitle>Activity timeline</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                A complete history of customer activity.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              {activities.length} event
              {activities.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <ActivitySummary activities={activities} />

          <CustomerActivityTimeline activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerJobCard({ job }: { job: Job }) {
  const address = [job.addressLine1, job.city, job.province].filter(Boolean).join(", ");

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`group block rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm ${
        job.archivedAt ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{job.name}</p>

            <JobStatusBadge status={job.status} />

            {job.archivedAt && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {job.description}
            </p>
          )}
        </div>

        <BriefcaseBusiness className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {job.startDate && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />

            <span>{new Date(job.startDate).toLocaleDateString()}</span>
          </div>
        )}

        {address && (
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />

            <span className="truncate">{address}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{formatEnumLabel(job.priority)} priority</span>

        {job.budgetCents !== null && (
          <span className="font-medium text-foreground">
            {formatMoney(job.budgetCents)}
          </span>
        )}
      </div>
    </Link>
  );
}

function JobStatusBadge({ status }: { status: Job["status"] }) {
  const styles: Record<Job["status"], string> = {
    LEAD: "border-slate-500/30 bg-slate-500/10 text-slate-600",

    ESTIMATING: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",

    APPROVED: "border-violet-500/30 bg-violet-500/10 text-violet-600",

    SCHEDULED: "border-blue-500/30 bg-blue-500/10 text-blue-600",

    IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-700",

    ON_HOLD: "border-orange-500/30 bg-orange-500/10 text-orange-700",

    COMPLETED: "border-green-500/30 bg-green-500/10 text-green-700",

    CANCELLED: "border-red-500/30 bg-red-500/10 text-red-600",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 font-medium">{value}</p>
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
