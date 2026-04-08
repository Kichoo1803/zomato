import { useAuthStore } from "@/store/auth.store";

export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  return {
    user,
    accessToken,
    isAuthenticated,
    setSession,
    clearSession,
  };
};
