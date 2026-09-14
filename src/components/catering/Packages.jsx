import { PACKAGES } from '../../data/catering.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import Alert from '../ui/Alert.jsx';
import PackageCard from './PackageCard.jsx';

/**
 * Packages are inquiry-only: there is no cart and no checkout. Selecting a
 * package pre-fills the inquiry form and moves focus to it. Kasalo and
 * Handaan additionally offer an inline calculator (see PackageCard) so a
 * customer can estimate a total before reaching out.
 *
 * `items-start` on the grid is deliberate: without it, CSS grid's default
 * `align-items: stretch` forces every card in a row to match the height of
 * the tallest one, so expanding one card's calculator would visually
 * stretch the *other* cards too even though nothing in them changed. With
 * `items-start`, each card sizes to its own content — expanding one has no
 * effect on its neighbours.
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

      <ul className="mx-auto grid max-w-lg items-start gap-6 md:max-w-none md:grid-cols-3">
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
