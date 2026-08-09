import Button from '../ui/Button.jsx'
import Image from '../ui/Image.jsx'
import { Container, Eyebrow } from '../ui/Section.jsx'
import { BUSINESS } from '../../data/site.js'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 to-white py-16 md:py-24">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-brand-100 opacity-60 blur-3xl"
        aria-hidden="true"
      />
      <Container className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Eyebrow>Chef-Led Catering</Eyebrow>
          <h1 className="mb-5 text-4xl sm:text-5xl lg:text-6xl">
            Filipino food, plated for the moments that <em className="text-brand-500">matter</em>.
          </h1>
          <p className="mb-7 max-w-xl text-lg text-ink-500">
            {BUSINESS.name} builds seasonal, chef-crafted menus and full event service for weddings,
            corporate gatherings, debuts, and private celebrations across Bulacan and Metro Manila.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button to="/#inquire" size="lg">
              Request a Quote
            </Button>
            <Button to="/#menu" variant="outline" size="lg">
              View Menu
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/5] overflow-hidden rounded-panel shadow-2xl">
            <Image
              src="https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=1000&auto=format&fit=crop"
              alt="Plated dish garnished and ready for service at a catered event"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
