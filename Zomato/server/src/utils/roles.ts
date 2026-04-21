import { Role } from "../constants/enums.js";

const activeRoles = new Set<string>(Object.values(Role));

export const LEGACY_OPERATIONS_MANAGER_ROLE = "OPERATIONS_MANAGER";

export const normalizeRoleValue = (role?: string | null): Role | null => {
  const trimmedRole = role?.trim();

  if (!trimmedRole) {
    return null;
  }

  const normalizedRole =
    trimmedRole === LEGACY_OPERATIONS_MANAGER_ROLE ? Role.REGIONAL_MANAGER : trimmedRole;

  return activeRoles.has(normalizedRole) ? (normalizedRole as Role) : null;
};
