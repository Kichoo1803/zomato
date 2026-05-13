import { Prisma } from "@prisma/client";
import { FoodType, Role } from "../../constants/enums.js";
import {
  CUSTOMER_RESTAURANT_RADIUS_KM,
  MAX_CUSTOMER_RESTAURANT_RADIUS_KM,
} from "../../constants/location.js";
import { StatusCodes } from "http-status-codes";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import {
  buildAddressSearchText,
  geocodeAddressText,
} from "../../utils/geo.js";
import {
  buildBoundingBoxFromCoordinates,
  getLatLngFromRestaurant,
  getLatLngFromUserLocation,
  getRoundedDistanceKm,
} from "../../utils/location.js";
import { getPagination, getPaginationMeta } from "../../utils/pagination.js";
import { slugify } from "../../utils/slug.js";
import {
  getRegionDistrictVariants,
  normalizeRegionValue,
  resolveCanonicalRegionDistrict,
  resolveCanonicalRegionState,
} from "../../utils/regions.js";
import { resolveRegionIdForAssignment } from "../regions/regions.service.js";

const listSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImage: true,
  logoImage: true,
  addressLine: true,
  area: true,
  city: true,
  state: true,
  pincode: true,
  latitude: true,
  longitude: true,
  isActive: true,
  avgRating: true,
  totalReviews: true,
  costForTwo: true,
  avgDeliveryTime: true,
  preparationTime: true,
  isVegOnly: true,
  isFeatured: true,
  cuisineMappings: {
    select: {
      cuisine: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  offers: {
    select: {
      offer: {
        select: {
          id: true,
          code: true,
          title: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  },
  region: {
    select: {
      districtName: true,
      stateName: true,
    },
  },
} satisfies Prisma.RestaurantSelect;

const searchMatchMenuItemSelect = {
  id: true,
  restaurantId: true,
  categoryId: true,
  name: true,
  description: true,
  image: true,
  price: true,
  discountPrice: true,
  foodType: true,
  isAvailable: true,
  isRecommended: true,
  preparationTime: true,
  calories: true,
  spiceLevel: true,
  addons: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.MenuItemSelect;

const publicDetailSelect = {
  ...listSelect,
  isActive: true,
  openingTime: true,
  closingTime: true,
  addressLine: true,
  state: true,
  pincode: true,
  categoryMappings: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  operatingHours: {
    orderBy: {
      dayOfWeek: "asc",
    },
  },
  menuCategories: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: [{ isRecommended: "desc" }, { createdAt: "desc" }],
        include: {
          addons: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  },
  combos: {
    where: { isActive: true },
    orderBy: [{ isAvailable: "desc" }, { createdAt: "desc" }],
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              image: true,
              price: true,
              discountPrice: true,
              foodType: true,
              isAvailable: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      addons: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  },
  reviews: {
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          profileImage: true,
        },
      },
    },
  },
} satisfies Prisma.RestaurantSelect;

const detailSelect = {
  ...publicDetailSelect,
  ownerId: true,
  phone: true,
  email: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.RestaurantSelect;

const ownerSummarySelect = {
  id: true,
  name: true,
  slug: true,
  area: true,
  city: true,
  state: true,
  isActive: true,
  isFeatured: true,
  isVegOnly: true,
} satisfies Prisma.RestaurantSelect;

const adminListSelect = {
  id: true,
  ownerId: true,
  name: true,
  slug: true,
  description: true,
  email: true,
  phone: true,
  addressLine: true,
  city: true,
  state: true,
  pincode: true,
  area: true,
  coverImage: true,
  avgRating: true,
  totalReviews: true,
  avgDeliveryTime: true,
  preparationTime: true,
  latitude: true,
  longitude: true,
  isVegOnly: true,
  isFeatured: true,
  isActive: true,
  costForTwo: true,
  createdAt: true,
  owner: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  categoryMappings: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  cuisineMappings: {
    select: {
      cuisine: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  _count: {
    select: {
      menuItems: true,
      orders: true,
      reviews: true,
    },
  },
} satisfies Prisma.RestaurantSelect;

const adminDetailSelect = {
  ...detailSelect,
  owner: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      profileImage: true,
    },
  },
  _count: {
    select: {
      menuItems: true,
      orders: true,
      reviews: true,
    },
  },
} satisfies Prisma.RestaurantSelect;

const getRestaurantOrderBy = (sort?: string): Prisma.RestaurantOrderByWithRelationInput[] => {
  switch (sort) {
    case "rating":
      return [{ avgRating: "desc" }, { totalReviews: "desc" }];
    case "delivery_time":
      return [{ avgDeliveryTime: "asc" }, { avgRating: "desc" }];
    case "cost_asc":
      return [{ costForTwo: "asc" }, { avgRating: "desc" }];
    case "cost_desc":
      return [{ costForTwo: "desc" }, { avgRating: "desc" }];
    case "popularity":
    default:
      return [{ totalReviews: "desc" }, { avgRating: "desc" }, { createdAt: "desc" }];
  }
};

const MENU_MATCH_LIMIT_PER_RESTAURANT = 4;
const FOOD_DISCOVERY_KEYWORDS: Record<string, string[]> = {
  biryani: ["Biryani", "Dum", "Rice"],
  pizza: ["Pizza", "Pizzas", "Flatbread"],
  burger: ["Burger", "Burgers", "Slider", "Sliders"],
  "south indian": ["South Indian", "Dosa", "Idli", "Uttapam", "Kaapi", "Sambar"],
  "north indian": ["North Indian", "Mughlai", "Naan", "Kebab", "Tikka", "Curry", "Paneer", "Thali"],
  chinese: ["Chinese", "Noodle", "Noodles", "Fried Rice", "Dimsum", "Manchurian", "Wok"],
  "fast food": ["Fast Food", "Quick Bites", "Burger", "Burgers", "Fries", "Taco", "Tacos", "Wrap", "Wraps"],
  desserts: ["Dessert", "Desserts", "Sweet", "Sweets", "Cake", "Cheesecake", "Brownie", "Pastry", "Payasam"],
  beverages: ["Beverage", "Beverages", "Drink", "Drinks", "Coffee", "Tea", "Juice", "Shake", "Soda", "Kaapi"],
};

const normalizeDiscoverySearchText = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const stripDiacritics = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const normalizeComparableLocationText = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);

  if (!normalizedValue) {
    return null;
  }

  const comparableValue = stripDiacritics(normalizedValue)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[,+]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return comparableValue || null;
};
const normalizeComparablePincode = (value?: string | null) => {
  const normalizedValue = value?.replace(/\D+/g, "").trim();
  return normalizedValue ? normalizedValue : null;
};
const normalizeComparableState = (state?: string | null) =>
  normalizeComparableLocationText(resolveCanonicalRegionState(state) ?? state);
const normalizeComparableDistrict = (state?: string | null, district?: string | null) =>
  normalizeComparableLocationText(resolveCanonicalRegionDistrict(state, district) ?? district);
const includesLocationText = (haystack?: string | null, needle?: string | null) => {
  const normalizedHaystack = normalizeComparableLocationText(haystack);
  const normalizedNeedle = normalizeComparableLocationText(needle);

  if (!normalizedHaystack || !normalizedNeedle) {
    return false;
  }

  return normalizedHaystack.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedHaystack);
};

