import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/api";
import { normalizeAuthUser } from "@/lib/auth";
import type { AuthUser, UserRole } from "@/types/auth";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type LookupItem = {
  id: number;
  name: string;
  description?: string | null;
};

type AdminUserBase = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: UserRole;
  regionId?: number | null;
  opsState?: string | null;
  opsDistrict?: string | null;
  opsNotes?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  walletBalance: number;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AdminUser = AdminUserBase;

export type AdminRegion = {
  id: number;
  name: string;
  districtName: string;
  stateName: string;
  code: string;
  slug: string;
  notes?: string | null;
  primaryPincode?: string | null;
  additionalPincodes: string[];
  isActive: boolean;
  managerUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  manager?: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    profileImage?: string | null;
    role: UserRole;
    isActive: boolean;
  } | null;
  counts: {
    restaurantsCount: number;
    deliveryPartnersCount: number;
    usersCount: number;
  };
};

export type AdminDashboard = {
  filters: {
    regionId?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  stats: {
    usersCount: number;
    restaurantsCount: number;
    restaurantOwnersCount: number;
    deliveryPartnersCount: number;
    ordersCount: number;
    deliveredOrders: number;
    activeOrders: number;
    pendingApplicationsCount: number;
    approvedApplicationsCount: number;
    rejectedApplicationsCount: number;
    grossMerchandiseValue: number;
  };
  ordersByStatus: Array<{
    status: string;
    count: number;
  }>;
  usersByRole: Array<{
    role: string;
    count: number;
  }>;
  applicationsByStatus: Array<{
    status: string;
    count: number;
  }>;
  applicationsByRole: Array<{
    roleType: string;
    count: number;
  }>;
  topRestaurants: Array<{
    id: number;
    name: string;
    slug: string;
    avgRating: number;
    totalReviews: number;
    costForTwo: number;
  }>;
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: number;
    orderedAt: string;
    restaurant: {
      id: number;
      name: string;
    };
    user: {
      id: number;
      fullName: string;
      email: string;
    };
  }>;
  recentUsers: Array<{
    id: number;
    fullName: string;
    email: string;
    role: string;
    createdAt: string;
    isActive: boolean;
  }>;
  regionMetrics: Array<{
    regionId: number;
    name: string;
    stateName: string;
    districtName: string;
    restaurantsCount: number;
    deliveryPartnersCount: number;
    usersCount: number;
    ordersCount: number;
  }>;
  dailyOrderTrends: Array<{
    date: string;
    label: string;
    value: number;
  }>;
  weeklyOrderTrends: Array<{
    date: string;
    label: string;
    value: number;
  }>;
  monthlyOrderTrends: Array<{
    date: string;
    label: string;
    value: number;
  }>;
};

export type AdminRestaurant = {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city: string;
  state: string;
  pincode: string;
  area?: string | null;
  coverImage?: string | null;
  avgRating: number;
  totalReviews: number;
  avgDeliveryTime: number;
  preparationTime: number;
  latitude?: number | null;
  longitude?: number | null;
  isVegOnly: boolean;
  isFeatured: boolean;
  isActive: boolean;
  costForTwo: number;
  createdAt: string;
  owner: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  categoryMappings: Array<{
    category: LookupItem;
  }>;
  cuisineMappings: Array<{
    cuisine: LookupItem;
  }>;
  _count: {
    menuItems: number;
    orders: number;
    reviews: number;
  };
};

export type AdminDeliveryPartner = {
  id: number;
  userId: number;
  vehicleType: string;
  vehicleNumber?: string | null;
  licenseNumber?: string | null;
  availabilityStatus: string;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationUpdatedAt?: string | null;
  avgRating: number;
  totalDeliveries: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    profileImage?: string | null;
    role: string;
    isActive: boolean;
    lastLoginAt?: string | null;
    createdAt: string;
  };
  documents: Array<{
    id: number;
    name: string;
    fileUrl: string;
    status: string;
    rejectionReason?: string | null;
    uploadedAt: string;
    reviewedAt?: string | null;
  }>;
  _count: {
    orders: number;
    documents: number;
  };
};

