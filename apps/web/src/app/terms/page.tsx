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
          By creating an account, accessing, purchasing, or using {LEGAL.productName}, you
          agree to these Terms of Service.
        </p>

        <p>
          If you use {LEGAL.productName} on behalf of a company, corporation, partnership,
          sole proprietorship, or other organization, you represent that you have
          authority to bind that organization to these Terms.
        </p>

        <p>If you do not agree to these Terms, you must not use the service.</p>
      </LegalSection>

      <LegalSection title="2. Business use">
        <p>
          {LEGAL.productName} is designed primarily for contractors, field service
          businesses, trades, and other organizations using the service for business or
          commercial purposes.
        </p>

        <p>
          Nothing in these Terms excludes, restricts, or waives any right or remedy that
          cannot lawfully be excluded, restricted, or waived under applicable law.
        </p>
      </LegalSection>

      <LegalSection title="3. The service">
        <p>
          {LEGAL.productName} provides software tools intended to help contracting and
          service businesses manage operational activities such as customers, estimates,
          jobs, scheduling, checklists, documents, photos, invoices, payments, reminders,
          communications, team workflows, and related business records.
        </p>

        <p>
          Features may change as the service develops. We may add, modify, suspend,
          replace, or discontinue features where reasonably necessary to operate, secure,
          maintain, or improve the service.
        </p>
      </LegalSection>

      <LegalSection title="4. Accounts and authorized users">
        <LegalList>
          <li>
            You must provide accurate and reasonably current account and business
            information.
          </li>

          <li>
            You are responsible for maintaining the security of your account and
            credentials.
          </li>

          <li>
            You are responsible for activity performed by users you authorize to access
            your workspace.
          </li>

          <li>
            You must promptly notify us if you believe an account has been compromised or
            accessed without authorization.
          </li>

          <li>
            Organization owners and administrators are responsible for managing team
            access, roles, permissions, and removal of users who should no longer have
            access.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Subscription plans">
        <p>
          Certain features require a paid subscription. Available plans, billing
          intervals, included features, and the exact configured price are presented
          through the billing interface and Stripe Checkout before you complete a
          subscription purchase.
        </p>

        <p>
          Subscription availability, features, limits, and pricing may change. Changes to
          an existing subscription will be handled in accordance with applicable law and
          the billing terms presented when the change is made.
        </p>
      </LegalSection>

      <LegalSection title="6. Automatic renewal">
        <p>
          Unless otherwise expressly stated at checkout, paid subscriptions automatically
          renew for the billing interval you select, such as monthly or annually, until
          cancelled.
        </p>

        <p>
          By completing subscription checkout, you authorize the applicable subscription
          charges to be billed through Stripe according to the billing interval and
          pricing presented at checkout.
        </p>
      </LegalSection>

      <LegalSection title="7. Billing and payment processing">
        <p>
          Subscription payments are processed by Stripe. Payment-card information is
          collected through Stripe&apos;s payment infrastructure, and {LEGAL.productName}{" "}
          does not require you to enter your complete payment-card number directly into
          our application servers.
        </p>

        <p>
          The exact amount, currency, billing interval, and other payment information
          applicable to a subscription are presented before payment through the checkout
          process.
        </p>

        <p>
          Promotional codes, discounts, or special pricing may be subject to additional
          conditions disclosed when offered.
        </p>
      </LegalSection>

      <LegalSection title="8. Cancellation">
        <p>
          An organization owner or authorized administrator may manage an eligible
          subscription using the billing-management tools available through{" "}
          {LEGAL.productName}, which currently connect to Stripe&apos;s customer billing
          portal.
        </p>

        <p>
          The effective date of cancellation is the date shown in the billing portal or
          subscription status. Where a subscription is scheduled to cancel at the end of
          the current billing period, access ordinarily continues through that paid period
          unless otherwise stated.
        </p>

        <p>
          Cancellation prevents future renewal according to the cancellation timing shown
          in the billing system. Cancellation of a subscription does not automatically
          delete your ContractFlow account or workspace.
        </p>
      </LegalSection>

      <LegalSection title="9. Trials and refunds">
        <p>
          A free trial is not included unless one is expressly offered and identified
          during signup or checkout.
        </p>

        <p>
          Subscription charges are generally not retroactively reversed solely because a
          subscription is later cancelled.
        </p>

        <p>
          Refunds, credits, corrections, or reversals may be provided where required by
          applicable law, where expressly promised at the time of purchase, or where we
          determine that a billing correction is appropriate.
        </p>

        <p>
          Nothing in this section limits rights or remedies that cannot legally be
          excluded.
        </p>
      </LegalSection>

      <LegalSection title="10. Taxes">
        <p>
          Prices may be exclusive of applicable taxes unless otherwise indicated during
          checkout.
        </p>

        <p>
          {LEGAL.legalName} will display, collect, and remit applicable sales taxes only
          where required and where the relevant registration and collection obligations
          have been established.
        </p>

        <p>
          You are responsible for taxes associated with your purchase to the extent
          required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="11. Your business data and content">
        <p>
          As between you and {LEGAL.legalName}, you retain ownership of business data,
          customer information, documents, photos, text, records, and other content that
          you or your authorized users submit to the service.
        </p>

        <p>
          You grant {LEGAL.legalName} a limited right to host, store, process, transmit,
          reproduce, display, and otherwise use that content only as reasonably necessary
          to provide, secure, maintain, support, and improve the service in accordance
          with these Terms and our Privacy Policy.
        </p>

        <p>
          You are responsible for ensuring that you have the rights, permissions, notices,
          consents, and lawful authority required to upload, process, store, or
          communicate information through the service.
        </p>
      </LegalSection>

      <LegalSection title="12. Customer and third-party personal information">
        <p>
          ContractFlow users may enter information about their own customers, employees,
          contractors, suppliers, or other persons.
        </p>

        <p>
          When you do so, you are responsible for determining whether you are legally
          permitted to collect, use, disclose, retain, and communicate that information
          through {LEGAL.productName}.
        </p>

        <p>
          You must not use {LEGAL.productName} to collect or process personal information
          in a manner that violates applicable privacy law.
        </p>
      </LegalSection>

      <LegalSection title="13. Customer communications">
        <p>
          {LEGAL.productName} may allow you to send estimates, invoices, payment
          confirmations, reminders, invitations, follow-ups, and other communications.
        </p>

        <p>
          You are responsible for communications you initiate and for compliance with
          applicable consent, sender-identification, privacy, anti-spam,
          consumer-protection, and other legal requirements.
        </p>

        <p>
          You must not use the service to send unlawful spam, deceptive messages,
          harassment, threats, or communications that you are not legally permitted to
          send.
        </p>
      </LegalSection>

      <LegalSection title="14. Acceptable use">
        <p>You must not use {LEGAL.productName} to:</p>

        <LegalList>
          <li>
            violate applicable law, regulation, court order, or the rights of another
            person;
          </li>

          <li>
            upload, distribute, or execute malware, malicious code, or material intended
            to interfere with systems or data;
          </li>

          <li>
            gain or attempt to gain unauthorized access to accounts, systems, credentials,
            infrastructure, or information;
          </li>

          <li>
            circumvent security controls, subscription controls, permissions, access
            restrictions, or usage limits;
          </li>

          <li>
            probe, scan, test, or exploit the service for vulnerabilities except where
            expressly authorized by us in writing;
          </li>

          <li>
            impersonate another person or organization or provide materially false or
            deceptive business information;
          </li>

          <li>
            use the service for fraud, unlawful surveillance, unlawful discrimination, or
            other unlawful activity;
          </li>

          <li>send unlawful unsolicited electronic communications;</li>

          <li>
            interfere with, overload, disrupt, damage, or materially degrade the service
            or another user&apos;s use of it;
          </li>

          <li>
            use automated means to extract, scrape, or harvest service content or data
            except through functionality or interfaces we expressly provide for that
            purpose.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="15. AI-assisted features">
        <p>
          Some features may use artificial intelligence to help generate drafts,
          summaries, suggestions, analysis, or other content.
        </p>

        <p>
          AI output may be inaccurate, incomplete, outdated, misleading, or inappropriate
          for a particular situation. AI-generated content should be reviewed by a human
          before it is relied upon, sent to a customer, incorporated into a business
          decision, or otherwise acted upon.
        </p>

        <p>
          You remain responsible for decisions, communications, records, estimates,
          invoices, actions, and other outputs resulting from your use of AI-assisted
          functionality.
        </p>

        <p>
          AI-assisted functionality does not provide legal, accounting, tax, engineering,
          medical, safety, financial, or other regulated professional advice.
        </p>
      </LegalSection>

      <LegalSection title="16. Third-party services">
        <p>
          {LEGAL.productName} depends on third-party infrastructure and service providers
          for functions such as authentication, hosting, database infrastructure,
          payments, transactional email, file storage, monitoring, and optional AI
          functionality.
        </p>

        <p>
          Third-party services may experience outages, change their products, discontinue
          functionality, impose limits, or modify their own terms.
        </p>

        <p>
          Your use of certain integrated functionality may also be subject to the
          applicable third party&apos;s terms, policies, and technical requirements.
        </p>
      </LegalSection>

      <LegalSection title="17. Availability, maintenance, and service changes">
        <p>
          We work to operate {LEGAL.productName} reliably, but we do not guarantee
          uninterrupted, error-free, or continuous availability.
        </p>

        <p>
          Maintenance, software defects, security events, provider incidents, internet
          failures, infrastructure failures, or events outside our reasonable control may
          affect service availability.
        </p>

        <p>
          We may make changes reasonably necessary for security, reliability, legal
          compliance, provider compatibility, or continued operation of the service.
        </p>
      </LegalSection>

      <LegalSection title="18. Intellectual property">
        <p>
          Except for customer content and third-party materials, {LEGAL.productName}, its
          software, branding, interfaces, designs, documentation, and related intellectual
          property are owned by or licensed to {LEGAL.legalName}.
        </p>

        <p>
          These Terms do not transfer ownership of ContractFlow intellectual property to
          you.
        </p>
      </LegalSection>

      <LegalSection title="19. Feedback">
        <p>
          If you voluntarily provide suggestions, ideas, or feedback about the service,
          you permit us to use that feedback to operate, improve, or develop{" "}
          {LEGAL.productName} without an obligation to compensate you, provided that this
          does not transfer ownership of your underlying business data or customer
          content.
        </p>
      </LegalSection>

      <LegalSection title="20. Suspension">
        <p>
          We may suspend, restrict, or limit access where reasonably necessary to address:
        </p>

        <LegalList>
          <li>security threats or suspected unauthorized access;</li>
          <li>fraud or unlawful activity;</li>
          <li>material breaches of these Terms;</li>
          <li>non-payment or subscription failure;</li>
          <li>abuse of the service or other users;</li>
          <li>risk to systems, infrastructure, or data;</li>
          <li>legal or regulatory requirements.</li>
        </LegalList>

        <p>
          Where reasonably appropriate, we may provide notice or an opportunity to resolve
          the issue before suspension.
        </p>
      </LegalSection>

      <LegalSection title="21. Account termination and data">
        <p>
          You may stop using the service at any time. Subscription cancellation, removal
          of users, and deletion of an account or workspace are separate actions.
        </p>

        <p>
          Termination or account deletion may result in loss of access to workspace
          information.
        </p>

        <p>
          Information may continue to be retained where reasonably necessary for security,
          dispute resolution, financial records, backups, legal obligations, or other
          purposes described in our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="22. Disclaimers">
        <p>
          To the maximum extent permitted by applicable law, {LEGAL.productName} is
          provided on an &quot;as is&quot; and &quot;as available&quot; basis.
        </p>

        <p>
          We do not warrant that the service will meet every business requirement, prevent
          every loss, remain continuously available, or produce error-free or complete
          results.
        </p>
      </LegalSection>

      <LegalSection title="23. Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, {LEGAL.legalName} will not be
          liable for indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for loss of profits, revenue, goodwill, business opportunities, or
          data arising from or relating to use of the service.
        </p>

        <p>
          To the extent a limitation of liability is permitted by law, our aggregate
          liability arising out of or relating to the service will not exceed the amounts
          paid by you to {LEGAL.legalName} for the service during the twelve months
          immediately preceding the event giving rise to the claim.
        </p>

        <p>
          Nothing in these Terms excludes or limits liability, rights, or remedies that
          cannot lawfully be excluded or limited.
        </p>
      </LegalSection>

      <LegalSection title="24. Governing law">
        <p>
          These Terms are governed by the laws of the Province of Alberta and the federal
          laws of Canada applicable in Alberta, without regard to conflict-of-law
          principles.
        </p>

        <p>
          Subject to mandatory rights or jurisdictional rules that apply, disputes
          relating to these Terms or the service will be brought before courts of
          competent jurisdiction in Alberta, Canada.
        </p>
      </LegalSection>

      <LegalSection title="25. Changes to these Terms">
        <p>
          We may update these Terms as our service, business practices, providers, pricing
          structure, or legal obligations change.
        </p>

        <p>
          When we make material changes, we will update the effective date and provide
          additional notice where reasonably appropriate or required by law.
        </p>

        <p>
          Continued use of {LEGAL.productName} after updated Terms become effective
          constitutes acceptance of those Terms, subject to applicable law.
        </p>
      </LegalSection>

      <LegalSection title="26. Contact">
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
