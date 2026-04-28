import { Prisma } from "@prisma/client";
import { FoodType, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import {
  buildAddressSearchText,
  geocodeAddressText,
  hasCoordinates,
  haversineDistanceKm,
} from "../../utils/geo.js";
import { getPagination, getPaginationMeta } from "../../utils/pagination.js";
import { slugify } from "../../utils/slug.js";

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
  latitude: true,
  longitude: true,
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
} satisfies Prisma.RestaurantSelect;

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

const DEFAULT_DISCOVERY_RADIUS_KM = Math.min(
  env.RESTAURANT_DISCOVERY_DEFAULT_RADIUS_KM,
  env.RESTAURANT_DISCOVERY_MAX_RADIUS_KM,
);
const MAX_DISCOVERY_RADIUS_KM = Math.max(
  env.RESTAURANT_DISCOVERY_DEFAULT_RADIUS_KM,
  env.RESTAURANT_DISCOVERY_MAX_RADIUS_KM,
);
const KILOMETERS_PER_LATITUDE_DEGREE = 111.32;

const isValidLatitude = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;

const getDiscoveryOrigin = (query: Record<string, unknown>) => {
  if (!isValidLatitude(query.latitude) || !isValidLongitude(query.longitude)) {
    return null;
  }

  return {
    latitude: query.latitude,
    longitude: query.longitude,
  };
};

const getDiscoveryRadiusKm = (radiusKm: unknown) => {
  const requestedRadiusKm =
    typeof radiusKm === "number" && Number.isFinite(radiusKm) && radiusKm >= 0
      ? radiusKm
      : DEFAULT_DISCOVERY_RADIUS_KM;

  return Math.min(requestedRadiusKm, MAX_DISCOVERY_RADIUS_KM);
};

const getNearbyRestaurantWhere = (
  where: Prisma.RestaurantWhereInput,
  origin: { latitude: number; longitude: number },
  radiusKm: number,
): Prisma.RestaurantWhereInput => {
  const latitudeDelta = radiusKm / KILOMETERS_PER_LATITUDE_DEGREE;
  const safeLongitudeDivisor = Math.max(
    Math.cos((origin.latitude * Math.PI) / 180) * KILOMETERS_PER_LATITUDE_DEGREE,
    0.01,
  );
  const longitudeDelta = radiusKm / safeLongitudeDivisor;

  return {
    AND: [
      where,
      {
        latitude: {
          not: null,
          gte: origin.latitude - latitudeDelta,
          lte: origin.latitude + latitudeDelta,
        },
      },
      {
        longitude: {
          not: null,
          gte: Math.max(-180, origin.longitude - longitudeDelta),
          lte: Math.min(180, origin.longitude + longitudeDelta),
        },
      },
    ],
  };
};

const buildListWhere = (query: Record<string, unknown>): Prisma.RestaurantWhereInput => {
  const clauses: Prisma.RestaurantWhereInput[] = [{ isActive: true }];

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    clauses.push({
      OR: [
        { name: { contains: search } },
        { area: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
        { addressLine: { contains: search } },
        { cuisineMappings: { some: { cuisine: { name: { contains: search } } } } },
        { menuItems: { some: { name: { contains: search } } } },
      ],
    });
  }

  const cuisine = typeof query.cuisine === "string" ? query.cuisine.trim() : "";
  if (cuisine) {
    const cuisines = cuisine.split(",").map((item) => item.trim()).filter(Boolean);
    clauses.push({
      cuisineMappings: {
        some: {
          cuisine: {
            name: {
              in: cuisines,
            },
          },
        },
      },
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

export const restaurantsService = {
  async list(query: Record<string, unknown>) {
    const pagination = getPagination({
      page: query.page,
      limit: query.limit,
      maxLimit: 24,
    });
    const where = buildListWhere(query);
    const orderBy = getRestaurantOrderBy(typeof query.sort === "string" ? query.sort : undefined);
    const origin = getDiscoveryOrigin(query);

    if (!origin) {
      return {
        restaurants: [],
        meta: {
          ...getPaginationMeta({
            total: 0,
          page: pagination.page,
          limit: pagination.limit,
          }),
          appliedRadiusKm: DEFAULT_DISCOVERY_RADIUS_KM,
          isLocationFiltered: false,
          requiresLocation: true,
        },
      };
    }

    const radiusKm = getDiscoveryRadiusKm(query.radiusKm);
    const nearbyRestaurants = await prisma.restaurant.findMany({
      where: getNearbyRestaurantWhere(where, origin, radiusKm),
      select: listSelect,
      orderBy,
    });

    // Use a coarse coordinate box in Prisma first, then apply exact Haversine filtering in memory.
    const filteredRestaurants = nearbyRestaurants.flatMap((restaurant) => {
      if (!hasCoordinates(restaurant)) {
        return [];
      }

      const distanceKm = haversineDistanceKm(origin, restaurant);
      if (distanceKm > radiusKm) {
        return [];
      }

      return [
        {
          ...restaurant,
          distanceKm: Number(distanceKm.toFixed(2)),
        },
      ];
    });
    const restaurants = filteredRestaurants.slice(pagination.skip, pagination.skip + pagination.limit);
    const total = filteredRestaurants.length;

    return {
      restaurants,
      meta: {
        ...getPaginationMeta({
          total,
          page: pagination.page,
          limit: pagination.limit,
        }),
        appliedRadiusKm: radiusKm,
        isLocationFiltered: true,
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
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: publicDetailSelect,
    });

    if (!restaurant || !restaurant.isActive) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    const origin = getDiscoveryOrigin(query);
    if (!origin) {
      return restaurant;
    }

    const radiusKm = getDiscoveryRadiusKm(query.radiusKm);

    if (!hasCoordinates(restaurant)) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "This restaurant is not available for the selected delivery location.",
        "RESTAURANT_NOT_SERVICEABLE_FOR_LOCATION",
      );
    }

    const distanceKm = haversineDistanceKm(origin, restaurant);
    if (distanceKm > radiusKm) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "This restaurant is not available for the selected delivery location.",
        "RESTAURANT_NOT_SERVICEABLE_FOR_LOCATION",
      );
    }

    return {
      ...restaurant,
      distanceKm: Number(distanceKm.toFixed(2)),
    };
  },

  async listForOwner(userId: number) {
    return prisma.restaurant.findMany({
      where: { ownerId: userId },
      select: detailSelect,
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
        regionId: true,
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

    const restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ownerId,
          regionId: owner.regionId,
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
    const currentRestaurant =
      shouldGeocode
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
