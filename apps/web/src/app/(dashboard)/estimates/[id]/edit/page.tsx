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
import { getEstimate, type Estimate } from "@/lib/estimates-api";
import { getJobs } from "@/lib/jobs-api";
import { ApiRequestError } from "@/lib/server-api";

import { EstimateEditForm } from "./estimate-edit-form";

type EditEstimatePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditEstimatePage({ params }: EditEstimatePageProps) {
  const { id } = await params;

  let estimate: Estimate;

  try {
    estimate = await getEstimate(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  if (estimate.status !== "DRAFT") {
    redirect(`/estimates/${estimate.id}`);
  }

  const [customers, jobs] = await Promise.all([getCustomers(), getJobs()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href={`/estimates/${estimate.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to estimate
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/30">
          <Pencil className="h-5 w-5 text-muted-foreground" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Edit {estimate.number}</h1>

            <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-600">
              Draft
            </span>
          </div>

          <p className="mt-1 text-muted-foreground">
            Update this estimate before sending it to the customer.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estimate builder</CardTitle>

          <CardDescription>
            Changes remain editable while this estimate is a draft. Once sent, the
            estimate becomes read-only.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <EstimateEditForm estimate={estimate} customers={customers} jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
