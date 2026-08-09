const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

export function formatPeso(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
  return pesoFormatter.format(Number(amount))
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

/** Whole nights between two ISO date strings; 0 when the range is invalid. */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const nights = Math.round((end - start) / 86_400_000)
  return nights > 0 ? nights : 0
}

/** Today as an ISO date string, for use as a date input's `min`. */
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}
