import { getApiHealth } from "@/lib/api";

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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
            ContractFlow AI
          </p>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            The AI operations platform for contractors
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Create estimates, organize customers, schedule jobs, collect
            payments, and automate routine office work.
          </p>
        </div>

        <section className="grid gap-5 sm:grid-cols-2">
          <StatusCard
            title="API"
            online={apiOnline}
            description="NestJS application server"
          />

          <StatusCard
            title="Database"
            online={databaseOnline}
            description="PostgreSQL connection"
          />
        </section>
      </div>
    </main>
  );
}

type StatusCardProps = {
  title: string;
  online: boolean;
  description: string;
};

function StatusCard({
  title,
  online,
  description,
}: StatusCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>

        <span
          className={
            online
              ? "rounded-full bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300"
              : "rounded-full bg-red-400/10 px-3 py-1 text-sm text-red-300"
          }
        >
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <p className="mt-3 text-slate-400">{description}</p>
    </article>
  );
}
