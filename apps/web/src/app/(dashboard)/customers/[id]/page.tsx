import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer, getCustomerActivity } from "@/lib/customers-api";
import { CustomerActivityTimeline } from "@/components/customers/customer-activity-timeline";

import { CustomerStatusActions } from "./customer-status-actions";

import { ActivitySummary } from "@/components/customers/activity-summary";

import { CustomerHealth } from "@/components/customers/customer-health";

type CustomerDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const { id } = await params;
  const [customer, activities] = await Promise.all([
    getCustomer(id),
    getCustomerActivity(id),
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

      <CustomerHealth customer={customer} activities={activities} />

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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