export type MenuCategory = {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminMenuItem = {
  id: number;
  restaurantId: number;
  categoryId: number;
  name: string;
  description?: string | null;
  image?: string | null;
  price: number;
  discountPrice?: number | null;
  foodType: string;
  isAvailable: boolean;
  isRecommended: boolean;
  preparationTime: number;
  calories?: number | null;
  spiceLevel?: number | null;
  createdAt: string;
  updatedAt: string;
  category: {
    id: number;
    name: string;
    description?: string | null;
  };
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  addons: Array<{
    id: number;
    name: string;
    price: number;
    isActive: boolean;
  }>;
};

export type AdminAddon = {
  id: number;
  restaurantId: number;
  menuItemId?: number | null;
  comboId?: number | null;
  name: string;
  description?: string | null;
  addonType: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  menuItem?: {
    id: number;
    name: string;
  } | null;
  combo?: {
    id: number;
    name: string;
  } | null;
};

export type AdminCombo = {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  image?: string | null;
  basePrice: number;
  offerPrice?: number | null;
  categoryTag?: string | null;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  restaurant: {
    id: number;
    ownerId: number;
    name: string;
    slug: string;
  };
  items: Array<{
    id: number;
    quantity: number;
    menuItem: {
      id: number;
      restaurantId: number;
      name: string;
      image?: string | null;
      price: number;
      discountPrice?: number | null;
      foodType: string;
      isAvailable: boolean;
      category: {
        id: number;
        name: string;
      };
    };
  }>;
  addons: Array<AdminAddon>;
};

export type AdminOrder = {
  id: number;
  userId: number;
  restaurantId: number;
  addressId: number;
  deliveryPartnerId?: number | null;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  totalAmount: number;
  assignmentRadiusKm?: number | null;
  routeDistanceKm?: number | null;
  travelDurationMinutes?: number | null;
  estimatedDeliveryMinutes?: number | null;
  trafficDelayMinutes: number;
  weatherDelayMinutes: number;
  delayMinutes: number;
  specialInstructions?: string | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  refundStatus?: string | null;
  orderedAt: string;
  confirmedAt?: string | null;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyForPickupAt?: string | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  onTheWayAt?: string | null;
  outForDeliveryAt?: string | null;
  delayedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  user: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  address: {
    id: number;
    title?: string | null;
    recipientName?: string | null;
    contactPhone?: string | null;
    houseNo?: string | null;
    street?: string | null;
    landmark?: string | null;
    area?: string | null;
    city: string;
    state: string;
    pincode: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  restaurant: {
    id: number;
    ownerId: number;
    name: string;
    slug: string;
    coverImage?: string | null;
    addressLine?: string | null;
    area?: string | null;
    city: string;
    state: string;
    pincode: string;
    latitude?: number | null;
    longitude?: number | null;
    avgDeliveryTime: number;
    preparationTime: number;
  };
  deliveryPartner?: {
    id: number;
    userId: number;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationUpdatedAt?: string | null;
    user: {
      id: number;
      fullName: string;
      phone?: string | null;
    };
  } | null;
  offer?: {
    id: number;
    code?: string | null;
    title: string;
    discountType: string;
    discountValue: number;
  } | null;
  items: Array<{
    id: number;
    menuItemId?: number | null;
    comboId?: number | null;
    itemType: string;
    itemSnapshot?: string | null;
    itemName: string;
    itemPrice: number;
    quantity: number;
    totalPrice: number;
    foodType?: string | null;
    menuItem?: {
      id: number;
      name: string;
    } | null;
    combo?: {
      id: number;
      name: string;
      image?: string | null;
      basePrice: number;
      offerPrice?: number | null;
    } | null;
    addons: Array<{
      id: number;
      addonName: string;
      addonPrice: number;
    }>;
  }>;
  payments: Array<{
    id: number;
    transactionId?: string | null;
    paymentGateway?: string | null;
    amount: number;
    status: string;
    paidAt?: string | null;
    createdAt: string;
  }>;
  statusEvents: Array<{
    id: number;
    status: string;
    note?: string | null;
    createdAt: string;
    actor?: {
      id: number;
      fullName: string;
      role: string;
    } | null;
  }>;
};

export type AdminOffer = {
  id: number;
  code?: string | null;
  title: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  scope: string;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminEvent = {
  id: number;
  title: string;
  description: string;
  restaurantId?: number | null;
  regionId?: number | null;
  imageUrl?: string | null;
  startsAt: string;
  endsAt: string;
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
  discountLabel?: string | null;
  totalSlots?: number | null;
  bookedSlots: number;
  slotPrice: number;
  maxTicketsPerUser?: number | null;
  refundAllowed: boolean;
  refundDeadline?: string | null;
  refundPercentage: number;
  cancellationFee: number;
  refundPolicyNote?: string | null;
  status: "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
  manualStatus: "ACTIVE" | "CANCELLED";
  lifecycleStatus: "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  appliesToAllRestaurants: boolean;
  remainingSlots?: number | null;
  bookingsCount: number;
  revenue: number;
  isSoldOut: boolean;
  isBookingClosed: boolean;
  isEventEnded: boolean;
  isLive: boolean;
  isCancelled: boolean;
  availabilityStatus: "AVAILABLE" | "SOLD_OUT" | "BOOKING_CLOSED" | "LIVE" | "EVENT_ENDED" | "CANCELLED";

  // Compatibility aliases
  maxAttendees?: number | null;
  attendeeCount: number;
  isFullyBooked: boolean;
  restaurant?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  region?: {
    id: number;
    name: string;
    districtName: string;
    stateName: string;
    slug: string;
  } | null;
};

export type AdminEventTemplate = {
  id: number;
  title: string;
  description: string;
  imageUrl?: string | null;
  suggestedDurationMinutes?: number | null;
  suggestedBookingWindowHours?: number | null;
  suggestedSlotPrice?: number | null;
  suggestedMaxSlots?: number | null;
  suggestedMaxTicketsPerUser?: number | null;
  suggestedOfferLabel?: string | null;
  setupChecklist: string[];
  requiredItems: string[];
  status: "ACTIVE" | "CANCELLED";
  createdByAdminId: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminEventAttendee = {
  id: number;
  userId: number;
  eventId: number;
  restaurantId: number;
  slotPrice?: number | null;
  quantity: number;
  subtotalAmount?: number | null;
  taxAmount?: number | null;
  platformFee?: number | null;
  discountAmount?: number | null;
  totalAmount: number;
  bookingCode: string;
  bookedAt: string;
  cancelledAt?: string | null;
  paymentStatus: "FREE" | "PAID" | "REFUNDED" | "PENDING" | "FAILED" | "REFUND_PENDING" | "PARTIALLY_REFUNDED";
  refundAllowed?: boolean | null;
  refundDeadline?: string | null;
  refundPercentage?: number | null;
  cancellationFee?: number | null;
  refundPolicyNote?: string | null;
  refundAmount?: number | null;
  refundStatus?: "NOT_REQUESTED" | "NOT_ELIGIBLE" | "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED" | "FAILED" | null;
  refundReason?: string | null;
  refundProcessedAt?: string | null;
  refundEligible?: boolean;
  bookingStatus?: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "ATTENDED" | "FAILED";
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "ATTENDED" | "FAILED";
  canCancel: boolean;
  isUpcoming: boolean;
  isPastEvent: boolean;
  hasActiveBooking: boolean;
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  user: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    profileImage?: string | null;
  };
};

export type AdminEventAttendeeReport = {
  event: AdminEvent;
  summary: {
    bookingsCount: number;
    pendingCount?: number;
    bookedSlots: number;
    confirmedCount: number;
    completedCount?: number;
    attendedCount: number;
    cancelledCount: number;
    failedCount?: number;
    refundedCount: number;
    totalSlots?: number | null;
    remainingSlots?: number | null;
    isSoldOut: boolean;
    isFullyBooked: boolean;
    isBookingClosed: boolean;
    revenue: number;
    totalTax?: number;
    refundedAmount?: number;
  };
  restaurantBreakdown: Array<{
    restaurant: {
      id: number;
      name: string;
      slug: string;
    };
    bookingsCount: number;
    bookedSlots: number;
    revenue: number;
  }>;
  bookings: AdminEventAttendee[];
  attendees: AdminEventAttendee[];
};

export type AdminReview = {
  id: number;
  userId: number;
  restaurantId: number;
  orderId?: number | null;
  rating: number;
  reviewText?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    profileImage?: string | null;
  };
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  order?: {
    id: number;
    orderNumber: string;
    status: string;
  } | null;
};

export type AdminNotification = {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  meta?: string | null;
  isRead: boolean;
  createdAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type AdminPayment = {
  id: number;
  orderId: number;
  transactionId?: string | null;
  paymentGateway?: string | null;
  amount: number;
  status: string;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: number;
    orderNumber: string;
    status: string;
    restaurant: {
      id: number;
      name: string;
    };
    user: {
      id: number;
      fullName: string;
      email: string;
    };
  };
};

export type Lookups = {
  cuisines: LookupItem[];
  restaurantCategories: LookupItem[];
};

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

export const toSessionUser = (user: AdminUser): AuthUser =>
  normalizeAuthUser({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? null,
    profileImage: user.profileImage ?? null,
    role: user.role,
    walletBalance: user.walletBalance,
  });

export const getAdminDashboard = async (params?: {
  regionId?: number;
  startDate?: string;
  endDate?: string;
}) => unwrapData(await apiClient.get<ApiEnvelope<AdminDashboard>>("/admin/analytics/dashboard", { params }));

export const getUsers = async (params?: {
  role?: UserRole;
  search?: string;
  isActive?: boolean;
}) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ users: AdminUser[] }>>("/users", { params })).users;

