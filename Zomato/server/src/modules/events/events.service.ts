import { Prisma } from "@prisma/client";
import { EventAttendanceStatus, EventStatus } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { notificationsService } from "../notifications/notifications.service.js";

const ACTIVE_ATTENDANCE_STATUSES = [
  EventAttendanceStatus.JOINED,
  EventAttendanceStatus.ATTENDED,
] as const;

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
  maxAttendees: true,
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

const attendeeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
} satisfies Prisma.UserSelect;

const eventAttendanceSelect = {
  id: true,
  userId: true,
  eventId: true,
  restaurantId: true,
  joinedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  event: {
    select: eventSelect,
  },
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  user: {
    select: attendeeUserSelect,
  },
} satisfies Prisma.EventAttendanceSelect;

type EventRecord = Prisma.EventGetPayload<{ select: typeof eventSelect }>;
type EventAttendanceRecord = Prisma.EventAttendanceGetPayload<{ select: typeof eventAttendanceSelect }>;
type RestaurantContext = NonNullable<EventRecord["restaurant"]>;
type AttendanceStatusValue = (typeof EventAttendanceStatus)[keyof typeof EventAttendanceStatus];

const getEffectiveEventStatus = (event: Pick<EventRecord, "status" | "endsAt">) => {
  if (event.status === EventStatus.INACTIVE) {
    return EventStatus.INACTIVE;
  }

  if (event.status === EventStatus.EXPIRED) {
    return EventStatus.EXPIRED;
  }

  return event.endsAt.getTime() < Date.now() ? EventStatus.EXPIRED : EventStatus.ACTIVE;
};

const getEffectiveAttendanceStatus = ({
  status,
  endsAt,
}: {
  status: string;
  endsAt: Date;
}) => {
  if (status === EventAttendanceStatus.CANCELLED) {
    return EventAttendanceStatus.CANCELLED;
  }

  if (status === EventAttendanceStatus.ATTENDED) {
    return EventAttendanceStatus.ATTENDED;
  }

  return endsAt.getTime() < Date.now() ? EventAttendanceStatus.ATTENDED : EventAttendanceStatus.JOINED;
};

