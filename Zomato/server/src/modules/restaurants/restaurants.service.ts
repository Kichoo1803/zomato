import { Prisma } from "@prisma/client";
import { FoodType, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { getPagination, getPaginationMeta } from "../../utils/pagination.js";
import { slugify } from "../../utils/slug.js";

const listSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImage: true,
  logoImage: true,
  area: true,
  city: true,
  avgRating: true,
  totalReviews: true,
  costForTwo: true,
  avgDeliveryTime: true,
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

const detailSelect = {
  ...listSelect,
  isActive: true,
  ownerId: true,
  phone: true,
  email: true,
  openingTime: true,
  closingTime: true,
  addressLine: true,
  state: true,
  pincode: true,
  latitude: true,
  longitude: true,
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

const buildListWhere = (query: Record<string, unknown>): Prisma.RestaurantWhereInput => {
  const clauses: Prisma.RestaurantWhereInput[] = [{ isActive: true }];

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    clauses.push({
      OR: [
        { name: { contains: search } },
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

    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        select: listSelect,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.restaurant.count({ where }),
    ]);

    return {
      restaurants,
      meta: getPaginationMeta({
        total,
        page: pagination.page,
        limit: pagination.limit,
      }),
    };
  },

  async getBySlug(slug: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: detailSelect,
    });

    if (!restaurant || !restaurant.isActive) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    return restaurant;
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
    const slug = await generateUniqueSlug(String(input.name));

    const restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ownerId,
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
          latitude: typeof input.latitude === "number" ? input.latitude : undefined,
          longitude: typeof input.longitude === "number" ? input.longitude : undefined,
          costForTwo: typeof input.costForTwo === "number" ? input.costForTwo : 0,
          avgDeliveryTime: typeof input.avgDeliveryTime === "number" ? input.avgDeliveryTime : 30,
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
    await ensureRestaurantAccess(user, restaurantId);

    const slug =
      typeof input.name === "string" ? await generateUniqueSlug(input.name, restaurantId) : undefined;

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
          ...(typeof input.costForTwo === "number" ? { costForTwo: input.costForTwo } : {}),
          ...(typeof input.avgDeliveryTime === "number" ? { avgDeliveryTime: input.avgDeliveryTime } : {}),
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
};
