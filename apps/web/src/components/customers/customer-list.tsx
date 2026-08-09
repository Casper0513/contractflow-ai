import { UserRound } from "lucide-react";

import type { Customer } from "@/lib/customers-api";

import { CustomerCard } from "./customer-card";

type CustomerListProps = {
  customers: Customer[];
  hasSearch: boolean;
};

export function CustomerList({ customers, hasSearch }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <UserRound className="mx-auto h-9 w-9 text-muted-foreground" />

          <p className="mt-3 font-medium">
            {hasSearch ? "No matching customers" : "No customers yet"}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {hasSearch
              ? "Try another name, company, email, or phone number."
              : "Add your first customer using the form."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {customers.map((customer) => (
        <CustomerCard key={customer.id} customer={customer} />
      ))}
    </div>
  );
}
