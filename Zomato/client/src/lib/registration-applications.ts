import type { AxiosResponse } from "axios";
import { apiClient, publicApi } from "@/lib/api";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type RegistrationApplicationRoleType = "RESTAURANT_OWNER" | "DELIVERY_PARTNER";
export type RegistrationApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RegistrationApplicationPayoutMethod = "BANK_TRANSFER" | "UPI";

export type RegistrationApplicationAsset = {
  fieldName: string;
  label: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  uploadedAt: string;
};

export type RegistrationApplicationPayoutDetails = {
  method: RegistrationApplicationPayoutMethod;
  accountHolderName?: string | null;
  bankName?: string | null;
  accountNumberLast4?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
} | null;

export type RegistrationApplicationDocuments = {
  fssaiCertificate?: RegistrationApplicationAsset | null;
  idProof?: RegistrationApplicationAsset | null;
  restaurantImages?: RegistrationApplicationAsset[];
  drivingLicense?: RegistrationApplicationAsset | null;
  profilePhoto?: RegistrationApplicationAsset | null;
} | null;

export type RegistrationApplication = {
  id: number;
  roleType: RegistrationApplicationRoleType;
  fullName: string;
  email: string;
  phone: string;
  alternatePhone?: string | null;
  addressLine: string;
  state: string;
  district: string;
  pincode: string;
  regionId?: number | null;
  restaurantName?: string | null;
  restaurantAddress?: string | null;
  fssaiCertificateNumber?: string | null;
  idProofType: string;
  idProofNumber: string;
  vehicleType?: string | null;
  vehicleNumber?: string | null;
  drivingLicenseNumber?: string | null;
  payoutDetails: RegistrationApplicationPayoutDetails;
  documents: RegistrationApplicationDocuments;
  status: RegistrationApplicationStatus;
  assignedRegionalManagerId?: number | null;
  reviewedById?: number | null;
  approvedUserId?: number | null;
  reviewRemarks?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  routingTarget?: "ADMIN" | "REGIONAL_MANAGER";
  region?: {
    id: number;
    name: string;
    code: string;
    slug: string;
    stateName: string;
    districtName: string;
    managerUserId?: number | null;
    manager?: {
      id: number;
      fullName: string;
      email: string;
      role: string;
      isActive: boolean;
    } | null;
  } | null;
  assignedRegionalManager?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
  } | null;
  reviewedBy?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  } | null;
  approvedUser?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
  } | null;
};

export type RegistrationApplicationListParams = {
  search?: string;
  roleType?: RegistrationApplicationRoleType;
  status?: RegistrationApplicationStatus;
  regionId?: number;
  state?: string;
  district?: string;
  createdFrom?: string;
  createdTo?: string;
  unassignedOnly?: boolean;
};

const unwrapData = <T>(response: AxiosResponse<ApiEnvelope<T>>) => response.data.data;

export const submitRestaurantOwnerApplication = async (formData: FormData) =>
  unwrapData(
    await publicApi.post<ApiEnvelope<{ application: RegistrationApplication }>>(
      "/registration-applications/restaurant-owner",
      formData,
    ),
  ).application;

export const submitDeliveryPartnerApplication = async (formData: FormData) =>
  unwrapData(
    await publicApi.post<ApiEnvelope<{ application: RegistrationApplication }>>(
      "/registration-applications/delivery-partner",
      formData,
    ),
  ).application;

export const getRegistrationApplications = async (params?: RegistrationApplicationListParams) =>
  unwrapData(
    await apiClient.get<ApiEnvelope<{ applications: RegistrationApplication[] }>>(
      "/registration-applications",
      { params },
    ),
  ).applications;

export const approveRegistrationApplication = async (
  applicationId: number,
  payload?: {
    remarks?: string;
  },
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ application: RegistrationApplication }>>(
      `/registration-applications/${applicationId}/approve`,
      payload ?? {},
    ),
  ).application;

export const rejectRegistrationApplication = async (
  applicationId: number,
  payload: {
    remarks: string;
  },
) =>
  unwrapData(
    await apiClient.patch<ApiEnvelope<{ application: RegistrationApplication }>>(
      `/registration-applications/${applicationId}/reject`,
      payload,
    ),
  ).application;
