import { z } from "zod";

export const INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE = "Enter a valid vehicle number like TN01AB1234.";
export const INDIAN_LICENSE_NUMBER_ERROR_MESSAGE =
  "Enter a valid license number using letters and numbers only.";

const VEHICLE_NUMBER_MAX_LENGTH = 12;
const LICENSE_NUMBER_MAX_LENGTH = 20;
const LICENSE_NUMBER_MIN_LENGTH = 6;
const alphaNumericRegex = /^[A-Z0-9]+$/;
const traditionalVehicleNumberRegex = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/;
const bharatVehicleNumberRegex = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

const sanitizeUppercaseAlphaNumeric = (value: string, maxLength: number) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLength);

export const sanitizeVehicleNumberInput = (value: string) =>
  sanitizeUppercaseAlphaNumeric(value, VEHICLE_NUMBER_MAX_LENGTH);

export const sanitizeLicenseNumberInput = (value: string) =>
  sanitizeUppercaseAlphaNumeric(value, LICENSE_NUMBER_MAX_LENGTH);

export const normalizeVehicleNumber = (value?: string | null) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = sanitizeVehicleNumberInput(value);
  return normalizedValue || undefined;
};

export const normalizeLicenseNumber = (value?: string | null) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = sanitizeLicenseNumberInput(value);
  return normalizedValue || undefined;
};

export const isValidIndianVehicleNumber = (value?: string | null) => {
  const normalizedValue = normalizeVehicleNumber(value);

  return Boolean(
    normalizedValue &&
      (traditionalVehicleNumberRegex.test(normalizedValue) ||
        bharatVehicleNumberRegex.test(normalizedValue)),
  );
};

export const isValidIndianLicenseNumber = (value?: string | null) => {
  const normalizedValue = normalizeLicenseNumber(value);

  return Boolean(
    normalizedValue &&
      alphaNumericRegex.test(normalizedValue) &&
      normalizedValue.length >= LICENSE_NUMBER_MIN_LENGTH,
  );
};

export const getVehicleNumberFieldError = (
  value?: string | null,
  options?: {
    required?: boolean;
    message?: string;
  },
) => {
  const normalizedValue = normalizeVehicleNumber(value);
  const message = options?.message ?? INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE;

  if (!normalizedValue) {
    return options?.required ? message : undefined;
  }

  return isValidIndianVehicleNumber(normalizedValue) ? undefined : message;
};

export const getLicenseNumberFieldError = (
  value?: string | null,
  options?: {
    required?: boolean;
    message?: string;
  },
) => {
  const normalizedValue = normalizeLicenseNumber(value);
  const message = options?.message ?? INDIAN_LICENSE_NUMBER_ERROR_MESSAGE;

  if (!normalizedValue) {
    return options?.required ? message : undefined;
  }

  return isValidIndianLicenseNumber(normalizedValue) ? undefined : message;
};

export const getVehicleNumberInputValue = (value?: string | null) => normalizeVehicleNumber(value) ?? "";

export const getLicenseNumberInputValue = (value?: string | null) => normalizeLicenseNumber(value) ?? "";

export const requiredVehicleNumberSchema = (message = INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE) =>
  z
    .string()
    .trim()
    .transform((value) => normalizeVehicleNumber(value) ?? value.trim())
    .refine(isValidIndianVehicleNumber, { message });

export const optionalVehicleNumberSchema = (message = INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE) =>
  z
    .string()
    .trim()
    .transform((value) => normalizeVehicleNumber(value) ?? "")
    .refine((value) => !value || isValidIndianVehicleNumber(value), { message });

export const requiredLicenseNumberSchema = (message = INDIAN_LICENSE_NUMBER_ERROR_MESSAGE) =>
  z
    .string()
    .trim()
    .transform((value) => normalizeLicenseNumber(value) ?? value.trim())
    .refine(isValidIndianLicenseNumber, { message });

export const optionalLicenseNumberSchema = (message = INDIAN_LICENSE_NUMBER_ERROR_MESSAGE) =>
  z
    .string()
    .trim()
    .transform((value) => normalizeLicenseNumber(value) ?? "")
    .refine((value) => !value || isValidIndianLicenseNumber(value), { message });
