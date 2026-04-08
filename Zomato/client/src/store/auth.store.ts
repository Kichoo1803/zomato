import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthState } from "@/types/auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setSession: ({ user, accessToken }) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
        }),
      clearSession: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "zomato-luxe-auth",
      storage: createJSONStorage(() => window.localStorage),
      partialize: ({ user, accessToken, isAuthenticated }) => ({
        user,
        accessToken,
        isAuthenticated,
      }),
    },
  ),
);
