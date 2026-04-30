import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/api";
import { normalizeAuthUser } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";
import type { RegionOptions } from "@/lib/india-regions";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

export type OperationsSummaryStats = {
  statesCount: number;
  districtsCount: number;
  ownersCount: number;
  deliveryPartnersCount: number;
  restaurantsCount: number;
  fullyAssignedCount: number;
  unassignedOwnersCount: number;
  unassignedPartnersCount: number;
  unassignedCount: number;
};

export type OperationsDashboard = {
  filters: {
    state?: string | null;
    district?: string | null;
  };
  scopeMessage?: string | null;
  regionOptions: RegionOptions;
  stats: OperationsSummaryStats;
  stateSummaries: Array<{
    state: string;
    ownersCount: number;
    deliveryPartnersCount: number;
    restaurantsCount: number;
    districtsCount: number;
    fullyAssignedCount: number;
    unassignedCount: number;
  }>;
  districtSummaries: Array<{
    state: string;
    district: string;
    ownersCount: number;
    deliveryPartnersCount: number;
    restaurantsCount: number;
    fullyAssignedCount: number;
    unassignedCount: number;
  }>;
  recentUpdates: Array<{
    id: string;
    kind: "REGION_NOTE" | "OWNER_ASSIGNMENT" | "DELIVERY_ASSIGNMENT";
    title: string;
    description: string;
    state?: string | null;
    district?: string | null;
    actorName?: string | null;
    updatedAt: string;
  }>;
};

export type OperationsRegionsSummary = Omit<OperationsDashboard, "recentUpdates">;

export type OperationsOwner = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  updatedAt: string;
  opsState?: string | null;
  opsDistrict?: string | null;
  opsNotes?: string | null;
  assignmentStatus: "ASSIGNED" | "UNASSIGNED" | "PARTIAL";
  restaurants: Array<{
    id: number;
    name: string;
    slug: string;
    city: string;
    state: string;
    area?: string | null;
    isActive: boolean;
    avgRating: number;
    totalReviews: number;
  }>;
};

export type OperationsDeliveryPartner = {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  updatedAt: string;
  opsState?: string | null;
  opsDistrict?: string | null;
  opsNotes?: string | null;
  assignmentStatus: "ASSIGNED" | "UNASSIGNED" | "PARTIAL";
  deliveryProfile: {
    id: number;
    vehicleType: string;
    vehicleNumber?: string | null;
    licenseNumber?: string | null;
    availabilityStatus: string;
    avgRating: number;
    totalDeliveries: number;
    isVerified: boolean;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationUpdatedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type OperationsRegionNote = {
  id: number;
  state: string;
  district?: string | null;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  } | null;
};

export type OperationsCommunications = {
  regionNotes: OperationsRegionNote[];
  ownerNotes: Array<{
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    opsState?: string | null;
    opsDistrict?: string | null;
    opsNotes?: string | null;
    updatedAt: string;
    restaurants: Array<{
      id: number;
      name: string;
      slug: string;
      city: string;
      state: string;
      area?: string | null;
      isActive: boolean;
      avgRating: number;
      totalReviews: number;
    }>;
  }>;
  partnerNotes: Array<{
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    opsState?: string | null;
    opsDistrict?: string | null;
    opsNotes?: string | null;
    updatedAt: string;
    deliveryProfile: {
      id: number;
      vehicleType: string;
      vehicleNumber?: string | null;
      licenseNumber?: string | null;
      availabilityStatus: string;
      avgRating: number;
      totalDeliveries: number;
      isVerified: boolean;
      currentLatitude?: number | null;
      currentLongitude?: number | null;
      lastLocationUpdatedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    };
  }>;
};

export type OperationsProfile = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  walletBalance: number;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateOperationsOwnerPayload = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  profileImage?: string;
  state: string;
  district: string;
  notes?: string;
};

export type CreateOperationsDeliveryPartnerPayload = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  profileImage?: string;
  vehicleType: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  availabilityStatus?: string;
  isVerified?: boolean;
  state: string;
  district: string;
  notes?: string;
};

export const toOperationsSessionUser = (user: OperationsProfile): AuthUser =>
  normalizeAuthUser({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? null,
    profileImage: user.profileImage ?? null,
    role: user.role,
    walletBalance: user.walletBalance,
  });

export const getOperationsDashboard = async (params?: { state?: string; district?: string }) =>
  unwrapData(await apiClient.get<ApiEnvelope<OperationsDashboard>>("/operations/dashboard", { params }));

export const getOperationsRegions = async (params?: { state?: string; district?: string }) =>
  unwrapData(await apiClient.get<ApiEnvelope<OperationsRegionsSummary>>("/operations/regions", { params }));

export const getOperationsOwners = async (params?: {
  search?: string;
  state?: string;
  district?: string;
  status?: string;
  assignmentStatus?: string;
}) =>
  unwrapData(await apiClient.get<ApiEnvelope<{ owners: OperationsOwner[] }>>("/operations/owners", { params }))
    .owners;

export const createOperationsOwner = async (payload: CreateOperationsOwnerPayload) =>
  unwrapData(await apiClient.post<ApiEnvelope<{ owner: OperationsOwner }>>("/operations/owners", payload)).owner;

export const getOperationsDeliveryPartners = async (params?: {
  search?: string;
  state?: string;
  district?: string;
  availabilityStatus?: string;
  assignmentStatus?: string;
}) =>
  unwrapData(
    await apiClient.get<ApiEnvelope<{ partners: OperationsDeliveryPartner[] }>>(
      "/operations/delivery-partners",
      { params },
    ),
  ).partners;

export const createOperationsDeliveryPartner = async (payload: CreateOperationsDeliveryPartnerPayload) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ partner: OperationsDeliveryPartner }>>(
      "/operations/delivery-partners",
      payload,
    ),
  ).partner;

export const updateOperationsAssignment = async (
  userId: number,
  payload: {
    state?: string;
    district?: string;
    notes?: string;
  },
) =>
  unwrapData(
    await apiClient.patch<
      ApiEnvelope<{
        assignment: {
          id: number;
          fullName: string;
          role: string;
          opsState?: string | null;
          opsDistrict?: string | null;
          opsNotes?: string | null;
          updatedAt: string;
          assignmentStatus: string;
        };
      }>
    >(`/operations/users/${userId}/assignment`, payload),
  ).assignment;

export const getOperationsCommunications = async (params?: {
  search?: string;
  state?: string;
  district?: string;
}) =>
  unwrapData(
    await apiClient.get<ApiEnvelope<OperationsCommunications>>("/operations/communications", { params }),
  );

export const createOperationsRegionNote = async (payload: {
  state: string;
  district?: string;
  title: string;
  message: string;
}) =>
  unwrapData(
    await apiClient.post<ApiEnvelope<{ note: OperationsRegionNote }>>("/operations/communications", payload),
  ).note;

export const updateOperationsRegionNote = async (
  noteId: number,
  payload: Partial<{
    state: string;
    district?: string;
    title: string;
    message: string;
  }>,
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ note: OperationsRegionNote }>>(
      `/operations/communications/${noteId}`,
      payload,
    ),
  ).note;

export const getOperationsProfile = async () =>
  unwrapData(await apiClient.get<ApiEnvelope<{ user: OperationsProfile }>>("/auth/me")).user;

export const updateOperationsProfile = async (payload: {
  fullName?: string;
  phone?: string;
  profileImage?: string;
}) =>
  unwrapData(await apiClient.patch<ApiEnvelope<{ user: OperationsProfile }>>("/users/me", payload)).user;
