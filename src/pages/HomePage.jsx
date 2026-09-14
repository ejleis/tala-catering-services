import { useRef } from 'react'
import Hero from '../components/catering/Hero.jsx'
import About from '../components/catering/About.jsx'
import Services from '../components/catering/Services.jsx'
import MenuShowcase from '../components/catering/MenuShowcase.jsx'
import Packages from '../components/catering/Packages.jsx'
import Gallery from '../components/catering/Gallery.jsx'
import InquiryForm from '../components/catering/InquiryForm.jsx'
import HotelsTeaser from '../components/hotels/HotelsTeaser.jsx'

export default function HomePage() {
  const inquiryRef = useRef(null)

  return (
    <>
      <Hero />
      <About />
      <Services />
      <MenuShowcase />
      <Packages onSelectPackage={(pkg, estimate) => inquiryRef.current?.prefillPackage(pkg, estimate)} />
      <Gallery />
      <HotelsTeaser />
      <InquiryForm ref={inquiryRef} />
    </>
  )
}