export const createUser = async (payload: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  managedRegionIds?: number[];
  assignedRegionIds?: number[];
  profileImage?: string;
  walletBalance?: number;
  isActive?: boolean;
  opsNotes?: string;
}) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ user: AdminUser }>>("/users", payload)).user;

export const updateUser = async (
  userId: number,
  payload: Partial<{
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    role: UserRole;
    managedRegionIds: number[];
    assignedRegionIds: number[];
    profileImage?: string;
    walletBalance?: number;
    isActive: boolean;
    opsNotes: string;
  }>,
) => unwrapData(await apiClient.patch<ApiEnvelope<{ user: AdminUser }>>(`/users/${userId}`, payload)).user;

export const disableUser = async (userId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<{ user: AdminUser }>>(`/users/${userId}`)).user;

export const getRegionsAdmin = async (params?: {
  search?: string;
  isActive?: boolean;
  assignmentStatus?: "ASSIGNED" | "UNASSIGNED";
}) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ regions: AdminRegion[] }>>("/regions", { params })).regions;

export const createRegionAdmin = async (payload: {
  name?: string;
  districtName: string;
  stateName: string;
  code?: string;
  slug?: string;
  notes?: string;
  primaryPincode?: string;
  additionalPincodes?: string[];
  isActive?: boolean;
  managerUserId?: number | null;
}) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ region: AdminRegion }>>("/regions", payload)).region;

