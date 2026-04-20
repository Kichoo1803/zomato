import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bike, LocateFixed, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { RouteMap } from "@/components/maps/route-map";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import {
  acceptDeliveryRequest as acceptDeliveryRequestApi,
  getDeliveryActiveOrders,
  getDeliveryHistory,
  getDeliveryProfile,
  getDeliveryRequests,
  releaseAssignedDeliveryOrder,
  skipDeliveryRequest,
  toDeliverySessionUser,
  updateDeliveryAvailability,
  updateDeliveryLocation,
  updateDeliveryOrderStatus,
  updateDeliveryProfile,
  type DeliveryOrder,
  type DeliveryProfile,
} from "@/lib/delivery";
import { deliveryStats } from "@/lib/demo-data";
import { RefreshButton, formatCurrency, formatDateTime, getToneForStatus, toLabel } from "@/pages/admin/admin-shared";

const demoDeliveryEarnings = [
  { label: "Shift total", value: "Rs. 2,480", hint: "Including incentives" },
  { label: "Average per order", value: "Rs. 138", hint: "Last 18 deliveries" },
  { label: "Next payout", value: "Rs. 6,920", hint: "Expected tomorrow" },
];

const deliveryStatusTransitions: Record<string, string[]> = {
  DELIVERY_PARTNER_ASSIGNED: ["PICKED_UP", "DELAYED"],
  PICKED_UP: ["ON_THE_WAY", "DELAYED"],
  ON_THE_WAY: ["OUT_FOR_DELIVERY", "DELAYED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELAYED"],
  DELAYED: ["PICKED_UP", "ON_THE_WAY", "OUT_FOR_DELIVERY", "DELIVERED"],
};
const requestAcceptableStatuses = new Set(["READY_FOR_PICKUP", "LOOKING_FOR_DELIVERY_PARTNER"]);

const isLiveDeliverySession = (isAuthenticated: boolean, role?: string | null) =>
  isAuthenticated && role === "DELIVERY_PARTNER";

const formatEtaMinutes = (value?: number | null) =>
  value != null ? `${value} min` : "Pending";

const formatDistanceKm = (value?: number | null) =>
  value != null ? `${value.toFixed(1)} km` : "Pending";

const formatOfferTimeRemaining = (value?: string | null) => {
  if (!value) {
    return "Live";
  }

  const differenceMs = new Date(value).getTime() - Date.now();
  if (differenceMs <= 0) {
    return "Expiring now";
  }

  const minutesRemaining = Math.ceil(differenceMs / (60 * 1000));
  return `${minutesRemaining} min left`;
};

const buildDeliveryAddressSummary = (parts: Array<string | null | undefined>) =>
  parts
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");

const buildDeliveryItemsSummary = (items: DeliveryOrder["items"]) => {
  if (!items.length) {
    return "Items will appear here once the order is confirmed.";
  }

  const preview = items.slice(0, 2).map((item) => `${item.quantity}x ${item.itemName}`);
  const extraCount = items.length - preview.length;

  return extraCount > 0 ? `${preview.join(", ")} +${extraCount} more` : preview.join(", ");
};

const getDeliveryRequestAction = (order: DeliveryOrder, profile?: DeliveryProfile | null) => {
  if (!profile) {
    return { disabled: true, label: "Loading profile" };
  }

  if (profile.availabilityStatus !== "ONLINE") {
    return { disabled: true, label: "Go online to accept" };
  }

  if (!requestAcceptableStatuses.has(order.status)) {
    return { disabled: true, label: "Awaiting pickup readiness" };
  }

  return { disabled: false, label: "Accept order" };
};

