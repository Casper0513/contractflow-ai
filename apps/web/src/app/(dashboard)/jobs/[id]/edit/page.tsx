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
import { getJob } from "@/lib/jobs-api";

import { JobEditForm } from "./job-edit-form";

type EditJobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditJobPage({ params }: EditJobPageProps) {
  const { id } = await params;

  const [job, customers] = await Promise.all([getJob(id), getCustomers()]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href={`/jobs/${job.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to job
          </Link>
        }
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit job</h1>

        <p className="mt-1 text-muted-foreground">
          Update the details for{" "}
          <span className="font-medium text-foreground">{job.name}</span>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job information</CardTitle>

          <CardDescription>
            Changes will be saved to the job and recorded in the customer&apos;s activity
            history.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <JobEditForm job={job} customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
