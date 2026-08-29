import { AiAssistant } from "./ai-assistant";

export default function AiPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">ContractFlow AI</h1>

          <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">
            Beta
          </span>
        </div>

        <p className="mt-2 max-w-3xl text-muted-foreground">
          Your AI operations assistant for jobs, customers, estimates, invoices and
          business priorities.
        </p>
      </div>

      <AiAssistant />
    </div>
  );
}
