/**
 * Sends via Resend's HTTP API rather than raw SMTP.
 *
 * WHY NOT SMTP: free tiers on Render (and most free hosts) block outbound
 * SMTP ports 25/465/587 entirely as an anti-spam measure — nodemailer would
 * time out silently in production even though it works fine locally. Resend
 * sends over a normal HTTPS request, which is never blocked.
 */
const { Resend } = require('resend')
const { deFormula } = require('./validation')

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Escapes HTML so user-supplied content can never inject markup or script into
 * the notification email. Every interpolated value below goes through this.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Strips CR/LF from any value used in a header (subject, names).
 * Without this, a newline in user input can inject extra headers — the classic
 * email header injection used to turn a contact form into a spam relay.
 */
function safeHeader(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)
}

function row(label, value) {
  if (!value) return ''
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#78706c;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-weight:600">${escapeHtml(deFormula(String(value)))}</td>
  </tr>`
}

async function sendInquiryToOwner(data) {
  const html = `
    <h2 style="font-family:Georgia,serif">New Catering Inquiry</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${row('Name', data.name)}
      ${row('Email', data.email)}
      ${row('Phone', data.phone)}
      ${row('Event type', data.eventType)}
      ${row('Event date', data.eventDate)}
      ${row('Guests', data.guestCount)}
      ${row('Package', data.packageId)}
      ${row('Venue', data.venue)}
      ${row('Menu interests', data.menuInterest.join(', '))}
      ${row('Message', data.message)}
    </table>
  `

  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: process.env.OWNER_EMAIL,
    // replyTo lets the owner hit Reply and reach the customer, while the
    // From header stays on our own verified domain (protects deliverability).
    replyTo: `${safeHeader(data.name)} <${safeHeader(data.email)}>`,
    subject: `New Catering Inquiry – ${safeHeader(data.name)}`,
    html,
  })

  // Resend resolves with { data, error } instead of rejecting on API-level
  // failures — an unchecked error here would silently drop the inquiry.
  if (error) throw new Error(`Resend: failed to send owner notification (${error.message ?? error.name})`)
}

async function sendInquiryAcknowledgement(data) {
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: safeHeader(data.email),
    subject: "We received your inquiry — Tala's Event Catering Services",
    html: `
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>Thank you for your inquiry. Your request has been sent to our team and we will contact
      you shortly with availability and further details.</p>
      <p><strong>Event:</strong> ${escapeHtml(data.eventType)} on ${escapeHtml(data.eventDate)}<br>
      <strong>Estimated guests:</strong> ${escapeHtml(data.guestCount)}</p>
      <p>— Tala's Event Catering Services</p>
    `,
  })

  if (error) throw new Error(`Resend: failed to send acknowledgement (${error.message ?? error.name})`)
}

const peso = (centavos) =>
  `PHP ${(Number(centavos) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function bookingRows(b) {
  return `
      ${row('Reference', b.reference)}
      ${row('Hotel', b.hotel_name)}
      ${row('Room', b.room_name)}
      ${row('Check-in', b.check_in)}
      ${row('Check-out', b.check_out)}
      ${row('Nights', b.nights)}
      ${row('Guests', b.guests)}
      ${row('Rooms', b.rooms)}
      ${row('Total paid', peso(b.total_centavos))}`
}

/** Sent ONLY after payment has been verified with Maya. */
async function sendBookingConfirmedToOwner(b, { note } = {}) {
  const html = `
    <h2 style="font-family:Georgia,serif">Hotel Booking PAID — ${escapeHtml(b.reference)}</h2>
    ${note ? `<p style="font-family:Arial,sans-serif;color:#b45309"><strong>${escapeHtml(note)}</strong></p>` : ''}
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${bookingRows(b)}
      ${row('Guest', b.guest_name)}
      ${row('Email', b.guest_email)}
      ${row('Phone', b.guest_phone)}
      ${row('Special requests', b.special_requests)}
      ${row('Maya receipt', b.receipt_number)}
    </table>
  `
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: process.env.OWNER_EMAIL,
    replyTo: `${safeHeader(b.guest_name)} <${safeHeader(b.guest_email)}>`,
    subject: `PAID booking ${safeHeader(b.reference)} — ${safeHeader(b.hotel_name)}`,
    html,
  })
  if (error) throw new Error(`Resend: failed to send owner confirmation (${error.message ?? error.name})`)
}

async function sendBookingConfirmationToGuest(b) {
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: safeHeader(b.guest_email),
    subject: `Booking confirmed ${safeHeader(b.reference)} — Tala's Event Catering Services`,
    html: `
      <p>Hi ${escapeHtml(b.guest_name)},</p>
      <p>Thank you — we have received your payment and your booking is confirmed.</p>
      <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
        ${bookingRows(b)}
      </table>
      <p>Please keep this email and your reference number. If you have questions, simply reply to this email.</p>
      <p>— Tala's Event Catering Services</p>
    `,
  })
  if (error) throw new Error(`Resend: failed to send guest confirmation (${error.message ?? error.name})`)
}

