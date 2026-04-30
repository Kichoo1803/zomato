import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/api";
import {
  toSessionUser,
  type AdminAddon,
  type AdminCombo,
  type AdminMenuItem,
  type AdminNotification,
  type AdminOrder,
  type AdminReview,
  type AdminUser,
} from "@/lib/admin";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type StatusBreakdown = {
  status: string;
  count: number;
};

type RestaurantBadge = {
  id: number;
  name: string;
  slug?: string;
};

export type OwnerDashboard = {
  stats: {
    restaurantsCount: number;
    todaysOrdersCount: number;
    pendingOrdersCount: number;
    completedOrdersCount: number;
    cancelledOrdersCount: number;
    revenue: number;
    reviewsCount: number;
    averageOrderValue: number;
  };
  restaurants: Array<{
    id: number;
    name: string;
    slug: string;
    city: string;
    area?: string | null;
    avgRating: number;
    totalReviews: number;
    avgDeliveryTime: number;
    preparationTime: number;
    isActive: boolean;
    openingTime?: string | null;
    closingTime?: string | null;
  }>;
  ordersByStatus: StatusBreakdown[];
  revenueTrend: Array<{
    date: string;
    label: string;
    value: number;
  }>;
  busyHours: Array<{
    hour: number;
    label: string;
    count: number;
  }>;
  prepTimeSummary: {
    averagePreparationTime: number;
    fastestRestaurant: {
      id: number;
      name: string;
      slug: string;
      city: string;
      area?: string | null;
      preparationTime: number;
    } | null;
    slowestRestaurant: {
      id: number;
      name: string;
      slug: string;
      city: string;
      area?: string | null;
      preparationTime: number;
    } | null;
  };
  cancellationSummary: {
    cancelledOrdersCount: number;
    cancellationRate: number;
  };
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: number;
    orderedAt: string;
    restaurant: RestaurantBadge;
    user: {
      id: number;
      fullName: string;
      email: string;
    };
  }>;
  recentReviews: Array<{
    id: number;
    rating: number;
    reviewText?: string | null;
    createdAt: string;
    restaurant: RestaurantBadge;
    user: {
      id: number;
      fullName: string;
      profileImage?: string | null;
    };
  }>;
  topDishes: Array<{
    id: number;
    name: string;
    restaurant: RestaurantBadge;
    totalOrders: number;
    revenue: number;
    isAvailable: boolean;
  }>;
  availabilityAlerts: Array<{
    id: number;
    name: string;
    price: number;
    isRecommended: boolean;
    updatedAt: string;
    restaurant: RestaurantBadge;
    category: {
      id: number;
      name: string;
    };
  }>;
};

export type OwnerRestaurant = {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  logoImage?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  avgRating: number;
  totalReviews: number;
  costForTwo: number;
  avgDeliveryTime: number;
  preparationTime: number;
  latitude?: number | null;
  longitude?: number | null;
  isVegOnly: boolean;
  isFeatured: boolean;
  isActive: boolean;
  phone?: string | null;
  email?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  addressLine?: string | null;
  categoryMappings: Array<{
    category: {
      id: number;
      name: string;
    };
  }>;
  cuisineMappings: Array<{
    cuisine: {
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
    menuItems: Array<{
      id: number;
      name: string;
      image?: string | null;
      price: number;
      discountPrice?: number | null;
      foodType: string;
      isAvailable: boolean;
      isRecommended: boolean;
      preparationTime: number;
    }>;
  }>;
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

export type OwnerRestaurantSummary = {
  id: number;
  name: string;
  slug: string;
  area?: string | null;
  city: string;
  state: string;
  isActive: boolean;
  isFeatured: boolean;
  isVegOnly: boolean;
};

export type OwnerMenuCategory = {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type OwnerOffer = {
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

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

export { toSessionUser };
export type {
  AdminAddon as OwnerAddon,
  AdminCombo as OwnerCombo,
  AdminMenuItem as OwnerMenuItem,
  AdminNotification as OwnerNotification,
  AdminOrder as OwnerOrder,
  AdminReview as OwnerReview,
  AdminUser as OwnerProfile,
};

export const getOwnerDashboard = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<OwnerDashboard>>("/owner/dashboard"));

export function getOwnerRestaurants(options: { view: "summary" }): Promise<OwnerRestaurantSummary[]>;
export function getOwnerRestaurants(options?: { view?: "detail" }): Promise<OwnerRestaurant[]>;
export async function getOwnerRestaurants(options?: { view?: "summary" | "detail" }) {
  const response = await apiClient.get<
    ApiEnvelope<{
      restaurants: Array<OwnerRestaurant | OwnerRestaurantSummary>;
    }>
  >("/restaurants/owner/mine", {
    params: options?.view ? { view: options.view } : undefined,
  });

  return unwrapData(response).restaurants;
}

export const updateOwnerRestaurant = async (restaurantId: number, payload: Record<string, unknown>) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ restaurant: OwnerRestaurant }>>(`/restaurants/${restaurantId}`, payload),
  ).restaurant;

export const getOwnerOrders = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ orders: AdminOrder[] }>>("/orders")).orders;

