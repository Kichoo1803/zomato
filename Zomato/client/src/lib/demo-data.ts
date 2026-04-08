// Demo content powers unfinished product surfaces until page-level API endpoints are wired.
export type DemoRestaurant = {
  slug: string;
  name: string;
  image: string;
  area: string;
  cuisineLabel: string;
  rating: number;
  deliveryTime: number;
  costForTwo: string;
  description: string;
  address: string;
  hours: string;
  tags: string[];
  heroNote: string;
  menu: Array<{
    category: string;
    items: Array<{
      name: string;
      description: string;
      price: string;
      badge?: string;
      image: string;
    }>;
  }>;
  reviews: Array<{
    author: string;
    title: string;
    review: string;
    rating: number;
    date: string;
  }>;
};

export type DemoOrder = {
  id: string;
  orderNumber: string;
  restaurantSlug: string;
  restaurantName: string;
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED";
  placedAt: string;
  total: string;
  eta: string;
  items: string[];
  paymentMethod: string;
  deliveryAddress: string;
  rider: {
    name: string;
    phone: string;
    vehicle: string;
  };
  timeline: Array<{
    label: string;
    time: string;
    done: boolean;
  }>;
};

export const restaurants: DemoRestaurant[] = [
  {
    slug: "saffron-story",
    name: "Saffron Story",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    area: "Indiranagar",
    cuisineLabel: "Royal biryanis, Awadhi kebabs, saffron desserts",
    rating: 4.8,
    deliveryTime: 28,
    costForTwo: "₹1,650",
    description: "Slow-cooked Awadhi comfort presented with polished, celebration-night energy.",
    address: "12A, 100 Feet Road, Indiranagar, Bengaluru",
    hours: "12:00 PM - 11:30 PM",
    tags: ["Biryani", "Signature", "Dinner"],
    heroNote: "Silk-textured gravies, charcoal aroma, and quiet luxury in every box.",
    menu: [
      {
        category: "Signatures",
        items: [
          {
            name: "Dum Gosht Biryani Royale",
            description: "Fragrant basmati layered with lamb, saffron milk, and a deep bronze dum finish.",
            price: "₹545",
            badge: "Chef pick",
            image: "https://images.unsplash.com/photo-1701579231305-d84d8af9a3fd?auto=format&fit=crop&w=900&q=80",
          },
          {
            name: "Zafrani Murgh Tikka",
            description: "Creamy saffron-marinated chicken skewers served with mint labneh.",
            price: "₹425",
            image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
      {
        category: "Desserts",
        items: [
          {
            name: "Rose Pistachio Phirni",
            description: "Velvet phirni finished with rose petals, pistachio dust, and silver leaf.",
            price: "₹195",
            image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
    ],
    reviews: [
      {
        author: "Aditi Verma",
        title: "Biryani that feels like an event",
        review: "Every layer had fragrance and restraint. The packaging felt premium and the lamb was tender all the way through.",
        rating: 4.9,
        date: "08 Apr",
      },
      {
        author: "Rohit Bansal",
        title: "Consistently elegant",
        review: "The tikka arrived hot, the mint dip was fresh, and the dessert had that polished restaurant finish.",
        rating: 4.7,
        date: "06 Apr",
      },
    ],
  },
  {
    slug: "ember-vine",
    name: "Ember & Vine",
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
    area: "Koramangala",
    cuisineLabel: "Wood-fired small plates, grills, natural wine pairings",
    rating: 4.7,
    deliveryTime: 32,
    costForTwo: "₹1,950",
    description: "Fire-led plates, polished comfort, and warm modern European flavors.",
    address: "41, 5th Block, Koramangala, Bengaluru",
    hours: "1:00 PM - 11:00 PM",
    tags: ["Grill", "European", "Date night"],
    heroNote: "For nights that want candlelight flavor and a little theatre.",
    menu: [
      {
        category: "Woodfire",
        items: [
          {
            name: "Charred Burrata Toast",
            description: "Sourdough with burrata, roasted tomato jam, and basil oil.",
            price: "₹385",
            badge: "Popular",
            image: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=900&q=80",
          },
          {
            name: "Smoked Pepper Steak Bowl",
            description: "Tenderloin slices, pepper jus, potato pave, and greens.",
            price: "₹695",
            image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
    ],
    reviews: [
      {
        author: "Meera Nair",
        title: "Fire and finesse",
        review: "The steak bowl traveled beautifully and still felt plated. Great for a polished at-home dinner.",
        rating: 4.8,
        date: "05 Apr",
      },
    ],
  },
  {
    slug: "jade-lotus",
    name: "Jade Lotus",
    image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80",
    area: "HSR Layout",
    cuisineLabel: "Pan-Asian bowls, dim sum, jasmine teas",
    rating: 4.6,
    deliveryTime: 24,
    costForTwo: "₹1,350",
    description: "Silky noodles, jewel-toned salads, and sharp wok aromas in clean, contemporary packaging.",
    address: "9, 27th Main, HSR Layout, Bengaluru",
    hours: "12:00 PM - 10:45 PM",
    tags: ["Asian", "Dim sum", "Fast delivery"],
    heroNote: "Bright broths, lacquered stir fries, and a calm, modern finish.",
    menu: [
      {
        category: "Dim Sum",
        items: [
          {
            name: "Truffle Edamame Dumplings",
            description: "Thin-skinned dumplings with edamame, truffle oil, and scallion crunch.",
            price: "₹345",
            badge: "Vegetarian",
            image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
    ],
    reviews: [
      {
        author: "Simran Bedi",
        title: "Dim sum with polish",
        review: "Light, fragrant, and still delicate when delivered. The sauces were excellent.",
        rating: 4.6,
        date: "07 Apr",
      },
    ],
  },
  {
    slug: "coastal-house",
    name: "Coastal House",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80",
    area: "Whitefield",
    cuisineLabel: "Mangalorean seafood, coconut curries, appam plates",
    rating: 4.5,
    deliveryTime: 36,
    costForTwo: "₹1,580",
    description: "Briny, creamy, and spice-bright coastal cooking with a celebratory feel.",
    address: "Phoenix Marketcity, Whitefield, Bengaluru",
    hours: "12:30 PM - 11:15 PM",
    tags: ["Seafood", "Coconut", "Weekend"],
    heroNote: "Sea breeze flavors, pepper heat, and glossy curries meant for slow meals.",
    menu: [
      {
        category: "Curries",
        items: [
          {
            name: "Prawn Gassi",
            description: "Rich coconut-red chilli curry with prawns and fragrant neer dosa.",
            price: "₹525",
            image: "https://images.unsplash.com/photo-1625944525533-473f1c3d54b3?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
    ],
    reviews: [
      {
        author: "Dev Patel",
        title: "Comforting and generous",
        review: "The gassi was bold without overpowering the prawns. Great portions for sharing.",
        rating: 4.5,
        date: "03 Apr",
      },
    ],
  },
  {
    slug: "velvet-crust",
    name: "Velvet Crust",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
    area: "Jayanagar",
    cuisineLabel: "Sourdough pizzas, burrata starters, tiramisu jars",
    rating: 4.7,
    deliveryTime: 26,
    costForTwo: "₹1,420",
    description: "Stone-baked comfort with plush sauces, crisp crusts, and generous finishing touches.",
    address: "3rd Block, Jayanagar, Bengaluru",
    hours: "11:30 AM - 11:00 PM",
    tags: ["Pizza", "Comfort", "Family"],
    heroNote: "Crisp edges, lush toppings, and Friday-night energy.",
    menu: [
      {
        category: "Pizzas",
        items: [
          {
            name: "Burrata Marinara Bianca",
            description: "White sauce pizza with burrata clouds, blistered tomato, and basil oil.",
            price: "₹495",
            badge: "Best seller",
            image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
    ],
    reviews: [
      {
        author: "Priya Menon",
        title: "Still crisp after delivery",
        review: "The crust had real character and the toppings felt thoughtful instead of overloaded.",
        rating: 4.8,
        date: "08 Apr",
      },
    ],
  },
  {
    slug: "midnight-bakery",
    name: "Midnight Bakery",
    image: "https://images.unsplash.com/photo-1483695028939-5bb13f8648b0?auto=format&fit=crop&w=1200&q=80",
    area: "MG Road",
    cuisineLabel: "Viennoiserie, celebration cakes, all-day coffee pastries",
    rating: 4.9,
    deliveryTime: 18,
    costForTwo: "₹980",
    description: "Butter-rich pastries, glossy cakes, and a quietly luxurious coffee ritual.",
    address: "Lavelle Road, MG Road, Bengaluru",
    hours: "8:00 AM - 12:30 AM",
    tags: ["Bakery", "Desserts", "Quick bites"],
    heroNote: "For slow mornings, late-night cravings, and everything sweet in between.",
    menu: [
      {
        category: "Pastries",
        items: [
          {
            name: "Almond Croissant Luxe",
            description: "Flaky laminated pastry with almond cream, toasted nuts, and a sugar veil.",
            price: "₹245",
            image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
          },
        ],
      },
    ],
    reviews: [
      {
        author: "Kunal Deshpande",
        title: "Best pastry delivery in the city",
        review: "Beautiful lamination, not soggy at all, and the packaging felt premium.",
        rating: 4.9,
        date: "07 Apr",
      },
    ],
  },
];

export const spotlightOffers = [
  {
    title: "Midweek supper club",
    description: "Flat ₹250 off premium dinner tables and delivery orders above ₹1,299.",
    code: "LUXE250",
    highlight: "Dinner edit",
  },
  {
    title: "Pastry hour privilege",
    description: "Unlock a complimentary dessert add-on with every order above ₹799.",
    code: "SWEETONUS",
    highlight: "Dessert first",
  },
  {
    title: "Chef tasting weekend",
    description: "Save 18% on chef-curated menus from the city’s most-loved restaurants.",
    code: "TASTING18",
    highlight: "Weekend only",
  },
];

export const membershipBenefits = [
  "Priority delivery windows during peak dining hours",
  "Extra reward credits on every completed premium order",
  "Complimentary reservation perks at select restaurants",
  "Exclusive access to chef drops and tasting menus",
];

export const savedAddresses = [
  {
    title: "Home",
    line1: "Prestige Shantiniketan, Tower 4",
    line2: "Whitefield Main Road, Bengaluru 560048",
    eta: "Default delivery address",
  },
  {
    title: "Studio",
    line1: "12/7 Lavelle Road",
    line2: "Ashok Nagar, Bengaluru 560001",
    eta: "Ideal for weekday lunches",
  },
];

export const notifications = [
  {
    id: "n1",
    title: "Driver is nearby",
    message: "Rakesh is two minutes away with your Saffron Story order.",
    time: "2 min ago",
  },
  {
    id: "n2",
    title: "A new tasting menu dropped",
    message: "Ember & Vine just launched a woodfire supper box for two.",
    time: "1 hour ago",
  },
  {
    id: "n3",
    title: "Wallet cashback credited",
    message: "₹180 has been credited back to your wallet after your weekend order.",
    time: "Yesterday",
  },
];

export const walletTransactions = [
  ["08 Apr", "Cashback credit", "+ ₹180"],
  ["07 Apr", "Saffron Story order", "- ₹1,245"],
  ["05 Apr", "Membership renewal", "- ₹799"],
  ["01 Apr", "Gift card redeemed", "+ ₹1,000"],
];

export const paymentMethods = [
  { title: "Visa ending 4421", subtitle: "Primary payment method" },
  { title: "UPI - aditi@okicici", subtitle: "Fast checkout" },
  { title: "Wallet balance", subtitle: "₹1,980 available" },
];

export const orders: DemoOrder[] = [
  {
    id: "zl-40330522715",
    orderNumber: "ZL-40330522715",
    restaurantSlug: "saffron-story",
    restaurantName: "Saffron Story",
    status: "PLACED",
    placedAt: "Today, 8:25 PM",
    total: "₹1,245",
    eta: "28 min",
    items: ["Dum Gosht Biryani Royale", "Rose Pistachio Phirni"],
    paymentMethod: "Cash on delivery",
    deliveryAddress: "Prestige Shantiniketan, Tower 4, Whitefield Main Road",
    rider: {
      name: "Rakesh Kumar",
      phone: "+91 98765 43210",
      vehicle: "KA 03 MH 8821",
    },
    timeline: [
      { label: "Order placed", time: "8:25 PM", done: true },
      { label: "Kitchen confirmed", time: "8:29 PM", done: true },
      { label: "Preparing your order", time: "8:37 PM", done: false },
      { label: "Out for delivery", time: "8:52 PM", done: false },
    ],
  },
  {
    id: "zl-40330511802",
    orderNumber: "ZL-40330511802",
    restaurantSlug: "ember-vine",
    restaurantName: "Ember & Vine",
    status: "DELIVERED",
    placedAt: "Yesterday, 9:10 PM",
    total: "₹1,860",
    eta: "Delivered in 31 min",
    items: ["Smoked Pepper Steak Bowl", "Charred Burrata Toast"],
    paymentMethod: "Visa ending 4421",
    deliveryAddress: "12/7 Lavelle Road, Ashok Nagar",
    rider: {
      name: "Sanjay S",
      phone: "+91 91234 56780",
      vehicle: "KA 05 KU 2201",
    },
    timeline: [
      { label: "Order placed", time: "9:10 PM", done: true },
      { label: "Kitchen confirmed", time: "9:13 PM", done: true },
      { label: "Out for delivery", time: "9:29 PM", done: true },
      { label: "Delivered", time: "9:41 PM", done: true },
    ],
  },
  {
    id: "zl-40330491212",
    orderNumber: "ZL-40330491212",
    restaurantSlug: "jade-lotus",
    restaurantName: "Jade Lotus",
    status: "OUT_FOR_DELIVERY",
    placedAt: "Today, 1:05 PM",
    total: "₹845",
    eta: "6 min",
    items: ["Truffle Edamame Dumplings", "Jasmine tea bundle"],
    paymentMethod: "UPI",
    deliveryAddress: "Prestige Shantiniketan, Tower 4, Whitefield Main Road",
    rider: {
      name: "Naveen R",
      phone: "+91 99887 66554",
      vehicle: "KA 51 AB 1204",
    },
    timeline: [
      { label: "Order placed", time: "1:05 PM", done: true },
      { label: "Kitchen confirmed", time: "1:09 PM", done: true },
      { label: "Out for delivery", time: "1:28 PM", done: true },
      { label: "Arriving shortly", time: "1:34 PM", done: false },
    ],
  },
];

export const orderRows = orders.map((order) => [
  order.orderNumber,
  order.restaurantName,
  order.status.replace(/_/g, " "),
  order.total,
  order.placedAt,
]);

export const dashboardSeries = [
  { label: "Mon", value: 24 },
  { label: "Tue", value: 36 },
  { label: "Wed", value: 31 },
  { label: "Thu", value: 44 },
  { label: "Fri", value: 58 },
  { label: "Sat", value: 71 },
  { label: "Sun", value: 63 },
];

export const partnerStats = [
  { label: "Today’s orders", value: "84", hint: "+12% from yesterday" },
  { label: "Kitchen SLA", value: "93%", hint: "Average prep 19 min" },
  { label: "Net revenue", value: "₹1.86L", hint: "This week so far" },
];

export const deliveryStats = [
  { label: "Deliveries today", value: "18", hint: "3 currently active" },
  { label: "On-time score", value: "96%", hint: "Last 30 orders" },
  { label: "Today’s earnings", value: "₹2,480", hint: "Including bonuses" },
];

export const adminStats = [
  { label: "GMV today", value: "₹18.2L", hint: "+14% vs last Tuesday" },
  { label: "Active restaurants", value: "214", hint: "12 flagged for follow-up" },
  { label: "Customer CSAT", value: "4.7 / 5", hint: "Across 1,284 reviews" },
];

export const partnerOrdersRows = [
  ["ZL-40330522715", "Dum Gosht Biryani Royale", "Preparing", "₹1,245", "8:25 PM"],
  ["ZL-40330511802", "Steak Bowl Combo", "Delivered", "₹1,860", "Yesterday"],
  ["ZL-40330491212", "Truffle Dumplings", "Assigned", "₹845", "1:05 PM"],
];

export const partnerMenuRows = [
  ["Dum Gosht Biryani Royale", "Signature", "₹545", "Available"],
  ["Zafrani Murgh Tikka", "Signature", "₹425", "Available"],
  ["Rose Pistachio Phirni", "Desserts", "₹195", "Available"],
];

export const adminUserRows = [
  ["Aditi Verma", "Customer", "active", "12 orders"],
  ["Rohit Bansal", "Customer", "active", "8 orders"],
  ["Tara Mehta", "Restaurant owner", "active", "2 restaurants"],
  ["Rakesh Kumar", "Delivery partner", "active", "96% on-time"],
];

export const adminRestaurantRows = restaurants.slice(0, 4).map((restaurant) => [
  restaurant.name,
  restaurant.area,
  restaurant.rating.toFixed(1),
  `${restaurant.deliveryTime} min`,
]);

export const adminDeliveryRows = [
  ["Rakesh Kumar", "18 active shifts", "4.8", "Verified"],
  ["Naveen R", "14 active shifts", "4.7", "Verified"],
  ["Sanjay S", "12 active shifts", "4.6", "Review docs"],
];

export const adminPaymentsRows = [
  ["08 Apr", "Refund", "ZL-40330115521", "₹320"],
  ["08 Apr", "Payout", "Saffron Story", "₹24,500"],
  ["07 Apr", "Settlement", "Velvet Crust", "₹18,200"],
];

export const adminOfferRows = [
  ["LUXE250", "Dinner edit", "Active", "2,104 redemptions"],
  ["TASTING18", "Weekend only", "Scheduled", "Starts Friday"],
  ["SWEETONUS", "Dessert first", "Active", "812 redemptions"],
];

export const deliveryHistoryRows = [
  ["ZL-40330491212", "Jade Lotus", "₹168", "4.8", "Delivered"],
  ["ZL-40330477108", "Velvet Crust", "₹142", "5.0", "Delivered"],
  ["ZL-40330455218", "Saffron Story", "₹210", "4.9", "Delivered"],
];

export const deliveryActiveRows = [
  ["ZL-40330522715", "Saffron Story", "Whitefield", "12 min away"],
  ["ZL-40330522109", "Midnight Bakery", "Lavelle Road", "Pickup ready"],
];

export const restaurantCategories = ["All", "Biryani", "Asian", "Pizza", "Desserts", "Seafood"];

export const getRestaurantBySlug = (slug?: string) => restaurants.find((restaurant) => restaurant.slug === slug);

export const getOrderById = (orderId?: string) => orders.find((order) => order.id === orderId);

export const searchRestaurants = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return restaurants;
  }

  return restaurants.filter((restaurant) => {
    if (restaurant.name.toLowerCase().includes(normalized)) {
      return true;
    }

    if (restaurant.cuisineLabel.toLowerCase().includes(normalized)) {
      return true;
    }

    return restaurant.menu.some((category) =>
      category.items.some((item) => item.name.toLowerCase().includes(normalized)),
    );
  });
};

export const getStatusTone = (status: string) => {
  if (status.includes("DELIVERED") || status.includes("Verified")) {
    return "success" as const;
  }

  if (status.includes("OUT_FOR_DELIVERY") || status.includes("Assigned") || status.includes("Active")) {
    return "info" as const;
  }

  if (status.includes("Preparing") || status.includes("Review")) {
    return "warning" as const;
  }

  return "neutral" as const;
};
