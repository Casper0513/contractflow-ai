import Link from "next/link";

import { LEGAL } from "@/lib/legal";

type SiteFooterProps = {
  apiOnline: boolean;
  databaseOnline: boolean;
};

export function SiteFooter({ apiOnline, databaseOnline }: SiteFooterProps) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <p className="font-semibold">{LEGAL.productName}</p>

            <p className="mt-1 text-sm text-muted-foreground">
              AI-powered operations for contractors.
            </p>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Operated by {LEGAL.legalName}, {LEGAL.jurisdiction}.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              © {new Date().getFullYear()} {LEGAL.legalName}. All rights reserved.
            </p>
          </div>

          <div className="flex flex-col gap-5 md:items-end">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <ServiceStatus label="API" online={apiOnline} />
              <ServiceStatus label="Database" online={databaseOnline} />
            </div>

            <nav
              aria-label="Legal and account links"
              className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground"
            >
              <Link href="/terms" className="transition hover:text-foreground">
                Terms
              </Link>

              <Link href="/privacy" className="transition hover:text-foreground">
                Privacy
              </Link>

              <a
                href={`mailto:${LEGAL.supportEmail}`}
                className="transition hover:text-foreground"
              >
                Support
              </a>

              <Link href="/sign-in" className="transition hover:text-foreground">
                Sign in
              </Link>

              <Link href="/sign-up" className="transition hover:text-foreground">
                Create account
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
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
