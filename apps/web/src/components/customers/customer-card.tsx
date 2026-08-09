import Link from "next/link";
import { Building2, ChevronRight, Mail, Phone, UserRound } from "lucide-react";

import type { Customer } from "@/lib/customers-api";

type CustomerCardProps = {
  customer: Customer;
};

export function CustomerCard({ customer }: CustomerCardProps) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  const archived = Boolean(customer.archivedAt);

  return (
    <Link
      href={`/customers/${customer.id}`}
      className={`group block rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm ${
        archived ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{name}</p>

              {archived && (
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Archived
                </span>
              )}
            </div>

            {customer.companyName && (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />

                <span className="truncate">{customer.companyName}</span>
              </div>
            )}
          </div>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>

      <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {customer.email && (
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" />

            <span className="truncate">{customer.email}</span>
          </div>
        )}

        {customer.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" />

            <span>{customer.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-5 border-t pt-3 text-xs text-muted-foreground">
        {archived && customer.archivedAt ? (
          <>Archived {new Date(customer.archivedAt).toLocaleDateString()}</>
        ) : (
          <>Created {new Date(customer.createdAt).toLocaleDateString()}</>
        )}
      </div>
    </Link>
  );
}
