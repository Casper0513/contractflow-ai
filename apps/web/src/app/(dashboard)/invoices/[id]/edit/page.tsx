import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomers } from "@/lib/customers-api";
import { getInvoice, type Invoice } from "@/lib/invoices-api";
import { getJobs } from "@/lib/jobs-api";
import { ApiRequestError } from "@/lib/server-api";

import { InvoiceEditForm } from "./invoice-edit-form";

type EditInvoicePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params;

  let invoice: Invoice;

  try {
    invoice = await getInvoice(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  /*
   * The API enforces this too, but keeping users out of the
   * editor once an invoice leaves DRAFT gives us consistent
   * frontend behavior.
   */
  if (invoice.status !== "DRAFT") {
    redirect(`/invoices/${invoice.id}`);
  }

  const [customers, jobs] = await Promise.all([getCustomers(), getJobs()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href={`/invoices/${invoice.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to invoice
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/30">
          <Pencil className="h-5 w-5 text-muted-foreground" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Edit {invoice.number}</h1>

            <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-600">
              Draft
            </span>
          </div>

          <p className="mt-1 text-muted-foreground">
            Update this invoice before sending it to the customer.
          </p>
        </div>
      </div>

      {invoice.sourceEstimate && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-sm font-medium">
            Created from{" "}
            <Link
              href={`/estimates/${invoice.sourceEstimate.id}`}
              className="underline-offset-4 hover:underline"
            >
              {invoice.sourceEstimate.number}
            </Link>
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Editing this draft invoice does not modify the approved source estimate.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice builder</CardTitle>

          <CardDescription>
            Changes remain editable while this invoice is a draft. Once sent, the invoice
            becomes read-only.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <InvoiceEditForm invoice={invoice} customers={customers} jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
