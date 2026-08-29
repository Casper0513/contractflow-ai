"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EstimateStatus } from "@/lib/estimates-api";

import { sendReviewedEstimateAction } from "./actions";
import {
  generateEstimateAiIntelligence,
  generateEstimateAiSendDraft,
} from "./estimate-ai-actions";

type EstimateAiIntelligenceProps = {
  estimateId: string;
  status: EstimateStatus;
};

export function EstimateAiIntelligence({
  estimateId,
  status,
}: EstimateAiIntelligenceProps) {
  const router = useRouter();

  const [intelligence, setIntelligence] = useState<string | null>(null);

  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [draftLoading, setDraftLoading] = useState(false);

  const [draftError, setDraftError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");

  const [message, setMessage] = useState("");

  const [draftGenerated, setDraftGenerated] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);

  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const [isSending, startSending] = useTransition();

  async function generateIntelligence() {
    if (analysisLoading) {
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const result = await generateEstimateAiIntelligence(estimateId);

      setIntelligence(result.intelligence);
    } catch (caughtError) {
      setAnalysisError(
        caughtError instanceof Error
          ? caughtError.message
          : "ContractFlow AI could not analyze this estimate.",
      );
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function generateSendDraft() {
    if (draftLoading) {
      return;
    }

    setDraftLoading(true);
    setDraftError(null);
    setSendError(null);
    setSendSuccess(null);

    try {
      const result = await generateEstimateAiSendDraft(estimateId);

      if (!result.draft) {
        setDraftError(
          result.error || "ContractFlow AI could not prepare an estimate email draft.",
        );
        setDraftGenerated(false);
        setSubject("");
        setMessage("");

        return;
      }

      setSubject(result.draft.subject);
      setMessage(result.draft.message);
      setDraftGenerated(true);
    } catch (caughtError) {
      setDraftError(
        caughtError instanceof Error
          ? caughtError.message
          : "ContractFlow AI could not prepare an estimate email draft.",
      );
    } finally {
      setDraftLoading(false);
    }
  }

  function sendEstimate() {
    if (isSending) {
      return;
    }

    setSendError(null);
    setSendSuccess(null);

    startSending(async () => {
      const result = await sendReviewedEstimateAction(estimateId, subject, message);

      if (result.error) {
        setSendError(result.error);

        return;
      }

      setSendSuccess(result.success);
      router.refresh();
    });
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
              action. Draft estimates can also use AI to prepare a customer email for
              human review before sending.
            </CardDescription>
          </div>

          <Button
            type="button"
            disabled={analysisLoading}
            onClick={() => void generateIntelligence()}
          >
            {analysisLoading
              ? "Analyzing..."
              : intelligence
                ? "Refresh AI Analysis"
                : "Analyze Estimate"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {analysisError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {analysisError}
          </div>
        ) : null}

        {!intelligence && !analysisError ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Analyze this estimate to identify sales risks, follow-up timing and the
            recommended next action.
          </div>
        ) : null}

        {intelligence ? (
          <div className="rounded-lg border bg-muted/20 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7">{intelligence}</p>
          </div>
        ) : null}

        {status === "DRAFT" ? (
          <div className="space-y-4 border-t pt-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />

                  <p className="font-medium">AI-assisted estimate email</p>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Generate customer-ready wording, edit it as needed, then explicitly send
                  the estimate.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={draftLoading || isSending}
                onClick={() => void generateSendDraft()}
              >
                <Sparkles className="h-4 w-4" />

                {draftLoading
                  ? "Generating..."
                  : draftGenerated
                    ? "Regenerate AI Draft"
                    : "Generate AI Draft"}
              </Button>
            </div>

            {draftError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {draftError}
              </div>
            ) : null}

            {!draftGenerated ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                AI will prepare the email subject and message only. The estimate will not
                be sent until you review the wording and click Send Estimate Email.
              </div>
            ) : null}

            {draftGenerated ? (
              <div className="space-y-4 rounded-xl border bg-muted/10 p-5">
                <div className="space-y-2">
                  <label htmlFor="estimate-email-subject" className="text-sm font-medium">
                    Subject
                  </label>

                  <input
                    id="estimate-email-subject"
                    value={subject}
                    maxLength={200}
                    disabled={isSending}
                    onChange={(event) => setSubject(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <p className="text-right text-xs text-muted-foreground">
                    {subject.length}/200
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="estimate-email-message" className="text-sm font-medium">
                    Message
                  </label>

                  <textarea
                    id="estimate-email-message"
                    value={message}
                    maxLength={5000}
                    rows={9}
                    disabled={isSending}
                    onChange={(event) => setMessage(event.target.value)}
                    className="flex min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <p className="text-right text-xs text-muted-foreground">
                    {message.length}/5000
                  </p>
                </div>

                <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                  ContractFlow will add the secure estimate review link and attach the
                  estimate PDF automatically. Review the AI-generated wording before
                  sending.
                </div>

                {sendError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {sendError}
                  </div>
                ) : null}

                {sendSuccess ? (
                  <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                    {sendSuccess}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={
                      isSending ||
                      !subject.trim() ||
                      !message.trim() ||
                      subject.length > 200 ||
                      message.length > 5000
                    }
                    onClick={sendEstimate}
                  >
                    <Send className="h-4 w-4" />

                    {isSending ? "Sending..." : "Send Estimate Email"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
