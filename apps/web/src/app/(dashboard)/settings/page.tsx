import { BellRing, Building2, Mail, MapPin, ReceiptText } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCurrentOrganization,
  getInvoiceReminderSettings,
} from "@/lib/organizations-api";

import { BusinessProfileForm } from "./business-profile-form";
import { InvoiceReminderSettingsForm } from "./invoice-reminder-settings-form";

export default async function SettingsPage() {
  const [organization, reminderSettings] = await Promise.all([
    getCurrentOrganization(),
    getInvoiceReminderSettings(),
  ]);

  const canEdit = organization.role === "OWNER" || organization.role === "ADMIN";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <p className="mt-1 text-muted-foreground">
          Manage your business profile, billing preferences, and automation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Business" value={organization.name} icon={Building2} />

        <SummaryCard label="Email" value={organization.email ?? "Not set"} icon={Mail} />

        <SummaryCard
          label="Location"
          value={
            organization.city && organization.province
              ? `${organization.city}, ${organization.province}`
              : "Not set"
          }
          icon={MapPin}
        />

        <SummaryCard label="Currency" value={organization.currency} icon={ReceiptText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>

          <CardDescription>
            This information will appear on invoices, estimates, and other customer-facing
            documents.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <BusinessProfileForm organization={organization} canEdit={canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-muted/30 p-2">
              <BellRing className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle>Invoice reminders</CardTitle>

              <CardDescription className="mt-1">
                Configure automatic payment reminders and overdue follow-ups.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <InvoiceReminderSettingsForm settings={reminderSettings} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Building2;
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
