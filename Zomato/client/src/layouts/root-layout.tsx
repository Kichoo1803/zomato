import { Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getNotificationActionLabel, getNotificationHref } from "@/lib/notifications";
import { Footer } from "@/components/navigation/footer";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { Navbar } from "@/components/navigation/navbar";

export const RootLayout = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isLiveCustomerSession = isAuthenticated && user?.role === "CUSTOMER";

  useRealtimeSubscription({
    enabled: isLiveCustomerSession,
    userId: user?.id,
    onNotification: (notification) => {
      if (!user?.role) {
        return;
      }

      const nextPath = getNotificationHref(user.role, notification);

      toast(notification.title, {
        description: notification.message,
        action: nextPath
          ? {
              label: getNotificationActionLabel(user.role, notification),
              onClick: () => navigate(nextPath),
            }
          : undefined,
      });
    },
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="min-h-[calc(100vh-80px)]">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};
