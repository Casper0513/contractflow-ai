import {
  BellRing,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  Mail,
  MapPin,
  ReceiptText,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getChecklistTemplates } from "@/lib/checklist-templates-api";
import {
  getCurrentOrganization,
  getDispatchSettings,
  getEstimateReminderSettings,
  getInvoiceReminderSettings,
} from "@/lib/organizations-api";

import { BusinessProfileForm } from "./business-profile-form";
import { ChecklistTemplateManager } from "./checklist-template-manager";
import { DispatchSettingsForm } from "./dispatch-settings-form";
import { EstimateReminderSettingsForm } from "./estimate-reminder-settings-form";
import { InvoiceReminderSettingsForm } from "./invoice-reminder-settings-form";

export default async function SettingsPage() {
  const [
    organization,
    invoiceReminderSettings,
    estimateReminderSettings,
    dispatchSettings,
    checklistTemplates,
  ] = await Promise.all([
    getCurrentOrganization(),
    getInvoiceReminderSettings(),
    getEstimateReminderSettings(),
    getDispatchSettings(),
    getChecklistTemplates(),
  ]);

  const canEdit = organization.role === "OWNER" || organization.role === "ADMIN";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <p className="mt-1 text-muted-foreground">
          Manage your business profile, billing preferences, automation, dispatch, and
          reusable job workflows.
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
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle>Dispatch scheduling</CardTitle>

              <CardDescription className="mt-1">
                Configure the defaults used when jobs are dragged from the dispatch
                backlog onto the crew schedule.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <DispatchSettingsForm settings={dispatchSettings} canEdit={canEdit} />
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
          <InvoiceReminderSettingsForm
            settings={invoiceReminderSettings}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-muted/30 p-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle>Estimate reminders</CardTitle>

              <CardDescription className="mt-1">
                Configure automatic follow-ups for estimates awaiting a customer response.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <EstimateReminderSettingsForm
            settings={estimateReminderSettings}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-muted/30 p-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <CardTitle>Checklist templates</CardTitle>

              <CardDescription className="mt-1">
                Build reusable workflows that can be applied to jobs and tracked by your
                team.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ChecklistTemplateManager templates={checklistTemplates} canEdit={canEdit} />
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
