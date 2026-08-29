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

import { generateInvoiceAiIntelligence } from "./invoice-ai-actions";

type InvoiceAiIntelligenceProps = {
  invoiceId: string;
};

export function InvoiceAiIntelligence({ invoiceId }: InvoiceAiIntelligenceProps) {
  const [intelligence, setIntelligence] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function generateIntelligence() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateInvoiceAiIntelligence(invoiceId);

      setIntelligence(result.intelligence);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ContractFlow AI could not analyze this invoice.",
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
              <CardTitle>ContractFlow AI Invoice Intelligence</CardTitle>

              <Badge variant="secondary">AI powered</Badge>
            </div>

            <CardDescription className="mt-1">
              Analyze payment status, due dates, reminder history and customer context,
              then prepare an appropriate payment follow-up draft.
            </CardDescription>
          </div>

          <Button
            type="button"
            disabled={loading}
            onClick={() => void generateIntelligence()}
          >
            {loading
              ? "Analyzing..."
              : intelligence
                ? "Refresh AI Analysis"
                : "Analyze Invoice"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!intelligence && !error ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Analyze this invoice to determine collection priority, payment follow-up
            timing and customer-ready wording. Nothing is sent automatically.
          </div>
        ) : null}

        {intelligence ? (
          <div className="rounded-lg border bg-muted/20 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7">{intelligence}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
