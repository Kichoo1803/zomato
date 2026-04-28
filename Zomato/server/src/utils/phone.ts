import { z } from "zod";

export const INDIAN_COUNTRY_CODE = "+91";
export const INDIAN_PHONE_ERROR_MESSAGE = "Enter a valid 10-digit Indian mobile number.";

const INDIAN_MOBILE_LOCAL_REGEX = /^[6-9]\d{9}$/;
const INDIAN_PHONE_DIGIT_LENGTH = 10;

const toDigits = (value: string) => value.replace(/\D/g, "");

export const extractIndianMobileNumber = (value?: string | null) => {
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

  if (digits.length === INDIAN_PHONE_DIGIT_LENGTH + 1 && digits.startsWith("0")) {
    const localDigits = digits.slice(1);
    return INDIAN_MOBILE_LOCAL_REGEX.test(localDigits) ? localDigits : null;
  }

  if (digits.length === INDIAN_PHONE_DIGIT_LENGTH + 2 && digits.startsWith("91")) {
    const localDigits = digits.slice(2);
    return INDIAN_MOBILE_LOCAL_REGEX.test(localDigits) ? localDigits : null;
  }

  return null;
};

export const normalizeIndianPhoneNumber = (value?: string | null) => {
  const localDigits = extractIndianMobileNumber(value);
  return localDigits ? `${INDIAN_COUNTRY_CODE}${localDigits}` : undefined;
};

export const isValidIndianPhoneNumber = (value?: string | null) =>
  Boolean(extractIndianMobileNumber(value));

export const areIndianPhoneNumbersEqual = (left?: string | null, right?: string | null) => {
  const leftPhone = normalizeIndianPhoneNumber(left);
  const rightPhone = normalizeIndianPhoneNumber(right);

  return Boolean(leftPhone && rightPhone && leftPhone === rightPhone);
};

export const getIndianPhoneSearchVariants = (value?: string | null) => {
  const localDigits = extractIndianMobileNumber(value);

  if (!localDigits) {
    return [];
  }

  return [...new Set([`${INDIAN_COUNTRY_CODE}${localDigits}`, `91${localDigits}`, `0${localDigits}`, localDigits])];
};

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && !value.trim() ? undefined : value;

export const requiredIndianPhoneSchema = (message = INDIAN_PHONE_ERROR_MESSAGE) =>
  z.string().trim().refine(isValidIndianPhoneNumber, { message }).transform((value) => normalizeIndianPhoneNumber(value)!);

export const optionalIndianPhoneSchema = (message = INDIAN_PHONE_ERROR_MESSAGE) =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .refine(isValidIndianPhoneNumber, { message })
      .transform((value) => normalizeIndianPhoneNumber(value)!)
      .optional(),
  );
