import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Privacy Policy | ${LEGAL.productName}`,
  description: `Privacy practices for ${LEGAL.productName}.`,
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      effectiveDate={LEGAL.privacyEffectiveDate}
      description={`${LEGAL.legalName} respects your privacy and uses personal information only for reasonable business purposes connected with operating ContractFlow AI.`}
    >
      <LegalSection title="1. Who we are">
        <p>
          ContractFlow AI is operated by {LEGAL.legalName}, an Alberta corporation based
          in Alberta, Canada.
        </p>

        <p>
          This Privacy Policy explains how we collect, use, disclose, protect, and retain
          personal information in connection with ContractFlow AI.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we may collect">
        <p>Depending on how you use ContractFlow AI, we may collect:</p>

        <LegalList>
          <li>
            account information such as name, email address, authentication identifiers,
            and account status;
          </li>

          <li>
            business-profile information such as business name, legal name, contact
            information, address, currency, timezone, and business preferences;
          </li>

          <li>customer and contact information entered by workspace users;</li>

          <li>
            job, estimate, invoice, payment, scheduling, checklist, follow-up, and
            operational records;
          </li>

          <li>
            documents, job photos, attachments, captions, and other files uploaded to the
            service;
          </li>

          <li>team membership, roles, invitations, and workspace permissions;</li>

          <li>
            payment and subscription information received from our payment processor, such
            as subscription status, price, transaction status, and payment references;
          </li>

          <li>
            technical and operational information such as request identifiers, timestamps,
            error information, security events, and service-health information;
          </li>

          <li>
            communications you send to us for support, privacy, legal, or other business
            purposes.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Information we do not require you to provide directly">
        <p>
          Payment-card information is collected and processed by Stripe. ContractFlow AI
          does not require users to enter their complete payment-card number directly into
          our application servers.
        </p>

        <p>
          You should not submit unnecessary sensitive personal information to ContractFlow
          AI.
        </p>
      </LegalSection>

      <LegalSection title="4. How we use personal information">
        <p>We may use personal information to:</p>

        <LegalList>
          <li>create, authenticate, and maintain user accounts;</li>

          <li>operate organization workspaces and role-based access;</li>

          <li>
            provide customer, job, estimate, invoice, scheduling, payment, document,
            photo, reminder, and related operational functionality;
          </li>

          <li>
            send service-related communications, estimates, invoices, receipts, reminders,
            invitations, and notifications initiated through the service;
          </li>

          <li>process subscriptions and maintain billing status;</li>

          <li>provide support and respond to user requests;</li>

          <li>protect accounts, users, systems, and data from misuse or abuse;</li>

          <li>diagnose errors and maintain service reliability;</li>

          <li>comply with legal, regulatory, tax, and accounting obligations;</li>

          <li>
            improve ContractFlow AI where doing so is reasonable and consistent with this
            Policy.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Legal basis and consent">
        <p>
          We collect, use, and disclose personal information only for purposes that are
          reasonable in the circumstances and as permitted by applicable privacy law.
        </p>

        <p>
          Where consent is required, consent may be express, implied, or otherwise
          permitted by law depending on the circumstances.
        </p>

        <p>
          You may withdraw consent where legally permitted, subject to reasonable notice
          and any legal or contractual restrictions. Withdrawal may affect our ability to
          provide certain features.
        </p>
      </LegalSection>

      <LegalSection title="6. Service providers and disclosures">
        <p>
          We use service providers to operate ContractFlow AI. Depending on the feature
          used, information may be processed by providers that include:
        </p>

        <LegalList>
          <li>Railway for application and database infrastructure;</li>

          <li>Clerk for authentication and identity services;</li>

          <li>Stripe for payment and subscription processing;</li>

          <li>Resend for transactional email delivery;</li>

          <li>Cloudflare R2 for object and file storage;</li>

          <li>Sentry for error and operational monitoring;</li>

          <li>
            OpenAI for optional AI-assisted functionality when such features are enabled
            and used.
          </li>
        </LegalList>

        <p>
          Service providers process information on our behalf for purposes connected with
          operating ContractFlow AI. We remain responsible for using service providers in
          a manner consistent with applicable privacy obligations and take reasonable
          steps to assess and manage provider-related privacy and security risks.
        </p>

        <p>
          We may also disclose information where required or permitted by law, to protect
          legal rights or security, to investigate fraud or abuse, or in connection with a
          corporate transaction such as a merger, financing, acquisition, or sale of
          assets.
        </p>

        <p>We do not sell personal information to advertisers.</p>
      </LegalSection>

      <LegalSection title="7. AI-assisted processing">
        <p>
          When optional AI-assisted functionality is enabled and used, information needed
          to perform the requested AI task may be transmitted to an AI service provider
          such as OpenAI.
        </p>

        <p>
          The information processed depends on the feature used and the content supplied
          to that feature. Users should avoid submitting information that is unnecessary
          for the requested AI task.
        </p>

        <p>
          AI-assisted functionality is not required for ordinary estimate, invoice,
          payment, customer, job, or document workflows unless a particular feature
          expressly indicates otherwise.
        </p>
      </LegalSection>

      <LegalSection title="8. Processing outside Canada">
        <p>
          Some of our service providers may process or store information outside Alberta
          or outside Canada.
        </p>

        <p>
          When information is processed in another jurisdiction, it may be subject to the
          laws and lawful-access requirements of that jurisdiction.
        </p>

        <p>
          Questions about our use of service providers outside Canada may be sent to our
          Privacy Contact using the information below.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use administrative, technical, and organizational safeguards that we consider
          reasonable for the nature of the information and the risks involved.
        </p>

        <p>
          These measures may include authentication controls, role-based access, encrypted
          network transport, restricted production access, monitoring, logging, backups,
          and provider security controls where applicable.
        </p>

        <p>
          No electronic system can be guaranteed to be completely secure, and we cannot
          guarantee that unauthorized access, loss, misuse, or disclosure will never
          occur.
        </p>
      </LegalSection>

      <LegalSection title="10. Retention">
        <p>
          We retain personal information only for as long as reasonably necessary for the
          purposes for which it was collected, to provide the service, resolve disputes,
          maintain legitimate business records, enforce agreements, and satisfy legal,
          tax, accounting, security, or regulatory requirements.
        </p>

        <p>
          Retention periods may vary depending on the type of information and the reason
          it is held.
        </p>
      </LegalSection>

      <LegalSection title="11. Access and correction">
        <p>
          Subject to applicable law, individuals may request access to personal
          information about themselves that is held by {LEGAL.legalName} and may request
          correction of inaccurate or incomplete personal information.
        </p>

        <p>
          Requests should be made in writing to{" "}
          <a
            href={`mailto:${LEGAL.privacyEmail}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {LEGAL.privacyEmail}
          </a>
          .
        </p>

        <p>
          We may need to verify identity before processing an access or correction
          request.
        </p>
      </LegalSection>

      <LegalSection title="12. Account and workspace data">
        <p>
          ContractFlow AI organization owners and administrators control access to
          business workspace information by authorized team members.
        </p>

        <p>
          If information about you was entered into ContractFlow AI by one of our business
          customers, that business may also be responsible for responding to requests
          concerning information it controls.
        </p>
      </LegalSection>

      <LegalSection title="13. Cookies and authentication technologies">
        <p>
          ContractFlow AI and its authentication providers may use cookies, local storage,
          session technologies, and similar mechanisms that are necessary for
          authentication, security, preferences, and operation of the service.
        </p>

        <p>
          We do not state that all such technologies are optional where they are necessary
          to provide secure account access.
        </p>
      </LegalSection>

      <LegalSection title="14. Electronic communications">
        <p>
          ContractFlow AI sends transactional and service-related communications connected
          with accounts, workspaces, estimates, invoices, payments, reminders,
          invitations, security, and support.
        </p>

        <p>
          If we send promotional commercial electronic messages, we will handle consent,
          sender identification, and unsubscribe requirements as required by applicable
          Canadian law.
        </p>
      </LegalSection>

      <LegalSection title="15. Privacy incidents">
        <p>
          If we become aware of a privacy or security incident involving personal
          information, we will investigate and take reasonable steps appropriate to the
          circumstances, including notifications where required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="16. Changes to this Privacy Policy">
        <p>
          We may update this Privacy Policy when our practices, service providers,
          features, or legal obligations change.
        </p>

        <p>
          The effective date at the top of this page will identify the current version.
          Where appropriate, we may provide additional notice of material changes.
        </p>
      </LegalSection>

      <LegalSection title="17. Privacy Contact">
        <p>
          Privacy questions, access requests, correction requests, and concerns may be
          sent to:
        </p>

        <div className="rounded-xl border border-border bg-card p-5 text-foreground">
          <p className="font-semibold">Privacy Officer</p>

          <p>{LEGAL.legalName}</p>

          <p>{LEGAL.jurisdiction}</p>

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
