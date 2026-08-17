/**
 * Partner hotel data.
 *
 * IMPORTANT — [NEEDS PROOF]
 * The three hotel names are real partner properties. Everything else below
 * (room types, nightly rates, availability counts, ratings, amenities, and
 * photos) is DEMO PLACEHOLDER CONTENT and must be replaced with details
 * confirmed in writing by each property before this goes live. Publishing
 * invented rates or availability for a real hotel is both a commercial and a
 * legal risk for your client.
 */
export const HOTELS = [
  {
    slug: 'swiss-belhotel-blulane',
    name: 'Swiss-Belhotel Blulane',
    city: 'Manila',
    area: 'Sta. Cruz, Manila',
    rating: 4.2,
    reviewCount: 312,
    startingRate: 5000,
    summary: 'A contemporary city hotel with easy access to Binondo, Divisoria, and the historic core of Manila.',
    description:
      'Swiss-Belhotel Blulane pairs modern rooms with an easy location for guests who want to be close to the older heart of Manila. Rooms are built for both short business stays and weekend trips, with a restaurant on site and a 24-hour front desk.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=800&auto=format&fit=crop',
    ],
    perks: ['Free high-speed Wi-Fi', 'On-site restaurant', '24-hour front desk', 'Fitness centre', 'Airport transfer available', 'Daily housekeeping'],
    rooms: [
      {
        id: 'sbb-suite',
        name: 'Executive Suite',
        description: 'Separate living area and premium finishes for longer stays.',
        bed: '1 King',
        maxGuests: 3,
        ratePerNight: 5000,
        image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
        amenities: ['Separate living area', 'Bathtub', 'Lounge access'],
      },
    ],
  },
  {
    slug: 'bay-area-suites-manila',
    name: 'Bay Area Suites Manila',
    city: 'Manila',
    area: 'Pasay, Metro Manila',
    rating: 4.4,
    reviewCount: 198,
    startingRate: 5000,
    summary: 'Spacious suite-style rooms near Manila Bay, geared toward families and longer stays.',
    description:
      'Bay Area Suites Manila offers apartment-style accommodation close to the bay, the airport, and the entertainment district. Most rooms include a kitchenette, which makes it a practical base for families or guests staying more than a few nights.',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=800&auto=format&fit=crop',
    ],
    perks: ['Free high-speed Wi-Fi', 'In-room kitchenette', 'Laundry service', 'On-site parking', '24-hour front desk', 'Family-friendly rooms'],
    rooms: [
      {
        id: 'basm-suite',
        name: 'Executive Suite',
        description: 'Separate living area and premium finishes for longer stays.',
        bed: '1 King',
        maxGuests: 3,
        ratePerNight: 5000,
        image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
        amenities: ['Separate living area', 'Bathtub', 'Lounge access'],
      },
    ],
  },
  {
    slug: 'red-hotel-cubao',
    name: 'Red Hotel Cubao',
    city: 'Quezon City',
    area: 'Cubao, Quezon City',
    rating: 4.0,
    reviewCount: 267,
    startingRate: 5000,
    summary: 'A practical, well-located hotel beside Cubao’s transport hubs and shopping districts.',
    description:
      'Red Hotel Cubao is a straightforward, comfortable choice for guests who mainly need a clean, secure base close to Araneta City, the MRT and LRT lines, and the bus terminals serving northern and southern Luzon.',
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
    ],
    perks: ['Free high-speed Wi-Fi', '24-hour front desk', 'On-site café', 'CCTV security', 'Walking distance to MRT/LRT', 'Luggage storage'],
    rooms: [
      {
        id: 'rhc-suite',
        name: 'Executive Suite',
        description: 'Separate living area and premium finishes for longer stays.',
        bed: '1 King',
        maxGuests: 3,
        ratePerNight: 5000,
        image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
        amenities: ['Separate living area', 'Bathtub', 'Lounge access'],
      },
    ],
  },
];

export function getHotelBySlug(slug) {
  return HOTELS.find((hotel) => hotel.slug === slug) ?? null;
}
