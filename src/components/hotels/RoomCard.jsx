import { formatPeso } from '../../lib/format.js'
import Image from '../ui/Image.jsx'
import Button from '../ui/Button.jsx'
import { BedIcon, UsersIcon } from '../ui/Icons.jsx'

export default function RoomCard({ room, selected, onSelect, disabled }) {
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-card border transition-shadow sm:flex-row ${
        selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-ink-200 hover:shadow-md'
      }`}
    >
      <div className="aspect-[4/3] shrink-0 sm:aspect-auto sm:w-56">
        <Image
          src={room.image}
          alt={`${room.name} interior`}
          kind="hotel"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-1 font-display text-base font-semibold">{room.name}</h3>
        <p className="mb-3 text-sm text-ink-500">{room.description}</p>

        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-500">
          <li className="flex items-center gap-1">
            <BedIcon size={14} /> {room.bed}
          </li>
          <li className="flex items-center gap-1">
            <UsersIcon size={14} /> Up to {room.maxGuests} guests
          </li>
        </ul>

        <ul className="mb-4 flex flex-wrap gap-2">
          {room.amenities.map((amenity) => (
            <li
              key={amenity}
              className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-medium"
            >
              {amenity}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold">
              {formatPeso(room.ratePerNight)}
              <span className="font-body text-xs font-medium text-ink-500"> / night</span>
            </p>
            <p className="text-xs text-ink-500">Excludes taxes and fees</p>
          </div>
          <Button
            size="sm"
            variant={selected ? 'primary' : 'outline'}
            onClick={() => onSelect(room.id)}
            disabled={disabled}
            aria-pressed={selected}
          >
            {selected ? 'Selected' : 'Select Room'}
          </Button>
        </div>
      </div>
    </article>
  )
}
