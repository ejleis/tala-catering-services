import { useId, useState } from 'react';
import { formatPeso } from '../../lib/format.js';
import { CheckIcon, CalculatorIcon, ChevronDownIcon } from '../ui/Icons.jsx';
import { TextInput } from '../ui/Field.jsx';
import Button from '../ui/Button.jsx';

/**
 * One package card, including — for packages with a fixed per-guest rate —
 * an inline, expandable calculator.
 *
 * Design choice: expand-in-place rather than a modal. A modal would need
 * its own focus trap and overlay (nothing else in this codebase has one yet,
 * see Section.jsx's note on this), and it interrupts comparing packages
 * side by side. An inline panel keeps all three cards visible and lets a
 * customer price out Kasalo and Handaan next to each other before deciding.
 *
 * Each card owns its own expanded/guests/days state independently — opening
 * one does not affect another, and closing one leaves any other open card
 * untouched. The parent grid uses `items-start` (see Packages.jsx) so that
 * one card growing taller does NOT visually stretch its neighbours to
 * match — CSS grid's default `align-items: stretch` would otherwise force
 * every card in the row to the height of the tallest one.
 *
 * The calculator is deliberately NOT a gate in front of "Inquire" — someone
 * who already knows their headcount shouldn't be forced to open a
 * calculator first just to reach the button they actually want.
 */
export default function PackageCard({ pkg, onSelectPackage }) {
  const hasCalculator = pkg.pricePerGuest != null;
  const panelId = useId();

  const [expanded, setExpanded] = useState(false);
  const [guests, setGuests] = useState(pkg.minimumGuests ?? 1);
  const [days, setDays] = useState(1);

  const guestsNum = Number(guests) || 0;
  const daysNum = Number(days) || 0;
  const total = pkg.pricePerGuest * guestsNum * daysNum;
  const belowMinimum = pkg.minimumGuests != null && guestsNum > 0 && guestsNum < pkg.minimumGuests;

  function handleInquire() {
    if (hasCalculator && expanded && guestsNum > 0 && daysNum > 0) {
      onSelectPackage(pkg, { guests: guestsNum, days: daysNum, total });
    } else {
      onSelectPackage(pkg);
    }
  }

  return (
    <li
      className={`relative flex flex-col rounded-panel border-2 bg-white p-7 transition-all duration-200 hover:-translate-y-1.5 ${
        pkg.featured ? 'border-brand-500 shadow-xl' : 'border-ink-200 hover:shadow-lg'
      }`}
    >
      {pkg.featured && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white">
          Most Requested
        </span>
      )}

      <h3 className="mb-1.5 font-display text-xl font-semibold">{pkg.name}</h3>
      <p className="mb-4 min-h-[40px] text-sm text-ink-500">{pkg.subtitle}</p>

      <p className="font-display text-4xl font-semibold">
        {pkg.pricePerGuest ? (
          <>
            {formatPeso(pkg.pricePerGuest)}
            <span className="font-body text-sm font-medium text-ink-500"> / guest</span>
          </>
        ) : (
          'Custom'
        )}
      </p>
      <p className="mb-5 mt-1 text-xs text-ink-500">
        {pkg.minimumGuests ? `Minimum ${pkg.minimumGuests} guests` : 'Quoted after a consultation'}
      </p>

      <ul className="mb-6 flex flex-1 flex-col gap-3">
        {pkg.inclusions.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-brand-600" />
            {item}
          </li>
        ))}
      </ul>

      {hasCalculator && (
        <div className="mb-5 -mt-1 border-t border-ink-100 pt-5">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-brand-700"
          >
            <span className="flex items-center gap-2">
              <CalculatorIcon size={16} />
              Estimate your total
            </span>
            <ChevronDownIcon size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {expanded && (
            <div id={panelId} className="mt-4 rounded-card bg-ink-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-500">Guests</span>
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                    className="!bg-white !py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-500">Days</span>
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                    className="!bg-white !py-2"
                  />
                </label>
              </div>

              {belowMinimum && (
                <p className="mt-2 text-xs text-amber-700">
                  This package has a {pkg.minimumGuests}-guest minimum — your final quote will reflect that.
                </p>
              )}

              <div className="mt-4 border-t border-ink-200 pt-4">
                <p className="text-xs text-ink-500">
                  {formatPeso(pkg.pricePerGuest)} × {guestsNum || 0} guests × {daysNum || 0} {daysNum === 1 ? 'day' : 'days'}
                </p>
                <p className="font-display text-2xl font-semibold text-brand-700">
                  {total > 0 ? formatPeso(total) : '—'}
                  <span className="font-body text-xs font-medium text-ink-500"> estimated total</span>
                </p>
              </div>

              <p className="mt-3 text-xs text-ink-500">
                This is an estimate to help you plan — your final quote may adjust for venue, staffing, and delivery.
              </p>
            </div>
          )}
        </div>
      )}

      <Button variant={pkg.featured ? 'primary' : 'outline'} className="w-full" onClick={handleInquire}>
        Inquire About {pkg.name}
      </Button>
    </li>
  );
}
