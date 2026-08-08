import { Mail, Phone, UserRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomers } from "@/lib/customers-api";

import { CustomerForm } from "./customer-form";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>

        <p className="mt-1 text-muted-foreground">Manage your customer relationships.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
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
            <CardTitle>Customer list</CardTitle>

            <CardDescription>
              {customers.length} customer
              {customers.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {customers.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
                <div className="text-center">
                  <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />

                  <p className="mt-3 font-medium">No customers yet</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first customer using the form.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {customers.map((customer) => {
                  const name = [customer.firstName, customer.lastName]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div key={customer.id} className="p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row">
                        <div>
                          <p className="font-semibold">{name}</p>

                          {customer.companyName && (
                            <p className="text-sm text-muted-foreground">
                              {customer.companyName}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          {customer.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {customer.email}
                            </div>
                          )}

                          {customer.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
