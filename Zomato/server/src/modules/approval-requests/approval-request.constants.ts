export const ApprovalRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export const ApprovalRequestEntityType = {
  USER: "USER",
  RESTAURANT: "RESTAURANT",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
} as const;

export const ApprovalRequestActionType = {
  USER_ASSIGNMENT_UPDATE: "USER_ASSIGNMENT_UPDATE",
} as const;

