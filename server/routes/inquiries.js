const express = require('express')
const rateLimit = require('express-rate-limit')
const { validateInquiry } = require('../lib/validation')
const { getClientIp } = require('../lib/clientIp')
const { sendInquiryToOwner, sendInquiryAcknowledgement } = require('../lib/mailer')

const router = express.Router()

// Contact forms are the most-abused endpoint on any small business site.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: 'Too many inquiries from this address. Please try again later.' },
})

router.post('/', submitLimiter, async (req, res, next) => {
  try {
    // Honeypot: only bots fill this. Respond 200 so the bot believes it
    // succeeded and does not retry with a different strategy.
    if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
      return res.status(200).json({ ok: true })
    }

    const { data, errors } = validateInquiry(req.body)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }

    // Owner notification must succeed — it is the actual deliverable.
    await sendInquiryToOwner(data)

    // The customer acknowledgement is best-effort: if it fails, the inquiry has
    // still reached the owner, so we must not fail the whole request.
    sendInquiryAcknowledgement(data).catch((error) => {
      console.error('[inquiry] acknowledgement email failed', error)
    })

    return res.status(201).json({ ok: true })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
