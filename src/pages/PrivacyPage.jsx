import { BUSINESS } from '../data/site.js'
import { Container } from '../components/ui/Section.jsx'

const H2 = 'mb-3 mt-10 font-display text-xl font-semibold text-ink-900'
const H3 = 'mb-2 mt-5 text-base font-semibold text-ink-900'
const P = 'mb-3 text-ink-600'
const UL = 'mb-3 list-disc space-y-1.5 pl-6 text-ink-600'
const LINK = 'font-semibold text-brand-700 underline hover:text-brand-800'

export default function PrivacyPage() {
  return (
    <Container className="py-12 md:py-16">
      <article className="mx-auto max-w-3xl">
        <h1 className="mb-2 font-display text-3xl font-semibold">Privacy Notice</h1>
        <p className="mb-6 text-sm text-ink-500">Last updated: 1 November 2026</p>

        <div className="rounded-panel border border-ink-200 bg-ink-50 p-5">
          <h2 className="mb-2 font-display text-lg font-semibold">Summary</h2>
          <ul className="list-disc space-y-1.5 pl-6 text-sm text-ink-600">
            <li>
              We collect only the personal information you enter in our inquiry, catering checkout
              and hotel booking forms.
            </li>
            <li>
              We use it to respond to you, process your order or booking, verify your payment and
              keep the records the law requires.
            </li>
            <li>
              Card and e-wallet details are entered on Maya&apos;s secure page. We never receive or
              store them.
            </li>
            <li>We do not sell your personal information, and this website uses no cookies, analytics or advertising trackers.</li>
            <li>
              You have rights under the Data Privacy Act of 2012, including access, correction,
              objection and erasure. You may exercise them by contacting us.
            </li>
          </ul>
        </div>

        <h2 className={H2}>1. Who we are</h2>
        <p className={P}>
          {BUSINESS.name} (&ldquo;Tala&apos;s&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is the
          personal information controller for the information collected through this website. This
          notice explains how we handle personal information in accordance with the Data Privacy
          Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the
          issuances of the National Privacy Commission (NPC).
        </p>
        {/* [NEEDS PROOF] The client must designate a Data Protection Officer (required under the IRR of RA 10173) and may add a named DPO email address here. No street address is published on the site; the client may add a business address. */}
        <p className={P}>
          You may contact our Data Protection Officer through the contact details below.
        </p>
        <ul className={UL}>
          <li>
            Email:{' '}
            <a href={`mailto:${BUSINESS.email}`} className={LINK}>
              {BUSINESS.email}
            </a>
          </li>
          <li>
            Telephone:{' '}
            <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`} className={LINK}>
              {BUSINESS.phone}
            </a>
          </li>
        </ul>

        <h2 className={H2}>2. Personal information we collect</h2>
        <p className={P}>
          We collect personal information only through the forms on this website, as follows.
        </p>
        <h3 className={H3}>Catering inquiry form</h3>
        <p className={P}>
          Full name, email address, contact number, event type, event date, estimated number of
          guests, preferred package, venue, your message and your menu interests.
        </p>
        <h3 className={H3}>Catering checkout</h3>
        <p className={P}>
          Full name, email address, contact number, event date, venue or delivery address, package,
          number of guests, number of days, your payment choice (full payment or down payment) and
          the amount.
        </p>
        <h3 className={H3}>Hotel booking</h3>
        <p className={P}>
          Full name, email address, contact number, special requests, the hotel and room selected,
          check-in and check-out dates, number of guests and number of rooms.
        </p>
        <h3 className={H3}>Payment information</h3>
        <p className={P}>
          Card or e-wallet details are entered on the secure checkout page of Maya, our payment
          provider. We never receive or store them. From Maya we receive only the payment status,
          amount, reference and receipt number.
        </p>
        <h3 className={H3}>Technical information</h3>
        <p className={P}>
          Our servers record IP addresses temporarily for security purposes, such as limiting
          excessive requests and verifying payment notifications, and keep standard server logs.
          This website does not use cookies, analytics or advertising trackers.
        </p>
        <h3 className={H3}>Sensitive personal information</h3>
        <p className={P}>
          We do not ask for sensitive personal information (such as health, religious or
          government-issued identification details). Please do not include such information in
          free-text fields such as the message or special requests.
        </p>

        <h2 className={H2}>3. Why we use your information</h2>
        <ul className={UL}>
          <li>To respond to your inquiries.</li>
          <li>To process catering orders and hotel bookings.</li>
          <li>To process and verify payments.</li>
          <li>To send confirmation emails.</li>
          <li>To communicate with you about your event or stay.</li>
          <li>To keep business, tax and accounting records.</li>
          <li>To protect this website against fraud and abuse.</li>
        </ul>

        <h2 className={H2}>4. Legal basis for processing</h2>
        <p className={P}>
          Under Section 12 of the Data Privacy Act, we process your personal information on the
          following bases.
        </p>
        <ul className={UL}>
          <li>
            Performance of a contract with you, or steps taken at your request before entering into
            a contract (for example, preparing a quotation, order or booking).
          </li>
          <li>
            Compliance with legal obligations to which we are subject, such as accounting and tax
            record-keeping.
          </li>
          <li>
            Our legitimate interests in the security of this website and the prevention of fraud
            and abuse, where these are not overridden by your fundamental rights and freedoms.
          </li>
        </ul>

        <h2 className={H2}>5. Who receives your information</h2>
        <p className={P}>
          We do not sell your personal information. We share it only with the following service
          providers and partners, and only to the extent needed for the purposes above.
        </p>
        <ul className={UL}>
          <li>Maya: payment processing.</li>
          <li>Supabase: database hosting.</li>
          <li>Render: application hosting.</li>
          <li>Vercel: website hosting.</li>
          <li>Resend: email delivery.</li>
          <li>
            Our partner hotels: for hotel bookings, the guest details needed to arrange your stay.
          </li>
        </ul>
        <p className={P}>
          We disclose personal information to government authorities only when required by law.
        </p>

        <h2 className={H2}>6. Transfers outside the Philippines</h2>
        <p className={P}>
          Some of our providers store or process data outside the Philippines. For example, our
          database is hosted in Australia, and our email and hosting providers may process data in
          other countries. We use providers that are bound to protect personal information, and we
          remain accountable for personal information transferred to them, consistent with Section
          21 of the Data Privacy Act.
        </p>

        <h2 className={H2}>7. How long we keep your information</h2>
        {/* [NEEDS PROOF] The client must confirm specific retention periods (for example inquiries vs. orders and bookings vs. accounting records). No number of years is stated here on purpose. */}
        <p className={P}>
          We keep personal information only for as long as needed for the purposes described in
          this notice and as required by law, for example for tax and accounting records. After
          that, we securely delete or anonymise it.
        </p>

        <h2 className={H2}>8. How we protect your information</h2>
        <ul className={UL}>
          <li>Connections to this website are encrypted (HTTPS/TLS).</li>
          <li>Access to personal information is limited to authorised personnel.</li>
          <li>Payment card data is handled by Maya and not by us.</li>
          <li>Access to our database is restricted.</li>
        </ul>

        <h2 className={H2}>9. Your rights</h2>
        <p className={P}>
          Under Sections 16 to 18 of the Data Privacy Act and its Implementing Rules and
          Regulations, you have the right:
        </p>
        <ul className={UL}>
          <li>to be informed about how your personal information is processed;</li>
          <li>to access the personal information we hold about you;</li>
          <li>to object to the processing of your personal information;</li>
          <li>to request the erasure or blocking of your personal information;</li>
          <li>to rectify inaccurate or incomplete personal information;</li>
          <li>to data portability, where applicable;</li>
          <li>to claim compensation for damages caused by inaccurate, incomplete, unlawfully obtained or unauthorised use of your personal information; and</li>
          <li>to file a complaint with the National Privacy Commission.</li>
        </ul>
        <h3 className={H3}>How to exercise your rights</h3>
        <p className={P}>
          Please email us at{' '}
          <a href={`mailto:${BUSINESS.email}`} className={LINK}>
            {BUSINESS.email}
          </a>{' '}
          and describe your request. We may need to verify your identity before acting on it. We
          will respond within a reasonable period.
        </p>
        <p className={P}>
          If you believe your rights have been violated, you may file a complaint with the
          National Privacy Commission at{' '}
          <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer" className={LINK}>
            https://privacy.gov.ph
          </a>
          .
        </p>

        <h2 className={H2}>10. Minors</h2>
        <p className={P}>
          Our services are intended for adults arranging events. If you are under 18 years of age,
          please do not submit personal information without the involvement of a parent or
          guardian.
        </p>

        <h2 className={H2}>11. Changes to this notice</h2>
        <p className={P}>
          We may update this notice from time to time. The &ldquo;Last updated&rdquo; date at the
          top of this page shows when the latest version took effect.
        </p>
      </article>
    </Container>
  )
}
