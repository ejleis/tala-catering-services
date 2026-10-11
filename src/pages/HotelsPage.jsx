import { HOTELS } from '../data/hotels.js';
import HotelCard from '../components/hotels/HotelCard.jsx';
import { Container, Eyebrow } from '../components/ui/Section.jsx';

export default function HotelsPage() {
  return (
    <>
      <section className="border-b border-ink-200 bg-gradient-to-br from-brand-50 to-white py-12 md:py-16">
        <Container>
          <Eyebrow>Hotel Booking</Eyebrow>
          <h1 className="mb-3 text-3xl md:text-4xl">Find a room for your stay</h1>
          <p className="max-w-2xl text-lg text-ink-500">Choose one of our partner hotels below, then pick your dates and room on the hotel&apos;s own page.</p>
        </Container>
      </section>

      <section className="py-12 md:py-16">
        <Container>
          <ul className="grid gap-6 md:grid-cols-3">
            {HOTELS.map((hotel) => (
              <li key={hotel.slug}>
                <HotelCard hotel={hotel} />
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
