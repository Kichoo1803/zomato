import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/api";
import { normalizeAuthUser } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

export type DeliveryProfile = {
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
    updatedAt: string;
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
};

export type DeliveryOrder = {
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
  address: {
    id: number;
    title?: string | null;
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
  user: {
    id: number;
    fullName: string;
    phone?: string | null;
  };
  deliveryPartner?: {
    id: number;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationUpdatedAt?: string | null;
    user: {
      id: number;
      fullName: string;
      phone?: string | null;
    };
  } | null;
  items: Array<{
    id: number;
    itemName: string;
    quantity: number;
    totalPrice: number;
  }>;
  statusEvents: Array<{
    id: number;
    status: string;
    note?: string | null;
    createdAt: string;
  }>;
};

export const toDeliverySessionUser = (profile: DeliveryProfile): AuthUser =>
  normalizeAuthUser({
    id: profile.user.id,
    fullName: profile.user.fullName,
    email: profile.user.email,
    phone: profile.user.phone ?? null,
    profileImage: profile.user.profileImage ?? null,
    role: profile.user.role,
  });

export const getDeliveryProfile = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ profile: DeliveryProfile }>>("/delivery-partners/me")).profile;

export const updateDeliveryProfile = async (payload: {
  fullName?: string;
  phone?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
}) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ profile: DeliveryProfile }>>("/delivery-partners/me", payload),
  ).profile;

export const updateDeliveryAvailability = async (availabilityStatus: string) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ profile: DeliveryProfile }>>("/delivery-partners/availability", {
      availabilityStatus,
    }),
  ).profile;

export const updateDeliveryLocation = async (payload: {
  latitude: number;
  longitude: number;
}) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ profile: DeliveryProfile }>>("/delivery-partners/location", payload),
  ).profile;

export const getDeliveryRequests = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ requests: DeliveryOrder[] }>>("/delivery-partners/requests"))
    .requests;

export const acceptDeliveryRequest = async (orderId: number) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ order: DeliveryOrder }>>(`/delivery-partners/requests/${orderId}/accept`),
  ).order;

export const getDeliveryActiveOrders = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ deliveries: DeliveryOrder[] }>>("/delivery-partners/active"))
    .deliveries;

export const getDeliveryHistory = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ deliveries: DeliveryOrder[] }>>("/delivery-partners/history"))
    .deliveries;

export const updateDeliveryOrderStatus = async (orderId: number, payload: { status: string; note?: string }) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ order: DeliveryOrder }>>(`/orders/${orderId}/status`, payload),
  ).order;
