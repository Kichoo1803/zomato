import { z } from "zod";

export const INDIAN_COUNTRY_CODE = "+91";
export const INDIAN_PHONE_LOCAL_LENGTH = 10;
export const INDIAN_PHONE_PLACEHOLDER = "9876543210";
export const INDIAN_PHONE_ERROR_MESSAGE = "Enter a valid 10-digit Indian mobile number.";

const INDIAN_MOBILE_LOCAL_REGEX = /^[6-9]\d{9}$/;

const toDigits = (value: string) => value.replace(/\D/g, "");

export const sanitizeIndianPhoneInput = (value: string) => {
  const digits = toDigits(value);

  if (digits.length > INDIAN_PHONE_LOCAL_LENGTH && digits.startsWith("91")) {
    return digits.slice(2, 2 + INDIAN_PHONE_LOCAL_LENGTH);
  }

  if (digits.length > INDIAN_PHONE_LOCAL_LENGTH && digits.startsWith("0")) {
    return digits.slice(1, 1 + INDIAN_PHONE_LOCAL_LENGTH);
  }

  return digits.slice(0, INDIAN_PHONE_LOCAL_LENGTH);
};

export const parseIndianPhoneInput = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const digits = toDigits(trimmedValue);

  if (INDIAN_MOBILE_LOCAL_REGEX.test(digits)) {
    return digits;
  }

  if (digits.length === INDIAN_PHONE_LOCAL_LENGTH + 1 && digits.startsWith("0")) {
    const localDigits = digits.slice(1);
    return INDIAN_MOBILE_LOCAL_REGEX.test(localDigits) ? localDigits : null;
  }

  if (digits.length === INDIAN_PHONE_LOCAL_LENGTH + 2 && digits.startsWith("91")) {
    const localDigits = digits.slice(2);
    return INDIAN_MOBILE_LOCAL_REGEX.test(localDigits) ? localDigits : null;
  }

  return null;
};

export const isValidIndianPhoneInput = (value?: string | null) => Boolean(parseIndianPhoneInput(value));

export const areIndianPhoneInputsEqual = (left?: string | null, right?: string | null) => {
  const leftDigits = parseIndianPhoneInput(left);
  const rightDigits = parseIndianPhoneInput(right);

  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
};

export const getIndianPhoneInputValue = (value?: string | null) => parseIndianPhoneInput(value) ?? "";

export const formatIndianPhoneDisplay = (value?: string | null) => {
  const localDigits = parseIndianPhoneInput(value);

  if (localDigits) {
    return `${INDIAN_COUNTRY_CODE} ${localDigits}`;
  }

  return value?.trim() ?? "";
};

export const getIndianPhoneFieldError = (
  value?: string | null,
  options?: {
    required?: boolean;
    message?: string;
  },
) => {
  const trimmedValue = value?.trim() ?? "";
  const message = options?.message ?? INDIAN_PHONE_ERROR_MESSAGE;

  if (!trimmedValue) {
    return options?.required ? message : undefined;
  }

  return isValidIndianPhoneInput(trimmedValue) ? undefined : message;
};

export const requiredIndianPhoneSchema = (message = INDIAN_PHONE_ERROR_MESSAGE) =>
  z.string().trim().min(1, message).refine(isValidIndianPhoneInput, { message });

export const optionalIndianPhoneSchema = (message = INDIAN_PHONE_ERROR_MESSAGE) =>
  z.string().trim().refine((value) => !value || isValidIndianPhoneInput(value), { message });
