import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getDefaultRedirectPath } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import { useAuth } from "@/hooks/use-auth";

type ProtectedRouteProps = {
  roles?: UserRole[];
};

export const ProtectedRoute = ({ roles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getDefaultRedirectPath(user.role)} replace />;
  }

  return <Outlet />;
};
