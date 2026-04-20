import type { AxiosResponse } from "axios";
import { apiClient, publicApi } from "@/lib/api";
import { normalizeAuthUser } from "@/lib/auth";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

type CustomerProfileApiUser = Parameters<typeof normalizeAuthUser>[0];

export type CustomerAddon = {
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
};

export type CustomerRestaurantSummary = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  logoImage?: string | null;
  addressLine?: string | null;
  area?: string | null;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  avgRating: number;
  totalReviews: number;
  costForTwo: number;
  avgDeliveryTime: number;
  preparationTime: number;
  isVegOnly: boolean;
  isFeatured: boolean;
  cuisineMappings: Array<{
    cuisine: {
      id: number;
      name: string;
    };
  }>;
  offers: Array<{
    offer: {
      id: number;
      code?: string | null;
      title: string;
      discountType: string;
      discountValue: number;
    };
  }>;
};

export type CustomerFavoriteRestaurant = {
  id: number;
  userId: number;
  restaurantId: number;
  createdAt: string;
  restaurant: {
    id: number;
    name: string;
    slug: string;
    coverImage?: string | null;
    avgRating: number;
    avgDeliveryTime: number;
    costForTwo: number;
    area?: string | null;
    addressLine?: string | null;
    city: string;
    state: string;
    cuisineMappings: Array<{
      cuisine: {
        id: number;
        name: string;
      };
    }>;
  };
};

export type CustomerMenuItem = {
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
  addons: CustomerAddon[];
};

export type CustomerCombo = {
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
  items: Array<{
    id: number;
    quantity: number;
    menuItem: {
      id: number;
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
  addons: CustomerAddon[];
};

export type CustomerRestaurantDetail = CustomerRestaurantSummary & {
  openingTime?: string | null;
  closingTime?: string | null;
  addressLine?: string | null;
  state: string;
  pincode: string;
  categoryMappings: Array<{
    category: {
      id: number;
      name: string;
    };
  }>;
  operatingHours: Array<{
    id: number;
    dayOfWeek: number;
    openTime?: string | null;
    closeTime?: string | null;
    isClosed: boolean;
  }>;
  menuCategories: Array<{
    id: number;
    name: string;
    description?: string | null;
    isActive: boolean;
    sortOrder: number;
    menuItems: CustomerMenuItem[];
  }>;
  combos: CustomerCombo[];
  reviews: Array<{
    id: number;
    rating: number;
    reviewText?: string | null;
    createdAt: string;
    user: {
      id: number;
      fullName: string;
      profileImage?: string | null;
    };
  }>;
};

export type CustomerCartItem = {
  id: number;
  cartId: number;
  menuItemId?: number | null;
  comboId?: number | null;
  itemType: string;
  itemSnapshot?: string | null;
  quantity: number;
  itemPrice: number;
  totalPrice: number;
  specialInstructions?: string | null;
  createdAt: string;
  updatedAt: string;
  menuItem?: {
    id: number;
    name: string;
    image?: string | null;
    price: number;
    discountPrice?: number | null;
    isAvailable: boolean;
    restaurantId: number;
  } | null;
  combo?: {
    id: number;
    name: string;
    description?: string | null;
    image?: string | null;
    basePrice: number;
    offerPrice?: number | null;
    categoryTag?: string | null;
    isAvailable: boolean;
    isActive: boolean;
    items: Array<{
      quantity: number;
      menuItem: {
        id: number;
        name: string;
        image?: string | null;
      };
    }>;
  } | null;
  addons: Array<{
    id: number;
    addonId: number;
    addonPrice: number;
    addon: CustomerAddon;
  }>;
  snapshot?: {
    includedItems?: Array<{
      menuItemId: number;
      name: string;
      image?: string | null;
      quantity: number;
    }>;
    categoryTag?: string | null;
  } | null;
};

export type CustomerCart = {
  id: number;
  userId: number;
  restaurantId: number;
  offerId?: number | null;
  totalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  createdAt: string;
  updatedAt: string;
  restaurant: {
    id: number;
    name: string;
    slug: string;
    coverImage?: string | null;
    avgDeliveryTime: number;
    costForTwo: number;
  };
  offer?: {
    id: number;
    code?: string | null;
    title: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    maxDiscount?: number | null;
    scope: string;
  } | null;
  items: CustomerCartItem[];
  summary: {
    subtotal: number;
    deliveryFee: number;
    taxAmount: number;
    discountAmount: number;
    payableTotal: number;
  };
};

export type CustomerAddress = {
  id: number;
  addressType: string;
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
  isDefault: boolean;
  isServiceable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddressPayload = {
  addressType: string;
  title?: string;
  recipientName: string;
  contactPhone: string;
  houseNo?: string;
  street: string;
  landmark?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
};

export type CustomerPaymentMethod = {
  id: number;
  type: "CARD" | "UPI";
  label?: string | null;
  holderName?: string | null;
  maskedEnding?: string | null;
  expiryMonth?: string | null;
  expiryYear?: string | null;
  upiId?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPaymentMethodPayload =
  | {
      type: "CARD";
      label: string;
      holderName: string;
      maskedEnding: string;
      expiryMonth: string;
      expiryYear: string;
      isPrimary?: boolean;
    }
  | {
      type: "UPI";
      label?: string;
      upiId: string;
      isPrimary?: boolean;
    };

export type CustomerOffer = {
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
  restaurantLinks: Array<{
    restaurant: {
      id: number;
      name: string;
      slug: string;
    };
  }>;
};

export type PendingCustomerCouponSelection = {
  code: string;
  cartId?: number | null;
};

export type PublicRestaurantQuery = {
  search?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};

export type CustomerLocationLookup = {
  latitude: number;
  longitude: number;
  address: string;
};

export type CustomerOrder = {
  id: number;
  userId: number;
  restaurantId: number;
  addressId: number;
  deliveryPartnerId?: number | null;
  offerId?: number | null;
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
  routeDistanceKm?: number | null;
  travelDurationMinutes?: number | null;
  estimatedDeliveryMinutes?: number | null;
  trafficDelayMinutes: number;
  weatherDelayMinutes: number;
  delayMinutes: number;
  specialInstructions?: string | null;
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
  address: CustomerAddress;
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
  review?: {
    id: number;
    restaurantId: number;
    orderId?: number | null;
    rating: number;
    reviewText?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

const PENDING_CUSTOMER_COUPON_STORAGE_PREFIX = "zomato-luxe-pending-coupon";

const getPendingCustomerCouponStorageKey = (userId?: number | null) =>
  `${PENDING_CUSTOMER_COUPON_STORAGE_PREFIX}:${userId ?? "guest"}`;

export const readPendingCustomerCouponSelection = (
  userId?: number | null,
): PendingCustomerCouponSelection | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getPendingCustomerCouponStorageKey(userId));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as PendingCustomerCouponSelection;
    return parsedValue.code?.trim() ? parsedValue : null;
  } catch {
    return null;
  }
};

export const writePendingCustomerCouponSelection = (
  userId: number | null | undefined,
  value: PendingCustomerCouponSelection,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getPendingCustomerCouponStorageKey(userId), JSON.stringify(value));
};

export const clearPendingCustomerCouponSelection = (userId?: number | null) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getPendingCustomerCouponStorageKey(userId));
};

