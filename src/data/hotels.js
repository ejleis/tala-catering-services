/**
 * Partner hotel data.
 *
 * PHOTOS: real, commissioned photography of each property — licensed for
 * this use by the client, who arranged the photographer directly with each
 * hotel. Stored under public/hotels/{slug}/.
 *
 * IMPORTANT — [NEEDS PROOF]
 * Room types, nightly rates, availability counts, ratings, and review counts
 * below are still DEMO PLACEHOLDER CONTENT and must be replaced with details
 * confirmed in writing by each property before this goes live. Publishing
 * invented rates or availability for a real hotel is both a commercial and a
 * legal risk for your client — this caveat applies to the data, not the
 * photos, which are already rights-cleared.
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
    image: '/hotels/swiss-belhotel-blulane/hero.jpg',
    gallery: [
      '/hotels/swiss-belhotel-blulane/lobby.jpg',
      '/hotels/swiss-belhotel-blulane/function-room.webp',
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
        image: '/hotels/swiss-belhotel-blulane/executive-suite-1.jpg',
        amenities: ['Separate living area', 'Bathtub', 'Lounge access'],
      },
      {
        id: 'sbb-premiere',
        name: 'Premiere Room',
        description: 'A comfortable, well-appointed room with a dedicated work desk.',
        bed: '1 Queen',
        maxGuests: 2,
        ratePerNight: 4000,
        image: '/hotels/swiss-belhotel-blulane/premiere-room-1.webp',
        amenities: ['Free Wi-Fi', 'Air conditioning', 'Work desk'],
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
    image: '/hotels/bay-area-suites-manila/hero.jpg',
    gallery: [
      '/hotels/bay-area-suites-manila/lobby.jpg',
      '/hotels/bay-area-suites-manila/swimming-pool.jpg',
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
        image: '/hotels/bay-area-suites-manila/executive-suite-1.jpg',
        amenities: ['Separate living area', 'Bathtub', 'Lounge access'],
      },
      {
        id: 'basm-premiere',
        name: 'Premiere Room',
        description: 'A comfortable, well-appointed room with a dedicated work desk.',
        bed: '1 Queen',
        maxGuests: 2,
        ratePerNight: 4000,
        image: '/hotels/bay-area-suites-manila/premiere-room-1.jpg',
        amenities: ['Free Wi-Fi', 'Air conditioning', 'Work desk'],
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
    image: '/hotels/red-hotel-cubao/hero.webp',
    gallery: [
      '/hotels/red-hotel-cubao/lobby.webp',
      '/hotels/red-hotel-cubao/restobar.webp',
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
        image: '/hotels/red-hotel-cubao/executive-suite.jpg',
        amenities: ['Separate living area', 'Bathtub', 'Lounge access'],
      },
      {
        id: 'rhc-premiere',
        name: 'Premiere Room',
        description: 'A comfortable, well-appointed room with a dedicated work desk.',
        bed: '1 Queen',
        maxGuests: 2,
        ratePerNight: 4000,
        image: '/hotels/red-hotel-cubao/premiere-room.jpg',
        amenities: ['Free Wi-Fi', 'Air conditioning', 'Work desk'],
      },
    ],
  },
];

export function getHotelBySlug(slug) {
  return HOTELS.find((hotel) => hotel.slug === slug) ?? null;
}
