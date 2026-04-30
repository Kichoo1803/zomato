import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DiscoveryLocationProvider,
  LocationSelectionModal,
  useDiscoveryLocation,
} from "@/components/customer/discovery-location";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useAuth } from "@/hooks/use-auth";
import {
  CUSTOMER_CART_UPDATED_EVENT,
  CUSTOMER_PAYMENT_METHODS_UPDATED_EVENT,
  getCustomerCarts,
  getCustomerPaymentMethods,
} from "@/lib/customer";
import { getNotificationActionLabel, getNotificationHref } from "@/lib/notifications";
import { Footer } from "@/components/navigation/footer";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { Navbar } from "@/components/navigation/navbar";

const RootLayoutContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const {
    canManageSavedLocation,
    isLoadingSavedAddresses,
    isResolvingCurrentLocation,
    isSavingManualLocation,
    isSavingMapLocation,
    saveMapLocation,
    saveManualLocation,
    savedAddresses,
    selectedLocation,
    useCurrentLocation,
    useSavedAddress,
  } = useDiscoveryLocation();
  const isLiveCustomerSession = isAuthenticated && user?.role === "CUSTOMER";
  const [cartItemCount, setCartItemCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [paymentMethodCount, setPaymentMethodCount] = useState(0);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

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

  useEffect(() => {
    if (!isLiveCustomerSession || !user?.id) {
      setCartItemCount(0);
      setCartTotal(0);
      setPaymentMethodCount(0);
      return;
    }

    let isMounted = true;
    const loadShellSummary = async () => {
      try {
        const [cartRows, paymentMethodRows] = await Promise.all([
          getCustomerCarts(),
          getCustomerPaymentMethods().catch(() => []),
        ]);

        if (!isMounted) {
          return;
        }

        setCartItemCount(
          cartRows.reduce(
            (totalCount, cart) =>
              totalCount + cart.items.reduce((itemCount, item) => itemCount + item.quantity, 0),
            0,
          ),
        );
        setCartTotal(cartRows.reduce((totalValue, cart) => totalValue + cart.summary.payableTotal, 0));
        setPaymentMethodCount(paymentMethodRows.length);
      } catch {
        if (!isMounted) {
          return;
        }

        setCartItemCount(0);
        setCartTotal(0);
        setPaymentMethodCount(0);
      }
    };

    void loadShellSummary();

    if (typeof window === "undefined") {
      return () => {
        isMounted = false;
      };
    }

    const handleRefresh = () => {
      void loadShellSummary();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener(CUSTOMER_CART_UPDATED_EVENT, handleRefresh);
    window.addEventListener(CUSTOMER_PAYMENT_METHODS_UPDATED_EVENT, handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener(CUSTOMER_CART_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(CUSTOMER_PAYMENT_METHODS_UPDATED_EVENT, handleRefresh);
    };
  }, [isLiveCustomerSession, location.pathname, user?.id]);

  return (
    <div className="min-h-screen">
      <Navbar
        cartItemCount={cartItemCount}
        cartTotal={cartTotal}
        onOpenLocationSelector={() => setIsLocationModalOpen(true)}
        paymentMethodCount={paymentMethodCount}
        savedAddressCount={savedAddresses.length}
        selectedLocation={selectedLocation}
      />
      <main className="min-h-[calc(100vh-80px)] pb-28 md:pb-0">
        <Outlet />
      </main>
      <Footer
        canManageSavedLocation={canManageSavedLocation}
        onOpenLocationSelector={() => setIsLocationModalOpen(true)}
        savedAddressCount={savedAddresses.length}
        selectedLocation={selectedLocation}
      />
      <MobileBottomNav />
      <LocationSelectionModal
        canManageSavedLocation={canManageSavedLocation}
        initialAddress={selectedLocation?.address}
        initialCoordinates={
          selectedLocation
            ? {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }
            : null
        }
        isLoadingSavedAddresses={isLoadingSavedAddresses}
        isResolvingCurrentLocation={isResolvingCurrentLocation}
        isSavingManualLocation={isSavingManualLocation}
        isSavingMapLocation={isSavingMapLocation}
        onClose={() => setIsLocationModalOpen(false)}
        onSubmitManualAddress={saveManualLocation}
        onUseCurrentLocation={useCurrentLocation}
        onUseMapLocation={saveMapLocation}
        onUseSavedAddress={useSavedAddress}
        open={isLocationModalOpen}
        savedAddresses={savedAddresses}
        selectedLocationAddressId={selectedLocation?.addressId ?? null}
        selectedLocationSource={selectedLocation?.source}
      />
    </div>
  );
};

export const RootLayout = () => (
  <DiscoveryLocationProvider>
    <RootLayoutContent />
  </DiscoveryLocationProvider>
);