type DiscoveryLocationTextContext = {
  address: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  comparableAddress: string | null;
  comparableArea: string | null;
  comparableCity: string | null;
  comparableDistrict: string | null;
  comparableState: string | null;
  comparablePincode: string | null;
};

type DiscoveryLocationMatchMode = "coordinates" | "location_text";

const buildDiscoveryLocationTextContext = (query: Record<string, unknown>): DiscoveryLocationTextContext => {
  const address = normalizeRegionValue(typeof query.address === "string" ? query.address : null);
  const area = normalizeRegionValue(typeof query.area === "string" ? query.area : null);
  const city = normalizeRegionValue(typeof query.city === "string" ? query.city : null);
  const state = normalizeRegionValue(typeof query.state === "string" ? query.state : null);
  const district = normalizeRegionValue(typeof query.district === "string" ? query.district : null);
  const pincode =
    normalizeRegionValue(typeof query.pincode === "string" ? query.pincode : null) ??
    normalizeComparablePincode(typeof query.pincode === "string" ? query.pincode : null);

  return {
    address,
    area,
    city,
    district,
    state,
    pincode,
    comparableAddress: normalizeComparableLocationText(address),
    comparableArea: normalizeComparableLocationText(area),
    comparableCity: normalizeComparableLocationText(city),
    comparableDistrict: normalizeComparableDistrict(state, district),
    comparableState: normalizeComparableState(state),
    comparablePincode: normalizeComparablePincode(pincode),
  };
};

const hasDiscoveryLocationText = (location: DiscoveryLocationTextContext) =>
  Boolean(
    location.comparablePincode ||
      location.comparableCity ||
      location.comparableDistrict ||
      location.comparableArea ||
      location.comparableAddress,
  );

const buildInsensitiveContains = (value: string) => ({
  contains: value,
  mode: "insensitive" as const,
});

const buildInsensitiveEquals = (value: string) => ({
  equals: value,
  mode: "insensitive" as const,
});

const getFoodDiscoveryKeywords = (value?: string | null) => {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) {
    return [];
  }

  const normalizedValue = normalizeDiscoverySearchText(trimmedValue);
  return [...new Set([trimmedValue, ...(FOOD_DISCOVERY_KEYWORDS[normalizedValue] ?? [])])];
};

const buildMenuItemTextClause = (value: string): Prisma.MenuItemWhereInput => ({
  OR: [
    { name: buildInsensitiveContains(value) },
    { description: buildInsensitiveContains(value) },
    { category: { name: buildInsensitiveContains(value) } },
  ],
});

const buildRestaurantTextSearchClause = (value: string): Prisma.RestaurantWhereInput => ({
  OR: [
    { name: buildInsensitiveContains(value) },
    { area: buildInsensitiveContains(value) },
    { city: buildInsensitiveContains(value) },
    { state: buildInsensitiveContains(value) },
    { pincode: buildInsensitiveContains(value) },
    { addressLine: buildInsensitiveContains(value) },
    { owner: { is: { fullName: buildInsensitiveContains(value) } } },
    { region: { is: { districtName: buildInsensitiveContains(value) } } },
    { categoryMappings: { some: { category: { name: buildInsensitiveContains(value) } } } },
    { cuisineMappings: { some: { cuisine: { name: buildInsensitiveContains(value) } } } },
    { menuItems: { some: buildMenuItemTextClause(value) } },
  ],
});

const buildRestaurantFoodCategoryClause = (value?: string | null): Prisma.RestaurantWhereInput | null => {
  const keywords = getFoodDiscoveryKeywords(value);
  if (!keywords.length) {
    return null;
  }

  return {
    OR: [
      ...keywords.map((keyword) => ({ name: buildInsensitiveContains(keyword) })),
      ...keywords.map((keyword) => ({
        categoryMappings: {
          some: {
            category: {
              name: buildInsensitiveContains(keyword),
            },
          },
        },
      })),
      ...keywords.map((keyword) => ({
        cuisineMappings: {
          some: {
            cuisine: {
              name: buildInsensitiveContains(keyword),
            },
          },
        },
      })),
      {
        menuItems: {
          some: {
            OR: keywords.map((keyword) => buildMenuItemTextClause(keyword)),
          },
        },
      },
    ],
  };
};

