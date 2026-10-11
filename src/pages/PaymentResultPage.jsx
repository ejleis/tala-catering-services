import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBookingStatus } from '../lib/api.js'
import { formatDate } from '../lib/format.js'
import { Container } from '../components/ui/Section.jsx'
import Button from '../components/ui/Button.jsx'
import { SpinnerIcon, CheckIcon, AlertIcon } from '../components/ui/Icons.jsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const POLL_MS = 3000
const MAX_POLLS = 20 // about a minute

const peso = (centavos) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(centavos / 100)

/**
 * Where Maya sends the customer back to (/payment/success|failure|cancel).
 *
 * IMPORTANT: this page is display-only. The URL (including the word
 * "success") proves nothing — anyone can type it. What is shown comes only
 * from the server's own record of the booking, which the server confirms by
 * asking Maya directly. So a forged or guessed URL can never show a paid
 * booking, and a real payment shows up here even if the customer closes the
 * tab (the server also confirms through Maya's webhook).
 */
export default function PaymentResultPage() {
  const { outcome } = useParams()
  const [params] = useSearchParams()
  const bookingId = params.get('b') ?? ''
  const validId = UUID.test(bookingId)

  const [booking, setBooking] = useState(null)
  const [state, setState] = useState(validId ? 'loading' : 'missing') // loading | ready | missing | error
  const [polls, setPolls] = useState(0)

  useEffect(() => {
    if (!validId) return undefined
    const controller = new AbortController()
    let timer

    async function check(count) {
      try {
        const result = await getBookingStatus(bookingId, { signal: controller.signal })
        setBooking(result)
        setState('ready')
        setPolls(count)
        const pending = ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(result.status)
        if (pending && count < MAX_POLLS) timer = setTimeout(() => check(count + 1), POLL_MS)
      } catch (error) {
        if (error?.name === 'AbortError') return
        if (error?.status === 404) setState('missing')
        else if (count < MAX_POLLS) timer = setTimeout(() => check(count + 1), POLL_MS)
        else setState('error')
      }
    }

    check(1)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [bookingId, validId])

  if (state === 'missing') {
    return (
      <Shell icon="alert" title="We couldn't find that booking">
        <p>The link may be incomplete. If you have just paid, please check your email for a confirmation.</p>
        <Actions />
      </Shell>
    )
  }

  if (state === 'loading') {
    return (
      <Shell icon="spinner" title="Checking your payment…">
        <p>Please wait a moment.</p>
      </Shell>
    )
  }

  if (state === 'error') {
    return (
      <Shell icon="alert" title="We couldn't check your payment">
        <p>
          Please do not pay again. If you completed the payment you will receive a confirmation
          email shortly; otherwise contact us and quote your booking details.
        </p>
        <Actions />
      </Shell>
    )
  }

  switch (booking.status) {
    case 'CONFIRMED':
      return (
        <Shell icon="check" title="Booking confirmed">
          <p className="mb-4">
            Thank you — your payment has been received. A confirmation has been emailed to you.
          </p>
          <Details booking={booking} />
          <Actions />
        </Shell>
      )
    case 'PENDING_PAYMENT':
    case 'PAYMENT_PROCESSING':
      return polls >= MAX_POLLS ? (
        <Shell icon="alert" title="We're still confirming your payment">
          <p className="mb-4">
            This is taking longer than usual. <strong>Please do not pay again.</strong> If your
            payment went through, you will receive a confirmation email. Otherwise nothing has been
            charged.
          </p>
          <Details booking={booking} />
          <Actions />
        </Shell>
      ) : (
        <Shell icon="spinner" title="Confirming your payment…">
          <p>
            {outcome === 'cancel'
              ? 'Checking whether the payment was cancelled…'
              : 'We are waiting for Maya to confirm your payment. This usually takes a few seconds.'}
          </p>
        </Shell>
      )
    default:
      return (
        <Shell icon="alert" title="Payment not completed">
          <p className="mb-4">
            {booking.status === 'CANCELLED'
              ? 'The payment was cancelled and you have not been charged.'
              : 'Your payment was not completed, so this booking was not made. You have not been charged for it.'}
          </p>
          <Details booking={booking} />
          <Actions retry />
        </Shell>
      )
  }
}

function Shell({ icon, title, children }) {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg rounded-panel border border-ink-200 bg-white p-8 text-center" role="status">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink-50 text-brand-600">
          {icon === 'spinner' && <SpinnerIcon size={26} />}
          {icon === 'check' && <CheckIcon size={26} />}
          {icon === 'alert' && <AlertIcon size={26} />}
        </span>
        <h1 className="mb-3 font-display text-2xl font-semibold">{title}</h1>
        <div className="text-sm text-ink-600">{children}</div>
      </div>
    </Container>
  )
}

function Details({ booking }) {
  return (
    <dl className="mb-6 space-y-2 rounded-card bg-ink-50 p-4 text-left text-sm">
      <Row label="Reference" value={booking.reference} />
      <Row label="Hotel" value={booking.hotelName} />
      <Row label="Room" value={booking.roomName} />
      <Row label="Check-in" value={formatDate(booking.checkIn)} />
      <Row label="Check-out" value={formatDate(booking.checkOut)} />
      <Row label="Total" value={peso(booking.totalCentavos)} />
    </dl>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  )
}

function Actions({ retry = false }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {retry && <Button to="/hotels">Try again</Button>}
      <Button to="/" variant={retry ? 'outline' : 'primary'}>
        Back to home
      </Button>
      {!retry && (
        <Link to="/hotels" className="inline-flex items-center text-sm font-semibold text-brand-700 hover:underline">
          Browse hotels
        </Link>
      )}
    </div>
  )
}
