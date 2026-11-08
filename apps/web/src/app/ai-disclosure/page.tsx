import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `AI Processing Disclosure | ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} uses artificial intelligence services.`,
};

export default function AiDisclosurePage() {
  return (
    <LegalPageShell
      title="AI Processing Disclosure"
      effectiveDate={LEGAL.aiDisclosureEffectiveDate}
      description={`How ${LEGAL.productName} uses artificial intelligence to provide optional business-assistance features.`}
    >
      <LegalSection title="1. AI provider">
        <p>
          ContractFlow currently uses services provided by OpenAI to power certain
          AI-assisted functionality through authenticated server-side application
          programming interfaces.
        </p>
      </LegalSection>

      <LegalSection title="2. When AI processing occurs">
        <p>
          AI processing occurs when a ContractFlow user invokes or uses an AI-assisted
          feature.
        </p>

        <p>
          Depending on the feature, ContractFlow may assemble information relevant to the
          requested business task and provide that information to OpenAI for processing.
        </p>
      </LegalSection>

      <LegalSection title="3. Information that may be processed">
        <p>
          Depending on the feature, AI processing may include information relating to:
        </p>

        <LegalList>
          <li>organizations and authorized users;</li>
          <li>customers and relevant contact information;</li>
          <li>customer notes and communications;</li>
          <li>jobs and job status;</li>
          <li>schedules, assignments, tasks, and checklists;</li>
          <li>materials, costs, and time entries;</li>
          <li>estimates and estimate status;</li>
          <li>invoices and payment status;</li>
          <li>follow-ups, reminders, and other operational business information.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Purposes of AI processing">
        <p>AI-assisted functionality may be used to:</p>

        <LegalList>
          <li>generate job or customer summaries;</li>
          <li>identify incomplete, overdue, or urgent work;</li>
          <li>review estimate or invoice information;</li>
          <li>identify unpaid or overdue balances;</li>
          <li>suggest customer follow-up actions;</li>
          <li>suggest tasks, scheduling, or dispatch actions;</li>
          <li>highlight workflow concerns;</li>
          <li>provide operational summaries and business-management recommendations.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Human review">
        <p>
          AI-generated output is assistance, not authoritative fact. AI systems may
          produce inaccurate, incomplete, outdated, misleading, or inappropriate
          information.
        </p>

        <p>
          Users remain responsible for reviewing AI-generated output before relying on it,
          communicating it to customers, modifying business records, or taking business
          action.
        </p>
      </LegalSection>

      <LegalSection title="6. Decisions affecting individuals">
        <p>
          ContractFlow does not intend its AI functionality to replace meaningful human
          judgment where a decision may materially affect an individual.
        </p>

        <p>
          Users should not rely exclusively on AI-generated recommendations for
          significant employment, credit, legal, safety, financial, or similar decisions
          concerning an identifiable person.
        </p>
      </LegalSection>

      <LegalSection title="7. Sensitive information">
        <p>
          Users should avoid submitting sensitive or confidential personal information to
          an AI feature unless the information is reasonably necessary, the organization
          has lawful authority to process it, and using the AI feature is appropriate for
          the intended business purpose.
        </p>
      </LegalSection>

      <LegalSection title="8. Data minimization">
        <p>
          ContractFlow intends to limit information provided to AI services to information
          reasonably relevant to the requested feature.
        </p>
      </LegalSection>

      <LegalSection title="9. International processing">
        <p>
          OpenAI processing may occur through infrastructure and subprocessors in multiple
          international jurisdictions, including Canada and the United States.
        </p>

        <p>
          Additional information about ContractFlow&apos;s external service providers is
          available on our{" "}
          <a
            href="/subprocessors"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Subprocessor List
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Provider retention and model use">
        <p>
          ContractFlow will not represent that customer information is excluded from
          provider model training, retained for a particular period, or handled in a
          specific manner unless that representation is supported by ContractFlow&apos;s
          applicable provider agreement, API terms, configuration, and data-processing
          arrangements.
        </p>
      </LegalSection>

      <LegalSection title="11. Professional advice">
        <p>
          AI-generated information does not constitute legal, accounting, tax, financial,
          engineering, occupational health or safety, medical, or other regulated
          professional advice.
        </p>
      </LegalSection>

      <LegalSection title="12. Security">
        <p>
          AI requests are made through authenticated server-side ContractFlow services.
          ContractFlow applies authorization controls designed to keep AI processing
          within the user&apos;s authorized organization and business context.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to AI providers">
        <p>
          ContractFlow may change AI models or providers as technology evolves. Material
          changes affecting personal-information processing will be reviewed and
          disclosures will be updated where appropriate.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact">
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