const DeliveryRequestCard = ({
  order,
  profile,
  pendingOrderId,
  onAccept,
  onSkip,
}: {
  order: DeliveryOrder;
  profile?: DeliveryProfile | null;
  pendingOrderId: number | null;
  onAccept: (orderId: number) => Promise<void>;
  onSkip: (orderId: number) => Promise<void>;
}) => {
  const actionState = getDeliveryRequestAction(order, profile);
  const pickupDistance = order.deliveryOffer?.distanceKm ?? order.routeDistanceKm;

  return (
    <div id={`delivery-order-${order.id}`} className="rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold text-ink">{order.orderNumber}</p>
            <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} />
          </div>
          <p className="text-sm text-ink-soft">{order.restaurant.name}</p>
          <p className="text-sm text-ink-soft">{buildDeliveryItemsSummary(order.items)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.25rem] bg-cream px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">ETA</p>
            <p className="mt-2 text-sm font-semibold text-ink">{formatEtaMinutes(order.estimatedDeliveryMinutes)}</p>
          </div>
          <div className="rounded-[1.25rem] bg-cream px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Pickup distance</p>
            <p className="mt-2 text-sm font-semibold text-ink">{formatDistanceKm(pickupDistance)}</p>
          </div>
          <div className="rounded-[1.25rem] bg-cream px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Offer window</p>
            <p className="mt-2 text-sm font-semibold text-ink">{formatOfferTimeRemaining(order.deliveryOffer?.expiresAt)}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm leading-7 text-ink-soft md:grid-cols-2">
        <p><span className="font-semibold text-ink">Customer:</span> {order.user.fullName}</p>
        <p><span className="font-semibold text-ink">Payment:</span> {toLabel(order.paymentMethod)} | {formatCurrency(order.totalAmount)}</p>
        <p><span className="font-semibold text-ink">Pickup:</span> {buildDeliveryAddressSummary([order.restaurant.addressLine, order.restaurant.area, order.restaurant.city]) || order.restaurant.name}</p>
        <p><span className="font-semibold text-ink">Drop-off:</span> {buildDeliveryAddressSummary([order.address.houseNo, order.address.street, order.address.area, order.address.city])}</p>
      </div>
      {order.deliveryOffer ? (
        <div className="mt-4 rounded-[1.25rem] bg-cream px-4 py-3 text-sm leading-7 text-ink-soft">
          Broadcast radius {formatDistanceKm(order.deliveryOffer.radiusKm)} • Batch {order.deliveryOffer.batchNumber}
        </div>
      ) : null}
      {order.specialInstructions ? (
        <div className="mt-4 rounded-[1.25rem] border border-accent/10 bg-accent/[0.03] px-4 py-3 text-sm leading-7 text-ink-soft">
          {order.specialInstructions}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          className="min-w-32"
          onClick={() => void onSkip(order.id)}
          disabled={pendingOrderId === order.id}
        >
          {pendingOrderId === order.id ? "Working..." : "Skip"}
        </Button>
        <Button
          type="button"
          className="min-w-40"
          onClick={() => void onAccept(order.id)}
          disabled={actionState.disabled || pendingOrderId === order.id}
        >
          {pendingOrderId === order.id ? "Accepting..." : actionState.label}
        </Button>
      </div>
    </div>
  );
};

const getBrowserLocation = () =>
  new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GEOLOCATION_UNAVAILABLE"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error("GEOLOCATION_DENIED")),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  });

const buildDeliveryRouteMarkers = (order: DeliveryOrder, profile?: DeliveryProfile | null) => {
  const partnerLatitude = profile?.currentLatitude ?? order.deliveryPartner?.currentLatitude;
  const partnerLongitude = profile?.currentLongitude ?? order.deliveryPartner?.currentLongitude;

  return [
    {
      id: `restaurant-${order.id}`,
      label: order.restaurant.name,
      description: "Pickup point",
      latitude: order.restaurant.latitude,
      longitude: order.restaurant.longitude,
      color: "#d97706",
    },
    {
      id: `customer-${order.id}`,
      label: order.address.title?.trim() || "Customer",
      description: [order.address.area, order.address.city].filter(Boolean).join(", ") || "Drop-off point",
      latitude: order.address.latitude,
      longitude: order.address.longitude,
      color: "#0f766e",
    },
    ...(partnerLatitude != null && partnerLongitude != null
      ? [
          {
            id: `partner-${order.id}`,
            label: profile?.user.fullName ?? order.deliveryPartner?.user.fullName ?? "You",
            description: "Current rider location",
            latitude: partnerLatitude,
            longitude: partnerLongitude,
            color: "#8b1e24",
          },
        ]
      : []),
  ];
};

const useDeliveryWorkspace = () => {
  const { isAuthenticated, user } = useAuth();
  const useLiveFlow = isLiveDeliverySession(isAuthenticated, user?.role);
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [requests, setRequests] = useState<DeliveryOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<DeliveryOrder[]>([]);
  const [history, setHistory] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const loadDataRef = useRef<
    ((options?: { quietly?: boolean }) => Promise<void>) | null
  >(null);

  const loadData = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!useLiveFlow) {
      return;
    }

    if (!quietly) {
      setIsLoading(true);
    }

    try {
      const [profileRow, requestRows, activeRows, historyRows] = await Promise.all([
        getDeliveryProfile(),
        getDeliveryRequests(),
        getDeliveryActiveOrders(),
        getDeliveryHistory(),
      ]);
      setProfile(profileRow);
      setRequests(requestRows);
      setActiveOrders(activeRows);
      setHistory(historyRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load delivery workspace data."));
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, [useLiveFlow]);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimeSubscription({
    enabled: useLiveFlow,
    userId: user?.id,
    onNotification: (notification) => {
      if (notification.type === "ORDER") {
        void loadData({ quietly: true });
      }
    },
    onOrderStatusUpdate: () => {
      void loadData({ quietly: true });
    },
    onDeliveryLocationUpdate: () => {
      void loadData({ quietly: true });
    },
    onDispatchQueueUpdate: () => {
      void loadData({ quietly: true });
    },
  });

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDataRef.current?.({ quietly: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [useLiveFlow]);

  const toggleAvailability = async () => {
    if (!profile) {
      return;
    }

    setIsUpdatingAvailability(true);
    try {
      const nextAvailability = profile.availabilityStatus === "ONLINE" ? "OFFLINE" : "ONLINE";
      const nextProfile = await updateDeliveryAvailability(nextAvailability);
      setProfile(nextProfile);
      toast.success(`Availability updated to ${toLabel(nextAvailability)}.`);
      await loadData({ quietly: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update availability right now."));
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const refreshLocation = async () => {
    if (!useLiveFlow) {
      return;
    }

    setIsUpdatingLocation(true);
    try {
      const location = await getBrowserLocation();
      const nextProfile = await updateDeliveryLocation(location);
      setProfile(nextProfile);
      toast.success("Live location refreshed successfully.");
      await loadData();
    } catch (error) {
      if (error instanceof Error && error.message === "GEOLOCATION_DENIED") {
        toast.error("Allow location access to refresh your live rider position.");
      } else {
        toast.error(getApiErrorMessage(error, "Unable to refresh live location."));
      }
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    setPendingOrderId(orderId);
    try {
      await updateDeliveryOrderStatus(orderId, { status });
      toast.success(`Order moved to ${toLabel(status)}.`);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this delivery status."));
    } finally {
      setPendingOrderId(null);
    }
  };

  const acceptOrder = async (orderId: number) => {
    setPendingOrderId(orderId);
    try {
      await acceptDeliveryRequestApi(orderId);
      toast.success("Delivery request accepted successfully.");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to accept this delivery request."));
    } finally {
      setPendingOrderId(null);
    }
  };

  const skipOrder = async (orderId: number) => {
    setPendingOrderId(orderId);
    try {
      await skipDeliveryRequest(orderId);
      toast.success("Delivery request skipped.");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to skip this delivery request."));
    } finally {
      setPendingOrderId(null);
    }
  };

  const releaseOrder = async (orderId: number) => {
    setPendingOrderId(orderId);
    try {
      await releaseAssignedDeliveryOrder(orderId);
      toast.success("Order released back to nearby rider search.");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to release this delivery order."));
    } finally {
      setPendingOrderId(null);
    }
  };

  return {
    useLiveFlow,
    profile,
    requests,
    activeOrders,
    history,
    isLoading,
    isUpdatingAvailability,
    isUpdatingLocation,
    pendingOrderId,
    loadData,
    refreshLocation,
    toggleAvailability,
    acceptOrder,
    skipOrder,
    releaseOrder,
    updateOrderStatus,
    user,
  };
};

const DemoDeliveryDashboard = () => (
  <div className="space-y-8">
    <SectionHeading
      eyebrow="Delivery partner"
      title="Shift view, live and ready."
      description="The delivery dashboard now has real route destinations for active runs, earnings, and profile readiness."
    />

    <div className="grid gap-4 xl:grid-cols-3">
      {deliveryStats.map((stat) => (
        <DashboardStatCard key={stat.label} {...stat} />
      ))}
    </div>

    <SurfaceCard className="space-y-4">
      <SectionHeading
        title="Live delivery intelligence"
        description="Sign in as a delivery partner to load the free map, ETA, and route-aware status controls."
      />
      <p className="text-sm leading-7 text-ink-soft">
        This fallback keeps the delivery routes intact for non-partner sessions while the live delivery workspace remains protected behind delivery-partner auth.
      </p>
    </SurfaceCard>
  </div>
);

export const DeliveryDashboardPage = () => {
  const {
    useLiveFlow,
    profile,
    requests,
    activeOrders,
    history,
    isLoading,
    pendingOrderId,
    acceptOrder,
    skipOrder,
    refreshLocation,
    loadData,
    isUpdatingLocation,
  } = useDeliveryWorkspace();

  const deliveredOrders = history.filter((order) => order.status === "DELIVERED");
  const dashboardMarkers = useMemo(
    () =>
      activeOrders.length
        ? activeOrders.flatMap((order) => buildDeliveryRouteMarkers(order, profile))
        : profile?.currentLatitude != null && profile.currentLongitude != null
          ? [
              {
                id: "profile-location",
                label: profile.user.fullName,
                description: "Current rider location",
                latitude: profile.currentLatitude,
                longitude: profile.currentLongitude,
                color: "#8b1e24",
              },
            ]
          : [],
    [activeOrders, profile],
  );

  if (!useLiveFlow) {
    return <DemoDeliveryDashboard />;
  }

  if (isLoading && !profile) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Delivery partner"
        title="Shift view, live and ready."
        description="Route-aware ETA, pickup visibility, and current rider location all stay on one delivery workspace."
        action={
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => void refreshLocation()} disabled={isUpdatingLocation}>
              {isUpdatingLocation ? "Refreshing..." : "Refresh location"}
            </Button>
            <RefreshButton onClick={() => void loadData()} />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <DashboardStatCard label="New requests" value={requests.length.toString()} hint="Dispatch-managed queue" />
        <DashboardStatCard label="Active deliveries" value={activeOrders.length.toString()} hint="Orders currently in motion" />
        <DashboardStatCard label="Completed runs" value={deliveredOrders.length.toString()} hint="Finished delivery history" />
        <DashboardStatCard
          label="Tips in flight"
          value={formatCurrency(activeOrders.reduce((sum, order) => sum + order.tipAmount, 0))}
          hint="Visible for assigned deliveries"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Navigation-ready map" description="Restaurant, drop-off, and your live rider location share one free OSM map." />
          <RouteMap markers={dashboardMarkers} />
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Shift readiness" description="Everything needed before the next pickup or handoff." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Availability</p>
              <div className="mt-2">
                <StatusPill label={toLabel(profile?.availabilityStatus ?? "OFFLINE")} tone={getToneForStatus(profile?.availabilityStatus)} />
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Vehicle</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {(profile?.vehicleType ?? "Bike").replace(/_/g, " ")}
                {profile?.vehicleNumber ? ` | ${profile.vehicleNumber}` : ""}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Current coordinates</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {profile?.currentLatitude != null && profile.currentLongitude != null
                  ? `${profile.currentLatitude.toFixed(4)}, ${profile.currentLongitude.toFixed(4)}`
                  : "Location not shared yet"}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Last location update</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {profile?.lastLocationUpdatedAt ? formatDateTime(profile.lastLocationUpdatedAt) : "Not updated yet"}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {requests.length ? (
              requests.slice(0, 3).map((order) => (
                <DeliveryRequestCard
                  key={order.id}
                  order={order}
                  profile={profile}
                  pendingOrderId={pendingOrderId}
                  onAccept={acceptOrder}
                  onSkip={skipOrder}
                />
              ))
            ) : (
              <p className="text-sm leading-7 text-ink-soft">
                No new dispatch requests are waiting right now.
              </p>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export const DeliveryActivePage = () => {
  const [searchParams] = useSearchParams();
  const {
    useLiveFlow,
    requests,
    profile,
    activeOrders,
    isLoading,
    pendingOrderId,
    acceptOrder,
    skipOrder,
    releaseOrder,
    updateOrderStatus,
    refreshLocation,
    loadData,
    isUpdatingLocation,
  } = useDeliveryWorkspace();
  const highlightedOrderId = Number(searchParams.get("orderId") ?? "0");

  useEffect(() => {
    if (!highlightedOrderId || typeof document === "undefined") {
      return;
    }

    const highlightedOrder = document.getElementById(`delivery-order-${highlightedOrderId}`);
    if (!highlightedOrder) {
      return;
    }

    highlightedOrder.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedOrderId, requests, activeOrders]);

  if (!useLiveFlow) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Active deliveries"
          title="Current runs and pickup queue."
          description="Active deliveries now live on their own route instead of sharing the generic dashboard placeholder."
        />
        <SurfaceCard>
          <p className="text-sm leading-7 text-ink-soft">
            Sign in as a delivery partner to load assigned orders, route maps, and live status controls.
          </p>
        </SurfaceCard>
      </div>
    );
  }

  if (isLoading && !activeOrders.length) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Active deliveries"
        title="Current runs and pickup queue."
        description="Every assigned delivery now carries ETA, route distance, tip visibility, and partner-safe status controls."
        action={
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => void refreshLocation()} disabled={isUpdatingLocation}>
              {isUpdatingLocation ? "Refreshing..." : "Refresh location"}
            </Button>
            <RefreshButton onClick={() => void loadData()} />
          </div>
        }
      />

      {requests.length ? (
        <SurfaceCard className="space-y-4">
          <SectionHeading
            title="Available pickup requests"
            description="Accept a ready request here to move it straight into your active delivery flow."
          />
          <div className="space-y-4">
            {requests.map((order) => (
              <DeliveryRequestCard
                key={order.id}
                order={order}
                profile={profile}
                pendingOrderId={pendingOrderId}
                onAccept={acceptOrder}
                onSkip={skipOrder}
              />
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {activeOrders.length ? (
        <div className="space-y-6">
          {activeOrders.map((order) => (
            <div key={order.id} id={`delivery-order-${order.id}`}>
              <SurfaceCard className="space-y-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-4xl font-semibold text-ink">{order.orderNumber}</h2>
                    <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} />
                  </div>
                  <p className="text-sm text-ink-soft">
                    {order.restaurant.name} to {[order.address.area, order.address.city].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">ETA</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatEtaMinutes(order.estimatedDeliveryMinutes)}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Distance</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDistanceKm(order.routeDistanceKm)}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Tip</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(order.tipAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <RouteMap markers={buildDeliveryRouteMarkers(order, profile)} />
                  {order.specialInstructions ? (
                    <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
                      {order.specialInstructions}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.75rem] bg-cream px-5 py-5 text-sm leading-7 text-ink-soft">
                    <p><span className="font-semibold text-ink">Order:</span> {order.orderNumber}</p>
                    <p><span className="font-semibold text-ink">Customer:</span> {order.user.fullName}</p>
                    <p><span className="font-semibold text-ink">Pickup:</span> {order.restaurant.addressLine ?? order.restaurant.area ?? order.restaurant.city}</p>
                    <p><span className="font-semibold text-ink">Drop-off:</span> {[order.address.houseNo, order.address.street, order.address.area, order.address.city].filter(Boolean).join(", ")}</p>
                    <p><span className="font-semibold text-ink">Items:</span> {buildDeliveryItemsSummary(order.items)}</p>
                    <p><span className="font-semibold text-ink">Payment:</span> {toLabel(order.paymentMethod)} | {formatCurrency(order.totalAmount)}</p>
                    <p><span className="font-semibold text-ink">Customer note:</span> {order.specialInstructions ?? "No extra note shared."}</p>
                  </div>
                  <div className="space-y-3">
                    {order.status === "DELIVERY_PARTNER_ASSIGNED" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => void releaseOrder(order.id)}
                        disabled={pendingOrderId === order.id}
                      >
                        {pendingOrderId === order.id ? "Updating..." : "Release order"}
                      </Button>
                    ) : null}
                    {(deliveryStatusTransitions[order.status] ?? []).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant={status === "DELIVERED" ? "primary" : "secondary"}
                        className="w-full justify-center"
                        onClick={() => void updateOrderStatus(order.id, status)}
                        disabled={pendingOrderId === order.id}
                      >
                        {pendingOrderId === order.id ? "Updating..." : `Mark as ${toLabel(status)}`}
                      </Button>
                    ))}
                    {!(deliveryStatusTransitions[order.status] ?? []).length ? (
                      <p className="text-sm leading-7 text-ink-soft">
                        No rider-side status update is needed for the current state.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              </SurfaceCard>
            </div>
          ))}
        </div>
      ) : requests.length ? null : (
        <EmptyState
          title="No active deliveries"
          description="Assigned orders will appear here with route map, ETA, and tip visibility."
        />
      )}
    </div>
  );
};

export const DeliveryHistoryPage = () => {
  const { useLiveFlow, history, isLoading, loadData } = useDeliveryWorkspace();
  const deliveredCount = history.filter((order) => order.status === "DELIVERED").length;
  const cancelledCount = history.filter((order) => order.status === "CANCELLED").length;
  const deliveredTips = history
    .filter((order) => order.status === "DELIVERED")
    .reduce((sum, order) => sum + order.tipAmount, 0);

  if (!useLiveFlow) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="History"
          title="Completed delivery archive."
          description="Past jobs, customer ratings, and payout values remain easy to scan in the current dashboard design system."
        />
        <SurfaceCard>
          <p className="text-sm leading-7 text-ink-soft">
            Sign in as a delivery partner to load live delivery history, tips, and final status outcomes.
          </p>
        </SurfaceCard>
      </div>
    );
  }

  if (isLoading && !history.length) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="History"
        title="Completed delivery archive."
        description="Past delivery outcomes, route summaries, and visible customer tips stay easy to scan."
        action={<RefreshButton onClick={() => void loadData()} />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardStatCard label="Completed deliveries" value={deliveredCount.toString()} hint="Successful handoffs" />
        <DashboardStatCard label="Cancelled runs" value={cancelledCount.toString()} hint="Orders closed before handoff" />
        <DashboardStatCard label="Tips earned" value={formatCurrency(deliveredTips)} hint="Delivered orders only" />
      </div>

      {history.length ? (
        <div className="space-y-4">
          {history.map((order) => (
            <SurfaceCard key={order.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{order.orderNumber}</p>
                <h2 className="font-display text-4xl font-semibold text-ink">{order.restaurant.name}</h2>
                <p className="text-sm text-ink-soft">
                  {formatDateTime(order.deliveredAt ?? order.cancelledAt ?? order.orderedAt)}
                </p>
                <p className="text-sm text-ink-soft">
                  {toLabel(order.paymentMethod)} | {formatCurrency(order.totalAmount)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} />
                <p className="text-sm font-semibold text-ink">{formatDistanceKm(order.routeDistanceKm)}</p>
                <p className="text-sm font-semibold text-ink">Tip {formatCurrency(order.tipAmount)}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No delivery history yet"
          description="Completed or cancelled delivery records will appear here once your first runs finish."
        />
      )}
    </div>
  );
};

export const DeliveryEarningsPage = () => {
  const { useLiveFlow, activeOrders, history, isLoading, loadData } = useDeliveryWorkspace();

  if (!useLiveFlow) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Earnings"
          title="Daily earnings and incentive visibility."
          description="A dedicated earnings page rounds out the rider dashboard using the existing stat card language."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {demoDeliveryEarnings.map((stat) => (
            <DashboardStatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    );
  }

  if (isLoading && !history.length && !activeOrders.length) {
    return <AdminLoadingState rows={6} />;
  }

  const deliveredOrders = history.filter((order) => order.status === "DELIVERED");
  const deliveredTips = deliveredOrders.reduce((sum, order) => sum + order.tipAmount, 0);
  const activeTips = activeOrders.reduce((sum, order) => sum + order.tipAmount, 0);
  const averageTip = deliveredOrders.length ? deliveredTips / deliveredOrders.length : 0;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const deliveredToday = deliveredOrders.filter(
    (order) => order.deliveredAt && new Date(order.deliveredAt) >= startOfToday,
  );
  const deliveredThisWeek = deliveredOrders.filter(
    (order) => order.deliveredAt && new Date(order.deliveredAt) >= startOfWeek,
  );
  const weeklyTips = deliveredThisWeek.reduce((sum, order) => sum + order.tipAmount, 0);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Earnings"
        title="Daily earnings and incentive visibility."
        description="Tip visibility and delivered-run counts are derived from the live delivery history without touching the existing payout flow."
        action={<RefreshButton onClick={() => void loadData()} />}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <DashboardStatCard label="Today completed" value={deliveredToday.length.toString()} hint="Deliveries closed today" />
        <DashboardStatCard label="This week" value={deliveredThisWeek.length.toString()} hint="Delivered in the last 7 days" />
        <DashboardStatCard label="Delivered runs" value={deliveredOrders.length.toString()} hint="Completed handoffs" />
        <DashboardStatCard label="Tips received" value={formatCurrency(deliveredTips)} hint="Delivered orders only" />
        <DashboardStatCard label="This week tips" value={formatCurrency(weeklyTips)} hint="Recent delivered orders" />
        <DashboardStatCard label="Tips in flight" value={formatCurrency(activeTips)} hint="Assigned active deliveries" />
        <DashboardStatCard label="Average tip" value={formatCurrency(averageTip)} hint="Per delivered order" />
      </div>

      <SurfaceCard className="space-y-4">
        <SectionHeading title="Recent tipped orders" description="Tip visibility stays operationally useful without changing payout settlement logic." />
        <div className="space-y-3">
          {history.filter((order) => order.tipAmount > 0).slice(0, 6).map((order) => (
            <div key={order.id} className="flex items-center justify-between rounded-[1.5rem] bg-cream px-4 py-4 text-sm text-ink-soft">
              <span>{order.orderNumber}</span>
              <span>{formatCurrency(order.tipAmount)}</span>
            </div>
          ))}
          {!history.some((order) => order.tipAmount > 0) ? (
            <p className="text-sm leading-7 text-ink-soft">
              Tips will appear here as customers add them during checkout.
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
};

export const DeliveryProfilePage = () => {
  const { accessToken, setSession } = useAuth();
  const {
    useLiveFlow,
    profile,
    isLoading,
    toggleAvailability,
    refreshLocation,
    loadData,
    isUpdatingAvailability,
    isUpdatingLocation,
    user,
  } = useDeliveryWorkspace();
  const [isAvailable, setIsAvailable] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    vehicleNumber: "",
    licenseNumber: "",
  });

  useEffect(() => {
    if (!profile || isEditingProfile) {
      return;
    }

    setForm({
      fullName: profile.user.fullName,
      phone: profile.user.phone ?? "",
      vehicleNumber: profile.vehicleNumber ?? "",
      licenseNumber: profile.licenseNumber ?? "",
    });
  }, [isEditingProfile, profile]);

  const handleProfileSubmit = async () => {
    if (!profile) {
      return;
    }

    setIsSavingProfile(true);
    try {
      const nextProfile = await updateDeliveryProfile({
        fullName: form.fullName,
        phone: form.phone.trim() || undefined,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
        licenseNumber: form.licenseNumber.trim() || undefined,
      });
      if (accessToken) {
        setSession({ user: toDeliverySessionUser(nextProfile), accessToken });
      }
      setIsEditingProfile(false);
      toast.success("Delivery profile updated successfully.");
      await loadData({ quietly: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your profile."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!useLiveFlow) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Availability and profile"
          title="Shift controls, documents, and contact details."
          description="This route combines availability and rider profile data so the delivery side has a complete operational surface."
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <SurfaceCard className="space-y-5">
            <Input label="Full name" defaultValue={user?.fullName ?? "Ravi Kumar"} />
            <Input label="Email" defaultValue={user?.email ?? "ravi.kumar@zomatoluxe.dev"} />
            <Input label="Phone" defaultValue={user?.phone ?? "+91 98200 00201"} />
            <Input label="Vehicle number" defaultValue="KA03EX1045" />
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Availability</p>
              <h2 className="mt-2 font-display text-4xl font-semibold text-ink">
                {isAvailable ? "Online for orders" : "Taking a short pause"}
              </h2>
            </div>
            <Button type="button" variant={isAvailable ? "secondary" : "primary"} onClick={() => setIsAvailable((value) => !value)}>
              {isAvailable ? "Go offline" : "Go online"}
            </Button>
            <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-soft">Driving license</span>
                <StatusPill label="Approved" tone="success" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-soft">Vehicle RC</span>
                <StatusPill label="Approved" tone="success" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-soft">Safety review</span>
                <StatusPill label="Up to date" tone="info" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <p className="text-sm leading-7 text-ink-soft">Document refresh and availability sync are ready to connect to the delivery partner endpoints when needed.</p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (isLoading && !profile) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Availability and profile"
        title="Shift controls, documents, and contact details."
        description="Availability, live location, and verification details stay together in the current delivery dashboard style."
        action={
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => void refreshLocation()} disabled={isUpdatingLocation}>
              {isUpdatingLocation ? "Refreshing..." : "Refresh location"}
            </Button>
            <RefreshButton onClick={() => void loadData()} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (isEditingProfile) {
                  setIsEditingProfile(false);
                  setForm({
                    fullName: profile?.user.fullName ?? "",
                    phone: profile?.user.phone ?? "",
                    vehicleNumber: profile?.vehicleNumber ?? "",
                    licenseNumber: profile?.licenseNumber ?? "",
                  });
                  return;
                }

                setIsEditingProfile(true);
              }}
            >
              {isEditingProfile ? "Cancel edit" : "Edit profile"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <Input
            label="Full name"
            value={isEditingProfile ? form.fullName : profile?.user.fullName ?? ""}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            readOnly={!isEditingProfile}
          />
          <Input label="Email" value={profile?.user.email ?? ""} readOnly />
          <Input
            label="Phone"
            value={isEditingProfile ? form.phone : profile?.user.phone ?? ""}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            readOnly={!isEditingProfile}
          />
          <Input
            label="Vehicle number"
            value={isEditingProfile ? form.vehicleNumber : profile?.vehicleNumber ?? ""}
            onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })}
            readOnly={!isEditingProfile}
          />
          <Input
            label="License number"
            value={isEditingProfile ? form.licenseNumber : profile?.licenseNumber ?? ""}
            onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })}
            readOnly={!isEditingProfile}
          />
          {isEditingProfile ? (
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditingProfile(false);
                  setForm({
                    fullName: profile?.user.fullName ?? "",
                    phone: profile?.user.phone ?? "",
                    vehicleNumber: profile?.vehicleNumber ?? "",
                    licenseNumber: profile?.licenseNumber ?? "",
                  });
                }}
                disabled={isSavingProfile}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleProfileSubmit()} disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save profile"}
              </Button>
            </div>
          ) : null}
          <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm text-ink-soft">
            Current location:{" "}
            <span className="font-semibold text-ink">
              {profile?.currentLatitude != null && profile.currentLongitude != null
                ? `${profile.currentLatitude.toFixed(4)}, ${profile.currentLongitude.toFixed(4)}`
                : "Not shared yet"}
            </span>
          </div>
          <RouteMap
            markers={
              profile?.currentLatitude != null && profile.currentLongitude != null
                ? [
                    {
                      id: "rider-location",
                      label: profile.user.fullName,
                      description: "Current rider location",
                      latitude: profile.currentLatitude,
                      longitude: profile.currentLongitude,
                      color: "#8b1e24",
                    },
                  ]
                : []
            }
            emptyMessage="Refresh location to pin your live rider position on the map."
          />
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Availability</p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-ink">
              {profile?.availabilityStatus === "ONLINE" ? "Online for orders" : "Taking a short pause"}
            </h2>
          </div>
          <Button
            type="button"
            variant={profile?.availabilityStatus === "ONLINE" ? "secondary" : "primary"}
            onClick={() => void toggleAvailability()}
            disabled={isUpdatingAvailability}
          >
            {isUpdatingAvailability
              ? "Saving..."
              : profile?.availabilityStatus === "ONLINE"
                ? "Go offline"
                : "Go online"}
          </Button>
          <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-4">
            {profile?.documents.length ? (
              profile.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between">
                  <span className="text-sm text-ink-soft">{document.name}</span>
                  <StatusPill label={toLabel(document.status)} tone={getToneForStatus(document.status)} />
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-ink-soft">No rider documents are attached to this profile yet.</p>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4">
            <LocateFixed className="h-5 w-5 text-accent" />
            <p className="text-sm leading-7 text-ink-soft">
              Last location update: {profile?.lastLocationUpdatedAt ? formatDateTime(profile.lastLocationUpdatedAt) : "Not updated yet"}.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <p className="text-sm leading-7 text-ink-soft">
              Verification and live-location updates stay connected without changing the current dashboard language.
            </p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
