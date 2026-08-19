"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type EstimateDecisionButtonsProps = {
  token: string;
};

type Decision = "approve" | "decline";

export function EstimateDecisionButtons({ token }: EstimateDecisionButtonsProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);

  const [error, setError] = useState<string | null>(null);

  function submitDecision(decision: Decision) {
    setError(null);
    setPendingDecision(decision);

    startTransition(async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        setError("Estimate actions are currently unavailable.");

        setPendingDecision(null);

        return;
      }

      try {
        const response = await fetch(
          `${apiUrl}/public/estimates/${encodeURIComponent(token)}/${decision}`,
          {
            method: "PATCH",

            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          const body = await response.text();

          let message = `Unable to ${decision} this estimate. Please try again.`;

          try {
            const parsed = JSON.parse(body) as {
              message?: unknown;
            };

            if (typeof parsed.message === "string") {
              message = parsed.message;
            }
          } catch {
            // Response was not JSON.
          }

          setError(message);
          setPendingDecision(null);

          return;
        }

        router.refresh();
      } catch (error) {
        console.error(`Unable to ${decision} estimate`, error);

        setError(`Unable to ${decision} this estimate. Please try again.`);

        setPendingDecision(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submitDecision("approve")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />

          {isPending && pendingDecision === "approve"
            ? "Approving..."
            : "Approve Estimate"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => submitDecision("decline")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />

          {isPending && pendingDecision === "decline"
            ? "Declining..."
            : "Decline Estimate"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