const buildMenuItemMatchWhere = ({
  foodCategory,
  search,
}: {
  foodCategory?: string;
  search?: string;
}): Prisma.MenuItemWhereInput => {
  const clauses: Prisma.MenuItemWhereInput[] = [{ isAvailable: true }];
  const normalizedSearch = search?.trim() ?? "";
  const foodDiscoveryKeywords = getFoodDiscoveryKeywords(foodCategory);

  if (normalizedSearch) {
    clauses.push(buildMenuItemTextClause(normalizedSearch));
  }

  if (foodDiscoveryKeywords.length) {
    clauses.push({
      OR: foodDiscoveryKeywords.map((keyword) => buildMenuItemTextClause(keyword)),
    });
  }

  return {
    AND: clauses,
  };
};

const getDiscoveryOrigin = (query: Record<string, unknown>) => {
  return getLatLngFromUserLocation(query);
};

const getDiscoveryRadiusKm = (radiusKm: unknown) => {
  const requestedRadiusKm =
    typeof radiusKm === "number" && Number.isFinite(radiusKm) && radiusKm >= 0
      ? radiusKm
      : CUSTOMER_RESTAURANT_RADIUS_KM;

  return Math.min(requestedRadiusKm, MAX_CUSTOMER_RESTAURANT_RADIUS_KM);
};

const shouldIncludeMenuMatches = (
  query: Record<string, unknown>,
  search: string,
  foodCategory: string,
) => Boolean(search || foodCategory) && query.includeMenuMatches === true;

const getNearbyRestaurantWhere = (
  where: Prisma.RestaurantWhereInput,
  origin: { latitude: number; longitude: number },
  radiusKm: number,
): Prisma.RestaurantWhereInput => {
  const boundingBox = buildBoundingBoxFromCoordinates(origin, radiusKm);

  return {
    AND: [
      where,
      {
        latitude: {
          not: null,
          gte: boundingBox.minLatitude,
          lte: boundingBox.maxLatitude,
        },
      },
      {
        longitude: {
          not: null,
          gte: boundingBox.minLongitude,
          lte: boundingBox.maxLongitude,
        },
      },
    ],
  };
};

type RestaurantDiscoveryLocationRecord = {
  id: number;
  name: string;
  isActive: boolean;
  addressLine?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  region?: {
    districtName: string;
    stateName: string;
  } | null;
};

const getRestaurantDistrict = (restaurant: RestaurantDiscoveryLocationRecord) =>
  normalizeRegionValue(restaurant.region?.districtName) ??
  normalizeRegionValue(restaurant.city) ??
  restaurant.city;

const buildRestaurantLocationAddress = (restaurant: RestaurantDiscoveryLocationRecord) =>
  buildAddressSearchText([
    restaurant.addressLine,
    restaurant.area,
    restaurant.city,
    getRestaurantDistrict(restaurant),
    restaurant.state,
    restaurant.pincode,
  ]);

const buildLocationTextCandidateWhere = (
  location: DiscoveryLocationTextContext,
): Prisma.RestaurantWhereInput | null => {
  if (!hasDiscoveryLocationText(location)) {
    return null;
  }

  const matchClauses: Prisma.RestaurantWhereInput[] = [];

  if (location.pincode) {
    matchClauses.push({ pincode: buildInsensitiveEquals(location.pincode) });
  }

  if (location.city) {
    matchClauses.push({ city: buildInsensitiveContains(location.city) });
  }

  if (location.district) {
    matchClauses.push({ region: { is: { districtName: buildInsensitiveContains(location.district) } } });
  }

  if (location.area) {
    matchClauses.push({ area: buildInsensitiveContains(location.area) });
    matchClauses.push({ addressLine: buildInsensitiveContains(location.area) });
  }

  if (location.address) {
    matchClauses.push({ addressLine: buildInsensitiveContains(location.address) });
  }

  if (!matchClauses.length) {
    return null;
  }

  if (!location.state) {
    return {
      OR: matchClauses,
    };
  }

  return {
    AND: [
      {
        OR: [
          { state: buildInsensitiveEquals(location.state) },
          { region: { is: { stateName: buildInsensitiveEquals(location.state) } } },
        ],
      },
      {
        OR: matchClauses,
      },
    ],
  };
};

const buildRestaurantDiscoveryCandidateWhere = ({
  allowGlobalResults,
  baseWhere,
  location,
  origin,
  radiusKm,
}: {
  allowGlobalResults: boolean;
  baseWhere: Prisma.RestaurantWhereInput;
  location: DiscoveryLocationTextContext;
  origin: { latitude: number; longitude: number } | null;
  radiusKm: number;
}): Prisma.RestaurantWhereInput => {
  if (!origin && !hasDiscoveryLocationText(location)) {
    return baseWhere;
  }

  const locationTextWhere = buildLocationTextCandidateWhere(location);
  const candidateClauses = [
    ...(origin ? [getNearbyRestaurantWhere(baseWhere, origin, radiusKm)] : []),
    ...(locationTextWhere ? [{ AND: [baseWhere, locationTextWhere] } satisfies Prisma.RestaurantWhereInput] : []),
  ];

  if (!candidateClauses.length || (!origin && !locationTextWhere && allowGlobalResults)) {
    return baseWhere;
  }

  if (candidateClauses.length === 1) {
    return candidateClauses[0]!;
  }

  return {
    OR: candidateClauses,
  };
};

