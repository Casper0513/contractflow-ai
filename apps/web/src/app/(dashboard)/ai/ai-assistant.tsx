"use client";

import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  askContractFlowAi,
  type AiContextSummary,
  type AiConversationHistoryMessage,
} from "./actions";

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: AiContextSummary;
};

const starterQuestions = [
  "What needs my attention right now?",
  "Which jobs should I focus on first?",
  "Do I have any overdue invoices?",
  "Give me a quick operations summary.",
];

export function AiAssistant() {
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuestion(question: string) {
    const cleanedQuestion = question.trim();

    if (!cleanedQuestion || loading) {
      return;
    }

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanedQuestion,
    };

    setConversation((current) => [...current, userMessage]);
    setMessage("");
    setError(null);
    setLoading(true);

    try {
      const history: AiConversationHistoryMessage[] = conversation
        .map((item) => ({
          role: item.role,
          content: item.content,
        }))
        .slice(-12);

      const result = await askContractFlowAi(cleanedQuestion, history);

      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        context: result.context,
      };

      setConversation((current) => [...current, assistantMessage]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ContractFlow AI could not answer that question.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion(message);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-h-[650px]">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>ContractFlow AI Assistant</CardTitle>
              <CardDescription className="mt-1">
                Ask questions about your current ContractFlow business data.
              </CardDescription>
            </div>

            <Badge variant="secondary">AI powered</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-[540px] flex-col">
          {conversation.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
              <div className="max-w-xl">
                <h2 className="text-xl font-semibold">What can I help you understand?</h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  ContractFlow AI can review the business context available to your
                  organization and help identify operational priorities.
                </p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {starterQuestions.map((question) => (
                    <Button
                      key={question}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
                      disabled={loading}
                      onClick={() => void submitQuestion(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto pb-6">
              {conversation.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[90%]"
                  }
                >
                  <div
                    className={
                      item.role === "user"
                        ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                        : "rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3 text-sm"
                    }
                  >
                    <p className="whitespace-pre-wrap leading-6">{item.content}</p>
                  </div>

                  {item.role === "assistant" && item.context ? (
                    <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                      Context reviewed: {item.context.activeCustomers} customers ·{" "}
                      {item.context.activeJobs} active jobs · {item.context.openEstimates}{" "}
                      open estimates · {item.context.overdueInvoices} overdue invoices
                    </p>
                  ) : null}
                </div>
              ))}

              {loading ? (
                <div className="mr-auto max-w-[90%]">
                  <div className="rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    ContractFlow AI is reviewing your business...
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="border-t pt-4">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={loading}
              maxLength={4000}
              rows={4}
              placeholder="Ask ContractFlow AI about your jobs, customers, estimates, invoices, or current priorities..."
              className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();

                  if (message.trim() && !loading) {
                    void submitQuestion(message);
                  }
                }
              }}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Enter to send · Shift+Enter for a new line
              </p>

              <Button type="submit" disabled={!message.trim() || loading}>
                {loading ? "Thinking..." : "Ask AI"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current AI context</CardTitle>
            <CardDescription>
              Phase 1 connects AI to a safe operational snapshot.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <ContextRow label="Customers" />
            <ContextRow label="Active jobs" />
            <ContextRow label="Open estimates" />
            <ContextRow label="Overdue invoices" />
            <ContextRow label="Recent job activity" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Built for ContractFlow</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>AI responses are scoped to your organization.</p>
            <p>
              ContractFlow AI does not claim an action was performed unless the
              application actually performs it.
            </p>
            <p>
              We will expand this context into estimates, invoices, schedules, notes,
              follow-ups, crew and job details as the AI layer develops.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContextRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <Badge variant="outline">Connected</Badge>
    </div>
  );
}
