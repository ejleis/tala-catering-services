import Image from '../ui/Image.jsx'
import { Container, Eyebrow } from '../ui/Section.jsx'
import { CheckIcon } from '../ui/Icons.jsx'

const VALUES = [
  ['Fresh, local sourcing', 'Menus built around what is in season in local markets.'],
  ['One coordinator throughout', 'A single point of contact from tasting to teardown.'],
  ['Dietary needs built in', 'Vegetarian, halal-friendly, and allergen options planned from the start.'],
  ['Complete service team', 'Setup, serving staff, and cleanup handled by our own crew.'],
]

export default function About() {
  return (
    <section id="about" className="scroll-mt-20 py-16 md:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-panel shadow-lg">
          <Image
            src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=900&auto=format&fit=crop"
            alt="Catering team plating dishes in a professional kitchen"
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <Eyebrow>About Tala&apos;s</Eyebrow>
          <h2 className="mb-4 text-3xl md:text-4xl">Food is the centrepiece. We treat it that way.</h2>
          <p className="mb-8 max-w-xl text-lg text-ink-500">
            Tala&apos;s Event Catering Services began the way most good kitchens do — cooking for family,
            then for friends, then for everyone they told. We have kept that instinct as we have grown:
            cook like it is for people you love, and plate like someone is going to photograph it.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {VALUES.map(([title, description]) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <CheckIcon size={14} className="text-brand-600" />
                </span>
                <div>
                  <h3 className="mb-0.5 font-display text-base font-semibold">{title}</h3>
                  <p className="text-sm text-ink-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
