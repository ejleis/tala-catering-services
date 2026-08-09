import { TalaMark } from './Icons.jsx'

export function Container({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 ${className}`}>{children}</div>
}

export function Section({ id, children, className = '', tone = 'default' }) {
  const tones = {
    default: 'bg-white',
    muted: 'bg-ink-50',
    tint: 'bg-brand-50/60',
  }
  return (
    <section id={id} className={`scroll-mt-20 py-16 md:py-24 ${tones[tone]} ${className}`}>
      <Container>{children}</Container>
    </section>
  )
}

export function Eyebrow({ children, centered = false }) {
  return (
    <span
      className={`mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-700 ${
        centered ? 'w-full justify-center' : ''
      }`}
    >
      <TalaMark className="h-3.5 w-3.5" />
      {children}
    </span>
  )
}

export function SectionHeading({ eyebrow, title, description, centered = false }) {
  return (
    <div className={`mb-10 max-w-2xl ${centered ? 'mx-auto text-center' : ''}`}>
      {eyebrow && <Eyebrow centered={centered}>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl md:text-4xl">{title}</h2>
      {description && <p className="mt-3 text-lg text-ink-500">{description}</p>}
    </div>
  )
}