const evaluateRestaurantDiscoveryLocationMatch = (
  restaurant: RestaurantDiscoveryLocationRecord,
  location: DiscoveryLocationTextContext,
  origin: { latitude: number; longitude: number } | null,
  radiusKm: number,
) => {
  const restaurantDistrict = getRestaurantDistrict(restaurant);
  const restaurantAddress = buildRestaurantLocationAddress(restaurant);
  const comparableRestaurantState = normalizeComparableState(restaurant.region?.stateName ?? restaurant.state);
  const comparableRestaurantDistrict = normalizeComparableDistrict(
    restaurant.region?.stateName ?? restaurant.state,
    restaurantDistrict,
  );
  const comparableRestaurantCity = normalizeComparableLocationText(restaurant.city);
  const comparableRestaurantPincode = normalizeComparablePincode(restaurant.pincode);

  const restaurantCoordinates = getLatLngFromRestaurant(restaurant);
  const hasDistanceCoordinates = Boolean(origin && restaurantCoordinates);
  const distanceKm = getRoundedDistanceKm(origin, restaurantCoordinates);
  const coordinateMatch = typeof distanceKm === "number" && distanceKm <= radiusKm;
  const canUseTextFallback = !origin || !restaurantCoordinates;

  const samePincode =
    Boolean(location.comparablePincode) && location.comparablePincode === comparableRestaurantPincode;
  const sameState =
    Boolean(location.comparableState) && location.comparableState === comparableRestaurantState;
  const sameDistrict =
    Boolean(location.comparableDistrict) && location.comparableDistrict === comparableRestaurantDistrict;
  const sameCity = Boolean(location.comparableCity) && location.comparableCity === comparableRestaurantCity;
  const areaOverlap =
    includesLocationText(restaurant.area, location.area) ||
    includesLocationText(restaurant.addressLine, location.area) ||
    includesLocationText(location.address, restaurant.area);
  const cityMentionedInAddress =
    includesLocationText(location.address, restaurant.city) ||
    includesLocationText(restaurantAddress, location.city);
  const districtMentionedInAddress =
    includesLocationText(location.address, restaurantDistrict) ||
    includesLocationText(restaurantAddress, location.district);

  const textMatch = canUseTextFallback && hasDiscoveryLocationText(location)
    ? samePincode ||
      (sameState && sameCity) ||
      (sameCity && sameDistrict) ||
      (sameState && sameDistrict && (areaOverlap || cityMentionedInAddress || districtMentionedInAddress))
    : false;

  const matchedBy: DiscoveryLocationMatchMode | null = coordinateMatch
    ? "coordinates"
    : textMatch
      ? "location_text"
      : null;
  const matchReason = coordinateMatch
    ? `within_${radiusKm}_km`
    : samePincode
      ? "same_pincode"
      : sameState && sameCity
        ? "same_state_city"
        : sameCity && sameDistrict
          ? "same_city_district"
          : sameState && sameDistrict && areaOverlap
            ? "same_state_district_area"
            : sameState && sameDistrict && (cityMentionedInAddress || districtMentionedInAddress)
              ? "same_state_district_address"
              : origin && restaurantCoordinates
                ? "outside_radius"
                : "outside_selected_location";

  return {
    coordinateMatch,
    coordinatesPresent: hasDistanceCoordinates,
    distanceKm,
    finalIncluded: coordinateMatch || textMatch,
    matchReason,
    matchedBy,
    restaurantAddress,
    restaurantDistrict,
    signals: {
      samePincode,
      sameState,
      sameDistrict,
      sameCity,
      areaOverlap,
      cityMentionedInAddress,
      districtMentionedInAddress,
    },
  };
};

const mapPublicRestaurantSummary = <
  TRestaurant extends Prisma.RestaurantGetPayload<{ select: typeof listSelect }> & {
    distanceKm?: number | null;
    matchedBy?: DiscoveryLocationMatchMode | null;
    matchingMenuItems?: Prisma.MenuItemGetPayload<{ select: typeof searchMatchMenuItemSelect }>[] | undefined;
  },
>(
  restaurant: TRestaurant,
) => ({
  id: restaurant.id,
  name: restaurant.name,
  slug: restaurant.slug,
  description: restaurant.description,
  coverImage: restaurant.coverImage,
  logoImage: restaurant.logoImage,
  addressLine: restaurant.addressLine,
  address: buildRestaurantLocationAddress(restaurant),
  area: restaurant.area,
  city: restaurant.city,
  district: getRestaurantDistrict(restaurant),
  state: restaurant.state,
  pincode: restaurant.pincode,
  latitude: restaurant.latitude,
  longitude: restaurant.longitude,
  distanceKm: restaurant.distanceKm ?? null,
  status: restaurant.isActive ? "ACTIVE" : "INACTIVE",
  avgRating: restaurant.avgRating,
  totalReviews: restaurant.totalReviews,
  costForTwo: restaurant.costForTwo,
  avgDeliveryTime: restaurant.avgDeliveryTime,
  preparationTime: restaurant.preparationTime,
  isVegOnly: restaurant.isVegOnly,
  isFeatured: restaurant.isFeatured,
  cuisineMappings: restaurant.cuisineMappings,
  offers: restaurant.offers,
  ...(restaurant.matchingMenuItems ? { matchingMenuItems: restaurant.matchingMenuItems } : {}),
  ...(env.isDevelopment && restaurant.matchedBy ? { matchedBy: restaurant.matchedBy } : {}),
});

const mapPublicRestaurantDetail = <
  TRestaurant extends Prisma.RestaurantGetPayload<{ select: typeof publicDetailSelect }> & {
    distanceKm?: number | null;
    matchedBy?: DiscoveryLocationMatchMode | null;
  },
>(
  restaurant: TRestaurant,
) => ({
  ...mapPublicRestaurantSummary(restaurant),
  openingTime: restaurant.openingTime,
  closingTime: restaurant.closingTime,
  categoryMappings: restaurant.categoryMappings,
  operatingHours: restaurant.operatingHours,
  menuCategories: restaurant.menuCategories,
  combos: restaurant.combos,
  reviews: restaurant.reviews,
});

