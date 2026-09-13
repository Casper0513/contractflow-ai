import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  ReceiptText,
  Sparkles,
  UsersRound,
  WandSparkles,
  Zap,
} from "lucide-react";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { getApiHealth } from "@/lib/api";

const features = [
  {
    icon: BriefcaseBusiness,
    title: "Jobs under control",
    description:
      "Track every job from lead to completion with customers, schedules, tasks, notes, materials, photos, documents, and costs in one place.",
  },
  {
    icon: FileText,
    title: "Professional estimates",
    description:
      "Build organized estimates, keep customer details connected, and move approved work directly into your operations workflow.",
  },
  {
    icon: ReceiptText,
    title: "Invoices that stay connected",
    description:
      "Create invoices from completed work, track balances, record payments, and keep financial activity tied to the correct customer and job.",
  },
  {
    icon: CalendarDays,
    title: "Scheduling without the chaos",
    description:
      "See upcoming work, site visits, inspections, deliveries, meetings, and crew activity without relying on scattered notes and calendars.",
  },
  {
    icon: ClipboardCheck,
    title: "Built-in accountability",
    description:
      "Use tasks and checklists to keep important work from being skipped before a job moves forward.",
  },
  {
    icon: Bot,
    title: "AI where it actually helps",
    description:
      "Use AI-assisted workflows to reduce repetitive office work instead of adding another complicated tool to your business.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Capture the customer",
    description:
      "Keep customer information, communication history, follow-ups, and job activity together.",
  },
  {
    number: "02",
    title: "Estimate and win the work",
    description:
      "Create estimates and move approved opportunities into an organized job workflow.",
  },
  {
    number: "03",
    title: "Run the job",
    description:
      "Coordinate schedules, tasks, checklists, materials, documents, photos, costs, and crew activity.",
  },
  {
    number: "04",
    title: "Invoice and get paid",
    description:
      "Turn completed work into invoices, record payments, and keep outstanding balances visible.",
  },
];

const contractorTypes = [
  "General contractors",
  "Plumbing companies",
  "Electrical contractors",
  "HVAC businesses",
  "Renovation companies",
  "Landscaping teams",
  "Service contractors",
  "Growing field-service businesses",
];

