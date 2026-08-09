import { CalendarIcon, UsersIcon } from '../ui/Icons.jsx'
import { todayISO } from '../../lib/format.js'

/**
 * The search bar that sits at the top of each hotel page (Agoda-style).
 * It is a controlled component — the parent page owns the search state so the
 * room list and booking summary stay in sync with it.
 */
export default function BookingWidget({ value, onChange, errors = {} }) {
  function update(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue })
  }

  const controlClass =
    'flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 focus-within:border-brand-500 focus-within:bg-white'

  return (
    <div className="rounded-panel border border-ink-200 bg-white p-4 shadow-lg md:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="check-in" className="mb-1.5 block text-xs font-semibold text-ink-500">
            Check-in
          </label>
          <div className={controlClass}>
            <CalendarIcon size={16} className="shrink-0 text-ink-400" />
            <input
              id="check-in"
              type="date"
              min={todayISO()}
              value={value.checkIn}
              onChange={(event) => update('checkIn', event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {errors.checkIn && <p className="mt-1 text-xs text-red-600">{errors.checkIn}</p>}
        </div>

        <div>
          <label htmlFor="check-out" className="mb-1.5 block text-xs font-semibold text-ink-500">
            Check-out
          </label>
          <div className={controlClass}>
            <CalendarIcon size={16} className="shrink-0 text-ink-400" />
            <input
              id="check-out"
              type="date"
              min={value.checkIn || todayISO()}
              value={value.checkOut}
              onChange={(event) => update('checkOut', event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {errors.checkOut && <p className="mt-1 text-xs text-red-600">{errors.checkOut}</p>}
        </div>

        <div>
          <label htmlFor="guests" className="mb-1.5 block text-xs font-semibold text-ink-500">
            Guests
          </label>
          <div className={controlClass}>
            <UsersIcon size={16} className="shrink-0 text-ink-400" />
            <select
              id="guests"
              value={value.guests}
              onChange={(event) => update('guests', Number(event.target.value))}
              className="w-full bg-transparent text-sm outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? 'Guest' : 'Guests'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="rooms" className="mb-1.5 block text-xs font-semibold text-ink-500">
            Rooms
          </label>
          <div className={controlClass}>
            <select
              id="rooms"
              value={value.rooms}
              onChange={(event) => update('rooms', Number(event.target.value))}
              className="w-full bg-transparent text-sm outline-none"
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? 'Room' : 'Rooms'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
