import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import ScrollToTop from './components/layout/ScrollToTop.jsx'
import HomePage from './pages/HomePage.jsx'
import HotelsPage from './pages/HotelsPage.jsx'
import HotelDetailPage from './pages/HotelDetailPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="hotels" element={<HotelsPage />} />
          <Route path="hotels/:slug" element={<HotelDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}
