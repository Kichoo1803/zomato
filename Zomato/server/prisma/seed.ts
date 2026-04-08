import { PrismaClient } from "@prisma/client";
import { AddressType, DeliveryAvailabilityStatus, DiscountType, DocumentStatus, FoodType, NotificationType, OfferScope, OrderStatus, PaymentMethod, PaymentStatus, ReservationStatus, Role, VehicleType } from "../src/constants/enums.js";
import bcrypt from "bcrypt";
import dayjs from "dayjs";

const prisma = new PrismaClient();
const BASE_DATE = dayjs("2026-04-08T12:00:00+05:30");
const DEMO_PASSWORD = "Password@123";

type UserSeed = {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  walletBalance?: number;
};

type AddressSeed = {
  key: string;
  userKey: string;
  addressType: AddressType;
  title: string;
  recipientName: string;
  contactPhone: string;
  houseNo: string;
  street: string;
  landmark?: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
};

type AddonSeed = {
  name: string;
  price: number;
};

type MenuItemSeed = {
  categoryName: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  foodType: FoodType;
  isRecommended?: boolean;
  preparationTime: number;
  calories?: number;
  spiceLevel?: number;
  addons?: AddonSeed[];
  image?: string;
};

type RestaurantSeed = {
  ownerKey: string;
  name: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  coverImage: string;
  logoText: string;
  licenseNumber: string;
  openingTime: string;
  closingTime: string;
  addressLine: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  costForTwo: number;
  avgDeliveryTime: number;
  isVegOnly: boolean;
  isFeatured?: boolean;
  categories: string[];
  cuisines: string[];
  linkedOffers?: string[];
  menuCategories: Array<{
    name: string;
    description: string;
    sortOrder: number;
  }>;
  menuItems: MenuItemSeed[];
};

type DeliveryPartnerSeed = UserSeed & {
  vehicleType: VehicleType;
  vehicleNumber: string;
  licenseNumber: string;
  availabilityStatus: DeliveryAvailabilityStatus;
  currentLatitude: number;
  currentLongitude: number;
  avgRating: number;
  isVerified?: boolean;
};

type ReservationSeed = {
  userKey: string;
  restaurantSlug: string;
  reservationDate: Date;
  guests: number;
  slot: string;
  specialRequest?: string;
  status: ReservationStatus;
};

type CartSelectionSeed = {
  itemName: string;
  quantity: number;
  addonNames?: string[];
  specialInstructions?: string;
};

type CartSeed = {
  userKey: string;
  restaurantSlug: string;
  offerCode?: string;
  items: CartSelectionSeed[];
};

type ReviewSeed = {
  rating: number;
  reviewText: string;
};

