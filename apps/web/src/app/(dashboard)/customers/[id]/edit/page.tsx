import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomer } from "@/lib/customers-api";

import { EditCustomerForm } from "./edit-customer-form";

type EditCustomerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomer(id);

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href={`/customers/${customer.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to customer
          </Link>
        }
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit customer</h1>

        <p className="mt-1 text-muted-foreground">Update the information for {name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer information</CardTitle>

          <CardDescription>
            Changes will be applied to this customer record immediately after saving.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <EditCustomerForm customer={customer} />
        </CardContent>
      </Card>
    </div>
  );
}
