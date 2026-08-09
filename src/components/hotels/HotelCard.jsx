import { formatPeso } from '../../lib/format.js'
import Image from '../ui/Image.jsx'
import Button from '../ui/Button.jsx'
import { StarIcon, MapPinIcon } from '../ui/Icons.jsx'

export default function HotelCard({ hotel }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-panel border border-ink-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden">
        <Image
          src={hotel.image}
          alt={`Exterior view of ${hotel.name}`}
          kind="hotel"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{hotel.name}</h2>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
            <StarIcon size={12} filled />
            {hotel.rating}
          </span>
        </div>

        <p className="mb-3 flex items-center gap-1.5 text-sm text-ink-500">
          <MapPinIcon size={14} />
          {hotel.area}
        </p>

        <p className="mb-5 flex-1 text-sm text-ink-500">{hotel.summary}</p>

        <div className="mt-auto flex items-end justify-between border-t border-ink-100 pt-4">
          <div>
            <p className="text-xs text-ink-500">Starting from</p>
            <p className="font-display text-lg font-semibold">
              {formatPeso(hotel.startingRate)}
              <span className="font-body text-xs font-medium text-ink-500"> / night</span>
            </p>
          </div>
          <Button to={`/hotels/${hotel.slug}`} size="sm">
            View Rooms
          </Button>
        </div>
      </div>
    </article>
  )
}
