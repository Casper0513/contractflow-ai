import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomers } from "@/lib/customers-api";

import { JobForm } from "./job-form";

type NewJobPageProps = {
  searchParams: Promise<{
    customerId?: string;
  }>;
};

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const { customerId } = await searchParams;

  const customers = await getCustomers();

  const selectedCustomerId =
    customerId && customers.some((customer) => customer.id === customerId)
      ? customerId
      : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href={selectedCustomerId ? `/customers/${selectedCustomerId}` : "/jobs"}>
            <ArrowLeft className="h-4 w-4" />
            {selectedCustomerId ? "Back to customer" : "Back to jobs"}
          </Link>
        }
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create job</h1>

        <p className="mt-1 text-muted-foreground">
          Create a job and connect it to an existing customer.
        </p>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>A customer is required</CardTitle>

            <CardDescription>
              Create a customer before creating your first job.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href="/customers">Go to customers</Link>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Job information</CardTitle>

            <CardDescription>
              Start with the basic job details. You can add tasks, scheduling, photos,
              documents, estimates, and invoices later.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <JobForm customers={customers} selectedCustomerId={selectedCustomerId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