const buildEventWhere = (
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

const getEventAttendanceSummary = async (eventIds: number[]) => {
  if (!eventIds.length) {
    return {
      attendeeCountByEventId: new Map<number, number>(),
      currentUserAttendanceByEventId: new Map<
        number,
        {
          restaurantId: number;
          status: string;
          joinedAt: Date;
        }
      >(),
    };
  }

  const activeAttendances = await prisma.eventAttendance.findMany({
    where: {
      eventId: { in: eventIds },
      status: {
        in: [...ACTIVE_ATTENDANCE_STATUSES],
      },
    },
    select: {
      eventId: true,
    },
  });

  const attendeeCountByEventId = activeAttendances.reduce((counts, attendance) => {
    counts.set(attendance.eventId, (counts.get(attendance.eventId) ?? 0) + 1);
    return counts;
  }, new Map<number, number>());

  return {
    attendeeCountByEventId,
    currentUserAttendanceByEventId: new Map<
      number,
      {
        restaurantId: number;
        status: string;
        joinedAt: Date;
      }
    >(),
  };
};

const getCurrentUserAttendanceByEventId = async (eventIds: number[], userId?: number) => {
  const currentUserAttendanceByEventId = new Map<
    number,
    {
      restaurantId: number;
      status: string;
      joinedAt: Date;
    }
  >();

  if (!userId || !eventIds.length) {
    return currentUserAttendanceByEventId;
  }

  const attendances = await prisma.eventAttendance.findMany({
    where: {
      eventId: { in: eventIds },
      userId,
      status: {
        not: EventAttendanceStatus.CANCELLED,
      },
    },
    select: {
      eventId: true,
      restaurantId: true,
      status: true,
      joinedAt: true,
    },
  });

  attendances.forEach((attendance) => {
    currentUserAttendanceByEventId.set(attendance.eventId, {
      restaurantId: attendance.restaurantId,
      status: attendance.status,
      joinedAt: attendance.joinedAt,
    });
  });

  return currentUserAttendanceByEventId;
};

const mapEvent = (
  event: EventRecord,
  options?: {
    attendeeCount?: number;
    currentUserAttendance?: {
      restaurantId: number;
      status: string;
      joinedAt: Date;
    } | null;
    restaurantOverride?: RestaurantContext | null;
  },
) => {
  const attendeeCount = options?.attendeeCount ?? 0;
  const maxAttendees = event.maxAttendees ?? null;
  const remainingSlots =
    maxAttendees == null ? null : Math.max(maxAttendees - attendeeCount, 0);
  const effectiveAttendanceStatus = options?.currentUserAttendance
    ? getEffectiveAttendanceStatus({
        status: options.currentUserAttendance.status,
        endsAt: event.endsAt,
      })
    : null;

  return {
    ...event,
    restaurant: options?.restaurantOverride ?? event.restaurant,
    status: getEffectiveEventStatus(event),
    appliesToAllRestaurants: !event.restaurantId && !event.regionId,
    maxAttendees,
    attendeeCount,
    remainingSlots,
    isFullyBooked: maxAttendees != null ? attendeeCount >= maxAttendees : false,
    attendanceStatus: effectiveAttendanceStatus,
    isJoined:
      effectiveAttendanceStatus === EventAttendanceStatus.JOINED ||
      effectiveAttendanceStatus === EventAttendanceStatus.ATTENDED,
    joinedAt: options?.currentUserAttendance?.joinedAt ?? null,
  };
};

const mapEventAttendance = (
  attendance: EventAttendanceRecord,
  attendeeCountByEventId: Map<number, number>,
) => {
  const status = getEffectiveAttendanceStatus({
    status: attendance.status,
    endsAt: attendance.event.endsAt,
  });

  return {
    id: attendance.id,
    userId: attendance.userId,
    eventId: attendance.eventId,
    restaurantId: attendance.restaurantId,
    joinedAt: attendance.joinedAt,
    status,
    createdAt: attendance.createdAt,
    updatedAt: attendance.updatedAt,
    restaurant: attendance.restaurant,
    event: mapEvent(attendance.event, {
      attendeeCount: attendeeCountByEventId.get(attendance.eventId) ?? 0,
      currentUserAttendance: {
        restaurantId: attendance.restaurantId,
        status: attendance.status,
        joinedAt: attendance.joinedAt,
      },
    }),
  };
};

const getRestaurantJoinContext = async (restaurantId: number) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      regionId: true,
      ownerId: true,
      isActive: true,
    },
  });

  if (!restaurant || !restaurant.isActive) {
    throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  return restaurant;
};

const assertEventMatchesRestaurant = async (event: EventRecord, restaurantId: number) => {
  const restaurant = await getRestaurantJoinContext(restaurantId);
  const effectiveStatus = getEffectiveEventStatus(event);

  if (effectiveStatus !== EventStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only active events can be joined right now.",
      "EVENT_NOT_ACTIVE",
    );
  }

  if (event.restaurantId && event.restaurantId !== restaurantId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This event is not available for the selected restaurant.",
      "EVENT_RESTAURANT_MISMATCH",
    );
  }

  if (event.regionId && restaurant.regionId !== event.regionId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This event is not available for the selected restaurant.",
      "EVENT_REGION_MISMATCH",
    );
  }

  return restaurant;
};

const sortMyEvents = <
  T extends {
    event: {
      startsAt: Date;
      endsAt: Date;
    };
    status: AttendanceStatusValue;
  },
>(
  left: T,
  right: T,
) => {
  const leftUpcoming = left.status === EventAttendanceStatus.JOINED;
  const rightUpcoming = right.status === EventAttendanceStatus.JOINED;

  if (leftUpcoming !== rightUpcoming) {
    return leftUpcoming ? -1 : 1;
  }

  if (leftUpcoming) {
    return left.event.startsAt.getTime() - right.event.startsAt.getTime();
  }

  return right.event.endsAt.getTime() - left.event.endsAt.getTime();
};