export const getPublicRestaurants = async (params?: PublicRestaurantQuery) =>
  unwrapData(
    await publicApi.get<
      ApiEnvelope<{
        restaurants: CustomerRestaurantSummary[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>
    >("/restaurants", { params }),
  ).restaurants;

export const geocodeCustomerLocation = async (query: string) =>
  unwrapData(
    await publicApi.get<ApiEnvelope<{ location: CustomerLocationLookup }>>("/geo/search", {
      params: { query },
    }),
  ).location;

export const reverseGeocodeCustomerLocation = async (payload: {
  latitude: number;
  longitude: number;
}) =>
  unwrapData(
    await publicApi.get<ApiEnvelope<{ location: CustomerLocationLookup }>>("/geo/reverse", {
      params: payload,
    }),
  ).location;

export const getPublicRestaurantBySlug = async (
  slug: string,
  params?: Pick<PublicRestaurantQuery, "latitude" | "longitude" | "radiusKm">,
) =>
  unwrapData(
    await publicApi.get<ApiEnvelope<{ restaurant: CustomerRestaurantDetail }>>(`/restaurants/${slug}`, {
      params,
    }),
  ).restaurant;

export const getPublicOffers = async () =>
  unwrapData(await publicApi.get<ApiEnvelope<{ offers: CustomerOffer[] }>>("/offers")).offers;

export const getCustomerCarts = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ carts: CustomerCart[] }>>("/carts")).carts;

export const applyCustomerCartOffer = async (cartId: number, code: string) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ cart: CustomerCart }>>(`/carts/${cartId}/apply-offer`, {
      code,
    }),
  ).cart;