const logRestaurantDiscoveryDecision = ({
  finalIncluded,
  location,
  origin,
  matchReason,
  matchedBy,
  restaurant,
  radiusKm,
  searchQuery,
  searchMatched,
  distanceKm,
}: {
  finalIncluded: boolean;
  location: DiscoveryLocationTextContext;
  origin: { latitude: number; longitude: number } | null;
  matchReason: string;
  matchedBy: DiscoveryLocationMatchMode | null;
  restaurant: RestaurantDiscoveryLocationRecord;
  radiusKm: number | null;
  searchQuery: string | null;
  searchMatched: boolean;
  distanceKm: number | null;
}) => {
  if (!env.isDevelopment) {
    return;
  }

  const restaurantCoordinates = getLatLngFromRestaurant(restaurant);

  logger.info("Restaurant discovery evaluated", {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    status: restaurant.isActive ? "ACTIVE" : "INACTIVE",
    restaurantLatitude: restaurantCoordinates?.latitude ?? null,
    restaurantLongitude: restaurantCoordinates?.longitude ?? null,
    restaurantCity: restaurant.city,
    restaurantDistrict: getRestaurantDistrict(restaurant),
    restaurantState: restaurant.state,
    restaurantPincode: restaurant.pincode,
    restaurantCoordinatesPresent: Boolean(restaurantCoordinates),
    userLatitude: origin?.latitude ?? null,
    userLongitude: origin?.longitude ?? null,
    userCity: location.city,
    userDistrict: location.district,
    userState: location.state,
    userPincode: location.pincode,
    userCoordinatesPresent: Boolean(origin),
    distanceKm,
    radiusKm,
    matchedBy,
    searchQuery,
    searchQueryMatch: searchMatched,
    finalDecision: finalIncluded ? "included" : "excluded",
    reason: matchReason,
  });
};

const buildListWhere = (query: Record<string, unknown>): Prisma.RestaurantWhereInput => {
  const clauses: Prisma.RestaurantWhereInput[] = [{ isActive: true }, { owner: { is: { isActive: true } } }];

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    clauses.push(buildRestaurantTextSearchClause(search));
  }

  const foodCategory = typeof query.foodCategory === "string" ? query.foodCategory.trim() : "";
  const foodCategoryClause = buildRestaurantFoodCategoryClause(foodCategory);
  if (foodCategoryClause) {
    clauses.push(foodCategoryClause);
  }

  const cuisine = typeof query.cuisine === "string" ? query.cuisine.trim() : "";
  if (cuisine) {
    const cuisines = cuisine.split(",").map((item) => item.trim()).filter(Boolean);
    clauses.push({
      OR: cuisines.map((name) => ({
        cuisineMappings: {
          some: {
            cuisine: {
              name: buildInsensitiveEquals(name),
            },
          },
        },
      })),
    });
  }

  if (query.foodType === "veg") {
    clauses.push({
      OR: [{ isVegOnly: true }, { menuItems: { some: { foodType: FoodType.VEG } } }],
    });
  }

  if (query.foodType === "non_veg") {
    clauses.push({
      menuItems: {
        some: {
          foodType: {
            in: [FoodType.NON_VEG, FoodType.EGG],
          },
        },
      },
    });
  }

  if (typeof query.ratingMin === "number") {
    clauses.push({ avgRating: { gte: query.ratingMin } });
  }

  if (typeof query.deliveryTimeMax === "number") {
    clauses.push({ avgDeliveryTime: { lte: query.deliveryTimeMax } });
  }

  if (typeof query.minCost === "number" || typeof query.maxCost === "number") {
    clauses.push({
      costForTwo: {
        gte: typeof query.minCost === "number" ? query.minCost : undefined,
        lte: typeof query.maxCost === "number" ? query.maxCost : undefined,
      },
    });
  }

  return {
    AND: clauses,
  };
};

const ensureRestaurantAccess = async (
  user: { id: number; role: Role },
  restaurantId: number,
) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, ownerId: true },
  });

  if (!restaurant) {
    throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  if (user.role !== Role.ADMIN && restaurant.ownerId !== user.id) {
    throw new AppError(StatusCodes.FORBIDDEN, "You do not have access to this restaurant", "RESTAURANT_FORBIDDEN");
  }

  return restaurant;
};

