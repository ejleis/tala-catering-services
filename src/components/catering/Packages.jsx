import { PACKAGES } from '../../data/catering.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import Alert from '../ui/Alert.jsx';
import PackageCard from './PackageCard.jsx';

/**
 * Kasalo and Handaan show a permanent calculator and lead to /checkout (see
 * PackageCard); Bespoke is quoted after a consultation, so it prefills the
 * inquiry form and moves focus to it.
 *
 * Cards stretch to equal height (the grid default). The calculators are
 * always open, so no card changes size and the Checkout / Inquire buttons
 * line up along the bottom of the row.
 */
export default function Packages({ onSelectPackage }) {
  return (
    <Section id="packages" tone="tint">
      <SectionHeading
        centered
        eyebrow="Packages"
        title="Choose a starting point"
        description="Indicative per-guest rates to frame your inquiry. Estimate your total below, or send us your details and we will reply with a firm, itemised quote."
      />

      <ul className="mx-auto grid max-w-lg gap-6 md:max-w-none md:grid-cols-3">
        {PACKAGES.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onSelectPackage={onSelectPackage} />
        ))}
      </ul>

      <Alert tone="info" className="mx-auto mt-8 max-w-2xl">
        Final pricing is confirmed in your written quote.
      </Alert>
    </Section>
  );
}
