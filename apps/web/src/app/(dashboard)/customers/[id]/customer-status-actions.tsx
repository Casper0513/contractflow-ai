"use client";

import { useState } from "react";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { archiveCustomerAction, restoreCustomerAction } from "./actions";

type CustomerStatusActionsProps = {
  customerId: string;
  customerName: string;
  archived: boolean;
};

export function CustomerStatusActions({
  customerId,
  customerName,
  archived,
}: CustomerStatusActionsProps) {
  const [confirming, setConfirming] = useState(false);

  if (archived) {
    return (
      <form action={restoreCustomerAction.bind(null, customerId)}>
        <Button type="submit" variant="outline">
          <RotateCcw className="h-4 w-4" />
          Restore customer
        </Button>
      </form>
    );
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium">Archive {customerName}?</p>

        <p className="mt-1 text-sm text-muted-foreground">
          The customer will disappear from the active directory, but all historical
          information will remain available.
        </p>

        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>

          <form action={archiveCustomerAction.bind(null, customerId)}>
            <Button type="submit" variant="destructive">
              <Archive className="h-4 w-4" />
              Archive customer
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
      <Archive className="h-4 w-4" />
      Archive
    </Button>
  );
}
