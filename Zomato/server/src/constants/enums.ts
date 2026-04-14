export const Role = {
  CUSTOMER: "CUSTOMER",
  RESTAURANT_OWNER: "RESTAURANT_OWNER",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
  OPERATIONS_MANAGER: "OPERATIONS_MANAGER",
  ADMIN: "ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const AddressType = {
  HOME: "HOME",
  WORK: "WORK",
  OTHER: "OTHER",
} as const;
export type AddressType = (typeof AddressType)[keyof typeof AddressType];

export const FoodType = {
  VEG: "VEG",
  NON_VEG: "NON_VEG",
  EGG: "EGG",
} as const;
export type FoodType = (typeof FoodType)[keyof typeof FoodType];

export const CatalogItemType = {
  MENU_ITEM: "MENU_ITEM",
  COMBO: "COMBO",
} as const;
export type CatalogItemType = (typeof CatalogItemType)[keyof typeof CatalogItemType];

export const AddonType = {
  EXTRA: "EXTRA",
  UPGRADE: "UPGRADE",
  DIP: "DIP",
  DRINK: "DRINK",
  SIDE: "SIDE",
  DESSERT: "DESSERT",
} as const;
export type AddonType = (typeof AddonType)[keyof typeof AddonType];

export const DiscountType = {
  PERCENTAGE: "PERCENTAGE",
  FLAT: "FLAT",
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const OfferScope = {
  PLATFORM: "PLATFORM",
  RESTAURANT: "RESTAURANT",
} as const;
export type OfferScope = (typeof OfferScope)[keyof typeof OfferScope];

export const OrderStatus = {
  PLACED: "PLACED",
  CONFIRMED: "CONFIRMED",
  ACCEPTED: "ACCEPTED",
  PREPARING: "PREPARING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  LOOKING_FOR_DELIVERY_PARTNER: "LOOKING_FOR_DELIVERY_PARTNER",
  DELIVERY_PARTNER_ASSIGNED: "DELIVERY_PARTNER_ASSIGNED",
  PICKED_UP: "PICKED_UP",
  ON_THE_WAY: "ON_THE_WAY",
  DELAYED: "DELAYED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  COD: "COD",
  CARD: "CARD",
  UPI: "UPI",
  WALLET: "WALLET",
  NET_BANKING: "NET_BANKING",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const VehicleType = {
  BIKE: "BIKE",
  CYCLE: "CYCLE",
  SCOOTER: "SCOOTER",
  CAR: "CAR",
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const DeliveryAvailabilityStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  BUSY: "BUSY",
} as const;
export type DeliveryAvailabilityStatus =
  (typeof DeliveryAvailabilityStatus)[keyof typeof DeliveryAvailabilityStatus];

export const NotificationType = {
  ORDER: "ORDER",
  OFFER: "OFFER",
  SYSTEM: "SYSTEM",
  PAYMENT: "PAYMENT",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const ReservationStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
} as const;
export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const DocumentStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
