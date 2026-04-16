import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type RequireCustomerAccessOptions = {
  guestMessage: string;
  wrongRoleMessage?: string;
};

export const useCustomerActionGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const canUseCustomerActions = Boolean(isAuthenticated && user?.role === "CUSTOMER");

  const requireCustomerAccess = ({
    guestMessage,
    wrongRoleMessage = "Sign in with a customer account to continue.",
  }: RequireCustomerAccessOptions) => {
    if (!isAuthenticated || !user) {
      toast.error(guestMessage);
      navigate("/login", {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        },
      });
      return false;
    }

    if (user.role !== "CUSTOMER") {
      toast.error(wrongRoleMessage);
      return false;
    }

    return true;
  };

  return {
    canUseCustomerActions,
    requireCustomerAccess,
  };
};
