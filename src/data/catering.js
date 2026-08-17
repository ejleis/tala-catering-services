/**
 * Catering content. Prices are indicative starting rates used to frame an
 * inquiry — no online payment is taken for catering.
 *
 * [NEEDS PROOF] All package rates and inclusions are placeholders pending
 * the client's confirmed pricing sheet.
 */

export const SERVICES = [
  {
    id: 'weddings',
    title: 'Weddings',
    description: 'Plated dinners, family-style spreads, and grazing stations built around your program and venue.',
  },
  {
    id: 'corporate',
    title: 'Corporate Events',
    description: 'Working breakfasts, packed meals, and full executive dinners delivered on schedule.',
  },
  {
    id: 'debut',
    title: 'Debuts & Birthdays',
    description: 'Crowd-pleasing menus and dessert tables sized for milestone celebrations.',
  },
  {
    id: 'private',
    title: 'Private Events',
    description: 'Anniversaries, reunions, and intimate gatherings cooked for your table.',
  },
  {
    id: 'custom',
    title: 'Custom Packages',
    description: 'Tell us your headcount, budget, and the feel of the day — we will build a menu around it.',
  },
];

export const MENU_CATEGORIES = {
  Appetizers: [
    { id: 'app-lumpia', name: 'Lumpiang Shanghai', description: 'Hand-rolled, sweet chili dip' },
    { id: 'app-ensalada', name: 'Ensaladang Mangga', description: 'Green mango, tomato, salted egg' },
    { id: 'app-crostini', name: 'Kesong Puti Crostini', description: 'Local white cheese, tomato, basil' },
    { id: 'app-cheese', name: 'Cheese & Charcuterie', description: 'Assorted local cheeses and cured meats' },
  ],
  'Main Courses': [
    { id: 'main-lechon', name: 'Lechon Belly', description: 'Slow-roasted, crackling skin, liver sauce' },
    { id: 'main-adobo', name: 'Chicken Adobo sa Gata', description: 'Coconut cream, garlic, bay leaf' },
    { id: 'main-beef', name: 'Beef Caldereta', description: 'Bell pepper, olives, tomato base' },
    { id: 'main-fish', name: 'Baked Salmon', description: 'Lemon butter, seasonal vegetables' },
  ],
  Desserts: [
    { id: 'des-leche', name: 'Leche Flan', description: 'Classic caramel custard' },
    { id: 'des-buko', name: 'Buko Pandan', description: 'Young coconut, pandan jelly, cream' },
    { id: 'des-sapin', name: 'Sapin-Sapin', description: 'Layered rice cake, latik topping' },
    { id: 'des-cake', name: 'Assorted Mini Cakes', description: 'Rotating seasonal flavors' },
  ],
  Beverages: [
    { id: 'bev-juice', name: 'Fresh Fruit Juices', description: 'Calamansi, mango, four seasons' },
    { id: 'bev-iced', name: 'Iced Tea Station', description: 'House-brewed, unlimited refills' },
    { id: 'bev-coffee', name: 'Coffee & Tea Service', description: 'Brewed coffee, assorted teas' },
    { id: 'bev-mocktail', name: 'Signature Mocktails', description: 'Two rotating non-alcoholic options' },
  ],
};

export const PACKAGES = [
  {
    id: 'kasalo',
    name: 'Kasalo',
    subtitle: 'Simple buffet service for smaller, casual gatherings.',
    pricePerGuest: 450,
    minimumGuests: 50,
    inclusions: ['3 main dishes, 1 dessert, 1 beverage', 'Buffet table setup and skirting', 'Disposable serviceware', 'Delivery within Bulacan'],
  },
  {
    id: 'handaan',
    name: 'Handaan',
    subtitle: 'Full-service catering with on-site staff — our most requested tier.',
    pricePerGuest: 750,
    minimumGuests: 50,
    featured: true,
    inclusions: [
      '4 main dishes, 2 desserts, 2 beverages',
      'Uniformed serving staff',
      'Themed table setup and centerpieces',
      'Chinaware, glassware, and linens',
      'Setup and full cleanup',
    ],
  },
  {
    id: 'binyag',
    name: 'Bespoke',
    subtitle: 'A fully customised menu and styling plan for weddings and large events.',
    pricePerGuest: null,
    minimumGuests: null,
    inclusions: [
      'Custom menu design and food tasting',
      'Full event styling coordination',
      'Complete staffing and service team',
      'Rentals and equipment coordination',
      'On-the-day coordination',
    ],
  },
];

export const EVENT_TYPES = ['Wedding', 'Corporate Event', 'Debut', 'Birthday', 'Anniversary', 'Reunion', 'Other'];

export const GALLERY = [
  {
    id: 'g1',
    caption: 'Wedding reception setup',
    src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop',
    span: 'row-span-2',
  },
  {
    id: 'g2',
    caption: 'Crispy fried favorites, banana-leaf service',
    src: 'https://images.unsplash.com/photo-1537495988501-f9cd94a78f3e?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g3',
    caption: 'Grilled inasal chicken',
    src: 'https://images.unsplash.com/photo-1593870682262-8c9f6a9bb225?q=80&w=900&auto=format&fit=crop',
    span: 'col-span-2',
  },
  {
    id: 'g4',
    caption: 'Pancit noodles',
    src: 'https://images.unsplash.com/photo-1530375930097-e957738bc0e6?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g5',
    caption: 'Traditional Filipino plate',
    src: 'https://images.unsplash.com/photo-1536489885071-87983c3e2859?q=80&w=800&auto=format&fit=crop',
    span: 'row-span-2',
  },
  {
    id: 'g6',
    caption: 'Crispy fried chicken',
    src: 'https://images.unsplash.com/photo-1625477811215-17ea8062246f?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g7',
    caption: 'Turon, fried banana',
    src: 'https://images.unsplash.com/photo-1540714605746-4f474eefc6d4?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g8',
    caption: 'Grilled meat and vegetables',
    src: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=900&auto=format&fit=crop',
    span: 'col-span-2',
  },
  {
    id: 'g9',
    caption: 'Home-style rice bowl',
    src: 'https://images.unsplash.com/photo-1658713064117-51f51ecfaf69?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g10',
    caption: 'Family-style serving',
    src: 'https://images.unsplash.com/photo-1642616128754-7d026f979317?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g11',
    caption: 'Sisig, sizzling plate',
    src: 'https://images.unsplash.com/photo-1688084403060-3594a4b8ff8d?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'g12',
    caption: 'Fresh rice, shared meal',
    src: 'https://images.unsplash.com/photo-1489710020360-66e504159b43?q=80&w=800&auto=format&fit=crop',
  },
];