type OrderSeed = {
  key: string;
  userKey: string;
  addressKey: string;
  restaurantSlug: string;
  deliveryPartnerKey?: string;
  offerCode?: string;
  selections: CartSelectionSeed[];
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  placedHoursAgo: number;
  specialInstructions?: string;
  review?: ReviewSeed;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const decimal = (value: number) => roundMoney(value);
const avatarUrl = (seed: string) => `https://i.pravatar.cc/300?u=${encodeURIComponent(seed)}`;
const logoUrl = (text: string) =>
  `https://dummyimage.com/240x240/7f1d1d/f8efe7.png&text=${encodeURIComponent(text)}`;

const offerDiscount = (
  offer: {
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    maxDiscount: number | null;
  } | null,
  subtotal: number,
) => {
  if (!offer) {
    return 0;
  }

  const minOrderAmount = offer.minOrderAmount;
  if (subtotal < minOrderAmount) {
    return 0;
  }

  let discount =
    offer.discountType === DiscountType.PERCENTAGE
      ? (subtotal * offer.discountValue) / 100
      : offer.discountValue;

  if (offer.maxDiscount) {
    discount = Math.min(discount, offer.maxDiscount);
  }

  return roundMoney(discount);
};

const restaurantCategorySeeds = [
  { name: "Fine Dining", description: "Elevated dine-in concepts with premium menu engineering." },
  { name: "Casual Dining", description: "Comfort-first restaurants with broad appeal and steady traffic." },
  { name: "Cafe", description: "Coffee, brunch, and social spaces with all-day ordering." },
  { name: "Bakery", description: "Dessert-led storefronts and pastry-first delivery brands." },
  { name: "Quick Bites", description: "Fast-moving kitchens optimized for snack and solo orders." },
  { name: "Healthy Kitchen", description: "Nutrition-forward brands focused on lighter meals." },
  { name: "Premium Delivery", description: "Delivery-first premium restaurant experiences." },
];

const cuisineSeeds = [
  "North Indian",
  "Biryani",
  "Coastal",
  "South Indian",
  "Italian",
  "Japanese",
  "Asian",
  "American",
  "Mediterranean",
  "Cafe",
  "Bakery",
  "Chinese",
  "Mughlai",
  "Healthy",
];

const offerSeeds = [
  {
    code: "LUXE50",
    title: "Flat Rs. 50 Off",
    description: "Instant savings on premium dinner orders above Rs. 499.",
    discountType: DiscountType.FLAT,
    discountValue: 50,
    minOrderAmount: 499,
    maxDiscount: null,
    scope: OfferScope.PLATFORM,
  },
  {
    code: "FIRSTFEAST",
    title: "20% Off Your First Feast",
    description: "Welcome offer for first-time customers, capped at Rs. 200.",
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    minOrderAmount: 349,
    maxDiscount: 200,
    scope: OfferScope.PLATFORM,
  },
  {
    code: "DATEDELIGHT",
    title: "15% Off Date Night",
    description: "Perfect for larger premium orders from signature partner kitchens.",
    discountType: DiscountType.PERCENTAGE,
    discountValue: 15,
    minOrderAmount: 899,
    maxDiscount: 300,
    scope: OfferScope.RESTAURANT,
  },
  {
    code: "NIGHTOWL",
    title: "Late Night Flat Rs. 120",
    description: "Post-9PM savings on selected restaurants with night menus.",
    discountType: DiscountType.FLAT,
    discountValue: 120,
    minOrderAmount: 699,
    maxDiscount: null,
    scope: OfferScope.RESTAURANT,
  },
  {
    code: "HEALTHY25",
    title: "25% Off Smart Eats",
    description: "Healthy and vegetarian concepts with a generous percentage discount.",
    discountType: DiscountType.PERCENTAGE,
    discountValue: 25,
    minOrderAmount: 399,
    maxDiscount: 250,
    scope: OfferScope.RESTAURANT,
  },
];

const adminSeed: UserSeed = {
  key: "aditya_sen",
  fullName: "Aditya Sen",
  email: "admin@zomatoluxe.dev",
  phone: "+919800000001",
  role: Role.ADMIN,
};

const ownerSeeds: UserSeed[] = [
  {
    key: "aarav_mehta",
    fullName: "Aarav Mehta",
    email: "aarav.mehta@zomatoluxe.dev",
    phone: "+919810000101",
    role: Role.RESTAURANT_OWNER,
  },
  {
    key: "rhea_kapoor",
    fullName: "Rhea Kapoor",
    email: "rhea.kapoor@zomatoluxe.dev",
    phone: "+919810000102",
    role: Role.RESTAURANT_OWNER,
  },
  {
    key: "vihaan_sharma",
    fullName: "Vihaan Sharma",
    email: "vihaan.sharma@zomatoluxe.dev",
    phone: "+919810000103",
    role: Role.RESTAURANT_OWNER,
  },
  {
    key: "sana_iyer",
    fullName: "Sana Iyer",
    email: "sana.iyer@zomatoluxe.dev",
    phone: "+919810000104",
    role: Role.RESTAURANT_OWNER,
  },
  {
    key: "kabir_malhotra",
    fullName: "Kabir Malhotra",
    email: "kabir.malhotra@zomatoluxe.dev",
    phone: "+919810000105",
    role: Role.RESTAURANT_OWNER,
  },
  {
    key: "naina_rao",
    fullName: "Naina Rao",
    email: "naina.rao@zomatoluxe.dev",
    phone: "+919810000106",
    role: Role.RESTAURANT_OWNER,
  },
];

const deliveryPartnerSeeds: DeliveryPartnerSeed[] = [
  {
    key: "ravi_kumar",
    fullName: "Ravi Kumar",
    email: "ravi.kumar@zomatoluxe.dev",
    phone: "+919820000201",
    role: Role.DELIVERY_PARTNER,
    vehicleType: VehicleType.BIKE,
    vehicleNumber: "KA03EX1045",
    licenseNumber: "DL-RAVI-2391",
    availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
    currentLatitude: 12.97194,
    currentLongitude: 77.64115,
    avgRating: 4.78,
    isVerified: true,
  },
  {
    key: "imran_sheikh",
    fullName: "Imran Sheikh",
    email: "imran.sheikh@zomatoluxe.dev",
    phone: "+919820000202",
    role: Role.DELIVERY_PARTNER,
    vehicleType: VehicleType.SCOOTER,
    vehicleNumber: "KA05MN4418",
    licenseNumber: "DL-IMRN-7742",
    availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
    currentLatitude: 12.96163,
    currentLongitude: 77.63842,
    avgRating: 4.69,
    isVerified: true,
  },
  {
    key: "deepak_nair",
    fullName: "Deepak Nair",
    email: "deepak.nair@zomatoluxe.dev",
    phone: "+919820000203",
    role: Role.DELIVERY_PARTNER,
    vehicleType: VehicleType.BIKE,
    vehicleNumber: "KA01HQ8291",
    licenseNumber: "DL-DPAK-6644",
    availabilityStatus: DeliveryAvailabilityStatus.BUSY,
    currentLatitude: 12.98648,
    currentLongitude: 77.72837,
    avgRating: 4.82,
    isVerified: true,
  },
  {
    key: "pooja_yadav",
    fullName: "Pooja Yadav",
    email: "pooja.yadav@zomatoluxe.dev",
    phone: "+919820000204",
    role: Role.DELIVERY_PARTNER,
    vehicleType: VehicleType.CYCLE,
    vehicleNumber: "KA09CY1184",
    licenseNumber: "DL-POOJ-3315",
    availabilityStatus: DeliveryAvailabilityStatus.OFFLINE,
    currentLatitude: 12.93048,
    currentLongitude: 77.61227,
    avgRating: 4.61,
    isVerified: true,
  },
  {
    key: "salman_ansari",
    fullName: "Salman Ansari",
    email: "salman.ansari@zomatoluxe.dev",
    phone: "+919820000205",
    role: Role.DELIVERY_PARTNER,
    vehicleType: VehicleType.BIKE,
    vehicleNumber: "KA41RT5507",
    licenseNumber: "DL-SALM-1280",
    availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
    currentLatitude: 12.92492,
    currentLongitude: 77.67425,
    avgRating: 4.73,
    isVerified: true,
  },
];

const customerSeeds: UserSeed[] = [
  { key: "aditi_verma", fullName: "Aditi Verma", email: "aditi.verma@zomatoluxe.dev", phone: "+919830000301", role: Role.CUSTOMER, walletBalance: 1250 },
  { key: "rohit_bansal", fullName: "Rohit Bansal", email: "rohit.bansal@zomatoluxe.dev", phone: "+919830000302", role: Role.CUSTOMER, walletBalance: 480 },
  { key: "meera_nair", fullName: "Meera Nair", email: "meera.nair@zomatoluxe.dev", phone: "+919830000303", role: Role.CUSTOMER, walletBalance: 890 },
  { key: "ishaan_khanna", fullName: "Ishaan Khanna", email: "ishaan.khanna@zomatoluxe.dev", phone: "+919830000304", role: Role.CUSTOMER, walletBalance: 1560 },
  { key: "priya_menon", fullName: "Priya Menon", email: "priya.menon@zomatoluxe.dev", phone: "+919830000305", role: Role.CUSTOMER, walletBalance: 620 },
  { key: "kunal_deshpande", fullName: "Kunal Deshpande", email: "kunal.deshpande@zomatoluxe.dev", phone: "+919830000306", role: Role.CUSTOMER, walletBalance: 320 },
  { key: "simran_bedi", fullName: "Simran Bedi", email: "simran.bedi@zomatoluxe.dev", phone: "+919830000307", role: Role.CUSTOMER, walletBalance: 940 },
  { key: "arjun_sethi", fullName: "Arjun Sethi", email: "arjun.sethi@zomatoluxe.dev", phone: "+919830000308", role: Role.CUSTOMER, walletBalance: 770 },
  { key: "neha_kulkarni", fullName: "Neha Kulkarni", email: "neha.kulkarni@zomatoluxe.dev", phone: "+919830000309", role: Role.CUSTOMER, walletBalance: 1340 },
  { key: "dev_patel", fullName: "Dev Patel", email: "dev.patel@zomatoluxe.dev", phone: "+919830000310", role: Role.CUSTOMER, walletBalance: 510 },
];

const addressSeedGroupA: AddressSeed[] = [
  {
    key: "aditi_home",
    userKey: "aditi_verma",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Aditi Verma",
    contactPhone: "+919830000301",
    houseNo: "18A",
    street: "6th Cross, HAL 2nd Stage",
    landmark: "Near Toit",
    area: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    latitude: 12.97152,
    longitude: 77.64114,
    isDefault: true,
  },
  {
    key: "rohit_home",
    userKey: "rohit_bansal",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Rohit Bansal",
    contactPhone: "+919830000302",
    houseNo: "604",
    street: "12th A Main",
    landmark: "Near Nexus Mall",
    area: "Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560095",
    latitude: 12.93551,
    longitude: 77.62448,
    isDefault: true,
  },
  {
    key: "meera_home",
    userKey: "meera_nair",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Meera Nair",
    contactPhone: "+919830000303",
    houseNo: "9/2",
    street: "Lavelle Road",
    landmark: "Near UB City",
    area: "Ashok Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    latitude: 12.97111,
    longitude: 77.60144,
    isDefault: true,
  },
  {
    key: "ishaan_home",
    userKey: "ishaan_khanna",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Ishaan Khanna",
    contactPhone: "+919830000304",
    houseNo: "1307",
    street: "Palm Meadows Road",
    landmark: "Near Forum Shantiniketan",
    area: "Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560066",
    latitude: 12.98964,
    longitude: 77.72816,
    isDefault: true,
  },
  {
    key: "priya_home",
    userKey: "priya_menon",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Priya Menon",
    contactPhone: "+919830000305",
    houseNo: "44",
    street: "27th Main Road",
    landmark: "Near Cult Gym",
    area: "HSR Layout",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560102",
    latitude: 12.91162,
    longitude: 77.64751,
    isDefault: true,
  },
  {
    key: "kunal_home",
    userKey: "kunal_deshpande",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Kunal Deshpande",
    contactPhone: "+919830000306",
    houseNo: "87",
    street: "11th Main",
    landmark: "Near Cool Joint",
    area: "Jayanagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560041",
    latitude: 12.92763,
    longitude: 77.58322,
    isDefault: true,
  },
  {
    key: "simran_home",
    userKey: "simran_bedi",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Simran Bedi",
    contactPhone: "+919830000307",
    houseNo: "21B",
    street: "Rest House Road",
    landmark: "Near Brigade Road",
    area: "Central Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    latitude: 12.96814,
    longitude: 77.60724,
    isDefault: true,
  },
];
const addressSeedGroupB: AddressSeed[] = [
  {
    key: "arjun_home",
    userKey: "arjun_sethi",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Arjun Sethi",
    contactPhone: "+919830000308",
    houseNo: "904",
    street: "Green Glen Layout",
    landmark: "Near RMZ Ecospace",
    area: "Bellandur",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560103",
    latitude: 12.92533,
    longitude: 77.67658,
    isDefault: true,
  },
  {
    key: "neha_home",
    userKey: "neha_kulkarni",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Neha Kulkarni",
    contactPhone: "+919830000309",
    houseNo: "6/5",
    street: "15th Cross",
    landmark: "Near Vega City Mall",
    area: "JP Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560078",
    latitude: 12.90776,
    longitude: 77.58593,
    isDefault: true,
  },
  {
    key: "dev_home",
    userKey: "dev_patel",
    addressType: AddressType.HOME,
    title: "Home",
    recipientName: "Dev Patel",
    contactPhone: "+919830000310",
    houseNo: "12",
    street: "Temple Road",
    landmark: "Near CTR",
    area: "Malleshwaram",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560003",
    latitude: 13.00396,
    longitude: 77.57016,
    isDefault: true,
  },
  {
    key: "aditi_work",
    userKey: "aditi_verma",
    addressType: AddressType.WORK,
    title: "Office",
    recipientName: "Aditi Verma",
    contactPhone: "+919830000301",
    houseNo: "Tower 3",
    street: "Embassy Golf Links",
    landmark: "Reception Desk",
    area: "Domlur",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560071",
    latitude: 12.95862,
    longitude: 77.64844,
  },
  {
    key: "ishaan_work",
    userKey: "ishaan_khanna",
    addressType: AddressType.WORK,
    title: "Studio",
    recipientName: "Ishaan Khanna",
    contactPhone: "+919830000304",
    houseNo: "Block C",
    street: "ITPL Main Road",
    landmark: "Near VR Mall",
    area: "Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560048",
    latitude: 12.99503,
    longitude: 77.69697,
  },
  {
    key: "priya_parents",
    userKey: "priya_menon",
    addressType: AddressType.OTHER,
    title: "Parents",
    recipientName: "Priya Menon",
    contactPhone: "+919830000305",
    houseNo: "19/4",
    street: "Church Street",
    landmark: "Above Starbucks",
    area: "MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    latitude: 12.97413,
    longitude: 77.60786,
  },
];
const addressSeeds = [...addressSeedGroupA, ...addressSeedGroupB];

const restaurantSeedGroupA: RestaurantSeed[] = [
  {
    ownerKey: "aarav_mehta",
    name: "Saffron Story",
    slug: "saffron-story",
    description:
      "A velvet-lined North Indian kitchen with slow braises, smoked gravies, and celebratory biryanis.",
    email: "hello@saffronstory.in",
    phone: "+919900010101",
    coverImage:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
    logoText: "SS",
    licenseNumber: "FSSAI-SS-560038",
    openingTime: "12:00",
    closingTime: "23:45",
    addressLine: "507, 12th Main, HAL 2nd Stage",
    area: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    latitude: 12.97184,
    longitude: 77.64065,
    costForTwo: 1200,
    avgDeliveryTime: 34,
    isVegOnly: false,
    isFeatured: true,
    categories: ["Fine Dining", "Premium Delivery"],
    cuisines: ["North Indian", "Biryani", "Mughlai"],
    linkedOffers: ["DATEDELIGHT", "NIGHTOWL"],
    menuCategories: [
      { name: "Signatures", description: "Signature curries and house specialties.", sortOrder: 1 },
      { name: "Kebabs & Breads", description: "Tandoor char and supporting plates.", sortOrder: 2 },
      { name: "Desserts", description: "Classic endings with a luxe finish.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Signatures",
        name: "Old Delhi Butter Chicken",
        description: "Charred tandoori chicken folded into a glossy tomato-makhani sauce.",
        price: 399,
        foodType: FoodType.NON_VEG,
        isRecommended: true,
        preparationTime: 24,
        calories: 640,
        spiceLevel: 2,
        addons: [
          { name: "Extra Butter Finish", price: 40 },
          { name: "Laccha Paratha Pair", price: 70 },
        ],
      },
      {
        categoryName: "Kebabs & Breads",
        name: "Charcoal Paneer Tikka",
        description: "Thick paneer steaks with smoked peppers and mint yogurt.",
        price: 289,
        discountPrice: 269,
        foodType: FoodType.VEG,
        preparationTime: 18,
        calories: 420,
        spiceLevel: 3,
        addons: [{ name: "Mint Yogurt Dip", price: 30 }],
      },
      {
        categoryName: "Signatures",
        name: "Dum Gosht Biryani Royale",
        description: "Long-grain basmati layered with saffron lamb stock and fried onions.",
        price: 429,
        foodType: FoodType.NON_VEG,
        isRecommended: true,
        preparationTime: 26,
        calories: 710,
        spiceLevel: 4,
        addons: [
          { name: "Boiled Egg", price: 25 },
          { name: "Raita Tub", price: 35 },
        ],
      },
      {
        categoryName: "Signatures",
        name: "Truffle Dal Makhani",
        description: "Slow-cooked black lentils finished with cream, butter, and truffle aroma.",
        price: 325,
        foodType: FoodType.VEG,
        preparationTime: 22,
        calories: 520,
        spiceLevel: 1,
        addons: [
          { name: "Jeera Rice Portion", price: 90 },
          { name: "Extra Cream", price: 35 },
        ],
      },
      {
        categoryName: "Kebabs & Breads",
        name: "Garlic Roomali Basket",
        description: "Paper-thin roomali rotis brushed with roasted garlic ghee.",
        price: 95,
        foodType: FoodType.VEG,
        preparationTime: 10,
        calories: 180,
      },
      {
        categoryName: "Desserts",
        name: "Saffron Phirni Jar",
        description: "Cold phirni layered with pistachio praline and rose dust.",
        price: 165,
        foodType: FoodType.VEG,
        preparationTime: 8,
        calories: 260,
      },
    ],
  },
  {
    ownerKey: "rhea_kapoor",
    name: "Coastal Copper",
    slug: "coastal-copper",
    description:
      "A polished coastal kitchen serving Kerala comfort, Mangalorean heat, and copper-pot curries.",
    email: "hello@coastalcopper.in",
    phone: "+919900010102",
    coverImage:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
    logoText: "CC",
    licenseNumber: "FSSAI-CC-560095",
    openingTime: "11:30",
    closingTime: "23:15",
    addressLine: "100 Feet Road, 5th Block",
    area: "Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560095",
    latitude: 12.93475,
    longitude: 77.62468,
    costForTwo: 1100,
    avgDeliveryTime: 31,
    isVegOnly: false,
    isFeatured: true,
    categories: ["Casual Dining", "Premium Delivery"],
    cuisines: ["Coastal", "South Indian"],
    linkedOffers: ["NIGHTOWL"],
    menuCategories: [
      { name: "Tiffin Classics", description: "Breakfast-style staples served all day.", sortOrder: 1 },
      { name: "From The Coast", description: "Curries, roasts, and house signatures.", sortOrder: 2 },
      { name: "Sweet Finish", description: "Dessert-led plates and pours.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "From The Coast",
        name: "Malabar Prawn Curry",
        description: "Tiger prawns simmered in coconut, tamarind, and fennel-forward masala.",
        price: 465,
        foodType: FoodType.NON_VEG,
        isRecommended: true,
        preparationTime: 25,
        calories: 590,
        spiceLevel: 4,
        addons: [
          { name: "Appam Pair", price: 60 },
          { name: "Neer Dosa Pair", price: 45 },
        ],
      },
      {
        categoryName: "From The Coast",
        name: "Mangalorean Ghee Roast Chicken",
        description: "Fiery roast-style chicken with glossy chilli-ghee reduction.",
        price: 425,
        foodType: FoodType.NON_VEG,
        preparationTime: 24,
        calories: 620,
        spiceLevel: 5,
        addons: [{ name: "Extra Ghee Roast Masala", price: 50 }],
      },
      {
        categoryName: "From The Coast",
        name: "Coconut Vegetable Stew",
        description: "Tender vegetables in a cardamom-laced coconut broth.",
        price: 255,
        foodType: FoodType.VEG,
        preparationTime: 16,
        calories: 340,
        spiceLevel: 1,
        addons: [{ name: "Appam Pair", price: 60 }],
      },
      {
        categoryName: "Tiffin Classics",
        name: "Neer Dosa Fold",
        description: "Soft lace dosa folded with coconut oil and coriander salt.",
        price: 120,
        foodType: FoodType.VEG,
        preparationTime: 12,
        calories: 190,
        addons: [{ name: "Coconut Chutney Trio", price: 40 }],
      },
      {
        categoryName: "Sweet Finish",
        name: "Filter Coffee Tiramisu",
        description: "South Indian coffee-soaked layers with mascarpone cream.",
        price: 195,
        foodType: FoodType.EGG,
        preparationTime: 8,
        calories: 310,
      },
      {
        categoryName: "From The Coast",
        name: "Jackfruit Pepper Fry",
        description: "Young jackfruit tossed in curry leaves, pepper, and roasted shallots.",
        price: 285,
        foodType: FoodType.VEG,
        preparationTime: 17,
        calories: 360,
        spiceLevel: 3,
      },
    ],
  },
];
const restaurantSeedGroupB: RestaurantSeed[] = [
  {
    ownerKey: "sana_iyer",
    name: "Truffle Theory",
    slug: "truffle-theory",
    description:
      "A modern Italian room with indulgent pastas, crisp woodfire crusts, and rich dessert rituals.",
    email: "hello@truffletheory.in",
    phone: "+919900010103",
    coverImage:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
    logoText: "TT",
    licenseNumber: "FSSAI-TT-560001",
    openingTime: "12:00",
    closingTime: "23:30",
    addressLine: "15, Lavelle Road",
    area: "Ashok Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    latitude: 12.97148,
    longitude: 77.60062,
    costForTwo: 1800,
    avgDeliveryTime: 38,
    isVegOnly: false,
    isFeatured: true,
    categories: ["Fine Dining", "Premium Delivery"],
    cuisines: ["Italian"],
    linkedOffers: ["DATEDELIGHT"],
    menuCategories: [
      { name: "Starters", description: "Elegant first plates and aperitivo bites.", sortOrder: 1 },
      { name: "Pastas & Risotto", description: "Rich sauces and silk-textured starches.", sortOrder: 2 },
      { name: "Woodfire", description: "Crackling crust pizzas from the stone oven.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Starters",
        name: "Burrata Pomodoro Bruschetta",
        description: "Charred sourdough, heirloom tomato jam, basil oil, and creamy burrata.",
        price: 325,
        foodType: FoodType.VEG,
        preparationTime: 14,
        calories: 380,
        addons: [{ name: "Extra Burrata Spoon", price: 90 }],
      },
      {
        categoryName: "Pastas & Risotto",
        name: "Wild Mushroom Truffle Risotto",
        description: "Arborio rice stirred with mushroom stock, parmesan, and black truffle.",
        price: 485,
        foodType: FoodType.VEG,
        isRecommended: true,
        preparationTime: 24,
        calories: 610,
        addons: [{ name: "Parmesan Crisp", price: 55 }],
      },
      {
        categoryName: "Pastas & Risotto",
        name: "Lobster Chilli Linguine",
        description: "Fresh linguine with chilli-garlic butter and butter-poached lobster.",
        price: 625,
        foodType: FoodType.NON_VEG,
        preparationTime: 26,
        calories: 690,
        spiceLevel: 2,
      },
      {
        categoryName: "Woodfire",
        name: "Four Cheese Bianca Pizza",
        description: "White sauce pizza with mozzarella, scamorza, parmesan, and ricotta.",
        price: 545,
        foodType: FoodType.VEG,
        preparationTime: 20,
        calories: 760,
        addons: [{ name: "Wild Rocket Salad", price: 85 }],
      },
      {
        categoryName: "Pastas & Risotto",
        name: "Smoky Chicken Arrabbiata",
        description: "House penne in a punchy tomato reduction with charred chicken.",
        price: 475,
        foodType: FoodType.NON_VEG,
        preparationTime: 23,
        calories: 640,
        spiceLevel: 3,
      },
      {
        categoryName: "Starters",
        name: "Tiramisu Cloud Slice",
        description: "Airy tiramisu wedge dusted with dark cocoa and espresso sugar.",
        price: 245,
        foodType: FoodType.EGG,
        preparationTime: 8,
        calories: 330,
      },
    ],
  },
  {
    ownerKey: "kabir_malhotra",
    name: "Kuro Flame",
    slug: "kuro-flame",
    description:
      "A sleek Japanese-leaning delivery kitchen built around fire, umami, and modern Tokyo comfort food.",
    email: "hello@kuroflame.in",
    phone: "+919900010104",
    coverImage:
      "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=1200&q=80",
    logoText: "KF",
    licenseNumber: "FSSAI-KF-560066",
    openingTime: "12:30",
    closingTime: "23:59",
    addressLine: "Phoenix Marketcity Road",
    area: "Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560066",
    latitude: 12.98613,
    longitude: 77.72891,
    costForTwo: 1600,
    avgDeliveryTime: 37,
    isVegOnly: false,
    categories: ["Premium Delivery", "Casual Dining"],
    cuisines: ["Japanese", "Asian"],
    linkedOffers: ["NIGHTOWL"],
    menuCategories: [
      { name: "Small Plates", description: "Crunchy, creamy, and shareable starters.", sortOrder: 1 },
      { name: "Robata & Bowls", description: "Charred mains and meal bowls.", sortOrder: 2 },
      { name: "Desserts", description: "Japanese-inspired sweet endings.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Small Plates",
        name: "Salmon Aburi Roll",
        description: "Torch-seared salmon maki with spicy mayo and crispy shallots.",
        price: 595,
        foodType: FoodType.NON_VEG,
        isRecommended: true,
        preparationTime: 18,
        calories: 520,
        addons: [{ name: "Wasabi Mayo", price: 35 }],
      },
      {
        categoryName: "Small Plates",
        name: "Miso Corn Crisps",
        description: "Sweet corn fritters glazed in white miso butter and sesame salt.",
        price: 285,
        foodType: FoodType.VEG,
        preparationTime: 14,
        calories: 320,
      },
      {
        categoryName: "Robata & Bowls",
        name: "Tokyo Fire Chicken Bowl",
        description: "Sticky rice, fire-glazed chicken, pickled cucumber, and gochugaru mayo.",
        price: 445,
        foodType: FoodType.NON_VEG,
        preparationTime: 20,
        calories: 560,
        spiceLevel: 4,
        addons: [{ name: "Soft Egg", price: 40 }],
      },
      {
        categoryName: "Small Plates",
        name: "Edamame Truffle Gyoza",
        description: "Pan-seared dumplings with truffle soy and edamame filling.",
        price: 365,
        foodType: FoodType.VEG,
        preparationTime: 16,
        calories: 350,
      },
      {
        categoryName: "Robata & Bowls",
        name: "Black Garlic Ramen",
        description: "Silky broth ramen with black garlic oil, mushrooms, and ajitama.",
        price: 425,
        foodType: FoodType.EGG,
        preparationTime: 20,
        calories: 590,
        addons: [{ name: "Grilled Chicken Skewers", price: 110 }],
      },
      {
        categoryName: "Desserts",
        name: "Matcha Basque Cheesecake",
        description: "Burnt cheesecake with ceremonial matcha and white chocolate cream.",
        price: 275,
        foodType: FoodType.EGG,
        preparationTime: 8,
        calories: 340,
      },
    ],
  },
];
const restaurantSeedGroupC: RestaurantSeed[] = [
  {
    ownerKey: "vihaan_sharma",
    name: "Ember Grill House",
    slug: "ember-grill-house",
    description:
      "Fire-kissed proteins, glossy sauces, and indulgent comfort food built for weekend cravings.",
    email: "hello@embergrillhouse.in",
    phone: "+919900010105",
    coverImage:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1200&q=80",
    logoText: "EG",
    licenseNumber: "FSSAI-EG-560102",
    openingTime: "12:00",
    closingTime: "23:30",
    addressLine: "18th Cross, Sector 3",
    area: "HSR Layout",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560102",
    latitude: 12.91183,
    longitude: 77.64798,
    costForTwo: 1400,
    avgDeliveryTime: 32,
    isVegOnly: false,
    categories: ["Casual Dining", "Premium Delivery"],
    cuisines: ["American"],
    linkedOffers: ["DATEDELIGHT"],
    menuCategories: [
      { name: "Grill Boards", description: "Charred mains from the grill line.", sortOrder: 1 },
      { name: "Burgers & Tacos", description: "Fast luxury comfort classics.", sortOrder: 2 },
      { name: "Desserts & Sides", description: "Sharable sides and sweet finishes.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Burgers & Tacos",
        name: "Hickory Lamb Slider Trio",
        description: "Mini lamb sliders with smoked onions and black pepper aioli.",
        price: 545,
        foodType: FoodType.NON_VEG,
        preparationTime: 20,
        calories: 690,
      },
      {
        categoryName: "Burgers & Tacos",
        name: "Charred Corn & Jalapeno Taco",
        description: "Soft tacos packed with charred corn salsa and chipotle crema.",
        price: 295,
        foodType: FoodType.VEG,
        preparationTime: 16,
        calories: 330,
        spiceLevel: 2,
      },
      {
        categoryName: "Grill Boards",
        name: "Tennessee BBQ Chicken Steak",
        description: "Grilled chicken with sticky bourbon-style glaze and mashed potato.",
        price: 525,
        foodType: FoodType.NON_VEG,
        isRecommended: true,
        preparationTime: 24,
        calories: 680,
        addons: [{ name: "Loaded Mash", price: 90 }],
      },
      {
        categoryName: "Burgers & Tacos",
        name: "Double Smash Luxe Burger",
        description: "Two smashed beef-style patties with cheddar, pickles, and brioche.",
        price: 465,
        foodType: FoodType.NON_VEG,
        preparationTime: 18,
        calories: 740,
        addons: [{ name: "Cheese Drip", price: 60 }],
      },
      {
        categoryName: "Desserts & Sides",
        name: "Parmesan Truffle Fries",
        description: "Crisp fries tossed in parmesan snow and truffle salt.",
        price: 225,
        foodType: FoodType.VEG,
        preparationTime: 12,
        calories: 390,
      },
      {
        categoryName: "Desserts & Sides",
        name: "Molten Pecan Brownie",
        description: "Warm brownie square with roasted pecans and dark chocolate core.",
        price: 255,
        foodType: FoodType.EGG,
        preparationTime: 9,
        calories: 360,
      },
    ],
  },
  {
    ownerKey: "naina_rao",
    name: "Verdant Bowl Club",
    slug: "verdant-bowl-club",
    description:
      "A bright wellness-forward kitchen serving elegant bowls, wraps, and lighter premium meals.",
    email: "hello@verdantbowlclub.in",
    phone: "+919900010106",
    coverImage:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    logoText: "VB",
    licenseNumber: "FSSAI-VB-560041",
    openingTime: "10:00",
    closingTime: "22:30",
    addressLine: "11th Main, 4th Block",
    area: "Jayanagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560041",
    latitude: 12.92828,
    longitude: 77.58372,
    costForTwo: 900,
    avgDeliveryTime: 28,
    isVegOnly: true,
    isFeatured: true,
    categories: ["Healthy Kitchen", "Premium Delivery"],
    cuisines: ["Mediterranean", "Healthy"],
    linkedOffers: ["HEALTHY25"],
    menuCategories: [
      { name: "Bowls", description: "Balanced meals built for lunch and dinner.", sortOrder: 1 },
      { name: "Wraps & Bites", description: "Portable flavour-forward wellness meals.", sortOrder: 2 },
      { name: "Drinks & Dessert", description: "Protein, fruit, and cultured sweets.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Bowls",
        name: "Harissa Falafel Power Bowl",
        description: "Falafel, herbed hummus, pickled vegetables, and saffron couscous.",
        price: 345,
        foodType: FoodType.VEG,
        isRecommended: true,
        preparationTime: 15,
        calories: 430,
        addons: [{ name: "Extra Hummus", price: 45 }],
      },
      {
        categoryName: "Bowls",
        name: "Avocado Millet Sushi Bowl",
        description: "Warm millet rice bowl with avocado, cucumber ribbons, and sesame dressing.",
        price: 385,
        foodType: FoodType.VEG,
        preparationTime: 16,
        calories: 410,
      },
      {
        categoryName: "Wraps & Bites",
        name: "Zaatar Cottage Cheese Wrap",
        description: "Soft lavash packed with zaatar paneer, greens, and tahini drizzle.",
        price: 295,
        foodType: FoodType.VEG,
        preparationTime: 14,
        calories: 350,
      },
      {
        categoryName: "Bowls",
        name: "Citrus Quinoa Tabbouleh",
        description: "Quinoa salad with citrus dressing, herbs, cucumber, and pomegranate.",
        price: 255,
        foodType: FoodType.VEG,
        preparationTime: 12,
        calories: 280,
        addons: [{ name: "Grilled Halloumi", price: 95 }],
      },
      {
        categoryName: "Drinks & Dessert",
        name: "Almond Date Protein Smoothie",
        description: "Thick smoothie with almond milk, dates, banana, and vegan protein.",
        price: 220,
        foodType: FoodType.VEG,
        preparationTime: 8,
        calories: 260,
      },
      {
        categoryName: "Drinks & Dessert",
        name: "Pistachio Greek Yogurt Parfait",
        description: "Greek yogurt layered with berries, pistachio granola, and honey.",
        price: 195,
        foodType: FoodType.VEG,
        preparationTime: 7,
        calories: 230,
      },
    ],
  },
];
const restaurantSeedGroupD: RestaurantSeed[] = [
  {
    ownerKey: "rhea_kapoor",
    name: "Crumble & Co.",
    slug: "crumble-and-co",
    description:
      "A polished all-day bakery cafe with glossy pastries, brunch favourites, and specialty pours.",
    email: "hello@crumbleandco.in",
    phone: "+919900010107",
    coverImage:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
    logoText: "CC",
    licenseNumber: "FSSAI-CR-560001",
    openingTime: "08:30",
    closingTime: "22:30",
    addressLine: "8, Lavelle Road",
    area: "Ashok Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    latitude: 12.97222,
    longitude: 77.60108,
    costForTwo: 850,
    avgDeliveryTime: 27,
    isVegOnly: false,
    categories: ["Cafe", "Bakery"],
    cuisines: ["Cafe", "Bakery"],
    linkedOffers: ["FIRSTFEAST"],
    menuCategories: [
      { name: "Bakery Case", description: "Pastries and dessert counter bestsellers.", sortOrder: 1 },
      { name: "Brunch Plates", description: "Morning-to-afternoon brunch mains.", sortOrder: 2 },
      { name: "Coffee Bar", description: "Specialty coffee and sweet sips.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Brunch Plates",
        name: "Brown Butter Croissant Sandwich",
        description: "Croissant sandwich with scrambled egg, cheddar, and caramelized onions.",
        price: 285,
        foodType: FoodType.EGG,
        preparationTime: 12,
        calories: 390,
      },
      {
        categoryName: "Bakery Case",
        name: "Hazelnut Opera Pastry",
        description: "Layered pastry with coffee buttercream, ganache, and hazelnut crunch.",
        price: 225,
        foodType: FoodType.EGG,
        preparationTime: 6,
        calories: 300,
      },
      {
        categoryName: "Coffee Bar",
        name: "Caramel Sea Salt Latte",
        description: "Velvety latte with house caramel and flaky sea salt foam.",
        price: 185,
        foodType: FoodType.VEG,
        preparationTime: 7,
        calories: 210,
      },
      {
        categoryName: "Brunch Plates",
        name: "Sunrise Shakshuka Toast",
        description: "Tomato-pepper shakshuka over sourdough with whipped labneh.",
        price: 325,
        foodType: FoodType.EGG,
        preparationTime: 14,
        calories: 350,
      },
      {
        categoryName: "Brunch Plates",
        name: "Lemon Ricotta Pancakes",
        description: "Fluffy pancakes with lemon ricotta cream and berry compote.",
        price: 295,
        foodType: FoodType.EGG,
        preparationTime: 15,
        calories: 410,
      },
      {
        categoryName: "Bakery Case",
        name: "Biscoff Cheesecake Cup",
        description: "Creamy cheesecake jar with cookie crumble and lotus spread.",
        price: 215,
        foodType: FoodType.EGG,
        preparationTime: 6,
        calories: 330,
      },
    ],
  },
  {
    ownerKey: "aarav_mehta",
    name: "Dum House 47",
    slug: "dum-house-47",
    description:
      "A moodier pan-Asian kitchen for bao, wok-fried comfort, and midnight noodle cravings.",
    email: "hello@dumhouse47.in",
    phone: "+919900010108",
    coverImage:
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80",
    logoText: "D47",
    licenseNumber: "FSSAI-DH-560103",
    openingTime: "12:00",
    closingTime: "23:59",
    addressLine: "Outer Ring Road Service Lane",
    area: "Bellandur",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560103",
    latitude: 12.92464,
    longitude: 77.67444,
    costForTwo: 1000,
    avgDeliveryTime: 30,
    isVegOnly: false,
    categories: ["Quick Bites", "Premium Delivery"],
    cuisines: ["Chinese", "Asian"],
    linkedOffers: ["NIGHTOWL"],
    menuCategories: [
      { name: "Dim Sum", description: "Steamed and seared starters.", sortOrder: 1 },
      { name: "Woks & Bowls", description: "Rice, noodles, and high-flame wok dishes.", sortOrder: 2 },
      { name: "Desserts", description: "Refreshing Asian-style desserts.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Dim Sum",
        name: "Chili Garlic Chicken Bao",
        description: "Pillowy bao stuffed with sweet-spicy chicken and crunchy slaw.",
        price: 335,
        foodType: FoodType.NON_VEG,
        preparationTime: 16,
        calories: 420,
      },
      {
        categoryName: "Dim Sum",
        name: "Crispy Lotus Stem Honey Pepper",
        description: "Crisp lotus stem ribbons glazed in honey pepper reduction.",
        price: 285,
        foodType: FoodType.VEG,
        preparationTime: 14,
        calories: 320,
      },
      {
        categoryName: "Woks & Bowls",
        name: "Burnt Garlic Hakka Noodles",
        description: "Wok-tossed noodles with vegetables, soy, and roasted garlic.",
        price: 315,
        foodType: FoodType.VEG,
        preparationTime: 15,
        calories: 470,
        addons: [{ name: "Chili Oil Drizzle", price: 25 }],
      },
      {
        categoryName: "Woks & Bowls",
        name: "Sichuan Pepper Paneer Bowl",
        description: "Sticky rice bowl with paneer, bok choy, and numbing pepper glaze.",
        price: 345,
        foodType: FoodType.VEG,
        preparationTime: 18,
        calories: 430,
        spiceLevel: 4,
      },
      {
        categoryName: "Woks & Bowls",
        name: "Kung Pao Chicken Rice",
        description: "Chicken and peanuts in a dark soy sauce served over jasmine rice.",
        price: 385,
        foodType: FoodType.NON_VEG,
        preparationTime: 17,
        calories: 510,
        spiceLevel: 3,
      },
      {
        categoryName: "Desserts",
        name: "Mango Sago Pot",
        description: "Light mango cream dessert with sago pearls and coconut milk.",
        price: 195,
        foodType: FoodType.VEG,
        preparationTime: 7,
        calories: 240,
      },
    ],
  },
];
const restaurantSeedGroupE: RestaurantSeed[] = [
  {
    ownerKey: "vihaan_sharma",
    name: "Nawab Reserve",
    slug: "nawab-reserve",
    description:
      "A royal Awadhi kitchen delivering refined kebabs, slow-cooked gravies, and regal rice dishes.",
    email: "hello@nawabreserve.in",
    phone: "+919900010109",
    coverImage:
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1200&q=80",
    logoText: "NR",
    licenseNumber: "FSSAI-NR-560078",
    openingTime: "12:00",
    closingTime: "23:30",
    addressLine: "100 Feet Ring Road",
    area: "JP Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560078",
    latitude: 12.90728,
    longitude: 77.58657,
    costForTwo: 1500,
    avgDeliveryTime: 36,
    isVegOnly: false,
    isFeatured: true,
    categories: ["Fine Dining", "Premium Delivery"],
    cuisines: ["North Indian", "Mughlai", "Biryani"],
    linkedOffers: ["DATEDELIGHT"],
    menuCategories: [
      { name: "Royal Starters", description: "Kebabs and elite appetizer platters.", sortOrder: 1 },
      { name: "Handis", description: "Slow-simmered curries and gravies.", sortOrder: 2 },
      { name: "Rice & Desserts", description: "Biryani and festive endings.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Royal Starters",
        name: "Awadhi Galouti Platter",
        description: "Melt-in-mouth kebabs served with ulte tawe ka paratha.",
        price: 525,
        foodType: FoodType.NON_VEG,
        preparationTime: 18,
        calories: 560,
      },
      {
        categoryName: "Handis",
        name: "Zafrani Murgh Korma",
        description: "Tender chicken in a saffron-cashew korma with silk-smooth texture.",
        price: 455,
        foodType: FoodType.NON_VEG,
        isRecommended: true,
        preparationTime: 24,
        calories: 650,
        addons: [{ name: "Warqi Paratha", price: 85 }],
      },
      {
        categoryName: "Handis",
        name: "Subz Nizami Handi",
        description: "Seasonal vegetables in a luxurious cashew-onion gravy.",
        price: 345,
        foodType: FoodType.VEG,
        preparationTime: 20,
        calories: 410,
      },
      {
        categoryName: "Rice & Desserts",
        name: "Lucknowi Muradabadi Biryani",
        description: "Fragrant rice layered with delicate masala and slow-cooked chicken.",
        price: 435,
        foodType: FoodType.NON_VEG,
        preparationTime: 26,
        calories: 690,
        addons: [{ name: "Mirchi Salan", price: 45 }],
      },
      {
        categoryName: "Rice & Desserts",
        name: "Sheermal Saffron Bread",
        description: "Soft saffron sheermal with a lacquered honey-brushed finish.",
        price: 115,
        foodType: FoodType.VEG,
        preparationTime: 10,
        calories: 210,
      },
      {
        categoryName: "Rice & Desserts",
        name: "Shahi Tukda Mille-Feuille",
        description: "A plated dessert spin on shahi tukda with rabri and pistachio dust.",
        price: 225,
        foodType: FoodType.EGG,
        preparationTime: 8,
        calories: 340,
      },
    ],
  },
  {
    ownerKey: "sana_iyer",
    name: "Millet & Spice",
    slug: "millet-and-spice",
    description:
      "A polished South Indian vegetarian kitchen pairing nostalgia with nutrient-forward ingredients.",
    email: "hello@milletandspice.in",
    phone: "+919900010110",
    coverImage:
      "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1200&q=80",
    logoText: "MS",
    licenseNumber: "FSSAI-MS-560003",
    openingTime: "08:00",
    closingTime: "22:00",
    addressLine: "Margosa Road",
    area: "Malleshwaram",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560003",
    latitude: 13.00338,
    longitude: 77.57114,
    costForTwo: 700,
    avgDeliveryTime: 26,
    isVegOnly: true,
    categories: ["Healthy Kitchen", "Casual Dining"],
    cuisines: ["South Indian", "Healthy"],
    linkedOffers: ["HEALTHY25"],
    menuCategories: [
      { name: "Breakfast All Day", description: "Comfort-forward south breakfast classics.", sortOrder: 1 },
      { name: "Meals & Bowls", description: "Rice plates, curries, and everyday comfort.", sortOrder: 2 },
      { name: "Desserts", description: "Traditional sweets reimagined with lighter finishes.", sortOrder: 3 },
    ],
    menuItems: [
      {
        categoryName: "Breakfast All Day",
        name: "Gunpowder Idli Bites",
        description: "Mini idlis tossed in podi, ghee, curry leaves, and roasted peanuts.",
        price: 195,
        foodType: FoodType.VEG,
        preparationTime: 12,
        calories: 280,
      },
      {
        categoryName: "Breakfast All Day",
        name: "Mysore Masala Dosa Deluxe",
        description: "Crisp dosa with spicy red chutney, potato masala, and butter finish.",
        price: 245,
        foodType: FoodType.VEG,
        isRecommended: true,
        preparationTime: 14,
        calories: 390,
        addons: [{ name: "Extra Potato Palya", price: 35 }],
      },
      {
        categoryName: "Meals & Bowls",
        name: "Millet Curd Rice Comfort Bowl",
        description: "Foxtail millet curd rice with pomegranate, ginger, and tempering.",
        price: 225,
        foodType: FoodType.VEG,
        preparationTime: 10,
        calories: 260,
      },
      {
        categoryName: "Meals & Bowls",
        name: "Gongura Paneer Rice Plate",
        description: "Tangy gongura paneer served with tempered rice and beetroot poriyal.",
        price: 325,
        foodType: FoodType.VEG,
        preparationTime: 18,
        calories: 450,
        spiceLevel: 3,
      },
      {
        categoryName: "Meals & Bowls",
        name: "Tamarind Sambar Meal",
        description: "Wholesome meal with sambar, poriyal, rasam rice, and papad.",
        price: 295,
        foodType: FoodType.VEG,
        preparationTime: 18,
        calories: 480,
      },
      {
        categoryName: "Desserts",
        name: "Elaneer Payasam Verrine",
        description: "Tender coconut payasam layered in a chilled dessert glass.",
        price: 165,
        foodType: FoodType.VEG,
        preparationTime: 7,
        calories: 220,
      },
    ],
  },
];
const restaurantSeeds = [
  ...restaurantSeedGroupA,
  ...restaurantSeedGroupB,
  ...restaurantSeedGroupC,
  ...restaurantSeedGroupD,
  ...restaurantSeedGroupE,
];

const favoriteSeeds: Array<[string, string]> = [
  ["aditi_verma", "saffron-story"],
  ["aditi_verma", "truffle-theory"],
  ["rohit_bansal", "coastal-copper"],
  ["rohit_bansal", "ember-grill-house"],
  ["meera_nair", "verdant-bowl-club"],
  ["meera_nair", "crumble-and-co"],
  ["ishaan_khanna", "kuro-flame"],
  ["ishaan_khanna", "dum-house-47"],
  ["priya_menon", "truffle-theory"],
  ["kunal_deshpande", "millet-and-spice"],
  ["simran_bedi", "crumble-and-co"],
  ["simran_bedi", "saffron-story"],
  ["arjun_sethi", "dum-house-47"],
  ["neha_kulkarni", "nawab-reserve"],
  ["dev_patel", "millet-and-spice"],
];
const reservationSeeds: ReservationSeed[] = [
  {
    userKey: "aditi_verma",
    restaurantSlug: "truffle-theory",
    reservationDate: BASE_DATE.add(1, "day").hour(20).minute(0).second(0).millisecond(0).toDate(),
    guests: 2,
    slot: "8:00 PM",
    specialRequest: "Window seating if available.",
    status: ReservationStatus.CONFIRMED,
  },
  {
    userKey: "rohit_bansal",
    restaurantSlug: "saffron-story",
    reservationDate: BASE_DATE.add(3, "day").hour(21).minute(0).second(0).millisecond(0).toDate(),
    guests: 4,
    slot: "9:00 PM",
    specialRequest: "Celebrating a birthday, please keep cake plating ready.",
    status: ReservationStatus.PENDING,
  },
  {
    userKey: "meera_nair",
    restaurantSlug: "coastal-copper",
    reservationDate: BASE_DATE.subtract(2, "day").hour(19).minute(30).second(0).millisecond(0).toDate(),
    guests: 3,
    slot: "7:30 PM",
    status: ReservationStatus.COMPLETED,
  },
  {
    userKey: "ishaan_khanna",
    restaurantSlug: "kuro-flame",
    reservationDate: BASE_DATE.add(5, "day").hour(20).minute(30).second(0).millisecond(0).toDate(),
    guests: 2,
    slot: "8:30 PM",
    specialRequest: "Prefer chef counter.",
    status: ReservationStatus.CONFIRMED,
  },
  {
    userKey: "priya_menon",
    restaurantSlug: "crumble-and-co",
    reservationDate: BASE_DATE.add(1, "day").hour(11).minute(0).second(0).millisecond(0).toDate(),
    guests: 3,
    slot: "11:00 AM",
    specialRequest: "Need one high chair.",
    status: ReservationStatus.CONFIRMED,
  },
  {
    userKey: "kunal_deshpande",
    restaurantSlug: "nawab-reserve",
    reservationDate: BASE_DATE.subtract(5, "day").hour(20).minute(0).second(0).millisecond(0).toDate(),
    guests: 5,
    slot: "8:00 PM",
    status: ReservationStatus.CANCELLED,
  },
  {
    userKey: "simran_bedi",
    restaurantSlug: "verdant-bowl-club",
    reservationDate: BASE_DATE.add(2, "day").hour(13).minute(0).second(0).millisecond(0).toDate(),
    guests: 2,
    slot: "1:00 PM",
    status: ReservationStatus.CONFIRMED,
  },
  {
    userKey: "neha_kulkarni",
    restaurantSlug: "truffle-theory",
    reservationDate: BASE_DATE.subtract(10, "day").hour(20).minute(0).second(0).millisecond(0).toDate(),
    guests: 2,
    slot: "8:00 PM",
    status: ReservationStatus.NO_SHOW,
  },
];
const cartSeeds: CartSeed[] = [
  {
    userKey: "aditi_verma",
    restaurantSlug: "saffron-story",
    offerCode: "LUXE50",
    items: [
      { itemName: "Old Delhi Butter Chicken", quantity: 1, addonNames: ["Laccha Paratha Pair"] },
      { itemName: "Dum Gosht Biryani Royale", quantity: 1, addonNames: ["Raita Tub"] },
    ],
  },
  {
    userKey: "meera_nair",
    restaurantSlug: "verdant-bowl-club",
    offerCode: "HEALTHY25",
    items: [
      { itemName: "Harissa Falafel Power Bowl", quantity: 1, addonNames: ["Extra Hummus"] },
      { itemName: "Almond Date Protein Smoothie", quantity: 2 },
    ],
  },
  {
    userKey: "ishaan_khanna",
    restaurantSlug: "kuro-flame",
    offerCode: "NIGHTOWL",
    items: [
      { itemName: "Tokyo Fire Chicken Bowl", quantity: 1, addonNames: ["Soft Egg"] },
      { itemName: "Salmon Aburi Roll", quantity: 1, addonNames: ["Wasabi Mayo"] },
    ],
  },
];
const orderSeedGroupA: OrderSeed[] = [
  {
    key: "order_001",
    userKey: "aditi_verma",
    addressKey: "aditi_home",
    restaurantSlug: "saffron-story",
    deliveryPartnerKey: "ravi_kumar",
    offerCode: "LUXE50",
    selections: [
      { itemName: "Old Delhi Butter Chicken", quantity: 1, addonNames: ["Laccha Paratha Pair"] },
      { itemName: "Dum Gosht Biryani Royale", quantity: 1, addonNames: ["Raita Tub"] },
      { itemName: "Saffron Phirni Jar", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.UPI,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 52,
    review: {
      rating: 5,
      reviewText: "Arrived piping hot, the biryani was deeply fragrant and the packaging felt premium.",
    },
  },
  {
    key: "order_002",
    userKey: "rohit_bansal",
    addressKey: "rohit_home",
    restaurantSlug: "coastal-copper",
    deliveryPartnerKey: "imran_sheikh",
    selections: [
      { itemName: "Malabar Prawn Curry", quantity: 1, addonNames: ["Appam Pair"] },
      { itemName: "Filter Coffee Tiramisu", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 28,
    review: {
      rating: 4,
      reviewText: "Great coastal flavours and really quick delivery. Would reorder the curry for sure.",
    },
  },
  {
    key: "order_003",
    userKey: "meera_nair",
    addressKey: "meera_home",
    restaurantSlug: "truffle-theory",
    offerCode: "DATEDELIGHT",
    selections: [
      { itemName: "Wild Mushroom Truffle Risotto", quantity: 1, addonNames: ["Parmesan Crisp"] },
      { itemName: "Burrata Pomodoro Bruschetta", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.PREPARING,
    placedHoursAgo: 2,
    specialInstructions: "Please keep the bruschetta crisp-packed.",
  },
  {
    key: "order_004",
    userKey: "ishaan_khanna",
    addressKey: "ishaan_home",
    restaurantSlug: "kuro-flame",
    deliveryPartnerKey: "deepak_nair",
    selections: [
      { itemName: "Tokyo Fire Chicken Bowl", quantity: 1, addonNames: ["Soft Egg"] },
      { itemName: "Miso Corn Crisps", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.UPI,
    status: OrderStatus.OUT_FOR_DELIVERY,
    placedHoursAgo: 1,
  },
  {
    key: "order_005",
    userKey: "priya_menon",
    addressKey: "priya_home",
    restaurantSlug: "ember-grill-house",
    selections: [
      { itemName: "Tennessee BBQ Chicken Steak", quantity: 1, addonNames: ["Loaded Mash"] },
      { itemName: "Parmesan Truffle Fries", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.WALLET,
    status: OrderStatus.CANCELLED,
    placedHoursAgo: 3,
  },
  {
    key: "order_006",
    userKey: "kunal_deshpande",
    addressKey: "kunal_home",
    restaurantSlug: "verdant-bowl-club",
    deliveryPartnerKey: "pooja_yadav",
    offerCode: "HEALTHY25",
    selections: [
      { itemName: "Harissa Falafel Power Bowl", quantity: 1, addonNames: ["Extra Hummus"] },
      { itemName: "Pistachio Greek Yogurt Parfait", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.UPI,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 96,
    review: {
      rating: 5,
      reviewText: "Fresh, balanced, and honestly one of the best healthy bowls I've ordered lately.",
    },
  },
  {
    key: "order_007",
    userKey: "simran_bedi",
    addressKey: "simran_home",
    restaurantSlug: "crumble-and-co",
    deliveryPartnerKey: "salman_ansari",
    offerCode: "FIRSTFEAST",
    selections: [
      { itemName: "Lemon Ricotta Pancakes", quantity: 1 },
      { itemName: "Caramel Sea Salt Latte", quantity: 2 },
      { itemName: "Biscoff Cheesecake Cup", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 6,
    review: {
      rating: 4,
      reviewText: "The pancakes were beautiful and the latte survived the ride better than expected.",
    },
  },
];
const orderSeedGroupB: OrderSeed[] = [
  {
    key: "order_008",
    userKey: "arjun_sethi",
    addressKey: "arjun_home",
    restaurantSlug: "dum-house-47",
    deliveryPartnerKey: "ravi_kumar",
    selections: [
      { itemName: "Chili Garlic Chicken Bao", quantity: 2 },
      { itemName: "Burnt Garlic Hakka Noodles", quantity: 1, addonNames: ["Chili Oil Drizzle"] },
    ],
    paymentMethod: PaymentMethod.COD,
    status: OrderStatus.ACCEPTED,
    placedHoursAgo: 0.5,
  },
  {
    key: "order_009",
    userKey: "neha_kulkarni",
    addressKey: "neha_home",
    restaurantSlug: "nawab-reserve",
    deliveryPartnerKey: "imran_sheikh",
    offerCode: "DATEDELIGHT",
    selections: [
      { itemName: "Awadhi Galouti Platter", quantity: 1 },
      { itemName: "Lucknowi Muradabadi Biryani", quantity: 1, addonNames: ["Mirchi Salan"] },
      { itemName: "Shahi Tukda Mille-Feuille", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 120,
    review: {
      rating: 5,
      reviewText: "The galouti was unreal and the dessert felt restaurant-quality even at home.",
    },
  },
  {
    key: "order_010",
    userKey: "dev_patel",
    addressKey: "dev_home",
    restaurantSlug: "millet-and-spice",
    deliveryPartnerKey: "pooja_yadav",
    offerCode: "HEALTHY25",
    selections: [
      { itemName: "Mysore Masala Dosa Deluxe", quantity: 1, addonNames: ["Extra Potato Palya"] },
      { itemName: "Tamarind Sambar Meal", quantity: 1 },
      { itemName: "Elaneer Payasam Verrine", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.UPI,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 72,
    review: {
      rating: 4,
      reviewText: "Comforting food, clean packaging, and the payasam was especially lovely.",
    },
  },
  {
    key: "order_011",
    userKey: "aditi_verma",
    addressKey: "aditi_work",
    restaurantSlug: "kuro-flame",
    selections: [
      { itemName: "Salmon Aburi Roll", quantity: 1, addonNames: ["Wasabi Mayo"] },
      { itemName: "Black Garlic Ramen", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.PAYMENT_FAILED,
    placedHoursAgo: 24,
  },
  {
    key: "order_012",
    userKey: "rohit_bansal",
    addressKey: "rohit_home",
    restaurantSlug: "saffron-story",
    deliveryPartnerKey: "salman_ansari",
    offerCode: "DATEDELIGHT",
    selections: [
      { itemName: "Old Delhi Butter Chicken", quantity: 1 },
      { itemName: "Truffle Dal Makhani", quantity: 1, addonNames: ["Jeera Rice Portion"] },
      { itemName: "Garlic Roomali Basket", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.REFUNDED,
    placedHoursAgo: 48,
  },
  {
    key: "order_013",
    userKey: "meera_nair",
    addressKey: "meera_home",
    restaurantSlug: "verdant-bowl-club",
    offerCode: "HEALTHY25",
    selections: [
      { itemName: "Avocado Millet Sushi Bowl", quantity: 1 },
      { itemName: "Almond Date Protein Smoothie", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.WALLET,
    status: OrderStatus.PLACED,
    placedHoursAgo: 0.2,
  },
  {
    key: "order_014",
    userKey: "ishaan_khanna",
    addressKey: "ishaan_work",
    restaurantSlug: "ember-grill-house",
    deliveryPartnerKey: "ravi_kumar",
    selections: [
      { itemName: "Double Smash Luxe Burger", quantity: 1, addonNames: ["Cheese Drip"] },
      { itemName: "Parmesan Truffle Fries", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.UPI,
    status: OrderStatus.ACCEPTED,
    placedHoursAgo: 0.7,
  },
];
const orderSeedGroupC: OrderSeed[] = [
  {
    key: "order_015",
    userKey: "priya_menon",
    addressKey: "priya_parents",
    restaurantSlug: "coastal-copper",
    selections: [
      { itemName: "Mangalorean Ghee Roast Chicken", quantity: 1, addonNames: ["Extra Ghee Roast Masala"] },
      { itemName: "Neer Dosa Fold", quantity: 2, addonNames: ["Coconut Chutney Trio"] },
    ],
    paymentMethod: PaymentMethod.COD,
    status: OrderStatus.PREPARING,
    placedHoursAgo: 1.5,
  },
  {
    key: "order_016",
    userKey: "kunal_deshpande",
    addressKey: "kunal_home",
    restaurantSlug: "nawab-reserve",
    deliveryPartnerKey: "imran_sheikh",
    selections: [
      { itemName: "Zafrani Murgh Korma", quantity: 1, addonNames: ["Warqi Paratha"] },
      { itemName: "Lucknowi Muradabadi Biryani", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.OUT_FOR_DELIVERY,
    placedHoursAgo: 0.8,
  },
  {
    key: "order_017",
    userKey: "simran_bedi",
    addressKey: "simran_home",
    restaurantSlug: "truffle-theory",
    deliveryPartnerKey: "deepak_nair",
    offerCode: "DATEDELIGHT",
    selections: [
      { itemName: "Four Cheese Bianca Pizza", quantity: 1, addonNames: ["Wild Rocket Salad"] },
      { itemName: "Tiramisu Cloud Slice", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 192,
    review: {
      rating: 5,
      reviewText: "Impressive quality, great crust, and the dessert was worth every rupee.",
    },
  },
  {
    key: "order_018",
    userKey: "arjun_sethi",
    addressKey: "arjun_home",
    restaurantSlug: "crumble-and-co",
    selections: [
      { itemName: "Brown Butter Croissant Sandwich", quantity: 1 },
      { itemName: "Caramel Sea Salt Latte", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.COD,
    status: OrderStatus.CANCELLED,
    placedHoursAgo: 26,
  },
  {
    key: "order_019",
    userKey: "neha_kulkarni",
    addressKey: "neha_home",
    restaurantSlug: "dum-house-47",
    deliveryPartnerKey: "salman_ansari",
    selections: [
      { itemName: "Kung Pao Chicken Rice", quantity: 1 },
      { itemName: "Mango Sago Pot", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.UPI,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 168,
    review: {
      rating: 4,
      reviewText: "Packed really well and the rice bowl hit the right sweet-spicy balance.",
    },
  },
  {
    key: "order_020",
    userKey: "dev_patel",
    addressKey: "dev_home",
    restaurantSlug: "saffron-story",
    deliveryPartnerKey: "ravi_kumar",
    offerCode: "LUXE50",
    selections: [
      { itemName: "Charcoal Paneer Tikka", quantity: 1, addonNames: ["Mint Yogurt Dip"] },
      { itemName: "Truffle Dal Makhani", quantity: 1, addonNames: ["Jeera Rice Portion"] },
      { itemName: "Saffron Phirni Jar", quantity: 1 },
    ],
    paymentMethod: PaymentMethod.WALLET,
    status: OrderStatus.DELIVERED,
    placedHoursAgo: 288,
    review: {
      rating: 5,
      reviewText: "Vegetarian comfort food done right. The dal was rich without feeling heavy.",
    },
  },
];
const orderSeeds = [...orderSeedGroupA, ...orderSeedGroupB, ...orderSeedGroupC];
const notificationSeeds: Array<{
  userKey: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
}> = [
  {
    userKey: "aditi_verma",
    type: NotificationType.ORDER,
    title: "Order delivered",
    message: "Your Saffron Story order has been delivered. Rate your meal to help other foodies.",
    isRead: false,
  },
  {
    userKey: "aditi_verma",
    type: NotificationType.OFFER,
    title: "Premium dinner offer unlocked",
    message: "Use LUXE50 on your next order above Rs. 499 and save instantly.",
    isRead: true,
  },
  {
    userKey: "meera_nair",
    type: NotificationType.ORDER,
    title: "Kitchen is preparing your order",
    message: "Truffle Theory has started preparing your meal.",
    isRead: false,
  },
  {
    userKey: "ishaan_khanna",
    type: NotificationType.ORDER,
    title: "Rider is on the way",
    message: "Deepak is heading to your doorstep with your Kuro Flame order.",
    isRead: false,
  },
  {
    userKey: "priya_menon",
    type: NotificationType.PAYMENT,
    title: "Wallet refund initiated",
    message: "Your cancelled Ember Grill House order is being refunded to your wallet.",
    isRead: false,
  },
  {
    userKey: "kunal_deshpande",
    type: NotificationType.ORDER,
    title: "Delivered with care",
    message: "Your Verdant Bowl Club order has been completed successfully.",
    isRead: true,
  },
  {
    userKey: "simran_bedi",
    type: NotificationType.ORDER,
    title: "Brunch just landed",
    message: "Crumble & Co. has delivered your order. Enjoy your brunch set.",
    isRead: false,
  },
  {
    userKey: "arjun_sethi",
    type: NotificationType.ORDER,
    title: "Restaurant accepted your order",
    message: "Dum House 47 has accepted your order and will start cooking shortly.",
    isRead: false,
  },
  {
    userKey: "neha_kulkarni",
    type: NotificationType.ORDER,
    title: "Your royal feast was delivered",
    message: "Nawab Reserve marked your order as delivered. Share your review when ready.",
    isRead: true,
  },
  {
    userKey: "dev_patel",
    type: NotificationType.OFFER,
    title: "Healthy dining offer active",
    message: "HEALTHY25 is now valid on Millet & Spice and Verdant Bowl Club.",
    isRead: false,
  },
  {
    userKey: "aarav_mehta",
    type: NotificationType.SYSTEM,
    title: "Menu performance insight",
    message: "Dum House 47's bao category is trending higher than last week.",
    isRead: false,
  },
  {
    userKey: "ravi_kumar",
    type: NotificationType.ORDER,
    title: "New pickup assigned",
    message: "You have been assigned a pickup from Saffron Story.",
    isRead: false,
  },
];

const statusProgression = (status: OrderStatus): OrderStatus[] => {
  switch (status) {
    case OrderStatus.PLACED:
      return [OrderStatus.PLACED];
    case OrderStatus.ACCEPTED:
      return [OrderStatus.PLACED, OrderStatus.ACCEPTED];
    case OrderStatus.PREPARING:
      return [OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING];
    case OrderStatus.OUT_FOR_DELIVERY:
      return [
        OrderStatus.PLACED,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.OUT_FOR_DELIVERY,
      ];
    case OrderStatus.DELIVERED:
      return [
        OrderStatus.PLACED,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
      ];
    case OrderStatus.CANCELLED:
      return [OrderStatus.PLACED, OrderStatus.CANCELLED];
    case OrderStatus.PAYMENT_FAILED:
      return [OrderStatus.PLACED, OrderStatus.PAYMENT_FAILED];
    case OrderStatus.REFUNDED:
      return [OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.REFUNDED];
    default:
      return [OrderStatus.PLACED];
  }
};

const paymentStatusForOrder = (status: OrderStatus, method: PaymentMethod) => {
  if (status === OrderStatus.PAYMENT_FAILED) {
    return PaymentStatus.FAILED;
  }

  if (status === OrderStatus.REFUNDED) {
    return PaymentStatus.REFUNDED;
  }

  if (method === PaymentMethod.COD) {
    return status === OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.PENDING;
  }

  if (status === OrderStatus.CANCELLED) {
    return PaymentStatus.REFUNDED;
  }

  return PaymentStatus.PAID;
};

const paymentGatewayForMethod = (method: PaymentMethod) => {
  switch (method) {
    case PaymentMethod.CARD:
      return "Stripe";
    case PaymentMethod.UPI:
      return "Razorpay";
    case PaymentMethod.WALLET:
      return "Wallet";
    case PaymentMethod.NET_BANKING:
      return "PayU";
    case PaymentMethod.COD:
    default:
      return "Cash";
  }
};

async function clearDatabase() {
  await prisma.cartItemAddon.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItemAddon.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.orderStatusEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.favoriteRestaurant.deleteMany();
  await prisma.restaurantOffer.deleteMany();
  await prisma.deliveryDocument.deleteMany();
  await prisma.deliveryPartner.deleteMany();
  await prisma.itemAddon.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.restaurantHour.deleteMany();
  await prisma.restaurantCuisine.deleteMany();
  await prisma.restaurantCategoryMap.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.cuisine.deleteMany();
  await prisma.restaurantCategory.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.address.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const userMap = new Map<string, Awaited<ReturnType<typeof prisma.user.create>>>();
  const addressMap = new Map<string, Awaited<ReturnType<typeof prisma.address.create>>>();
  const restaurantMap = new Map<string, Awaited<ReturnType<typeof prisma.restaurant.create>>>();
  const deliveryPartnerMap = new Map<
    string,
    Awaited<ReturnType<typeof prisma.deliveryPartner.create>>
  >();
  const offerMap = new Map<string, Awaited<ReturnType<typeof prisma.offer.create>>>();
  const menuItemMap = new Map<string, Awaited<ReturnType<typeof prisma.menuItem.create>>>();
  const addonMap = new Map<string, Awaited<ReturnType<typeof prisma.itemAddon.create>>>();

  const allUsers = [adminSeed, ...ownerSeeds, ...deliveryPartnerSeeds, ...customerSeeds];
  for (const [index, userSeed] of allUsers.entries()) {
    const user = await prisma.user.create({
      data: {
        fullName: userSeed.fullName,
        email: userSeed.email,
        phone: userSeed.phone,
        passwordHash,
        profileImage: avatarUrl(userSeed.email),
        role: userSeed.role,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        walletBalance: decimal(userSeed.walletBalance ?? 0),
        lastLoginAt: BASE_DATE.subtract(index * 3 + 1, "hour").toDate(),
      },
    });

    userMap.set(userSeed.key, user);
  }

  for (const addressSeed of addressSeeds) {
    const address = await prisma.address.create({
      data: {
        userId: userMap.get(addressSeed.userKey)!.id,
        addressType: addressSeed.addressType,
        title: addressSeed.title,
        recipientName: addressSeed.recipientName,
        contactPhone: addressSeed.contactPhone,
        houseNo: addressSeed.houseNo,
        street: addressSeed.street,
        landmark: addressSeed.landmark,
        area: addressSeed.area,
        city: addressSeed.city,
        state: addressSeed.state,
        pincode: addressSeed.pincode,
        latitude: decimal(addressSeed.latitude),
        longitude: decimal(addressSeed.longitude),
        isDefault: Boolean(addressSeed.isDefault),
        isServiceable: true,
      },
    });

    addressMap.set(addressSeed.key, address);
  }

  for (const categorySeed of restaurantCategorySeeds) {
    await prisma.restaurantCategory.create({ data: categorySeed });
  }

  const categoryRecords = await prisma.restaurantCategory.findMany();
  const categoryMap = new Map(categoryRecords.map((item) => [item.name, item]));

  for (const cuisineName of cuisineSeeds) {
    await prisma.cuisine.create({ data: { name: cuisineName } });
  }

  const cuisineRecords = await prisma.cuisine.findMany();
  const cuisineMap = new Map(cuisineRecords.map((item) => [item.name, item]));

  for (const offerSeed of offerSeeds) {
    const offer = await prisma.offer.create({
      data: {
        code: offerSeed.code,
        title: offerSeed.title,
        description: offerSeed.description,
        discountType: offerSeed.discountType,
        discountValue: decimal(offerSeed.discountValue),
        minOrderAmount: decimal(offerSeed.minOrderAmount),
        maxDiscount: offerSeed.maxDiscount ? decimal(offerSeed.maxDiscount) : null,
        scope: offerSeed.scope,
        usageLimit: 500,
        perUserLimit: 3,
        startDate: BASE_DATE.subtract(15, "day").toDate(),
        endDate: BASE_DATE.add(45, "day").toDate(),
        isActive: true,
      },
    });

    offerMap.set(offerSeed.code, offer);
  }

  for (const restaurantSeed of restaurantSeeds) {
    const restaurant = await prisma.restaurant.create({
      data: {
        ownerId: userMap.get(restaurantSeed.ownerKey)!.id,
        name: restaurantSeed.name,
        slug: restaurantSeed.slug,
        description: restaurantSeed.description,
        email: restaurantSeed.email,
        phone: restaurantSeed.phone,
        coverImage: restaurantSeed.coverImage,
        logoImage: logoUrl(restaurantSeed.logoText),
        licenseNumber: restaurantSeed.licenseNumber,
        openingTime: restaurantSeed.openingTime,
        closingTime: restaurantSeed.closingTime,
        addressLine: restaurantSeed.addressLine,
        area: restaurantSeed.area,
        city: restaurantSeed.city,
        state: restaurantSeed.state,
        pincode: restaurantSeed.pincode,
        latitude: decimal(restaurantSeed.latitude),
        longitude: decimal(restaurantSeed.longitude),
        avgRating: decimal(0),
        totalReviews: 0,
        costForTwo: decimal(restaurantSeed.costForTwo),
        avgDeliveryTime: restaurantSeed.avgDeliveryTime,
        isVegOnly: restaurantSeed.isVegOnly,
        isActive: true,
        isFeatured: Boolean(restaurantSeed.isFeatured),
      },
    });

    restaurantMap.set(restaurantSeed.slug, restaurant);

    for (const categoryName of restaurantSeed.categories) {
      await prisma.restaurantCategoryMap.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: categoryMap.get(categoryName)!.id,
        },
      });
    }

    for (const cuisineName of restaurantSeed.cuisines) {
      await prisma.restaurantCuisine.create({
        data: {
          restaurantId: restaurant.id,
          cuisineId: cuisineMap.get(cuisineName)!.id,
        },
      });
    }

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      await prisma.restaurantHour.create({
        data: {
          restaurantId: restaurant.id,
          dayOfWeek,
          openTime: restaurantSeed.openingTime,
          closeTime: restaurantSeed.closingTime,
          isClosed: false,
        },
      });
    }

    const menuCategoryMap = new Map<string, Awaited<ReturnType<typeof prisma.menuCategory.create>>>();
    for (const menuCategorySeed of restaurantSeed.menuCategories) {
      const category = await prisma.menuCategory.create({
        data: {
          restaurantId: restaurant.id,
          name: menuCategorySeed.name,
          description: menuCategorySeed.description,
          isActive: true,
          sortOrder: menuCategorySeed.sortOrder,
        },
      });

      menuCategoryMap.set(menuCategorySeed.name, category);
    }

    for (const menuItemSeed of restaurantSeed.menuItems) {
      const menuItem = await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: menuCategoryMap.get(menuItemSeed.categoryName)!.id,
          name: menuItemSeed.name,
          description: menuItemSeed.description,
          image: menuItemSeed.image ?? restaurantSeed.coverImage,
          price: decimal(menuItemSeed.price),
          discountPrice: menuItemSeed.discountPrice ? decimal(menuItemSeed.discountPrice) : null,
          foodType: menuItemSeed.foodType,
          isAvailable: true,
          isRecommended: Boolean(menuItemSeed.isRecommended),
          preparationTime: menuItemSeed.preparationTime,
          calories: menuItemSeed.calories,
          spiceLevel: menuItemSeed.spiceLevel,
        },
      });

      menuItemMap.set(`${restaurantSeed.slug}:${menuItemSeed.name}`, menuItem);

      for (const addonSeed of menuItemSeed.addons ?? []) {
        const addon = await prisma.itemAddon.create({
          data: {
            menuItemId: menuItem.id,
            name: addonSeed.name,
            price: decimal(addonSeed.price),
            isActive: true,
          },
        });

        addonMap.set(`${restaurantSeed.slug}:${menuItemSeed.name}:${addonSeed.name}`, addon);
      }
    }

    for (const offerCode of restaurantSeed.linkedOffers ?? []) {
      await prisma.restaurantOffer.create({
        data: {
          restaurantId: restaurant.id,
          offerId: offerMap.get(offerCode)!.id,
        },
      });
    }
  }

  for (const deliverySeed of deliveryPartnerSeeds) {
    const deliveryPartner = await prisma.deliveryPartner.create({
      data: {
        userId: userMap.get(deliverySeed.key)!.id,
        vehicleType: deliverySeed.vehicleType,
        vehicleNumber: deliverySeed.vehicleNumber,
        licenseNumber: deliverySeed.licenseNumber,
        availabilityStatus: deliverySeed.availabilityStatus,
        currentLatitude: decimal(deliverySeed.currentLatitude),
        currentLongitude: decimal(deliverySeed.currentLongitude),
        avgRating: decimal(deliverySeed.avgRating),
        totalDeliveries: 0,
        isVerified: Boolean(deliverySeed.isVerified),
      },
    });

    deliveryPartnerMap.set(deliverySeed.key, deliveryPartner);

    await prisma.deliveryDocument.createMany({
      data: [
        {
          deliveryPartnerId: deliveryPartner.id,
          name: "Driving License",
          fileUrl: `https://docs.zomatoluxe.dev/licenses/${deliveryPartner.id}.pdf`,
          status: DocumentStatus.APPROVED,
          uploadedAt: BASE_DATE.subtract(35, "day").toDate(),
          reviewedAt: BASE_DATE.subtract(30, "day").toDate(),
        },
        {
          deliveryPartnerId: deliveryPartner.id,
          name: "Vehicle RC",
          fileUrl: `https://docs.zomatoluxe.dev/vehicle-rc/${deliveryPartner.id}.pdf`,
          status: DocumentStatus.APPROVED,
          uploadedAt: BASE_DATE.subtract(34, "day").toDate(),
          reviewedAt: BASE_DATE.subtract(29, "day").toDate(),
        },
      ],
    });
  }

  for (const [userKey, restaurantSlug] of favoriteSeeds) {
    await prisma.favoriteRestaurant.create({
      data: {
        userId: userMap.get(userKey)!.id,
        restaurantId: restaurantMap.get(restaurantSlug)!.id,
      },
    });
  }

  for (const reservationSeed of reservationSeeds) {
    const user = userMap.get(reservationSeed.userKey)!;
    await prisma.reservation.create({
      data: {
        userId: user.id,
        restaurantId: restaurantMap.get(reservationSeed.restaurantSlug)!.id,
        reservationDate: reservationSeed.reservationDate,
        guests: reservationSeed.guests,
        slot: reservationSeed.slot,
        specialRequest: reservationSeed.specialRequest,
        contactPhone: user.phone,
        status: reservationSeed.status,
      },
    });
  }

  for (const cartSeed of cartSeeds) {
    const offer = cartSeed.offerCode ? offerMap.get(cartSeed.offerCode)! : null;
    const lines = cartSeed.items.map((selection) => {
      const menuItem = menuItemMap.get(`${cartSeed.restaurantSlug}:${selection.itemName}`)!;
      const unitPrice = (menuItem.discountPrice ?? menuItem.price);
      const selectedAddons = (selection.addonNames ?? []).map(
        (addonName) => addonMap.get(`${cartSeed.restaurantSlug}:${selection.itemName}:${addonName}`)!,
      );
      const addonTotal = selectedAddons.reduce((total, addon) => total + addon.price, 0);
      const totalPrice = roundMoney((unitPrice + addonTotal) * selection.quantity);

      return {
        menuItem,
        selectedAddons,
        quantity: selection.quantity,
        unitPrice,
        totalPrice,
        specialInstructions: selection.specialInstructions,
      };
    });

    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.totalPrice, 0));
    const deliveryFee = subtotal > 499 ? 29 : 49;
    const taxAmount = roundMoney(subtotal * 0.05);
    const discountAmount = offerDiscount(offer, subtotal);

    const cart = await prisma.cart.create({
      data: {
        userId: userMap.get(cartSeed.userKey)!.id,
        restaurantId: restaurantMap.get(cartSeed.restaurantSlug)!.id,
        offerId: offer?.id,
        totalAmount: decimal(subtotal),
        discountAmount: decimal(discountAmount),
        deliveryFee: decimal(deliveryFee),
        taxAmount: decimal(taxAmount),
      },
    });

    for (const line of lines) {
      const cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: line.menuItem.id,
          quantity: line.quantity,
          itemPrice: decimal(line.unitPrice),
          totalPrice: decimal(line.totalPrice),
          specialInstructions: line.specialInstructions,
        },
      });

      for (const addon of line.selectedAddons) {
        await prisma.cartItemAddon.create({
          data: {
            cartItemId: cartItem.id,
            addonId: addon.id,
            addonPrice: addon.price,
          },
        });
      }
    }
  }

  for (const [index, orderSeed] of orderSeeds.entries()) {
    const restaurant = restaurantMap.get(orderSeed.restaurantSlug)!;
    const offer = orderSeed.offerCode ? offerMap.get(orderSeed.offerCode)! : null;
    const customer = userMap.get(orderSeed.userKey)!;
    const address = addressMap.get(orderSeed.addressKey)!;
    const deliveryPartner = orderSeed.deliveryPartnerKey
      ? deliveryPartnerMap.get(orderSeed.deliveryPartnerKey)!
      : null;

    const lineItems = orderSeed.selections.map((selection) => {
      const menuItem = menuItemMap.get(`${orderSeed.restaurantSlug}:${selection.itemName}`)!;
      const itemPrice = (menuItem.discountPrice ?? menuItem.price);
      const selectedAddons = (selection.addonNames ?? []).map(
        (addonName) => addonMap.get(`${orderSeed.restaurantSlug}:${selection.itemName}:${addonName}`)!,
      );
      const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
      const totalPrice = roundMoney((itemPrice + addonTotal) * selection.quantity);

      return {
        menuItem,
        selectedAddons,
        quantity: selection.quantity,
        itemPrice,
        totalPrice,
      };
    });

    const subtotal = roundMoney(lineItems.reduce((sum, line) => sum + line.totalPrice, 0));
    const deliveryFee = subtotal > 599 ? 25 : 49;
    const taxAmount = roundMoney(subtotal * 0.05);
    const discountAmount = offerDiscount(offer, subtotal);
    const totalAmount = roundMoney(subtotal + deliveryFee + taxAmount - discountAmount);
    const placedAt = BASE_DATE.subtract(orderSeed.placedHoursAgo, "hour");
    const progress = statusProgression(orderSeed.status);
    const acceptedAt = progress.includes(OrderStatus.ACCEPTED) ? placedAt.add(8, "minute") : null;
    const preparingAt = progress.includes(OrderStatus.PREPARING) ? placedAt.add(20, "minute") : null;
    const outForDeliveryAt = progress.includes(OrderStatus.OUT_FOR_DELIVERY)
      ? placedAt.add(45, "minute")
      : null;
    const deliveredAt = orderSeed.status === OrderStatus.DELIVERED ? placedAt.add(80, "minute") : null;
    const cancelledAt =
      orderSeed.status === OrderStatus.CANCELLED || orderSeed.status === OrderStatus.REFUNDED
        ? placedAt.add(28, "minute")
        : null;
    const paymentStatus = paymentStatusForOrder(orderSeed.status, orderSeed.paymentMethod);

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        restaurantId: restaurant.id,
        addressId: address.id,
        deliveryPartnerId: deliveryPartner?.id,
        offerId: offer?.id,
        orderNumber: `ZL-${String(10001 + index)}`,
        status: orderSeed.status,
        paymentStatus,
        paymentMethod: orderSeed.paymentMethod,
        subtotal: decimal(subtotal),
        deliveryFee: decimal(deliveryFee),
        taxAmount: decimal(taxAmount),
        discountAmount: decimal(discountAmount),
        totalAmount: decimal(totalAmount),
        specialInstructions: orderSeed.specialInstructions,
        orderedAt: placedAt.toDate(),
        acceptedAt: acceptedAt?.toDate(),
        preparingAt: preparingAt?.toDate(),
        outForDeliveryAt: outForDeliveryAt?.toDate(),
        deliveredAt: deliveredAt?.toDate(),
        cancelledAt: cancelledAt?.toDate(),
        createdAt: placedAt.toDate(),
        updatedAt:
          deliveredAt?.toDate() ??
          outForDeliveryAt?.toDate() ??
          preparingAt?.toDate() ??
          acceptedAt?.toDate() ??
          placedAt.toDate(),
      },
    });

    for (const lineItem of lineItems) {
      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: lineItem.menuItem.id,
          itemName: lineItem.menuItem.name,
          itemPrice: decimal(lineItem.itemPrice),
          quantity: lineItem.quantity,
          totalPrice: decimal(lineItem.totalPrice),
          foodType: lineItem.menuItem.foodType,
        },
      });

      for (const addon of lineItem.selectedAddons) {
        await prisma.orderItemAddon.create({
          data: {
            orderItemId: orderItem.id,
            addonName: addon.name,
            addonPrice: addon.price,
          },
        });
      }
    }

    const paymentTimestamp =
      paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.REFUNDED
        ? placedAt.add(2, "minute").toDate()
        : null;

    await prisma.payment.create({
      data: {
        orderId: order.id,
        transactionId:
          orderSeed.paymentMethod === PaymentMethod.COD
            ? null
            : `TXN-${placedAt.format("YYMMDD")}-${String(index + 1).padStart(4, "0")}`,
        paymentGateway: paymentGatewayForMethod(orderSeed.paymentMethod),
        amount: decimal(totalAmount),
        status: paymentStatus,
        paidAt: paymentTimestamp,
        createdAt: placedAt.add(1, "minute").toDate(),
        updatedAt: paymentTimestamp ?? placedAt.add(1, "minute").toDate(),
      },
    });

    for (const [stepIndex, status] of progress.entries()) {
      const actorId =
        status === OrderStatus.PLACED
          ? customer.id
          : status === OrderStatus.ACCEPTED || status === OrderStatus.PREPARING
            ? restaurant.ownerId
            : status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED
              ? userMap.get(orderSeed.deliveryPartnerKey ?? "")?.id ?? null
              : status === OrderStatus.REFUNDED
                ? userMap.get("aditya_sen")!.id
                : customer.id;

      const eventTime = placedAt.add(stepIndex * 18, "minute");
      await prisma.orderStatusEvent.create({
        data: {
          orderId: order.id,
          actorId,
          status,
          note:
            status === OrderStatus.OUT_FOR_DELIVERY
              ? "Rider picked up the order from the restaurant."
              : status === OrderStatus.DELIVERED
                ? "Order handed to customer successfully."
                : status === OrderStatus.PAYMENT_FAILED
                  ? "Payment authorization failed for this order."
                  : status === OrderStatus.REFUNDED
                    ? "Refund completed after order issue."
                    : null,
          latitude:
            status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED
              ? deliveryPartner?.currentLatitude ?? address.latitude
              : null,
          longitude:
            status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED
              ? deliveryPartner?.currentLongitude ?? address.longitude
              : null,
          createdAt: eventTime.toDate(),
        },
      });
    }

    if (orderSeed.review) {
      await prisma.review.create({
        data: {
          userId: customer.id,
          restaurantId: restaurant.id,
          orderId: order.id,
          rating: orderSeed.review.rating,
          reviewText: orderSeed.review.reviewText,
          createdAt: placedAt.add(3, "hour").toDate(),
          updatedAt: placedAt.add(3, "hour").toDate(),
        },
      });
    }
  }

  for (const notificationSeed of notificationSeeds) {
    await prisma.notification.create({
      data: {
        userId: userMap.get(notificationSeed.userKey)!.id,
        title: notificationSeed.title,
        message: notificationSeed.message,
        type: notificationSeed.type,
        isRead: notificationSeed.isRead,
        meta: "{}",
      },
    });
  }

  const restaurantsWithReviews = await prisma.restaurant.findMany({
    include: {
      reviews: true,
    },
  });

  for (const restaurant of restaurantsWithReviews) {
    const totalReviews = restaurant.reviews.length;
    const avgRating =
      totalReviews === 0
        ? 0
        : restaurant.reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        totalReviews,
        avgRating: decimal(avgRating),
      },
    });
  }

  const deliveryPartners = await prisma.deliveryPartner.findMany({
    include: {
      orders: true,
    },
  });

  for (const deliveryPartner of deliveryPartners) {
    const completedDeliveries = deliveryPartner.orders.filter(
      (order) => order.status === OrderStatus.DELIVERED,
    ).length;

    await prisma.deliveryPartner.update({
      where: { id: deliveryPartner.id },
      data: {
        totalDeliveries: completedDeliveries,
      },
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
