"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InvoiceStatus } from "@/lib/invoices-api";

import { sendReviewedInvoiceFollowUpAction } from "./actions";
import {
  generateInvoiceAiFollowUpDraft,
  generateInvoiceAiIntelligence,
} from "./invoice-ai-actions";

type InvoiceAiIntelligenceProps = {
  invoiceId: string;
  status: InvoiceStatus;
  balanceDueCents: number;
};

const FOLLOW_UP_ELIGIBLE_STATUSES: InvoiceStatus[] = [
  "SENT",
  "VIEWED",
  "PARTIALLY_PAID",
  "OVERDUE",
];

export function InvoiceAiIntelligence({
  invoiceId,
  status,
  balanceDueCents,
}: InvoiceAiIntelligenceProps) {
  const router = useRouter();

  const [intelligence, setIntelligence] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");

  const [message, setMessage] = useState("");

  const [draftGenerated, setDraftGenerated] = useState(false);

  const [draftLoading, setDraftLoading] = useState(false);

  const [draftError, setDraftError] = useState<string | null>(null);

  const [sendError, setSendError] = useState<string | null>(null);

  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const [sending, startSendTransition] = useTransition();

  const canFollowUp = FOLLOW_UP_ELIGIBLE_STATUSES.includes(status) && balanceDueCents > 0;

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

  async function generateFollowUpDraft() {
    if (draftLoading) {
      return;
    }

    setDraftLoading(true);
    setDraftError(null);
    setSendError(null);
    setSendSuccess(null);

    try {
      const result = await generateInvoiceAiFollowUpDraft(invoiceId);

      if (!result.draft) {
        setDraftError(
          result.error || "ContractFlow AI could not prepare a payment follow-up draft.",
        );

        setDraftGenerated(false);
        setSubject("");
        setMessage("");

        return;
      }

      setSubject(result.draft.subject);
      setMessage(result.draft.message);
      setDraftGenerated(true);
    } finally {
      setDraftLoading(false);
    }
  }

  function sendFollowUp() {
    if (sending || !subject.trim() || !message.trim()) {
      return;
    }

    setSendError(null);
    setSendSuccess(null);

    startSendTransition(async () => {
      const result = await sendReviewedInvoiceFollowUpAction(invoiceId, subject, message);

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
              <CardTitle>ContractFlow AI Invoice Intelligence</CardTitle>

              <Badge variant="secondary">AI powered</Badge>
            </div>

            <CardDescription className="mt-1">
              Analyze payment status, due dates, reminder history and customer context,
              then prepare reviewed payment follow-up wording when appropriate.
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

      <CardContent className="space-y-6">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
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

        {canFollowUp ? (
          <div className="space-y-4 rounded-xl border p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />

                  <p className="font-medium">AI-assisted payment follow-up</p>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Generate customer-ready wording, review or edit it, then send only when
                  you explicitly approve it.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={draftLoading || sending}
                onClick={() => void generateFollowUpDraft()}
              >
                {draftLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}

                {draftLoading
                  ? "Generating..."
                  : draftGenerated
                    ? "Regenerate AI Draft"
                    : "Generate AI Draft"}
              </Button>
            </div>

            {draftError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {draftError}
              </div>
            ) : null}

            {draftGenerated ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="invoice-follow-up-subject"
                      className="text-sm font-medium"
                    >
                      Subject
                    </label>

                    <span className="text-xs text-muted-foreground">
                      {subject.length}/200
                    </span>
                  </div>

                  <input
                    id="invoice-follow-up-subject"
                    value={subject}
                    maxLength={200}
                    disabled={sending}
                    onChange={(event) => setSubject(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="invoice-follow-up-message"
                      className="text-sm font-medium"
                    >
                      Message
                    </label>

                    <span className="text-xs text-muted-foreground">
                      {message.length}/5000
                    </span>
                  </div>

                  <textarea
                    id="invoice-follow-up-message"
                    value={message}
                    maxLength={5000}
                    rows={7}
                    disabled={sending}
                    onChange={(event) => setMessage(event.target.value)}
                    className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  ContractFlow adds the secure invoice link and PDF automatically. Sending
                  this manual follow-up does not mark an automatic reminder stage as sent.
                </div>

                {sendError ? (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {sendError}
                  </div>
                ) : null}

                {sendSuccess ? (
                  <div
                    role="status"
                    className="rounded-md border bg-muted/30 px-4 py-3 text-sm"
                  >
                    {sendSuccess}
                  </div>
                ) : null}

                <Button
                  type="button"
                  disabled={sending || !subject.trim() || !message.trim()}
                  onClick={sendFollowUp}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}

                  {sending ? "Sending..." : "Send Payment Follow-up"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {status === "PAID" ? (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            This invoice is paid in full, so payment follow-up drafting is disabled.
          </div>
        ) : null}

        {status === "VOIDED" ? (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            This invoice is voided, so payment follow-up drafting is disabled.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
