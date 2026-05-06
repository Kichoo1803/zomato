import { Prisma } from "@prisma/client";
import { EventStatus } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const eventSelect = {
  id: true,
  title: true,
  description: true,
  restaurantId: true,
  regionId: true,
  imageUrl: true,
  startsAt: true,
  endsAt: true,
  discountLabel: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  region: {
    select: {
      id: true,
      name: true,
      districtName: true,
      stateName: true,
      slug: true,
    },
  },
} satisfies Prisma.EventSelect;

type EventRecord = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

const getEffectiveStatus = (event: Pick<EventRecord, "status" | "endsAt">) => {
  if (event.status === EventStatus.INACTIVE) {
    return EventStatus.INACTIVE;
  }

  if (event.status === EventStatus.EXPIRED) {
    return EventStatus.EXPIRED;
  }

  return event.endsAt.getTime() < Date.now() ? EventStatus.EXPIRED : EventStatus.ACTIVE;
};

const mapEvent = (event: EventRecord) => ({
  ...event,
  status: getEffectiveStatus(event),
  appliesToAllRestaurants: !event.restaurantId && !event.regionId,
});

const buildListWhere = (
  query: {
    search?: string;
    restaurantId?: number;
    regionId?: number;
    status?: string;
  },
  mode: "admin" | "public",
): Prisma.EventWhereInput => {
  const clauses: Prisma.EventWhereInput[] = [];
  const trimmedSearch = query.search?.trim();

  if (trimmedSearch) {
    clauses.push({
      OR: [
        { title: { contains: trimmedSearch } },
        { description: { contains: trimmedSearch } },
        { discountLabel: { contains: trimmedSearch } },
      ],
    });
  }

  if (typeof query.restaurantId === "number") {
    clauses.push({ restaurantId: query.restaurantId });
  }

  if (typeof query.regionId === "number") {
    clauses.push({ regionId: query.regionId });
  }

  if (mode === "admin") {
    if (query.status) {
      if (query.status === EventStatus.EXPIRED) {
        clauses.push({
          OR: [
            { status: EventStatus.EXPIRED },
            {
              status: EventStatus.ACTIVE,
              endsAt: {
                lt: new Date(),
              },
            },
          ],
        });
      } else {
        clauses.push({ status: query.status });
      }
    }
  } else {
    clauses.push({
      status: EventStatus.ACTIVE,
      endsAt: {
        gte: new Date(),
      },
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const ensureTargetExists = async (input: {
  restaurantId?: number | null;
  regionId?: number | null;
}) => {
  if (typeof input.restaurantId === "number") {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { id: true },
    });

    if (!restaurant) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }
  }

  if (typeof input.regionId === "number") {
    const region = await prisma.region.findUnique({
      where: { id: input.regionId },
      select: { id: true },
    });

    if (!region) {
      throw new AppError(StatusCodes.NOT_FOUND, "Region not found", "REGION_NOT_FOUND");
    }
  }
};

const getEventById = async (eventId: number) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: eventSelect,
  });

  if (!event) {
    throw new AppError(StatusCodes.NOT_FOUND, "Event not found", "EVENT_NOT_FOUND");
  }

  return event;
};

export const eventsService = {
  async listAdmin(query: {
    search?: string;
    restaurantId?: number;
    regionId?: number;
    status?: string;
  }) {
    const events = await prisma.event.findMany({
      where: buildListWhere(query, "admin"),
      select: eventSelect,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    });

    return events.map(mapEvent);
  },

  async listPublic(query: {
    search?: string;
    restaurantId?: number;
    regionId?: number;
  }) {
    const events = await prisma.event.findMany({
      where: buildListWhere(query, "public"),
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });

    return events.map(mapEvent);
  },

  async listForRestaurantPublic(restaurantId: number) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        slug: true,
        regionId: true,
        isActive: true,
      },
    });

    if (!restaurant || !restaurant.isActive) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    const events = await prisma.event.findMany({
      where: {
        status: EventStatus.ACTIVE,
        endsAt: {
          gte: new Date(),
        },
        OR: [
          { restaurantId },
          ...(restaurant.regionId ? [{ regionId: restaurant.regionId }] : []),
          {
            restaurantId: null,
            regionId: null,
          },
        ],
      },
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });

    return events.map((event) =>
      mapEvent({
        ...event,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
        },
      }),
    );
  },

  async create(input: {
    title: string;
    description: string;
    restaurantId?: number | null;
    regionId?: number | null;
    imageUrl?: string | null;
    startsAt: Date;
    endsAt: Date;
    discountLabel?: string | null;
    status: string;
  }) {
    await ensureTargetExists(input);

    const event = await prisma.event.create({
      data: {
        title: input.title,
        description: input.description,
        restaurantId: input.restaurantId ?? null,
        regionId: input.regionId ?? null,
        imageUrl: input.imageUrl ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        discountLabel: input.discountLabel ?? null,
        status: input.status,
      },
      select: eventSelect,
    });

    return mapEvent(event);
  },

  async update(
    eventId: number,
    input: Partial<{
      title: string;
      description: string;
      restaurantId: number | null;
      regionId: number | null;
      imageUrl: string | null;
      startsAt: Date;
      endsAt: Date;
      discountLabel: string | null;
      status: string;
    }>,
  ) {
    const existingEvent = await getEventById(eventId);
    const nextRestaurantId =
      input.restaurantId !== undefined ? input.restaurantId : existingEvent.restaurantId;
    const nextRegionId = input.regionId !== undefined ? input.regionId : existingEvent.regionId;

    if (typeof nextRestaurantId === "number" && typeof nextRegionId === "number") {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Assign the event to a restaurant, a region, or all restaurants.",
        "INVALID_EVENT_TARGET",
      );
    }

    await ensureTargetExists({
      restaurantId: nextRestaurantId,
      regionId: nextRegionId,
    });

    const nextStartsAt = input.startsAt ?? existingEvent.startsAt;
    const nextEndsAt = input.endsAt ?? existingEvent.endsAt;

    if (nextEndsAt <= nextStartsAt) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "End time must be after the start time.",
        "INVALID_EVENT_SCHEDULE",
      );
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.restaurantId !== undefined ? { restaurantId: input.restaurantId } : {}),
        ...(input.regionId !== undefined ? { regionId: input.regionId } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.discountLabel !== undefined ? { discountLabel: input.discountLabel ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: eventSelect,
    });

    return mapEvent(event);
  },

  async remove(eventId: number) {
    await getEventById(eventId);

    await prisma.event.delete({
      where: { id: eventId },
    });
  },
};
