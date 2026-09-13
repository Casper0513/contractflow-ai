import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { getCurrentUser } from "@/lib/authenticated-api";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const authState = await auth();

  if (!authState.userId) {
    redirect("/");
  }

  const user = await getCurrentUser();

  if (user.memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center">
        <div className="w-full rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-xl sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Company setup
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Create your company workspace
            </h1>

            <p className="mt-4 max-w-xl text-muted-foreground">
              This workspace will contain your customers, jobs, estimates, invoices, and
              team members.
            </p>
          </div>

          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