export const updateRegionAdmin = async (
  regionId: number,
  payload: Partial<{
    name: string;
      districtName: string;
      stateName: string;
      code: string;
      slug: string;
      notes: string;
      primaryPincode: string;
      additionalPincodes: string[];
      isActive: boolean;
      managerUserId: number | null;
    }>,
) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ region: AdminRegion }>>(`/regions/${regionId}`, payload))
    .region;

export const getRestaurants = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ restaurants: AdminRestaurant[] }>>("/restaurants/admin/all"))
    .restaurants;

export const createRestaurant = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ restaurant: AdminRestaurant }>>("/restaurants", payload))
    .restaurant;

export const updateRestaurant = async (restaurantId: number, payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ restaurant: AdminRestaurant }>>(
      `/restaurants/${restaurantId}`,
      payload,
    ),
  ).restaurant;

export const archiveRestaurant = async (restaurantId: number) =>
  unwrapData(
    await apiClient.delete<ApiEnvelope<{ restaurant: AdminRestaurant }>>(`/restaurants/${restaurantId}`),
  ).restaurant;

export const getDeliveryPartners = async () =>
  unwrapData(
    await apiClient.get<ApiEnvelope<{ partners: AdminDeliveryPartner[] }>>("/delivery-partners/admin/all"),
  ).partners;

