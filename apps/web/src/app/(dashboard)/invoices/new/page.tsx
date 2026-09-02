import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomers } from "@/lib/customers-api";
import { getJobs } from "@/lib/jobs-api";
import { getCurrentOrganization } from "@/lib/organizations-api";

import { InvoiceForm } from "./invoice-form";

type NewInvoicePageProps = {
  searchParams: Promise<{
    customerId?: string;
    jobId?: string;
  }>;
};

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const { customerId, jobId } = await searchParams;

  const [customers, jobs, organization] = await Promise.all([
    getCustomers(),
    getJobs(),
    getCurrentOrganization(),
  ]);

  const selectedCustomerId =
    customerId && customers.some((customer) => customer.id === customerId)
      ? customerId
      : undefined;

  const selectedJob = jobId ? jobs.find((job) => job.id === jobId) : undefined;

  const selectedJobId =
    selectedJob && (!selectedCustomerId || selectedJob.customerId === selectedCustomerId)
      ? selectedJob.id
      : undefined;

  const effectiveCustomerId = selectedCustomerId ?? selectedJob?.customerId;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/30">
          <ReceiptText className="h-5 w-5 text-muted-foreground" />
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">New invoice</h1>

          <p className="mt-1 text-muted-foreground">
            Create a manual invoice and save it as a draft.
          </p>
        </div>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>A customer is required</CardTitle>

            <CardDescription>
              Create a customer before building your first invoice.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href="/customers/new">Create customer</Link>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Invoice builder</CardTitle>

            <CardDescription>
              Add line items, pricing, tax, due dates, notes, and payment terms.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <InvoiceForm
              customers={customers}
              jobs={jobs}
              currency={organization.currency}
              selectedCustomerId={effectiveCustomerId}
              selectedJobId={selectedJobId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
