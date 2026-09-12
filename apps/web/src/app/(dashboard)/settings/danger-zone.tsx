"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { AlertTriangle, Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  deleteAccountAction,
  leaveOrganizationAction,
} from "./account-lifecycle-actions";

type DangerZoneProps = {
  isFinalOwner: boolean;
};

export function DangerZone({ isFinalOwner }: DangerZoneProps) {
  const { signOut } = useClerk();
  const router = useRouter();

  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<"leave" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  const lifecycleLocked = !hydrated || isFinalOwner;

  function handleLeaveOrganization() {
    if (isFinalOwner) {
      setMessage({
        success: false,
        text: "Transfer ownership to another team member before leaving this organization.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Leave this organization?\n\nYou will immediately lose access to this workspace. The organization's business data will remain intact.",
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setPendingAction("leave");

    startTransition(async () => {
      const result = await leaveOrganizationAction();

      if (!result.success) {
        setPendingAction(null);
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      router.push("/onboarding");
      router.refresh();
    });
  }

  function handleDeleteAccount() {
    if (isFinalOwner) {
      setMessage({
        success: false,
        text: "Transfer ownership to another team member before deleting your account.",
      });
      return;
    }

    if (deleteConfirmation !== "DELETE") {
      setMessage({
        success: false,
        text: 'Type "DELETE" exactly to confirm account deletion.',
      });
      return;
    }

    const confirmed = window.confirm(
      "Permanently delete your ContractFlow account?\n\nYour login and personal account will be removed. Organization business data will remain with the organization. This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setPendingAction("delete");

    startTransition(async () => {
      const result = await deleteAccountAction();

      if (!result.success) {
        setPendingAction(null);
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      await signOut({
        redirectUrl: "/",
      });
    });
  }

  return (
    <div className="space-y-6">
      {isFinalOwner ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

          <div>
            <p className="font-medium">Ownership transfer required</p>

            <p className="mt-1 text-muted-foreground">
              You are the final owner of this organization. Promote another team member to
              Owner before leaving the workspace or deleting your account.
            </p>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          className={
            message.success
              ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h3 className="font-medium">Leave organization</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Remove your membership from this workspace. Organization data, customers,
            jobs, estimates, invoices, and other business records will not be deleted.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={pending || lifecycleLocked}
          onClick={handleLeaveOrganization}
          className="shrink-0"
        >
          {pending && pendingAction === "leave" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LogOut />
          )}
          Leave organization
        </Button>
      </div>

      <div className="rounded-lg border border-destructive/40 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="font-medium text-destructive">Delete account</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete your ContractFlow login and personal account. This does
              not delete the organization or its business records.
            </p>

            <div className="mt-4 max-w-sm">
              <label
                htmlFor="delete-account-confirmation"
                className="text-sm font-medium"
              >
                Type DELETE to confirm
              </label>

              <Input
                id="delete-account-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                disabled={pending || lifecycleLocked}
                className="mt-2"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="destructive"
            disabled={pending || lifecycleLocked || deleteConfirmation !== "DELETE"}
            onClick={handleDeleteAccount}
            className="shrink-0"
          >
            {pending && pendingAction === "delete" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash2 />
            )}
            Delete account
          </Button>
        </div>
      </div>
    </div>
  );
}
