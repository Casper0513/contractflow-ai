import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Terms of Service | ${LEGAL.productName}`,
  description: `Terms governing use of ${LEGAL.productName}.`,
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      effectiveDate={LEGAL.termsEffectiveDate}
      description={`These Terms govern access to and use of ${LEGAL.productName}, a software service operated by ${LEGAL.legalName}.`}
    >
      <LegalSection title="1. Agreement to these Terms">
        <p>
          By creating an account, accessing, purchasing, or using ContractFlow AI, you
          agree to these Terms of Service. If you are using ContractFlow AI on behalf of a
          company or other organization, you represent that you have authority to bind
          that organization to these Terms.
        </p>

        <p>If you do not agree to these Terms, you must not use the service.</p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          ContractFlow AI provides software tools intended to help contracting and service
          businesses manage operational activities such as customers, estimates, jobs,
          scheduling, checklists, photos, documents, invoices, payments, reminders,
          communications, and related workflows.
        </p>

        <p>
          Features may change as the service develops. We may add, modify, suspend, or
          discontinue features where reasonably necessary to operate, secure, or improve
          the service.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and authorized users">
        <LegalList>
          <li>You must provide accurate account and business information.</li>

          <li>
            You are responsible for maintaining the security of your account and for
            activity performed by users you authorize.
          </li>

          <li>
            You must promptly notify us if you believe an account has been compromised or
            accessed without authorization.
          </li>

          <li>
            Organization owners and administrators are responsible for managing user
            access and permissions within their workspace.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Subscription plans and billing">
        <p>
          Certain ContractFlow AI features require a paid subscription. Subscription
          prices, billing periods, included features, and applicable charges are shown
          before purchase.
        </p>

        <p>
          Payments and subscription billing are processed through Stripe or another
          payment processor that we may designate. We do not require you to provide your
          full payment-card number directly to ContractFlow AI.
        </p>

        <p>
          Unless otherwise stated at checkout, subscriptions renew automatically for the
          selected billing period until cancelled.
        </p>

        <p>
          You may manage or cancel an active subscription through the available
          billing-management tools. Cancellation generally stops future renewal charges
          and does not retroactively reverse charges already incurred, except where
          required by law or expressly stated otherwise.
        </p>
      </LegalSection>

      <LegalSection title="5. Taxes">
        <p>
          Prices may be exclusive of applicable taxes unless otherwise indicated. You are
          responsible for taxes associated with your purchase where required by law.
        </p>

        <p>
          ContractFlow AI will display, collect, and remit sales taxes only where
          applicable and where the relevant registration and collection obligations have
          been established.
        </p>
      </LegalSection>

      <LegalSection title="6. Your business data and content">
        <p>
          You retain ownership of business data, customer information, documents, photos,
          text, and other content that you or your authorized users submit to ContractFlow
          AI.
        </p>

        <p>
          You grant {LEGAL.legalName} a limited right to host, process, transmit,
          reproduce, and otherwise use that content only as reasonably necessary to
          provide, secure, maintain, and support the service.
        </p>

        <p>
          You are responsible for ensuring that you have the rights and lawful authority
          required to upload, process, or communicate personal information and other
          content through the service.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>You must not use ContractFlow AI to:</p>

        <LegalList>
          <li>violate applicable law or the rights of another person;</li>

          <li>
            upload or distribute malware, malicious code, or material intended to
            interfere with the service;
          </li>

          <li>
            attempt to gain unauthorized access to accounts, systems, data, or
            infrastructure;
          </li>

          <li>
            circumvent security controls, access restrictions, subscription controls, or
            usage limits;
          </li>

          <li>
            use the service to send unlawful spam or other prohibited electronic
            communications;
          </li>

          <li>
            impersonate another person or organization or provide materially false
            business information;
          </li>

          <li>
            use the service in a manner that materially disrupts or degrades the service
            for others.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. Customer communications">
        <p>
          ContractFlow AI may allow you to send estimates, invoices, reminders, receipts,
          invitations, and other communications to customers or team members.
        </p>

        <p>
          You are responsible for ensuring that communications you initiate comply with
          applicable consent, identification, privacy, anti-spam, and other legal
          requirements.
        </p>
      </LegalSection>

      <LegalSection title="9. AI-assisted features">
        <p>
          Some features may use artificial intelligence to generate or assist with drafts,
          summaries, suggestions, or other content.
        </p>

        <p>
          AI-generated output may be incomplete, inaccurate, or inappropriate for a
          particular purpose. You are responsible for reviewing AI-generated content
          before relying on it or sending it to another person.
        </p>

        <p>
          ContractFlow AI does not provide legal, accounting, tax, engineering, safety, or
          other regulated professional advice through AI-generated output.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-party services">
        <p>
          ContractFlow AI relies on third-party infrastructure and service providers for
          functions such as authentication, hosting, payments, communications, file
          storage, monitoring, and optional AI functionality.
        </p>

        <p>
          Your use of certain integrated functionality may also be subject to the
          applicable third party&apos;s terms and policies.
        </p>
      </LegalSection>

      <LegalSection title="11. Availability and changes">
        <p>
          We work to operate ContractFlow AI reliably, but we do not guarantee that the
          service will be uninterrupted, error-free, or available at all times.
          Maintenance, provider outages, security events, internet failures, or other
          circumstances may temporarily affect availability.
        </p>
      </LegalSection>

      <LegalSection title="12. Intellectual property">
        <p>
          Except for customer content and third-party materials, ContractFlow AI, its
          software, branding, interfaces, designs, documentation, and related intellectual
          property are owned by or licensed to {LEGAL.legalName}.
        </p>

        <p>
          These Terms do not transfer ownership of ContractFlow AI intellectual property
          to you.
        </p>
      </LegalSection>

      <LegalSection title="13. Suspension and termination">
        <p>
          We may suspend or restrict access where reasonably necessary to address security
          risks, unlawful activity, material breaches of these Terms, non-payment, abuse
          of the service, or risks to other users or systems.
        </p>

        <p>
          You may stop using the service at any time. Subscription cancellation and
          account deletion are separate actions and may have different effects on billing
          and stored data.
        </p>
      </LegalSection>

      <LegalSection title="14. Disclaimers">
        <p>
          To the maximum extent permitted by applicable law, ContractFlow AI is provided
          on an &quot;as is&quot; and &quot;as available&quot; basis.
        </p>

        <p>
          We do not warrant that the service will meet every business requirement, prevent
          every loss, or produce error-free results.
        </p>
      </LegalSection>

      <LegalSection title="15. Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, {LEGAL.legalName} will not be
          liable for indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for loss of profits, revenue, goodwill, business opportunities, or
          data arising from use of the service.
        </p>

        <p>
          To the extent a limitation of liability is permitted by law, our aggregate
          liability arising out of or relating to the service will not exceed the amounts
          paid by you to {LEGAL.legalName} for the service during the twelve months
          immediately preceding the event giving rise to the claim.
        </p>

        <p>
          Nothing in these Terms excludes rights or remedies that cannot lawfully be
          excluded or limited.
        </p>
      </LegalSection>

      <LegalSection title="16. Governing law">
        <p>
          These Terms are governed by the laws of the Province of Alberta and the federal
          laws of Canada applicable in Alberta, without regard to conflict-of-law
          principles.
        </p>

        <p>
          Subject to any mandatory legal rights that apply, disputes relating to these
          Terms or the service will be brought before courts of competent jurisdiction in
          Alberta, Canada.
        </p>
      </LegalSection>

      <LegalSection title="17. Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we make material changes, we
          will update the effective date and provide notice where reasonably appropriate.
        </p>

        <p>
          Continued use of ContractFlow AI after updated Terms take effect constitutes
          acceptance of the updated Terms, subject to applicable law.
        </p>
      </LegalSection>

      <LegalSection title="18. Contact">
        <p>
          Questions about these Terms may be sent to{" "}
          <a
            href={`mailto:${LEGAL.legalEmail}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {LEGAL.legalEmail}
          </a>
          .
        </p>

        <p>
          {LEGAL.productName} is operated by {LEGAL.legalName}, {LEGAL.jurisdiction}.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