export default async function HomePage() {
  let apiOnline = false;
  let databaseOnline = false;

  try {
    const health = await getApiHealth();

    apiOnline = health.status === "ok";
    databaseOnline = health.database === "connected";
  } catch {
    apiOnline = false;
    databaseOnline = false;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-sm">
              <Zap className="h-5 w-5" />
            </div>

            <div>
              <p className="font-bold leading-none">ContractFlow</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                AI
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>

            <a href="#workflow" className="transition hover:text-foreground">
              How it works
            </a>

            <a href="#built-for" className="transition hover:text-foreground">
              Built for
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Link
              href="/sign-in"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-muted sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Start now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_36%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_28%)]" />

        <div className="mx-auto grid max-w-7xl gap-14 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:pb-32 lg:pt-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
              <Sparkles className="h-4 w-4" />
              Built for contractors who are ready to run tighter operations
            </div>

            <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Run your contracting business from{" "}
              <span className="text-amber-500">one powerful workflow.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              ContractFlow AI brings customers, estimates, jobs, schedules, tasks,
              invoices, payments, follow-ups, and AI-assisted operations into one system
              built around how contractors actually work.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-300"
              >
                Create your workspace
                <ArrowRight className="h-5 w-5" />
              </Link>

              <a
                href="#workflow"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-6 py-3 font-semibold transition hover:bg-muted"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <TrustPoint text="No scattered spreadsheets" />
              <TrustPoint text="Built around job flow" />
              <TrustPoint text="Secure Stripe billing" />
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-8 rounded-full bg-amber-400/10 blur-3xl" />

            <div className="relative w-full rounded-[2rem] border border-border bg-card p-4 shadow-2xl sm:p-6">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-sm font-semibold">Operations overview</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Everything requiring attention, in one place.
                  </p>
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Live workspace
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewMetric icon={BriefcaseBusiness} label="Active jobs" value="24" />

                <PreviewMetric icon={ReceiptText} label="Ready to invoice" value="6" />

                <PreviewMetric
                  icon={CircleDollarSign}
                  label="Outstanding"
                  value="$18,420"
                />

                <PreviewMetric icon={ClipboardCheck} label="Attention items" value="4" />
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Today&apos;s workflow</p>
                    <p className="text-xs text-muted-foreground">
                      Work moving through the business
                    </p>
                  </div>

                  <WandSparkles className="h-5 w-5 text-amber-500" />
                </div>

                <div className="space-y-3">
                  <PreviewRow
                    title="Kitchen renovation"
                    detail="Crew scheduled · 8:00 AM"
                    badge="In progress"
                  />

                  <PreviewRow
                    title="Commercial plumbing estimate"
                    detail="Customer follow-up due"
                    badge="Estimate"
                  />

                  <PreviewRow
                    title="Basement development"
                    detail="Checklist ready for review"
                    badge="Ready"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-muted-foreground">
            Replace disconnected tools with one operational command center for your
            contracting business.
          </p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="One system"
          title="The office side of contracting should not be harder than the job itself."
          description="ContractFlow AI gives your team a connected operating system instead of forcing customers, jobs, paperwork, schedules, and payments into separate tools."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="group rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-xl"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                  <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>

                <h3 className="text-lg font-semibold">{feature.title}</h3>

                <p className="mt-3 leading-7 text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="bg-muted/25">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="From first call to final payment"
            title="A workflow that follows the way your business actually operates."
            description="Every stage stays connected, so important information does not disappear when the work moves from sales to the field to billing."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-4">
            {workflow.map((step) => (
              <article
                key={step.number}
                className="relative rounded-2xl border border-border bg-background p-6"
              >
                <p className="text-4xl font-black text-amber-500/30">{step.number}</p>

                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="built-for"
        className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Built for real operators
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Built for contractors who want the business to run as professionally as the
            work they deliver.
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Whether you are organizing your first crew or trying to bring order to a
            growing operation, ContractFlow AI gives you a central place to manage the
            work behind the work.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {contractorTypes.map((type) => (
              <div
                key={type}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-sm font-medium">{type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-10">
          <UsersRound className="h-10 w-10 text-amber-500" />

          <h3 className="mt-6 text-2xl font-bold">
            Know what needs attention before it becomes a problem.
          </h3>

          <div className="mt-7 space-y-5">
            <Benefit text="See overdue tasks, follow-ups, and invoices." />
            <Benefit text="Know which completed jobs are ready to invoice." />
            <Benefit text="Keep customer communication connected to the work." />
            <Benefit text="Keep schedules, documents, photos, and job details together." />
            <Benefit text="Control feature access through your subscription plan." />
            <Benefit text="Give your team one source of truth instead of five different systems." />
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-amber-500/20 bg-slate-950 px-6 py-14 text-white shadow-2xl sm:px-10 lg:px-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2 text-amber-400">
                <BadgeCheck className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                  Ready when you are
                </span>
              </div>

              <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
                Stop running your business out of disconnected apps.
              </h2>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Build your ContractFlow workspace and start bringing customers, jobs,
                scheduling, paperwork, billing, and operations together.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/sign-up"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Create your account
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/sign-in"
                className="text-center text-sm text-slate-300 transition hover:text-white"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="font-semibold">ContractFlow AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-powered operations for contractors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <ServiceStatus label="API" online={apiOnline} />
            <ServiceStatus label="Database" online={databaseOnline} />

            <span className="hidden h-4 w-px bg-border sm:block" />

            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>

            <Link href="/sign-up" className="hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function TrustPoint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
      <span>{text}</span>
    </div>
  );
}

function PreviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-2xl font-bold">{value}</span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function PreviewRow({
  title,
  detail,
  badge,
}: {
  title: string;
  detail: string;
  badge: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>

      <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
        {badge}
      </span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>

      <p className="mt-5 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      </div>

      <p className="leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function ServiceStatus({ label, online }: { label: string; online: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`}
      />
      {label} {online ? "Online" : "Offline"}
    </span>
  );
}