export const eventsService = {
  async listAdmin(query: {
    search?: string;
    restaurantId?: number;
    regionId?: number;
    status?: string;
  }) {
    const events = await prisma.event.findMany({
      where: buildEventWhere(query, "admin"),
      select: eventSelect,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    });
    const { attendeeCountByEventId } = await getEventAttendanceSummary(events.map((event) => event.id));

    return events.map((event) =>
      mapEvent(event, {
        attendeeCount: attendeeCountByEventId.get(event.id) ?? 0,
      }),
    );
  },

  async listPublic(
    query: {
      search?: string;
      restaurantId?: number;
      regionId?: number;
    },
    userId?: number,
  ) {
    const events = await prisma.event.findMany({
      where: buildEventWhere(query, "public"),
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });
    const eventIds = events.map((event) => event.id);
    const [{ attendeeCountByEventId }, currentUserAttendanceByEventId] = await Promise.all([
      getEventAttendanceSummary(eventIds),
      getCurrentUserAttendanceByEventId(eventIds, userId),
    ]);

    return events.map((event) =>
      mapEvent(event, {
        attendeeCount: attendeeCountByEventId.get(event.id) ?? 0,
        currentUserAttendance: currentUserAttendanceByEventId.get(event.id) ?? null,
      }),
    );
  },

  async listForRestaurantPublic(restaurantId: number, userId?: number) {
    const restaurant = await getRestaurantJoinContext(restaurantId);

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
    const eventIds = events.map((event) => event.id);
    const [{ attendeeCountByEventId }, currentUserAttendanceByEventId] = await Promise.all([
      getEventAttendanceSummary(eventIds),
      getCurrentUserAttendanceByEventId(eventIds, userId),
    ]);

    return events.map((event) =>
      mapEvent(event, {
        attendeeCount: attendeeCountByEventId.get(event.id) ?? 0,
        currentUserAttendance: currentUserAttendanceByEventId.get(event.id) ?? null,
        restaurantOverride: {
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
    maxAttendees?: number | null;
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
        maxAttendees: input.maxAttendees ?? null,
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
      maxAttendees: number | null;
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
        ...(input.maxAttendees !== undefined ? { maxAttendees: input.maxAttendees ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: eventSelect,
    });

    const { attendeeCountByEventId } = await getEventAttendanceSummary([event.id]);

    return mapEvent(event, {
      attendeeCount: attendeeCountByEventId.get(event.id) ?? 0,
    });
  },

  async remove(eventId: number) {
    await getEventById(eventId);

    await prisma.event.delete({
      where: { id: eventId },
    });
  },

  async join(userId: number, eventId: number, restaurantId: number) {
    const event = await getEventById(eventId);
    const restaurant = await assertEventMatchesRestaurant(event, restaurantId);

    const attendance = await prisma.$transaction(async (tx) => {
      const existingAttendance = await tx.eventAttendance.findFirst({
        where: {
          eventId,
          userId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingAttendance && existingAttendance.status !== EventAttendanceStatus.CANCELLED) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "You have already joined this event.",
          "EVENT_ALREADY_JOINED",
        );
      }

      const attendeeCount = await tx.eventAttendance.count({
        where: {
          eventId,
          status: {
            in: [...ACTIVE_ATTENDANCE_STATUSES],
          },
        },
      });

      if (event.maxAttendees != null && attendeeCount >= event.maxAttendees) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "This event is fully booked right now.",
          "EVENT_FULL",
        );
      }

      if (existingAttendance) {
        await tx.eventAttendance.update({
          where: { id: existingAttendance.id },
          data: {
            restaurantId,
            joinedAt: new Date(),
            status: EventAttendanceStatus.JOINED,
          },
        });
      } else {
        await tx.eventAttendance.create({
          data: {
            userId,
            eventId,
            restaurantId,
            joinedAt: new Date(),
            status: EventAttendanceStatus.JOINED,
          },
        });
      }

      return tx.eventAttendance.findFirstOrThrow({
        where: {
          eventId,
          userId,
        },
        select: eventAttendanceSelect,
      });
    });

    await notificationsService.createForUser({
      userId,
      title: "Event joined successfully",
      message: `You successfully joined the ${event.title} event at ${restaurant.name}.`,
      meta: {
        eventId,
        restaurantId,
        path: "/my-events",
        eventKey: `event:join:${eventId}`,
      },
      dedupeWindowMinutes: 1,
    });

    const { attendeeCountByEventId } = await getEventAttendanceSummary([eventId]);

    return {
      attendance: mapEventAttendance(attendance, attendeeCountByEventId),
      event: mapEvent(event, {
        attendeeCount: attendeeCountByEventId.get(eventId) ?? 0,
        currentUserAttendance: {
          restaurantId: attendance.restaurantId,
          status: attendance.status,
          joinedAt: attendance.joinedAt,
        },
      }),
    };
  },

  async cancel(userId: number, eventId: number) {
    const attendance = await prisma.eventAttendance.findFirst({
      where: {
        eventId,
        userId,
      },
      select: eventAttendanceSelect,
    });

    if (!attendance || attendance.status === EventAttendanceStatus.CANCELLED) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Event attendance not found.",
        "EVENT_ATTENDANCE_NOT_FOUND",
      );
    }

    const effectiveStatus = getEffectiveAttendanceStatus({
      status: attendance.status,
      endsAt: attendance.event.endsAt,
    });

    if (effectiveStatus !== EventAttendanceStatus.JOINED) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Past events cannot be cancelled.",
        "EVENT_CANNOT_BE_CANCELLED",
      );
    }

    const cancelledAttendance = await prisma.eventAttendance.update({
      where: { id: attendance.id },
      data: {
        status: EventAttendanceStatus.CANCELLED,
      },
      select: eventAttendanceSelect,
    });

    const { attendeeCountByEventId } = await getEventAttendanceSummary([eventId]);

    return {
      attendance: mapEventAttendance(cancelledAttendance, attendeeCountByEventId),
      event: mapEvent(cancelledAttendance.event, {
        attendeeCount: attendeeCountByEventId.get(eventId) ?? 0,
      }),
    };
  },

  async listMyEvents(userId: number) {
    const attendances = await prisma.eventAttendance.findMany({
      where: {
        userId,
        status: {
          not: EventAttendanceStatus.CANCELLED,
        },
      },
      select: eventAttendanceSelect,
      orderBy: [{ joinedAt: "desc" }],
    });
    const { attendeeCountByEventId } = await getEventAttendanceSummary(
      attendances.map((attendance) => attendance.eventId),
    );

    return attendances
      .map((attendance) => mapEventAttendance(attendance, attendeeCountByEventId))
      .sort(sortMyEvents);
  },

  async listAttendeesForAdmin(eventId: number) {
    const event = await getEventById(eventId);
    const attendances = await prisma.eventAttendance.findMany({
      where: {
        eventId,
      },
      select: eventAttendanceSelect,
      orderBy: [{ joinedAt: "desc" }],
    });
    const { attendeeCountByEventId } = await getEventAttendanceSummary([eventId]);
    const attendeeCount = attendeeCountByEventId.get(eventId) ?? 0;

    const attendees = attendances.map((attendance) => {
      const status = getEffectiveAttendanceStatus({
        status: attendance.status,
        endsAt: attendance.event.endsAt,
      });

      return {
        id: attendance.id,
        userId: attendance.userId,
        eventId: attendance.eventId,
        restaurantId: attendance.restaurantId,
        joinedAt: attendance.joinedAt,
        status,
        user: attendance.user,
        restaurant: attendance.restaurant,
      };
    });

    const restaurantBreakdownMap = new Map<
      number,
      {
        restaurant: {
          id: number;
          name: string;
          slug: string;
        };
        attendeeCount: number;
      }
    >();
    let joinedCount = 0;
    let attendedCount = 0;
    let cancelledCount = 0;

    attendees.forEach((attendance) => {
      if (attendance.status === EventAttendanceStatus.CANCELLED) {
        cancelledCount += 1;
        return;
      }

      if (attendance.status === EventAttendanceStatus.ATTENDED) {
        attendedCount += 1;
      } else {
        joinedCount += 1;
      }

      const current = restaurantBreakdownMap.get(attendance.restaurant.id);
      restaurantBreakdownMap.set(attendance.restaurant.id, {
        restaurant: attendance.restaurant,
        attendeeCount: (current?.attendeeCount ?? 0) + 1,
      });
    });

    return {
      event: mapEvent(event, { attendeeCount }),
      summary: {
        attendeeCount,
        joinedCount,
        attendedCount,
        cancelledCount,
        remainingSlots:
          event.maxAttendees == null ? null : Math.max(event.maxAttendees - attendeeCount, 0),
        isFullyBooked: event.maxAttendees != null ? attendeeCount >= event.maxAttendees : false,
        maxAttendees: event.maxAttendees ?? null,
      },
      restaurantBreakdown: [...restaurantBreakdownMap.values()].sort(
        (left, right) => right.attendeeCount - left.attendeeCount,
      ),
      attendees,
    };
  },

  async listOwnerParticipation(userId: number) {
    const ownedRestaurants = await prisma.restaurant.findMany({
      where: {
        ownerId: userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        regionId: true,
      },
      orderBy: { name: "asc" },
    });

    if (!ownedRestaurants.length) {
      return [];
    }

    const ownedRestaurantIds = ownedRestaurants.map((restaurant) => restaurant.id);
    const ownedRegionIds = [...new Set(ownedRestaurants.flatMap((restaurant) => (restaurant.regionId ? [restaurant.regionId] : [])))];

    const events = await prisma.event.findMany({
      where: {
        status: EventStatus.ACTIVE,
        endsAt: {
          gte: new Date(),
        },
        OR: [
          { restaurantId: { in: ownedRestaurantIds } },
          ...(ownedRegionIds.length ? [{ regionId: { in: ownedRegionIds } }] : []),
          {
            restaurantId: null,
            regionId: null,
          },
        ],
      },
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });

    if (!events.length) {
      return [];
    }

    const eventIds = events.map((event) => event.id);
    const [allActiveAttendances, ownerAttendances] = await Promise.all([
      prisma.eventAttendance.findMany({
        where: {
          eventId: { in: eventIds },
          status: {
            in: [...ACTIVE_ATTENDANCE_STATUSES],
          },
        },
        select: {
          eventId: true,
        },
      }),
      prisma.eventAttendance.findMany({
        where: {
          eventId: { in: eventIds },
          restaurantId: { in: ownedRestaurantIds },
          status: {
            in: [...ACTIVE_ATTENDANCE_STATUSES],
          },
        },
        select: eventAttendanceSelect,
        orderBy: [{ joinedAt: "desc" }],
      }),
    ]);

    const attendeeCountByEventId = allActiveAttendances.reduce((counts, attendance) => {
      counts.set(attendance.eventId, (counts.get(attendance.eventId) ?? 0) + 1);
      return counts;
    }, new Map<number, number>());

    const restaurantAttendanceCountByKey = ownerAttendances.reduce((counts, attendance) => {
      const key = `${attendance.eventId}:${attendance.restaurantId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    const joinedUsersByKey = ownerAttendances.reduce((groups, attendance) => {
      const key = `${attendance.eventId}:${attendance.restaurantId}`;
      const group = groups.get(key) ?? [];

      if (group.length < 5) {
        group.push({
          id: attendance.id,
          userId: attendance.userId,
          joinedAt: attendance.joinedAt,
          status: getEffectiveAttendanceStatus({
            status: attendance.status,
            endsAt: attendance.event.endsAt,
          }),
          user: attendance.user,
        });
      }

      groups.set(key, group);
      return groups;
    }, new Map<string, Array<{
      id: number;
      userId: number;
      joinedAt: Date;
      status: AttendanceStatusValue;
      user: EventAttendanceRecord["user"];
    }>>());

    const eventById = new Map(events.map((event) => [event.id, event]));

    return ownedRestaurants.flatMap((restaurant) => {
      const applicableEvents = events.filter(
        (event) =>
          event.restaurantId === restaurant.id ||
          (event.regionId != null && event.regionId === restaurant.regionId) ||
          (!event.restaurantId && !event.regionId),
      );

      return applicableEvents.map((event) => {
        const key = `${event.id}:${restaurant.id}`;
        const mappedEvent = mapEvent(eventById.get(event.id) ?? event, {
          attendeeCount: attendeeCountByEventId.get(event.id) ?? 0,
        });

        return {
          event: mappedEvent,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
          },
          restaurantAttendeeCount: restaurantAttendanceCountByKey.get(key) ?? 0,
          joinedUsers: joinedUsersByKey.get(key) ?? [],
        };
      });
    });
  },
};
