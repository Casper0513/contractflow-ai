"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { generateCustomerAiSummary } from "./customer-ai-actions";

type CustomerAiSummaryProps = {
  customerId: string;
};

export function CustomerAiSummary({ customerId }: CustomerAiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function generateSummary() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateCustomerAiSummary(customerId);

      setSummary(result.summary);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ContractFlow AI could not analyze this customer.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>ContractFlow AI Customer Intelligence</CardTitle>

              <Badge variant="secondary">AI powered</Badge>
            </div>

            <CardDescription className="mt-1">
              Analyze this customer&apos;s jobs, estimates, invoices, payments,
              communications and follow-ups.
            </CardDescription>
          </div>

          <Button type="button" disabled={loading} onClick={() => void generateSummary()}>
            {loading
              ? "Analyzing..."
              : summary
                ? "Refresh AI Brief"
                : "Generate AI Customer Brief"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!summary && !error ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Generate an AI brief to review the relationship, financial exposure, sales
            opportunities, follow-ups and highest-priority next actions for this customer.
          </div>
        ) : null}

        {summary ? (
          <div className="rounded-lg border bg-muted/20 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7">{summary}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
