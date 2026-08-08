import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

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
    <main className="min-h-[calc(100vh-4rem)] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
            Company setup
          </p>

          <h1 className="mt-3 text-3xl font-bold">Create your company workspace</h1>

          <p className="mt-4 text-slate-400">
            This workspace will contain your customers, jobs, estimates, invoices, and
            team members.
          </p>

          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
