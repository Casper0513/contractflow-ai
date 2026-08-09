import Link from "next/link";

import { CustomerSearch } from "@/components/customers/customer-search";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomers } from "@/lib/customers-api";

import { CustomerForm } from "./customer-form";

type CustomersPageProps = {
  searchParams: Promise<{
    archived?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { archived } = await searchParams;

  const includeArchived = archived === "true";

  const customers = await getCustomers(includeArchived);

  const activeCount = customers.filter((customer) => !customer.archivedAt).length;

  const archivedCount = customers.filter((customer) =>
    Boolean(customer.archivedAt),
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>

        <p className="mt-1 text-muted-foreground">
          Manage customer relationships and contact information.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add customer</CardTitle>

            <CardDescription>Create a new customer record.</CardDescription>
          </CardHeader>

          <CardContent>
            <CustomerForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <CardTitle>Customer directory</CardTitle>

                <CardDescription className="mt-1">
                  Search and manage your customer records.
                </CardDescription>
              </div>

              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={includeArchived ? "/customers" : "/customers?archived=true"}
                  >
                    {includeArchived ? "Hide archived" : "Show archived"}
                  </Link>
                }
              />
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>{activeCount} active</span>

              {includeArchived && <span>{archivedCount} archived</span>}

              <span>
                {includeArchived
                  ? "Showing active and archived customers."
                  : "Showing active customers only."}
              </span>
            </div>

            <CustomerSearch customers={customers} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