const generateUniqueSlug = async (name: string, excludeId?: number) => {
  const baseSlug = slugify(name);
  let nextSlug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.restaurant.findFirst({
      where: {
        slug: nextSlug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return nextSlug;
    }

    nextSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

type RestaurantWriteClient = Prisma.TransactionClient | typeof prisma;

const resolveRegionIdForRestaurantLocation = async (
  client: RestaurantWriteClient,
  state?: string | null,
  city?: string | null,
) => {
  const normalizedState = normalizeRegionValue(state);
  const normalizedCity = normalizeRegionValue(city);

  if (!normalizedState || !normalizedCity) {
    return null;
  }

  const exactRegion = await resolveRegionIdForAssignment(client, normalizedState, normalizedCity);

  if (exactRegion) {
    return exactRegion;
  }

  const stateRegions = await client.region.findMany({
    where: {
      isActive: true,
      stateName: normalizedState,
    },
    select: {
      id: true,
      name: true,
      stateName: true,
      districtName: true,
      code: true,
      slug: true,
    },
    orderBy: [{ districtName: "asc" }, { id: "asc" }],
  });

  return (
    stateRegions.find((region) => getRegionDistrictVariants(region.districtName).includes(normalizedCity)) ??
    null
  );
};

export const restaurantsService = {
  async list(query: Record<string, unknown>) {
    const pagination = getPagination({
      page: query.page,
      limit: query.limit,
      maxLimit: 48,
    });
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const foodCategory = typeof query.foodCategory === "string" ? query.foodCategory.trim() : "";
    const allowGlobalResults = query.allowGlobalResults === true;
    const where = buildListWhere(query);
    const orderBy = getRestaurantOrderBy(typeof query.sort === "string" ? query.sort : undefined);
    const origin = getDiscoveryOrigin(query);
    const location = buildDiscoveryLocationTextContext(query);
    const hasTextLocation = hasDiscoveryLocationText(location);
    const includeMenuMatches = shouldIncludeMenuMatches(query, search, foodCategory);
    const menuItemMatchWhere = buildMenuItemMatchWhere({
      foodCategory,
      search,
    });
    const hasLocationContext = Boolean(origin || hasTextLocation);

    if (!hasLocationContext && !allowGlobalResults) {
      return {
        restaurants: [],
        meta: {
          ...getPaginationMeta({
            total: 0,
            page: pagination.page,
            limit: pagination.limit,
          }),
          appliedRadiusKm: CUSTOMER_RESTAURANT_RADIUS_KM,
          isLocationFiltered: false,
          requiresLocation: true,
        },
      };
    }

    if (!hasLocationContext && allowGlobalResults) {
      if (includeMenuMatches) {
        const [total, globalRestaurantsWithMatches] = await Promise.all([
          prisma.restaurant.count({ where }),
          prisma.restaurant.findMany({
            where,
            select: {
              ...listSelect,
              menuItems: {
                where: menuItemMatchWhere,
                orderBy: [{ isRecommended: "desc" }, { createdAt: "desc" }],
                take: MENU_MATCH_LIMIT_PER_RESTAURANT,
                select: searchMatchMenuItemSelect,
              },
            },
            orderBy,
            skip: pagination.skip,
            take: pagination.limit,
          }),
        ]);

        return {
          restaurants: globalRestaurantsWithMatches.map(({ menuItems, ...restaurant }) =>
            mapPublicRestaurantSummary({
              ...restaurant,
              matchingMenuItems: menuItems,
            }),
          ),
          meta: {
            ...getPaginationMeta({
              total,
              page: pagination.page,
              limit: pagination.limit,
            }),
            appliedRadiusKm: null,
            isLocationFiltered: false,
            requiresLocation: false,
          },
        };
      }

      const [total, globalRestaurants] = await Promise.all([
        prisma.restaurant.count({ where }),
        prisma.restaurant.findMany({
          where,
          select: listSelect,
          orderBy,
          skip: pagination.skip,
          take: pagination.limit,
        }),
      ]);

      return {
        restaurants: globalRestaurants.map((restaurant) => mapPublicRestaurantSummary(restaurant)),
        meta: {
          ...getPaginationMeta({
            total,
            page: pagination.page,
            limit: pagination.limit,
          }),
          appliedRadiusKm: null,
          isLocationFiltered: false,
          requiresLocation: false,
        },
      };
    }

    const radiusKm = getDiscoveryRadiusKm(query.radiusKm);
    const discoveryCandidateWhere = buildRestaurantDiscoveryCandidateWhere({
      allowGlobalResults,
      baseWhere: where,
      location,
      origin,
      radiusKm,
    });

    if (includeMenuMatches) {
      const discoveryRestaurantsWithMatches = await prisma.restaurant.findMany({
        where: discoveryCandidateWhere,
        select: {
          ...listSelect,
          menuItems: {
            where: menuItemMatchWhere,
            orderBy: [{ isRecommended: "desc" }, { createdAt: "desc" }],
            take: MENU_MATCH_LIMIT_PER_RESTAURANT,
            select: searchMatchMenuItemSelect,
          },
        },
        orderBy,
      });

      const filteredRestaurants = discoveryRestaurantsWithMatches.flatMap(({ menuItems, ...restaurant }) => {
        const discoveryMatch = evaluateRestaurantDiscoveryLocationMatch(restaurant, location, origin, radiusKm);
        const searchMatched = Boolean(search);

        logRestaurantDiscoveryDecision({
          finalIncluded: discoveryMatch.finalIncluded,
          location,
          origin,
          matchReason: discoveryMatch.matchReason,
          matchedBy: discoveryMatch.matchedBy,
          restaurant,
          radiusKm,
          searchQuery: search || null,
          searchMatched,
          distanceKm: discoveryMatch.distanceKm,
        });

        if (!discoveryMatch.finalIncluded) {
          return [];
        }

        return [
          mapPublicRestaurantSummary({
            ...restaurant,
            distanceKm: discoveryMatch.distanceKm,
            matchedBy: discoveryMatch.matchedBy,
            matchingMenuItems: menuItems,
          }),
        ];
      });

      const sortedRestaurants = [...filteredRestaurants].sort((left, right) => {
        const leftDistance = typeof left.distanceKm === "number" ? left.distanceKm : Number.POSITIVE_INFINITY;
        const rightDistance =
          typeof right.distanceKm === "number" ? right.distanceKm : Number.POSITIVE_INFINITY;

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return left.name.localeCompare(right.name);
      });
      const total = sortedRestaurants.length;

      return {
        restaurants: sortedRestaurants.slice(pagination.skip, pagination.skip + pagination.limit),
        meta: {
          ...getPaginationMeta({
            total,
            page: pagination.page,
            limit: pagination.limit,
          }),
          appliedRadiusKm: radiusKm,
          isLocationFiltered: true,
          requiresLocation: false,
        },
      };
    }

    const discoveryRestaurants = await prisma.restaurant.findMany({
      where: discoveryCandidateWhere,
      select: listSelect,
      orderBy,
    });

    const filteredRestaurants = discoveryRestaurants.flatMap((restaurant) => {
      const discoveryMatch = evaluateRestaurantDiscoveryLocationMatch(restaurant, location, origin, radiusKm);
      const searchMatched = Boolean(search);

      logRestaurantDiscoveryDecision({
        finalIncluded: discoveryMatch.finalIncluded,
        location,
        origin,
        matchReason: discoveryMatch.matchReason,
        matchedBy: discoveryMatch.matchedBy,
        restaurant,
        radiusKm,
        searchQuery: search || null,
        searchMatched,
        distanceKm: discoveryMatch.distanceKm,
      });

      if (!discoveryMatch.finalIncluded) {
        return [];
      }

      return [
        mapPublicRestaurantSummary({
          ...restaurant,
          distanceKm: discoveryMatch.distanceKm,
          matchedBy: discoveryMatch.matchedBy,
        }),
      ];
    });

    const sortedRestaurants = [...filteredRestaurants].sort((left, right) => {
      const leftDistance = typeof left.distanceKm === "number" ? left.distanceKm : Number.POSITIVE_INFINITY;
      const rightDistance =
        typeof right.distanceKm === "number" ? right.distanceKm : Number.POSITIVE_INFINITY;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.name.localeCompare(right.name);
    });
    const total = sortedRestaurants.length;

    return {
      restaurants: sortedRestaurants.slice(pagination.skip, pagination.skip + pagination.limit),
      meta: {
        ...getPaginationMeta({
          total,
          page: pagination.page,
          limit: pagination.limit,
        }),
        appliedRadiusKm: radiusKm,
        isLocationFiltered: true,
        requiresLocation: false,
      },
    };
  },

  async listForAdmin(query: {
    search?: string;
    city?: string;
    ownerId?: number;
    isActive?: boolean;
  }) {
    const search = query.search?.trim();
    const city = query.city?.trim();

    return prisma.restaurant.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { slug: { contains: search } },
                { area: { contains: search } },
              ],
            }
          : {}),
        ...(city ? { city: { contains: city } } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      select: adminListSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async getBySlug(slug: string, query: Record<string, unknown> = {}) {
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        slug,
        isActive: true,
        owner: {
          is: {
            isActive: true,
          },
        },
      },
      select: publicDetailSelect,
    });

    if (!restaurant) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    const origin = getDiscoveryOrigin(query);
    const location = buildDiscoveryLocationTextContext(query);
    const hasLocationContext = Boolean(origin || hasDiscoveryLocationText(location));

    if (!hasLocationContext) {
      return mapPublicRestaurantDetail(restaurant);
    }

    const radiusKm = getDiscoveryRadiusKm(query.radiusKm);
    const discoveryMatch = evaluateRestaurantDiscoveryLocationMatch(restaurant, location, origin, radiusKm);

    logRestaurantDiscoveryDecision({
      finalIncluded: discoveryMatch.finalIncluded,
      location,
      origin,
      matchReason: discoveryMatch.matchReason,
      matchedBy: discoveryMatch.matchedBy,
      restaurant,
      radiusKm,
      searchQuery: null,
      searchMatched: true,
      distanceKm: discoveryMatch.distanceKm,
    });

    if (!discoveryMatch.finalIncluded) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "This restaurant is not available for the selected delivery location.",
        "RESTAURANT_NOT_SERVICEABLE_FOR_LOCATION",
      );
    }

    return mapPublicRestaurantDetail({
      ...restaurant,
      distanceKm: discoveryMatch.distanceKm,
      matchedBy: discoveryMatch.matchedBy,
    });
  },

  async listForOwner(userId: number, view: "summary" | "detail" = "detail") {
    return prisma.restaurant.findMany({
      where: { ownerId: userId },
      select: view === "summary" ? ownerSummarySelect : detailSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async create(user: { id: number; role: Role }, input: Record<string, unknown>) {
    const ownerId =
      user.role === Role.ADMIN && typeof input.ownerId === "number" ? input.ownerId : user.id;
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
      },
    });

    if (!owner) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant owner not found", "OWNER_NOT_FOUND");
    }

    const slug = await generateUniqueSlug(String(input.name));
    const geocodedCoordinates =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? null
        : await geocodeAddressText(
            buildAddressSearchText([
              input.addressLine as string | undefined,
              input.area as string | undefined,
              input.city as string | undefined,
              input.state as string | undefined,
              input.pincode as string | undefined,
            ]),
          );
    const restaurantRegion = await resolveRegionIdForRestaurantLocation(
      prisma,
      input.state as string | undefined,
      input.city as string | undefined,
    );

    const restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ownerId,
          regionId: restaurantRegion?.id ?? null,
          name: String(input.name),
          slug,
          description: input.description as string | undefined,
          email: input.email as string | undefined,
          phone: input.phone as string | undefined,
          coverImage: input.coverImage as string | undefined,
          logoImage: input.logoImage as string | undefined,
          licenseNumber: input.licenseNumber as string | undefined,
          openingTime: input.openingTime as string | undefined,
          closingTime: input.closingTime as string | undefined,
          addressLine: input.addressLine as string | undefined,
          area: input.area as string | undefined,
          city: String(input.city),
          state: String(input.state),
          pincode: String(input.pincode),
          latitude:
            typeof input.latitude === "number"
              ? input.latitude
              : geocodedCoordinates?.latitude,
          longitude:
            typeof input.longitude === "number"
              ? input.longitude
              : geocodedCoordinates?.longitude,
          costForTwo: typeof input.costForTwo === "number" ? input.costForTwo : 0,
          avgDeliveryTime: typeof input.avgDeliveryTime === "number" ? input.avgDeliveryTime : 30,
          preparationTime:
            typeof input.preparationTime === "number" ? input.preparationTime : 20,
          isVegOnly: Boolean(input.isVegOnly),
          isActive: input.isActive === undefined ? true : Boolean(input.isActive),
          isFeatured: Boolean(input.isFeatured),
        },
      });

      const categoryIds = Array.isArray(input.categoryIds)
        ? [...new Set(input.categoryIds as number[])]
        : [];
      if (categoryIds.length) {
        await tx.restaurantCategoryMap.createMany({
          data: categoryIds.map((categoryId) => ({
            restaurantId: created.id,
            categoryId,
          })),
        });
      }

      const cuisineIds = Array.isArray(input.cuisineIds)
        ? [...new Set(input.cuisineIds as number[])]
        : [];
      if (cuisineIds.length) {
        await tx.restaurantCuisine.createMany({
          data: cuisineIds.map((cuisineId) => ({
            restaurantId: created.id,
            cuisineId,
          })),
        });
      }

      if (input.openingTime || input.closingTime) {
        await tx.restaurantHour.createMany({
          data: Array.from({ length: 7 }).map((_, dayOfWeek) => ({
            restaurantId: created.id,
            dayOfWeek,
            openTime: (input.openingTime as string | undefined) ?? "09:00",
            closeTime: (input.closingTime as string | undefined) ?? "23:00",
            isClosed: false,
          })),
        });
      }

      return created;
    });

    return this.getById(restaurant.id);
  },

  async update(user: { id: number; role: Role }, restaurantId: number, input: Record<string, unknown>) {
    const restaurant = await ensureRestaurantAccess(user, restaurantId);

    const slug =
      typeof input.name === "string" ? await generateUniqueSlug(input.name, restaurantId) : undefined;
    const shouldGeocode =
      !("latitude" in input) &&
      !("longitude" in input) &&
      ["addressLine", "area", "city", "state", "pincode"].some((key) => key in input);
    const shouldRefreshRegion = shouldGeocode || "city" in input || "state" in input;
    const currentRestaurant =
      shouldRefreshRegion
        ? await prisma.restaurant.findUnique({
            where: { id: restaurant.id },
            select: {
              addressLine: true,
              area: true,
              city: true,
              state: true,
              pincode: true,
            },
          })
        : null;
    const geocodedCoordinates =
      shouldGeocode && currentRestaurant
        ? await geocodeAddressText(
            buildAddressSearchText([
              (input.addressLine as string | undefined) ?? currentRestaurant.addressLine,
              (input.area as string | undefined) ?? currentRestaurant.area,
              (input.city as string | undefined) ?? currentRestaurant.city,
              (input.state as string | undefined) ?? currentRestaurant.state,
              (input.pincode as string | undefined) ?? currentRestaurant.pincode,
            ]),
          )
        : null;
    const nextRestaurantState =
      typeof input.state === "string" ? input.state : currentRestaurant?.state;
    const nextRestaurantCity =
      typeof input.city === "string" ? input.city : currentRestaurant?.city;
    const nextRegion = shouldRefreshRegion
      ? await resolveRegionIdForRestaurantLocation(prisma, nextRestaurantState, nextRestaurantCity)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          ...(input.name ? { name: input.name as string, slug } : {}),
          ...(input.description !== undefined ? { description: input.description as string | undefined } : {}),
          ...(input.email !== undefined ? { email: input.email as string | undefined } : {}),
          ...(input.phone !== undefined ? { phone: input.phone as string | undefined } : {}),
          ...(input.coverImage !== undefined ? { coverImage: input.coverImage as string | undefined } : {}),
          ...(input.logoImage !== undefined ? { logoImage: input.logoImage as string | undefined } : {}),
          ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber as string | undefined } : {}),
          ...(input.openingTime !== undefined ? { openingTime: input.openingTime as string | undefined } : {}),
          ...(input.closingTime !== undefined ? { closingTime: input.closingTime as string | undefined } : {}),
          ...(input.addressLine !== undefined ? { addressLine: input.addressLine as string | undefined } : {}),
          ...(input.area !== undefined ? { area: input.area as string | undefined } : {}),
          ...(input.city !== undefined ? { city: input.city as string } : {}),
          ...(input.state !== undefined ? { state: input.state as string } : {}),
          ...(input.pincode !== undefined ? { pincode: input.pincode as string } : {}),
          ...(shouldRefreshRegion ? { regionId: nextRegion?.id ?? null } : {}),
          ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
          ...(typeof input.longitude === "number" ? { longitude: input.longitude } : {}),
          ...(geocodedCoordinates
            ? {
                latitude: geocodedCoordinates.latitude,
                longitude: geocodedCoordinates.longitude,
              }
            : {}),
          ...(typeof input.costForTwo === "number" ? { costForTwo: input.costForTwo } : {}),
          ...(typeof input.avgDeliveryTime === "number" ? { avgDeliveryTime: input.avgDeliveryTime } : {}),
          ...(typeof input.preparationTime === "number"
            ? { preparationTime: input.preparationTime }
            : {}),
          ...(input.isVegOnly !== undefined ? { isVegOnly: Boolean(input.isVegOnly) } : {}),
          ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: Boolean(input.isFeatured) } : {}),
        },
      });

      if (Array.isArray(input.categoryIds)) {
        await tx.restaurantCategoryMap.deleteMany({ where: { restaurantId } });
        const categoryIds = [...new Set(input.categoryIds as number[])];
        if (categoryIds.length) {
          await tx.restaurantCategoryMap.createMany({
            data: categoryIds.map((categoryId) => ({
              restaurantId,
              categoryId,
            })),
          });
        }
      }

      if (Array.isArray(input.cuisineIds)) {
        await tx.restaurantCuisine.deleteMany({ where: { restaurantId } });
        const cuisineIds = [...new Set(input.cuisineIds as number[])];
        if (cuisineIds.length) {
          await tx.restaurantCuisine.createMany({
            data: cuisineIds.map((cuisineId) => ({
              restaurantId,
              cuisineId,
            })),
          });
        }
      }

      if (input.openingTime !== undefined || input.closingTime !== undefined) {
        await tx.restaurantHour.updateMany({
          where: {
            restaurantId,
            isClosed: false,
          },
          data: {
            ...(input.openingTime !== undefined ? { openTime: input.openingTime as string | undefined } : {}),
            ...(input.closingTime !== undefined ? { closeTime: input.closingTime as string | undefined } : {}),
          },
        });
      }
    });

    return this.getById(restaurantId);
  },

  async getById(id: number) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: detailSelect,
    });

    if (!restaurant) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    return restaurant;
  },

  async getAdminById(id: number) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: adminDetailSelect,
    });

    if (!restaurant) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    return restaurant;
  },

  async archiveByAdmin(id: number) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!restaurant) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    await prisma.restaurant.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return this.getAdminById(id);
  },
};