export const updateOwnerOrderStatus = async (orderId: number, payload: { status: string; note?: string }) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ order: AdminOrder }>>(`/orders/${orderId}/status`, payload),
  ).order;

export const getOwnerMenuItems = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ items: AdminMenuItem[] }>>("/menu-items/owner/mine")).items;

export const getOwnerMenuCategories = async (restaurantId: number) =>
  unwrapData(
    await apiClient.get<ApiEnvelope<{ categories: OwnerMenuCategory[] }>>(
      `/categories/restaurants/${restaurantId}/menu`,
    ),
  ).categories;

export const createOwnerMenuItem = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ item: AdminMenuItem }>>("/menu-items", payload)).item;

export const updateOwnerMenuItem = async (itemId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ item: AdminMenuItem }>>(`/menu-items/${itemId}`, payload)).item;

export const deleteOwnerMenuItem = async (itemId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/menu-items/${itemId}`));

export const getOwnerAddons = async (params?: {
  search?: string;
  restaurantId?: number;
  isActive?: boolean;
  parentType?: "MENU_ITEM" | "COMBO";
}) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ addons: AdminAddon[] }>>("/addons/owner/mine", { params }))
    .addons;

export const createOwnerAddon = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ addon: AdminAddon }>>("/addons", payload)).addon;

export const updateOwnerAddon = async (addonId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ addon: AdminAddon }>>(`/addons/${addonId}`, payload)).addon;

export const deleteOwnerAddon = async (addonId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/addons/${addonId}`));

export const getOwnerCombos = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ combos: AdminCombo[] }>>("/combos/owner/mine")).combos;

export const createOwnerCombo = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ combo: AdminCombo }>>("/combos", payload)).combo;

export const updateOwnerCombo = async (comboId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ combo: AdminCombo }>>(`/combos/${comboId}`, payload)).combo;

export const deleteOwnerCombo = async (comboId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/combos/${comboId}`));

export const getOwnerOffers = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ offers: OwnerOffer[] }>>("/offers/owner/mine")).offers;

export const createOwnerOffer = async (payload: Record<string, unknown>) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ offer: OwnerOffer }>>("/offers/owner", payload)).offer;

export const updateOwnerOffer = async (offerId: number, payload: Record<string, unknown>) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ offer: OwnerOffer }>>(`/offers/owner/${offerId}`, payload))
    .offer;

export const deleteOwnerOffer = async (offerId: number) =>
  unwrapData(await apiClient.delete<ApiEnvelope<void>>(`/offers/owner/${offerId}`));

export const getOwnerReviews = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ reviews: AdminReview[] }>>("/reviews/owner/mine")).reviews;

export const getOwnerNotifications = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ notifications: AdminNotification[] }>>("/notifications"))
    .notifications;

export const markOwnerNotificationRead = async (notificationId: number) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ notification: AdminNotification }>>(
      `/notifications/${notificationId}/read`,
    ),
  ).notification;

export const markAllOwnerNotificationsRead = async () =>
  unwrapData(await apiClient.post<ApiEnvelope<void>>("/notifications/mark-all-read"));

export const getOwnerProfile = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ user: AdminUser }>>("/auth/me")).user;

export const updateOwnerProfile = async (payload: {
  fullName?: string;
  phone?: string;
  profileImage?: string;
}) => unwrapData(await apiClient.patch<ApiEnvelope<{ user: AdminUser }>>("/users/me", payload)).user;
