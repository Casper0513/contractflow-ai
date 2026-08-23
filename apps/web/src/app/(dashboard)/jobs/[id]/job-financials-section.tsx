import type { ComponentProps } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { JobFinancials } from "./job-financials";

type JobFinancialsProps = ComponentProps<typeof JobFinancials>;

type JobFinancialsSectionProps = Pick<
  JobFinancialsProps,
  "jobId" | "costs" | "summary"
> & {
  currency?: string;
};

export function JobFinancialsSection({
  jobId,
  costs,
  summary,
  currency = "CAD",
}: JobFinancialsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Financials</CardTitle>

        <CardDescription>
          Track actual job costs, budget performance, revenue, profit, and margin.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <JobFinancials
          jobId={jobId}
          costs={costs}
          summary={summary}
          currency={currency}
        />
      </CardContent>
    </Card>
  );
}