export const createDeliveryPartner = async (payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ partner: AdminDeliveryPartner }>>(
      "/delivery-partners/admin",
      payload,
    ),
  ).partner;

export const updateDeliveryPartner = async (partnerId: number, payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ partner: AdminDeliveryPartner }>>(
      `/delivery-partners/admin/${partnerId}`,
      payload,
    ),
  ).partner;

export const disableDeliveryPartner = async (partnerId: number) =>
  unwrapData(
    await apiClient.delete<ApiEnvelope<{ partner: AdminDeliveryPartner }>>(
      `/delivery-partners/admin/${partnerId}`,
    ),
  ).partner;

export const getMenuItems = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ items: AdminMenuItem[] }>>("/menu-items")).items;

export const getAddons = async (params?: {
  search?: string;
  restaurantId?: number;
  isActive?: boolean;
  parentType?: "MENU_ITEM" | "COMBO";
}) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ addons: AdminAddon[] }>>("/addons/admin/all", { params }))
    .addons;

export const createAddon = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ addon: AdminAddon }>>("/addons", payload)).addon;

export const updateAddon = async (addonId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ addon: AdminAddon }>>(`/addons/${addonId}`, payload)).addon;

export const deleteAddon = async (addonId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/addons/${addonId}`));

export const createMenuItem = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ item: AdminMenuItem }>>("/menu-items", payload)).item;

export const updateMenuItem = async (itemId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ item: AdminMenuItem }>>(`/menu-items/${itemId}`, payload)).item;

export const deleteMenuItem = async (itemId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/menu-items/${itemId}`));

export const getCombos = async (params?: {
  search?: string;
  restaurantId?: number;
  isActive?: boolean;
}) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ combos: AdminCombo[] }>>("/combos/admin/all", { params }))
    .combos;

export const createCombo = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ combo: AdminCombo }>>("/combos", payload)).combo;

export const updateCombo = async (comboId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ combo: AdminCombo }>>(`/combos/${comboId}`, payload)).combo;

export const deleteCombo = async (comboId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/combos/${comboId}`));

export const getOrders = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ orders: AdminOrder[] }>>("/orders")).orders;

export const updateOrderStatus = async (orderId: number, payload: { status: string; note?: string }) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ order: AdminOrder }>>(`/orders/${orderId}/status`, payload),
  ).order;

export const assignDeliveryPartnerToOrder = async (
  orderId: number,
  deliveryPartnerId: number,
  payload: {
    emergencyOverride?: true;
    overrideReason?: string;
  },
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ order: AdminOrder }>>(`/orders/${orderId}/assign-delivery`, {
      deliveryPartnerId,
      ...payload,
    }),
  ).order;

export const getOffers = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ offers: AdminOffer[] }>>("/offers/admin/all")).offers;

export const getEvents = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ events: AdminEvent[] }>>("/events")).events;

export const getEventTemplates = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ templates: AdminEventTemplate[] }>>("/admin/event-templates"))
    .templates;

export const createEventTemplate = async (payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ template: AdminEventTemplate }>>(
      "/admin/event-templates",
      payload,
    ),
  ).template;

export const updateEventTemplate = async (templateId: number, payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ template: AdminEventTemplate }>>(
      `/admin/event-templates/${templateId}`,
      payload,
    ),
  ).template;

export const deleteEventTemplate = async (templateId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/admin/event-templates/${templateId}`));

export const getEventAttendees = async (eventId: number) =>
  unwrapData(
    await apiClient.get<ApiEnvelope<AdminEventAttendeeReport>>(`/admin/events/${eventId}/bookings`),
  );

export const markEventBookingAttended = async (eventId: number, bookingId: number) =>
  unwrapData(
    await apiClient.patch<
      ApiEnvelope<{
        booking: AdminEventAttendee;
      }>
    >(`/admin/events/${eventId}/bookings/${bookingId}/attend`),
  ).booking;

