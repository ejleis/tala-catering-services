import { Container } from '../components/ui/Section.jsx'
import Button from '../components/ui/Button.jsx'

export default function NotFoundPage() {
  return (
    <Container className="py-24 text-center">
      <p className="mb-2 font-display text-5xl font-semibold text-brand-500">404</p>
      <h1 className="mb-3 text-3xl">We couldn&apos;t find that page</h1>
      <p className="mx-auto mb-8 max-w-md text-ink-500">
        The page you are looking for may have moved or no longer exists.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button to="/">Back to home</Button>
        <Button to="/hotels" variant="outline">
          Browse hotels
        </Button>
      </div>
    </Container>
  )
}
