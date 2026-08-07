import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getCurrentUser } from "@/lib/authenticated-api";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const user = await getCurrentUser();

  if (user.memberships.length === 0) {
  redirect("/onboarding");
  }

  const displayName =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ") || user.email;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
          Dashboard
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Welcome, {displayName}
        </h1>

        <p className="mt-2 text-slate-400">
          Your authenticated ContractFlow workspace is ready.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        <DashboardCard
          title="Account"
          value="Active"
        />

        <DashboardCard
          title="Organizations"
          value={String(user.memberships.length)}
        />

        <DashboardCard
          title="Role"
          value={
            user.memberships[0]?.role ??
            "No workspace"
          }
        />
      </section>

      {user.memberships.length === 0 && (
        <section className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
          <h2 className="text-xl font-semibold">
            Create your company workspace
          </h2>

          <p className="mt-2 text-slate-300">
            Your account is authenticated. The next step is creating your contractor company.
          </p>
        </section>
      )}
    </main>
  );
}

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold">
        {value}
      </p>
    </article>
  );
}