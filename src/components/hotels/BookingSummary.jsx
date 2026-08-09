import { formatPeso, formatDate, nightsBetween } from '../../lib/format.js'
import { LockIcon } from '../ui/Icons.jsx'

const TAX_RATE = 0.12 // [NEEDS PROOF] Confirm the correct rate with each property.

export function calculateTotals({ room, search }) {
  const nights = nightsBetween(search.checkIn, search.checkOut)
  const rooms = search.rooms || 1
  const subtotal = room ? room.ratePerNight * nights * rooms : 0
  const taxes = Math.round(subtotal * TAX_RATE)
  return { nights, rooms, subtotal, taxes, total: subtotal + taxes }
}

export default function BookingSummary({ hotel, room, search }) {
  const { nights, rooms, subtotal, taxes, total } = calculateTotals({ room, search })

  return (
    <div className="rounded-panel border border-ink-200 bg-ink-50 p-6">
      <h2 className="mb-4 font-display text-lg font-semibold">Booking summary</h2>

      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-500">Hotel</dt>
          <dd className="text-right font-medium">{hotel.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-500">Room</dt>
          <dd className="text-right font-medium">{room ? room.name : 'Not selected'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-500">Check-in</dt>
          <dd className="text-right font-medium">{formatDate(search.checkIn)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-500">Check-out</dt>
          <dd className="text-right font-medium">{formatDate(search.checkOut)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-500">Guests</dt>
          <dd className="text-right font-medium">
            {search.guests} {search.guests === 1 ? 'guest' : 'guests'} · {rooms}{' '}
            {rooms === 1 ? 'room' : 'rooms'}
          </dd>
        </div>
      </dl>

      {room && nights > 0 && (
        <>
          <hr className="my-4 border-ink-200" />
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">
                {formatPeso(room.ratePerNight)} × {nights} {nights === 1 ? 'night' : 'nights'}
                {rooms > 1 ? ` × ${rooms} rooms` : ''}
              </dt>
              <dd>{formatPeso(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Taxes and fees (est.)</dt>
              <dd>{formatPeso(taxes)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-ink-200 pt-4">
            <span className="text-sm text-ink-500">Total</span>
            <span className="font-display text-2xl font-semibold">{formatPeso(total)}</span>
          </div>
        </>
      )}

      <p className="mt-5 flex items-start gap-2 text-xs text-ink-500">
        <LockIcon size={14} className="mt-0.5 shrink-0" />
        Payment is processed by Maya on their own secure page. Card details are never entered on or
        stored by this website.
      </p>
    </div>
  )
}
