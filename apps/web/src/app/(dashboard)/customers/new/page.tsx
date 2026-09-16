import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/customers">← Back to customers</Link>}
        />

        <div>
          <h1 className="text-3xl font-bold tracking-tight">New customer</h1>

          <p className="mt-1 text-muted-foreground">
            Create a customer record for estimates, jobs, invoices, and follow-up.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>

          <CardDescription>
            Add the customer&apos;s contact information and any notes you want to keep
            with their record.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <CustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
