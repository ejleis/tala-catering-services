import { useState } from 'react'
import { MENU_CATEGORIES } from '../../data/catering.js'
import { Section, SectionHeading } from '../ui/Section.jsx'

const CATEGORIES = Object.keys(MENU_CATEGORIES)

export default function MenuShowcase() {
  const [active, setActive] = useState(CATEGORIES[0])

  return (
    <Section id="menu">
      <SectionHeading
        centered
        eyebrow="Featured Menu"
        title="A taste of what's on the table"
        description="A sample of what we cook most often — every menu is tailored to your event during planning."
      />

      {/* Tabs follow the WAI-ARIA tab pattern so screen readers announce the
          relationship between each tab and its panel. */}
      <div role="tablist" aria-label="Menu categories" className="mb-10 flex flex-wrap justify-center gap-3">
        {CATEGORIES.map((category) => {
          const selected = active === category
          return (
            <button
              key={category}
              type="button"
              role="tab"
              id={`tab-${category}`}
              aria-selected={selected}
              aria-controls={`panel-${category}`}
              onClick={() => setActive(category)}
              className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-ink-200 bg-white text-ink-500 hover:border-brand-500 hover:text-brand-700'
              }`}
            >
              {category}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {MENU_CATEGORIES[active].map((item) => (
          <article key={item.id} className="rounded-card border border-ink-200 bg-white p-5">
            <h3 className="mb-1 font-display text-base font-semibold">{item.name}</h3>
            <p className="text-sm text-ink-500">{item.description}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}
