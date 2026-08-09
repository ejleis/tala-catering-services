import { GALLERY } from '../../data/catering.js'
import Image from '../ui/Image.jsx'
import { Section, SectionHeading } from '../ui/Section.jsx'

export default function Gallery() {
  return (
    <Section id="gallery">
      <SectionHeading
        centered
        eyebrow="Gallery"
        title="From the kitchen to the table"
        description="A look at recent events, plating, and setups."
      />

      <ul className="grid auto-rows-[140px] grid-cols-2 gap-3 md:auto-rows-[170px] md:grid-cols-4">
        {GALLERY.map((item) => (
          <li key={item.id} className={`group relative overflow-hidden rounded-card ${item.span ?? ''}`}>
            <Image
              src={item.src}
              alt={item.caption}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              {item.caption}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
