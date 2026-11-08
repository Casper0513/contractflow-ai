import type { Metadata } from "next";

import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Subprocessor List | ${LEGAL.productName}`,
  description: `Third-party service providers used by ${LEGAL.productName}.`,
};

export default function SubprocessorsPage() {
  return (
    <LegalPageShell
      title="Subprocessor List"
      effectiveDate={LEGAL.subprocessorsUpdatedDate}
      description={`Third-party providers used by ${LEGAL.productName} to deliver authentication, hosting, storage, email, payments, AI functionality, and monitoring.`}
    >
      <LegalSection title="1. Clerk">
        <p>
          <strong className="text-foreground">Purpose:</strong> Authentication, account
          management, identity services, sessions, organization access, and team
          invitations.
        </p>

        <p>
          <strong className="text-foreground">Processing location:</strong> United States.
        </p>
      </LegalSection>

      <LegalSection title="2. Railway">
        <p>
          <strong className="text-foreground">Purpose:</strong> ContractFlow application,
          API, web, PostgreSQL database, networking, logging, and related production
          infrastructure.
        </p>

        <p>
          <strong className="text-foreground">ContractFlow production region:</strong>{" "}
          United States - California.
        </p>
      </LegalSection>

      <LegalSection title="3. Cloudflare R2">
        <p>
          <strong className="text-foreground">Purpose:</strong> Private storage of job
          photographs, documents, and other uploaded business files.
        </p>

        <p>
          <strong className="text-foreground">Configured location:</strong> Western North
          America (WNAM).
        </p>

        <p>
          ContractFlow&apos;s current R2 bucket uses Cloudflare&apos;s default
          jurisdiction. The WNAM placement is not represented as a country-specific data
          residency guarantee.
        </p>
      </LegalSection>

      <LegalSection title="4. Resend">
        <p>
          <strong className="text-foreground">Purpose:</strong> Transactional and
          service-related email delivery, including estimates, invoices, reminders,
          receipts, invitations, and service communications.
        </p>

        <p>
          <strong className="text-foreground">Processing location:</strong> United States.
        </p>
      </LegalSection>

      <LegalSection title="5. Stripe">
        <p>
          <strong className="text-foreground">Purpose:</strong> Payment processing,
          subscription checkout, transaction processing, fraud prevention, reconciliation,
          receipts, and related payment functionality.
        </p>

        <p>
          <strong className="text-foreground">Processing locations:</strong> Canada and
          United States, plus other jurisdictions used by applicable Stripe subprocessors,
          support services, or payment methods.
        </p>
      </LegalSection>

      <LegalSection title="6. OpenAI">
        <p>
          <strong className="text-foreground">Purpose:</strong> AI-powered summaries,
          recommendations, workflow assistance, scheduling and task suggestions,
          operational analysis, and other optional AI-assisted functionality.
        </p>

        <p>
          <strong className="text-foreground">Processing locations:</strong> Multiple
          international jurisdictions, including Canada and the United States, depending
          on infrastructure and subprocessors.
        </p>
      </LegalSection>

      <LegalSection title="7. Sentry">
        <p>
          <strong className="text-foreground">Purpose:</strong> Error monitoring,
          diagnostics, application reliability, operational monitoring, and security
          troubleshooting.
        </p>

        <p>
          <strong className="text-foreground">ContractFlow data storage region:</strong>{" "}
          United States.
        </p>
      </LegalSection>

      <LegalSection title="8. Cross-border processing">
        <p>
          Some ContractFlow subprocessors process personal information outside Canada.
          Personal information processed outside Canada may be subject to the laws and
          lawful-access requirements of the jurisdiction in which it is processed.
        </p>

        <p>
          Questions about ContractFlow&apos;s use of service providers outside Canada may
          be directed to our Privacy Officer.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to subprocessors">
        <p>
          ContractFlow may add, replace, or remove subprocessors as its products,
          infrastructure, and technology evolve.
        </p>

        <p>
          This page will be updated when material changes to ContractFlow&apos;s
          subprocessors occur.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <div className="rounded-xl border border-border bg-card p-5 text-foreground">
          <p className="font-semibold">{LEGAL.privacyOfficer}</p>
          <p>{LEGAL.legalName}</p>
          <p>Corporation No. {LEGAL.corporationNumber}</p>
          <p>{LEGAL.businessAddress}</p>

          <a
            href={`mailto:${LEGAL.privacyEmail}`}
            className="underline underline-offset-4"
          >
            {LEGAL.privacyEmail}
          </a>
        </div>
      </LegalSection>
    </LegalPageShell>
  );
}
