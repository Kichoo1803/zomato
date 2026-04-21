import type { AuthUser, UserRole } from "@/types/auth";
import { USER_ROLES } from "@/types/auth";

const allowedRoles = new Set<string>(USER_ROLES);
const LEGACY_ROLE_ALIASES: Partial<Record<string, UserRole>> = {
  OPERATIONS_MANAGER: "REGIONAL_MANAGER",
};

export const normalizeUserRole = (role?: string | null): UserRole | null => {
  const trimmedRole = role?.trim();

  if (!trimmedRole) {
    return null;
  }

  const normalizedRole = LEGACY_ROLE_ALIASES[trimmedRole] ?? trimmedRole;

  return allowedRoles.has(normalizedRole) ? (normalizedRole as UserRole) : null;
};

export const normalizeStoredAuthUser = (user?: AuthUser | null): AuthUser | null => {
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: normalizeUserRole(user.role) ?? "CUSTOMER",
  };
};
