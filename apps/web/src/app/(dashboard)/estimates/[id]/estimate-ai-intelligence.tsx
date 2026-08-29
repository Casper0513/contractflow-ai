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

import { generateEstimateAiIntelligence } from "./estimate-ai-actions";

type EstimateAiIntelligenceProps = {
  estimateId: string;
};

export function EstimateAiIntelligence({ estimateId }: EstimateAiIntelligenceProps) {
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
      const result = await generateEstimateAiIntelligence(estimateId);

      setIntelligence(result.intelligence);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ContractFlow AI could not analyze this estimate.",
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
              <CardTitle>ContractFlow AI Estimate Intelligence</CardTitle>

              <Badge variant="secondary">AI powered</Badge>
            </div>

            <CardDescription className="mt-1">
              Analyze this estimate&apos;s sales status, customer history and next best
              action, then prepare customer-ready follow-up wording.
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
                : "Analyze Estimate"}
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
            Analyze this estimate to identify sales risks, follow-up timing and the
            recommended next action. ContractFlow AI can also prepare customer-facing
            wording for human review.
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
