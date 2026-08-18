import Link from "next/link";
import { ArrowLeft, FilePlus2 } from "lucide-react";

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

import { EstimateForm } from "./estimate-form";

type NewEstimatePageProps = {
  searchParams: Promise<{
    customerId?: string;
    jobId?: string;
  }>;
};

export default async function NewEstimatePage({ searchParams }: NewEstimatePageProps) {
  const { customerId, jobId } = await searchParams;

  const [customers, jobs] = await Promise.all([getCustomers(), getJobs()]);

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
          <Link href="/estimates">
            <ArrowLeft className="h-4 w-4" />
            Back to estimates
          </Link>
        }
      />

      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/30">
            <FilePlus2 className="h-5 w-5 text-muted-foreground" />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">New estimate</h1>

            <p className="mt-1 text-muted-foreground">
              Build a detailed estimate and save it as a draft.
            </p>
          </div>
        </div>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>A customer is required</CardTitle>

            <CardDescription>
              Create a customer before building your first estimate.
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
            <CardTitle>Estimate builder</CardTitle>

            <CardDescription>
              Add line items, pricing, tax, notes, and terms. Financial totals are
              validated again by the server when saved.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <EstimateForm
              customers={customers}
              jobs={jobs}
              selectedCustomerId={effectiveCustomerId}
              selectedJobId={selectedJobId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
