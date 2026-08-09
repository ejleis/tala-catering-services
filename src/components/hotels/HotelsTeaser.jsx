import { HOTELS } from '../../data/hotels.js'
import { Section, SectionHeading } from '../ui/Section.jsx'
import Button from '../ui/Button.jsx'
import HotelCard from './HotelCard.jsx'

export default function HotelsTeaser() {
  return (
    <Section id="hotels" tone="muted">
      <SectionHeading
        centered
        eyebrow="Partner Hotels"
        title="Need rooms for your guests?"
        description="Book accommodation for out-of-town guests at our partner properties in Manila and Quezon City."
      />

      <ul className="grid gap-6 md:grid-cols-3">
        {HOTELS.map((hotel) => (
          <li key={hotel.slug}>
            <HotelCard hotel={hotel} />
          </li>
        ))}
      </ul>

      <div className="mt-10 text-center">
        <Button to="/hotels" variant="outline" size="lg">
          Browse all hotels
        </Button>
      </div>
    </Section>
  )
}
