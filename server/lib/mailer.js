const nodemailer = require('nodemailer')
const { deFormula } = require('./validation')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
})

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

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.OWNER_EMAIL,
    // replyTo lets the owner hit Reply and reach the customer, while the
    // From header stays on our own verified domain (protects SPF/DKIM).
    replyTo: `${safeHeader(data.name)} <${safeHeader(data.email)}>`,
    subject: `New catering inquiry — ${safeHeader(data.eventType)} on ${safeHeader(data.eventDate)}`,
    html,
  })
}

async function sendInquiryAcknowledgement(data) {
  return transporter.sendMail({
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
}

async function sendBookingToOwner(data, reference) {
  const html = `
    <h2 style="font-family:Georgia,serif">New Hotel Booking Request</h2>
    <p style="font-family:Arial,sans-serif"><strong>Reference:</strong> ${escapeHtml(reference)}<br>
    <strong>Status:</strong> PENDING_PAYMENT (Maya not yet connected)</p>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${row('Hotel', data.hotelName)}
      ${row('Room', data.roomName)}
      ${row('Guest', data.name)}
      ${row('Email', data.email)}
      ${row('Phone', data.phone)}
      ${row('Check-in', data.checkIn)}
      ${row('Check-out', data.checkOut)}
      ${row('Nights', data.nights)}
      ${row('Guests', data.guests)}
      ${row('Rooms', data.rooms)}
      ${row('Estimated total', data.total)}
      ${row('Special requests', data.requests)}
    </table>
  `

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.OWNER_EMAIL,
    replyTo: `${safeHeader(data.name)} <${safeHeader(data.email)}>`,
    subject: `Booking request ${safeHeader(reference)} — ${safeHeader(data.hotelName)}`,
    html,
  })
}

module.exports = {
  sendInquiryToOwner,
  sendInquiryAcknowledgement,
  sendBookingToOwner,
  escapeHtml,
  safeHeader,
}
