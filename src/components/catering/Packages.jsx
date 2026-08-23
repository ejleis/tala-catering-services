import { PACKAGES } from '../../data/catering.js';
import { formatPeso } from '../../lib/format.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { CheckIcon } from '../ui/Icons.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';

/**
 * Packages are inquiry-only: there is no cart and no checkout. Selecting a
 * package pre-fills the inquiry form and moves focus to it.
 */
export default function Packages({ onSelectPackage }) {
  return (
    <Section id="packages" tone="tint">
      <SectionHeading
        centered
        eyebrow="Packages"
        title="Choose a starting point"
        description="Indicative per-guest rates to frame your inquiry. Send us your details and we will reply with a firm, itemised quote."
      />

      <ul className="mx-auto grid max-w-lg gap-6 md:max-w-none md:grid-cols-3">
        {PACKAGES.map((pkg) => (
          <li
            key={pkg.id}
            className={`relative flex flex-col rounded-panel border-2 bg-white p-7 transition-all duration-200 hover:-translate-y-1.5 ${
              pkg.featured ? 'border-brand-500 shadow-xl' : 'border-ink-200 hover:shadow-lg'
            }`}
          >
            {pkg.featured && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white">
                Most Requested
              </span>
            )}

            <h3 className="mb-1.5 font-display text-xl font-semibold">{pkg.name}</h3>
            <p className="mb-4 min-h-[40px] text-sm text-ink-500">{pkg.subtitle}</p>

            <p className="mb-5 mt-1 text-xs text-ink-500">{pkg.minimumGuests ? `Minimum ${pkg.minimumGuests} guests` : 'Quoted after a consultation'}</p>

            <ul className="mb-6 flex flex-1 flex-col gap-3">
              {pkg.inclusions.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckIcon size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  {item}
                </li>
              ))}
            </ul>

            <Button variant={pkg.featured ? 'primary' : 'outline'} className="w-full" onClick={() => onSelectPackage(pkg)}>
              Inquire About {pkg.name}
            </Button>
          </li>
        ))}
      </ul>

      <Alert tone="info" className="mx-auto mt-8 max-w-2xl">
        Final pricing is confirmed in your written quote.
      </Alert>
    </Section>
  );
}
