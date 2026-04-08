import { DiscountType } from "../constants/enums.js";

type OfferLike = {
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
} | null;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const decimalToNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
};

export const calculateOfferDiscount = (offer: OfferLike, subtotal: number) => {
  if (!offer) {
    return 0;
  }

  if (subtotal < offer.minOrderAmount) {
    return 0;
  }

  const rawDiscount =
    offer.discountType === DiscountType.PERCENTAGE
      ? (subtotal * offer.discountValue) / 100
      : offer.discountValue;

  const maxDiscount = offer.maxDiscount;

  return roundMoney(maxDiscount ? Math.min(rawDiscount, maxDiscount) : rawDiscount);
};

export const buildTotals = ({
  subtotal,
  offer,
  deliveryFee = subtotal > 499 ? 29 : 49,
  taxRate = 0.05,
}: {
  subtotal: number;
  offer?: OfferLike;
  deliveryFee?: number;
  taxRate?: number;
}) => {
  const taxAmount = roundMoney(subtotal * taxRate);
  const discountAmount = calculateOfferDiscount(offer ?? null, subtotal);
  const totalAmount = roundMoney(subtotal + deliveryFee + taxAmount - discountAmount);

  return {
    subtotal: roundMoney(subtotal),
    deliveryFee: roundMoney(deliveryFee),
    taxAmount,
    discountAmount,
    totalAmount,
  };
};