function cateringRows(o) {
  return `
      ${row('Reference', o.reference)}
      ${row('Package', o.package_name)}
      ${row('Event date', o.event_date)}
      ${row('Venue / delivery address', o.venue)}
      ${row('Guests', o.guests)}
      ${row('Days', o.days)}
      ${row('Total paid', peso(o.total_centavos))}`
}

/** Sent ONLY after the catering payment has been verified with Maya. */
async function sendCateringConfirmedToOwner(o) {
  const html = `
    <h2 style="font-family:Georgia,serif">Catering Order PAID — ${escapeHtml(o.reference)}</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${cateringRows(o)}
      ${row('Customer', o.customer_name)}
      ${row('Email', o.customer_email)}
      ${row('Phone', o.customer_phone)}
      ${row('Maya receipt', o.receipt_number)}
    </table>
  `
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: process.env.OWNER_EMAIL,
    replyTo: `${safeHeader(o.customer_name)} <${safeHeader(o.customer_email)}>`,
    subject: `PAID catering order ${safeHeader(o.reference)} — ${safeHeader(o.package_name)}`,
    html,
  })
  if (error) throw new Error(`Resend: failed to send owner catering confirmation (${error.message ?? error.name})`)
}

async function sendCateringConfirmationToCustomer(o) {
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: safeHeader(o.customer_email),
    subject: `Order confirmed ${safeHeader(o.reference)} — Tala's Event Catering Services`,
    html: `
      <p>Hi ${escapeHtml(o.customer_name)},</p>
      <p>Thank you — we have received your payment and your catering order is confirmed.</p>
      <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
        ${cateringRows(o)}
      </table>
      <p>Please keep this email and your reference number. For any changes or questions, simply reply to this email.</p>
      <p>— Tala's Event Catering Services</p>
    `,
  })
  if (error) throw new Error(`Resend: failed to send customer confirmation (${error.message ?? error.name})`)
}

/** Plain internal alert for anything that needs a human (mismatch, late payment…). */
async function sendOwnerAlert(subject, lines) {
  const html = `
    <h2 style="font-family:Georgia,serif">Payment attention needed</h2>
    <ul style="font-family:Arial,sans-serif;font-size:14px">
      ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
    </ul>
  `
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: process.env.OWNER_EMAIL,
    subject: safeHeader(subject),
    html,
  })
  if (error) throw new Error(`Resend: failed to send alert (${error.message ?? error.name})`)
}

module.exports = {
  sendInquiryToOwner,
  sendInquiryAcknowledgement,
  sendBookingConfirmedToOwner,
  sendBookingConfirmationToGuest,
  sendCateringConfirmedToOwner,
  sendCateringConfirmationToCustomer,
  sendOwnerAlert,
  escapeHtml,
  safeHeader,
}
