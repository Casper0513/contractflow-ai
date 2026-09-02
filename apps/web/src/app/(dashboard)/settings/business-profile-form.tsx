"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Building2, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrencyDisplayName, SUPPORTED_CURRENCIES } from "@/lib/currencies";
import type { OrganizationProfile } from "@/lib/organizations-api";

import { updateBusinessProfileAction, type BusinessProfileActionState } from "./actions";

const initialState: BusinessProfileActionState = {
  success: false,
  message: null,
};

type BusinessProfileFormProps = {
  organization: OrganizationProfile;
  canEdit: boolean;
};

export function BusinessProfileForm({ organization, canEdit }: BusinessProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateBusinessProfileAction,
    initialState,
  );

  const [form, setForm] = useState(() => ({
    name: organization.name,
    legalName: organization.legalName ?? "",
    email: organization.email ?? "",
    phone: organization.phone ?? "",

    addressLine1: organization.addressLine1 ?? "",
    addressLine2: organization.addressLine2 ?? "",
    city: organization.city ?? "",
    province: organization.province ?? "",
    postalCode: organization.postalCode ?? "",
    country: organization.country,

    taxNumber: organization.taxNumber ?? "",

    website: organization.website ?? "",
    logoUrl: organization.logoUrl ?? "",

    timezone: organization.timezone,
    currency: organization.currency,
  }));

  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message) {
      messageRef.current?.focus();
    }
  }, [state]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <form action={formAction} className="space-y-8">
      {!canEdit && (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div>
            <p className="font-medium">Business profile is read-only</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Only organization owners and administrators can update these settings.
            </p>
          </div>
        </div>
      )}

      {state.message && (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.success ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm outline-none ${
            state.success
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.success && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}

            <span>{state.message}</span>
          </div>
        </div>
      )}

      <FormSection
        title="Business identity"
        description="The business information customers will see on invoices and estimates."
        icon={Building2}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Business name" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
              minLength={2}
              maxLength={100}
              disabled={!canEdit || pending}
            />
          </FormField>

          <FormField label="Legal business name" htmlFor="legalName">
            <Input
              id="legalName"
              name="legalName"
              value={form.legalName}
              onChange={(event) => updateField("legalName", event.target.value)}
              maxLength={150}
              disabled={!canEdit || pending}
              placeholder="Optional legal name"
            />
          </FormField>

          <FormField label="Business email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              maxLength={255}
              disabled={!canEdit || pending}
              placeholder="billing@example.com"
            />
          </FormField>

          <FormField label="Business phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              maxLength={40}
              disabled={!canEdit || pending}
              placeholder="780-555-0123"
            />
          </FormField>

          <FormField label="Website" htmlFor="website">
            <Input
              id="website"
              name="website"
              type="url"
              value={form.website}
              onChange={(event) => updateField("website", event.target.value)}
              maxLength={255}
              disabled={!canEdit || pending}
              placeholder="https://example.com"
            />
          </FormField>

          <FormField label="Tax / GST / HST number" htmlFor="taxNumber">
            <Input
              id="taxNumber"
              name="taxNumber"
              value={form.taxNumber}
              onChange={(event) => updateField("taxNumber", event.target.value)}
              maxLength={100}
              disabled={!canEdit || pending}
              placeholder="Optional"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Business address"
        description="Used as the sender address on customer-facing documents."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Address line 1"
            htmlFor="addressLine1"
            className="md:col-span-2"
          >
            <Input
              id="addressLine1"
              name="addressLine1"
              value={form.addressLine1}
              onChange={(event) => updateField("addressLine1", event.target.value)}
              maxLength={150}
              disabled={!canEdit || pending}
              placeholder="123 Main Street"
            />
          </FormField>

          <FormField
            label="Address line 2"
            htmlFor="addressLine2"
            className="md:col-span-2"
          >
            <Input
              id="addressLine2"
              name="addressLine2"
              value={form.addressLine2}
              onChange={(event) => updateField("addressLine2", event.target.value)}
              maxLength={150}
              disabled={!canEdit || pending}
              placeholder="Unit, suite, building, etc."
            />
          </FormField>

          <FormField label="City" htmlFor="city">
            <Input
              id="city"
              name="city"
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
              maxLength={100}
              disabled={!canEdit || pending}
            />
          </FormField>

          <FormField label="Province / state" htmlFor="province">
            <Input
              id="province"
              name="province"
              value={form.province}
              onChange={(event) => updateField("province", event.target.value)}
              maxLength={100}
              disabled={!canEdit || pending}
              placeholder="Alberta"
            />
          </FormField>

          <FormField label="Postal / ZIP code" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              value={form.postalCode}
              onChange={(event) => updateField("postalCode", event.target.value)}
              maxLength={20}
              disabled={!canEdit || pending}
            />
          </FormField>

          <FormField label="Country code" htmlFor="country">
            <Input
              id="country"
              name="country"
              value={form.country}
              onChange={(event) => updateField("country", event.target.value)}
              minLength={2}
              maxLength={2}
              disabled={!canEdit || pending}
              placeholder="CA"
            />

            <p className="mt-1 text-xs text-muted-foreground">
              Use the two-letter country code, such as CA or US.
            </p>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Documents & billing"
        description="Defaults used for invoices, estimates, and customer documents."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Currency" htmlFor="currency">
            <select
              id="currency"
              name="currency"
              value={form.currency}
              onChange={(event) => updateField("currency", event.target.value)}
              disabled={!canEdit || pending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency} — {getCurrencyDisplayName(currency)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Timezone" htmlFor="timezone">
            <Input
              id="timezone"
              name="timezone"
              value={form.timezone}
              onChange={(event) => updateField("timezone", event.target.value)}
              maxLength={100}
              disabled={!canEdit || pending}
              placeholder="America/Edmonton"
            />
          </FormField>

          <FormField label="Logo URL" htmlFor="logoUrl" className="md:col-span-2">
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              value={form.logoUrl}
              onChange={(event) => updateField("logoUrl", event.target.value)}
              maxLength={500}
              disabled={!canEdit || pending}
              placeholder="https://example.com/logo.png"
            />

            <p className="mt-1 text-xs text-muted-foreground">
              We can replace this with direct logo upload later.
            </p>
          </FormField>
        </div>
      </FormSection>

      {canEdit && (
        <div className="flex items-center justify-end border-t pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save business profile"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon?: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="rounded-lg border bg-muted/30 p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        <div>
          <h2 className="font-semibold">{title}</h2>

          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function FormField({
  label,
  htmlFor,
  required = false,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium">
        {label}

        {required && <span className="ml-1 text-destructive">*</span>}
      </label>

      {children}
    </div>
  );
}
