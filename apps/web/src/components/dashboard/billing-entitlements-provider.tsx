"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import type { BillingEntitlement } from "@/lib/billing-api";

type BillingEntitlementsContextValue = {
  entitlements: readonly BillingEntitlement[];
  hasEntitlement: (entitlement: BillingEntitlement) => boolean;
};

const BillingEntitlementsContext = createContext<BillingEntitlementsContextValue | null>(
  null,
);

type BillingEntitlementsProviderProps = {
  entitlements: BillingEntitlement[];
  children: ReactNode;
};

export function BillingEntitlementsProvider({
  entitlements,
  children,
}: BillingEntitlementsProviderProps) {
  const value = useMemo<BillingEntitlementsContextValue>(() => {
    const entitlementSet = new Set<BillingEntitlement>(entitlements);

    return {
      entitlements,
      hasEntitlement: (entitlement) => entitlementSet.has(entitlement),
    };
  }, [entitlements]);

  return (
    <BillingEntitlementsContext.Provider value={value}>
      {children}
    </BillingEntitlementsContext.Provider>
  );
}

export function useBillingEntitlements(): BillingEntitlementsContextValue {
  const context = useContext(BillingEntitlementsContext);

  if (!context) {
    throw new Error(
      "useBillingEntitlements must be used within BillingEntitlementsProvider",
    );
  }

  return context;
}

export function useBillingEntitlement(entitlement: BillingEntitlement): boolean {
  return useBillingEntitlements().hasEntitlement(entitlement);
}