export const removeCustomerCartOffer = async (cartId: number) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ cart: CustomerCart }>>(`/carts/${cartId}/remove-offer`)).cart;

export const addCustomerCartItem = async (payload: {
  restaurantId: number;
  menuItemId?: number;
  comboId?: number;
  quantity: number;
  addonIds?: number[];
  specialInstructions?: string;
}) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ cart: CustomerCart }>>("/carts/items", payload)).cart;

export const updateCustomerCartItem = async (
  cartItemId: number,
  payload: { quantity?: number; addonIds?: number[]; specialInstructions?: string },
) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ cart: CustomerCart }>>(`/carts/items/${cartItemId}`, payload))
    .cart;

export const removeCustomerCartItem = async (cartItemId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<{ cart: CustomerCart | null }>>(`/carts/items/${cartItemId}`))
    .cart;

export const clearCustomerCart = async (cartId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/carts/${cartId}`));

export const getCustomerAddresses = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ addresses: CustomerAddress[] }>>("/addresses")).addresses;

export const getCustomerPaymentMethods = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ paymentMethods: CustomerPaymentMethod[] }>>("/payments/methods"))
    .paymentMethods;

export const createCustomerPaymentMethod = async (payload: CustomerPaymentMethodPayload) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ paymentMethod: CustomerPaymentMethod }>>("/payments/methods", payload),
  ).paymentMethod;

export const updateCustomerPaymentMethod = async (
  paymentMethodId: number,
  payload: CustomerPaymentMethodPayload,
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ paymentMethod: CustomerPaymentMethod }>>(
      `/payments/methods/${paymentMethodId}`,
      payload,
    ),
  ).paymentMethod;

export const updateCustomerProfile = async (payload: {
  fullName?: string;
  phone?: string;
  profileImage?: string;
}) =>
  normalizeAuthUser(
    unwrapData(await apiClient.patch<ApiEnvelope<{ user: CustomerProfileApiUser }>>("/users/me", payload)).user,
  );

export const updateCustomerMembership = async (payload: {
  tier: "CLASSIC" | "GOLD" | "PLATINUM";
  paymentMode?: "CARD" | "UPI";
  paymentMethodId?: number;
}) =>
  normalizeAuthUser(
    unwrapData(
      await apiClient.patch<ApiEnvelope<{ user: CustomerProfileApiUser }>>("/users/me/membership", payload),
    ).user,
  );

export const createCustomerAddress = async (payload: CustomerAddressPayload) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ address: CustomerAddress }>>("/addresses", payload)).address;

export const updateCustomerAddress = async (
  addressId: number,
  payload: Partial<CustomerAddressPayload>,
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ address: CustomerAddress }>>(`/addresses/${addressId}`, payload),
  ).address;

export const deleteCustomerAddress = async (addressId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/addresses/${addressId}`));

export const placeCustomerOrder = async (payload: {
  cartId: number;
  addressId: number;
  paymentMethod: string;
  tipAmount?: number;
  specialInstructions?: string;
}) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ order: CustomerOrder }>>("/orders", payload)).order;

export const getCustomerOrders = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ orders: CustomerOrder[] }>>("/orders")).orders;

export const getCustomerOrderById = async (orderId: number) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ order: CustomerOrder }>>(`/orders/${orderId}`)).order;

export const getCustomerFavorites = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ favorites: CustomerFavoriteRestaurant[] }>>("/favorites")).favorites;

export const addCustomerFavorite = async (restaurantId: number) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ favorite: CustomerFavoriteRestaurant }>>(`/favorites/${restaurantId}`),
  ).favorite;

export const removeCustomerFavorite = async (restaurantId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/favorites/${restaurantId}`));

export const createCustomerReview = async (payload: {
  restaurantId: number;
  orderId: number;
  rating: number;
  reviewText?: string;
}) =>
  unwrapData(
    await apiClient.post<
      ApiEnvelope<{
        review: NonNullable<CustomerOrder["review"]>;
      }>
    >("/reviews", payload),
  ).review;

export const updateCustomerReview = async (
  reviewId: number,
  payload: {
    rating?: number;
    reviewText?: string;
  },
) =>
  unwrapData(
    await apiClient.patch<
      ApiEnvelope<{
        review: NonNullable<CustomerOrder["review"]>;
      }>
    >(`/reviews/${reviewId}`, payload),
  ).review;
