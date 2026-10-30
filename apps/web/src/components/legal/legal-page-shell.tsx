import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { LEGAL } from "@/lib/legal";

type LegalPageShellProps = {
  title: string;
  effectiveDate: string;
  description: string;
  children: React.ReactNode;
};

export function LegalPageShell({
  title,
  effectiveDate,
  description,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
              <Zap className="h-5 w-5" />
            </div>

            <div>
              <p className="font-bold leading-none">ContractFlow</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                AI
              </p>
            </div>
          </Link>

          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ContractFlow AI
        </Link>

        <div className="mt-8 border-b border-border pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
            {LEGAL.legalName}
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            {description}
          </p>

          <p className="mt-4 text-sm text-muted-foreground">Effective: {effectiveDate}</p>
        </div>

        <article className="mt-10 space-y-10 text-[15px] leading-7">{children}</article>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="font-medium text-foreground">{LEGAL.productName}</p>
            <p>
              Operated by {LEGAL.legalName}, {LEGAL.jurisdiction}.
            </p>
          </div>

          <nav className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>

            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>

            <a href={`mailto:${LEGAL.supportEmail}`} className="hover:text-foreground">
              Support
            </a>

            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>

      <div className="mt-4 space-y-4 text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}
