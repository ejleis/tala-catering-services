import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getHotelBySlug } from '../data/hotels.js'
import { nightsBetween } from '../lib/format.js'
import { Container } from '../components/ui/Section.jsx'
import Image from '../components/ui/Image.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import { StarIcon, MapPinIcon, CheckIcon, ChevronLeftIcon } from '../components/ui/Icons.jsx'
import BookingWidget from '../components/hotels/BookingWidget.jsx'
import RoomCard from '../components/hotels/RoomCard.jsx'
import BookingSummary from '../components/hotels/BookingSummary.jsx'
import BookingForm from '../components/hotels/BookingForm.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function HotelDetailPage() {
  const { slug } = useParams()
  const hotel = getHotelBySlug(slug)

  const [search, setSearch] = useState({
    checkIn: '',
    checkOut: '',
    guests: 2,
    rooms: 1,
  })
  const [selectedRoomId, setSelectedRoomId] = useState(null)

  // Only rooms that can actually hold the party size are offered — this avoids
  // taking a booking the property would have to reject.
  const availableRooms = useMemo(() => {
    if (!hotel) return []
    return hotel.rooms.filter((room) => room.maxGuests >= search.guests)
  }, [hotel, search.guests])

  const selectedRoom = availableRooms.find((room) => room.id === selectedRoomId) ?? null
  const nights = nightsBetween(search.checkIn, search.checkOut)

  // An unknown slug should 404 rather than crash.
  if (!hotel) return <NotFoundPage />

  function handleSearchChange(next) {
    setSearch(next)
    // If the party no longer fits the chosen room, clear the selection.
    const stillValid = hotel.rooms.some(
      (room) => room.id === selectedRoomId && room.maxGuests >= next.guests,
    )
    if (!stillValid) setSelectedRoomId(null)
  }

  return (
    <>
      {/* ---------- Hotel header ---------- */}
      <section className="relative">
        <div className="h-64 w-full overflow-hidden md:h-80">
          <Image
            src={hotel.image}
            alt={`${hotel.name} exterior`}
            kind="hotel"
            className="h-full w-full object-cover"
          />
        </div>

        <Container>
          <Link
            to="/hotels"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
          >
            <ChevronLeftIcon size={16} />
            All hotels
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl">{hotel.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-ink-500">
                <MapPinIcon size={16} />
                {hotel.area}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700">
              <StarIcon size={14} filled />
              {hotel.rating}
              <span className="font-normal text-ink-500">({hotel.reviewCount} reviews)</span>
            </span>
          </div>
        </Container>
      </section>

      {/* ---------- Booking widget (sits at the top, Agoda-style) ---------- */}
      <section className="py-8">
        <Container>
          <BookingWidget value={search} onChange={handleSearchChange} />
        </Container>
      </section>

      <Container className="pb-20">
        <Alert tone="info" className="mb-10">
          Rates and availability for {hotel.name} are demonstration data pending written confirmation
          from the property.
        </Alert>

        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/* ---------- Main column ---------- */}
          <div>
            <p className="mb-8 max-w-2xl text-ink-600">{hotel.description}</p>

            <h2 className="mb-4 font-display text-xl font-semibold">Hotel perks</h2>
            <ul className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {hotel.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2 text-sm text-ink-600">
                  <CheckIcon size={14} className="shrink-0 text-brand-600" />
                  {perk}
                </li>
              ))}
            </ul>

            <h2 className="mb-4 font-display text-xl font-semibold">Photos</h2>
            <ul className="mb-10 grid grid-cols-2 gap-3">
              {hotel.gallery.map((src, index) => (
                <li key={src} className="overflow-hidden rounded-card">
                  <Image
                    src={src}
                    alt={`${hotel.name} photo ${index + 1}`}
                    kind="hotel"
                    className="h-44 w-full object-cover"
                  />
                </li>
              ))}
            </ul>

            <h2 id="rooms" className="mb-4 scroll-mt-24 font-display text-xl font-semibold">
              Available rooms
            </h2>

            {availableRooms.length === 0 ? (
              <Alert tone="info">
                No room type at this property fits {search.guests} guests. Try reducing the guest
                count, or book more than one room.
              </Alert>
            ) : (
              <ul className="flex flex-col gap-4">
                {availableRooms.map((room) => (
                  <li key={room.id}>
                    <RoomCard
                      room={room}
                      selected={selectedRoomId === room.id}
                      onSelect={setSelectedRoomId}
                    />
                  </li>
                ))}
              </ul>
            )}

            {selectedRoom && nights > 0 && (
              <div className="mt-10">
                <BookingForm hotel={hotel} room={selectedRoom} search={search} />
              </div>
            )}

            {selectedRoom && nights === 0 && (
              <Alert tone="info" className="mt-10">
                Choose your check-in and check-out dates above to continue.
              </Alert>
            )}
          </div>

          {/* ---------- Sticky summary ---------- */}
          <aside>
            <div className="lg:sticky lg:top-24">
              <BookingSummary hotel={hotel} room={selectedRoom} search={search} />
              {!selectedRoom && (
                <Button
                  href="#rooms"
                  variant="outline"
                  className="mt-4 w-full lg:hidden"
                >
                  Choose a room
                </Button>
              )}
            </div>
          </aside>
        </div>
      </Container>
    </>
  )
}
