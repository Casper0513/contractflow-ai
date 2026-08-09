"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/customers-api";

import { CustomerList } from "./customer-list";

type CustomerSearchProps = {
  customers: Customer[];
};

export function CustomerSearch({ customers }: CustomerSearchProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) => {
      const searchableValues = [
        customer.firstName,
        customer.lastName,
        customer.companyName,
        customer.email,
        customer.phone,
      ];

      return searchableValues.some((value) =>
        value?.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [customers, normalizedQuery]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, company, email, or phone..."
          className="h-11 pl-9 pr-11"
          aria-label="Search customers"
        />

        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
            aria-label="Clear customer search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredCustomers.length} customer
          {filteredCustomers.length === 1 ? "" : "s"}
        </span>

        {normalizedQuery && <span>Filtering {customers.length} total</span>}
      </div>

      <CustomerList customers={filteredCustomers} hasSearch={Boolean(normalizedQuery)} />
    </div>
  );
}
