import { SERVICES } from '../../data/catering.js';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { RingsIcon, BriefcaseIcon, CakeIcon, HomeHeartIcon, SlidersIcon } from '../ui/Icons.jsx';

const SERVICE_ICONS = {
  weddings: RingsIcon,
  corporate: BriefcaseIcon,
  debut: CakeIcon,
  private: HomeHeartIcon,
  custom: SlidersIcon,
};

export default function Services() {
  return (
    <Section id="services" tone="muted">
      <SectionHeading
        centered
        eyebrow="What We Cater"
        title="An occasion for every menu"
        description="From boardrooms to barangay halls, each service is built around the shape and pace of the day."
      />

      <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
        {SERVICES.map((service) => {
          const Icon = SERVICE_ICONS[service.id];
          return (
            <li key={service.id} className="rounded-card border border-ink-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-lg">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                <Icon className="h-5 w-5 text-brand-500" />
              </span>
              <h3 className="mb-1.5 font-display text-base font-semibold">{service.title}</h3>
              <p className="text-sm text-ink-500">{service.description}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