export const updateEventBookingRefund = async (
  eventId: number,
  bookingId: number,
  payload: {
    action: "APPROVE" | "REJECT" | "PROCESS";
    refundReason?: string;
  },
) =>
  unwrapData(
    await apiClient.patch<
      ApiEnvelope<{
        booking: AdminEventAttendee;
      }>
    >(`/admin/events/${eventId}/bookings/${bookingId}/refund`, payload),
  ).booking;

export const createEvent = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ event: AdminEvent }>>("/admin/events", payload)).event;

export const updateEvent = async (eventId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ event: AdminEvent }>>(`/admin/events/${eventId}`, payload)).event;

export const deleteEvent = async (eventId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/admin/events/${eventId}`));

export const createOffer = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ offer: AdminOffer }>>("/offers", payload)).offer;

export const updateOffer = async (offerId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ offer: AdminOffer }>>(`/offers/${offerId}`, payload)).offer;

export const deleteOffer = async (offerId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/offers/${offerId}`));

export const getReviews = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ reviews: AdminReview[] }>>("/reviews/admin/all")).reviews;

export const deleteReview = async (reviewId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/reviews/${reviewId}`));

export const getLookups = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<Lookups>>("/categories/lookups"));

export const getMenuCategories = async (restaurantId: number) =>
  unwrapData(
    await apiClient.get<ApiEnvelope<{ categories: MenuCategory[] }>>(
      `/categories/restaurants/${restaurantId}/menu`,
    ),
  ).categories;

export const createMenuCategory = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ category: MenuCategory }>>("/categories/menu", payload))
    .category;

export const updateMenuCategory = async (categoryId: number, payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ category: MenuCategory }>>(
      `/categories/menu/${categoryId}`,
      payload,
    ),
  ).category;

export const deleteMenuCategory = async (categoryId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/categories/menu/${categoryId}`));

export const createCuisine = async (payload: { name: string }) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ cuisine: LookupItem }>>("/categories/admin/cuisines", payload),
  ).cuisine;

export const updateCuisine = async (cuisineId: number, payload: { name?: string }) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ cuisine: LookupItem }>>(
      `/categories/admin/cuisines/${cuisineId}`,
      payload,
    ),
  ).cuisine;

export const deleteCuisine = async (cuisineId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/categories/admin/cuisines/${cuisineId}`));

export const createRestaurantCategory = async (payload: { name: string; description?: string }) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ category: LookupItem }>>(
      "/categories/admin/restaurant-categories",
      payload,
    ),
  ).category;

export const updateRestaurantCategory = async (
  restaurantCategoryId: number,
  payload: { name?: string; description?: string },
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ category: LookupItem }>>(
      `/categories/admin/restaurant-categories/${restaurantCategoryId}`,
      payload,
    ),
  ).category;

export const deleteRestaurantCategory = async (restaurantCategoryId: number) =>
  unwrapData(
    await apiClient.delete<ApiEnvelope<void>>(
      `/categories/admin/restaurant-categories/${restaurantCategoryId}`,
    ),
  );

export const getNotifications = async () =>
  unwrapData(
    await apiClient.get<ApiEnvelope<{ notifications: AdminNotification[] }>>("/notifications/admin/all"),
  ).notifications;

export const createNotification = async (payload: {
  userId: number;
  title: string;
  message: string;
  type: string;
  meta?: string;
}) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ notification: AdminNotification }>>(
      "/notifications/admin",
      payload,
    ),
  ).notification;

export const deleteNotification = async (notificationId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/notifications/admin/${notificationId}`));

export const getPayments = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ payments: AdminPayment[] }>>("/payments")).payments;

export const getAdminProfile = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ user: AdminUser }>>("/auth/me")).user;

export const updateAdminProfile = async (payload: {
  fullName?: string;
  phone?: string;
  profileImage?: string;
}) => unwrapData(await apiClient.patch<ApiEnvelope<{ user: AdminUser }>>("/users/me", payload)).user;
