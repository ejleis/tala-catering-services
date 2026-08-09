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
    startingRate: 4500,
    summary:
      'A contemporary city hotel with easy access to Binondo, Divisoria, and the historic core of Manila.',
    description:
      'Swiss-Belhotel Blulane pairs modern rooms with an easy location for guests who want to be close to the older heart of Manila. Rooms are built for both short business stays and weekend trips, with a restaurant on site and a 24-hour front desk.',
    image:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=800&auto=format&fit=crop',
    ],
    perks: [
      'Free high-speed Wi-Fi',
      'On-site restaurant',
      '24-hour front desk',
      'Fitness centre',
      'Airport transfer available',
      'Daily housekeeping',
    ],
    rooms: [
      {
        id: 'sbb-deluxe',
        name: 'Deluxe Room',
        description: 'Bright, modern room suited to solo travellers or couples.',
        bed: '1 King or 2 Twin',
        maxGuests: 2,
        ratePerNight: 4500,
        image:
          'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800&auto=format&fit=crop',
        amenities: ['Air conditioning', 'Flat-screen TV', 'Private bathroom'],
      },
      {
        id: 'sbb-premier',
        name: 'Premier Room',
        description: 'A larger room with upgraded furnishings and a work desk.',
        bed: '1 King',
        maxGuests: 2,
        ratePerNight: 5800,
        image:
          'https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=800&auto=format&fit=crop',
        amenities: ['City view', 'Work desk', 'Mini bar'],
      },
      {
        id: 'sbb-suite',
        name: 'Executive Suite',
        description: 'Separate living area and premium finishes for longer stays.',
        bed: '1 King + sofa bed',
        maxGuests: 3,
        ratePerNight: 8200,
        image:
          'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
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
    startingRate: 3900,
    summary:
      'Spacious suite-style rooms near Manila Bay, geared toward families and longer stays.',
    description:
      'Bay Area Suites Manila offers apartment-style accommodation close to the bay, the airport, and the entertainment district. Most rooms include a kitchenette, which makes it a practical base for families or guests staying more than a few nights.',
    image:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=800&auto=format&fit=crop',
    ],
    perks: [
      'Free high-speed Wi-Fi',
      'In-room kitchenette',
      'Laundry service',
      'On-site parking',
      '24-hour front desk',
      'Family-friendly rooms',
    ],
    rooms: [
      {
        id: 'bas-studio',
        name: 'Studio Suite',
        description: 'Self-contained studio with a compact kitchenette.',
        bed: '1 Queen',
        maxGuests: 2,
        ratePerNight: 3900,
        image:
          'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop',
        amenities: ['Kitchenette', 'Air conditioning', 'Work area'],
      },
      {
        id: 'bas-family',
        name: 'Family Suite',
        description: 'Two sleeping areas, built for families travelling together.',
        bed: '1 King + 2 Twin',
        maxGuests: 4,
        ratePerNight: 6600,
        image:
          'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=800&auto=format&fit=crop',
        amenities: ['Two bathrooms', 'Kitchenette', 'Living area'],
      },
      {
        id: 'bas-penthouse',
        name: 'Penthouse Suite',
        description: 'Top-floor suite with a full kitchen and private balcony.',
        bed: '1 King',
        maxGuests: 3,
        ratePerNight: 9800,
        image:
          'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=800&auto=format&fit=crop',
        amenities: ['Full kitchen', 'Balcony', 'Bay view'],
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
    startingRate: 2400,
    summary:
      'A practical, well-located hotel beside Cubao’s transport hubs and shopping districts.',
    description:
      'Red Hotel Cubao is a straightforward, comfortable choice for guests who mainly need a clean, secure base close to Araneta City, the MRT and LRT lines, and the bus terminals serving northern and southern Luzon.',
    image:
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
    ],
    perks: [
      'Free high-speed Wi-Fi',
      '24-hour front desk',
      'On-site café',
      'CCTV security',
      'Walking distance to MRT/LRT',
      'Luggage storage',
    ],
    rooms: [
      {
        id: 'rhc-standard',
        name: 'Standard Room',
        description: 'A compact, comfortable room for guests who need a good base.',
        bed: '1 Queen',
        maxGuests: 2,
        ratePerNight: 2400,
        image:
          'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800&auto=format&fit=crop',
        amenities: ['Air conditioning', 'Private bathroom', 'Cable TV'],
      },
      {
        id: 'rhc-deluxe',
        name: 'Deluxe Room',
        description: 'A larger room with an upgraded bathroom and better views.',
        bed: '1 King',
        maxGuests: 2,
        ratePerNight: 3100,
        image:
          'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=800&auto=format&fit=crop',
        amenities: ['Work desk', 'Air conditioning', 'Mini fridge'],
      },
      {
        id: 'rhc-triple',
        name: 'Triple Room',
        description: 'Extra sleeping space for small groups or families.',
        bed: '1 Queen + 1 Single',
        maxGuests: 3,
        ratePerNight: 3900,
        image:
          'https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=800&auto=format&fit=crop',
        amenities: ['Extra bedding', 'Air conditioning', 'Private bathroom'],
      },
    ],
  },
]

export function getHotelBySlug(slug) {
  return HOTELS.find((hotel) => hotel.slug === slug) ?? null
}
