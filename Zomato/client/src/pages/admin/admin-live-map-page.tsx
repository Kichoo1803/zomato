import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { RouteMap } from "@/components/maps/route-map";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import {
  getDeliveryPartners,
  getOrders,
  type AdminDeliveryPartner,
  type AdminOrder,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  RefreshButton,
  formatCurrency,
  getToneForStatus,
  toLabel,
} from "./admin-shared";

const terminalStatuses = new Set(["DELIVERED", "CANCELLED", "PAYMENT_FAILED", "REFUNDED"]);

export const AdminLiveMapPage = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [partners, setPartners] = useState<AdminDeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orderRows, partnerRows] = await Promise.all([getOrders(), getDeliveryPartners()]);
      setOrders(orderRows);
      setPartners(partnerRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the live delivery map."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !terminalStatuses.has(order.status) &&
          (statusFilter === "ALL" || order.status === statusFilter),
      ),
    [orders, statusFilter],
  );

  const activePartners = useMemo(
    () => partners.filter((partner) => partner.availabilityStatus !== "OFFLINE"),
    [partners],
  );

  const mapMarkers = useMemo(
    () => [
      ...activePartners.map((partner) => ({
        id: `partner-${partner.id}`,
        label: partner.user.fullName,
        description: `${toLabel(partner.availabilityStatus)} delivery partner`,
        latitude: partner.currentLatitude,
        longitude: partner.currentLongitude,
        color: "#8b1e24",
      })),
      ...activeOrders.map((order) => ({
        id: `restaurant-${order.id}`,
        label: order.restaurant.name,
        description: `Pickup for ${order.orderNumber}`,
        latitude: order.restaurant.latitude,
        longitude: order.restaurant.longitude,
        color: "#d97706",
      })),
      ...activeOrders.map((order) => ({
        id: `customer-${order.id}`,
        label: order.orderNumber,
        description: `${order.address.city} drop-off`,
        latitude: order.address.latitude,
        longitude: order.address.longitude,
        color: "#0f766e",
      })),
    ],
    [activeOrders, activePartners],
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Live delivery map"
          title="Platform movement across active deliveries."
          description="Loading partners, active routes, and order-level ETA signals."
          action={<RefreshButton onClick={() => void loadData()} />}
        />
        <AdminLoadingState rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Live delivery map"
        title="Platform movement across active deliveries."
        description="Monitor delivery partners, pickup points, drop-offs, and order ETA from one premium operations view."
        action={
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[240px]">
              <option value="ALL">All active statuses</option>
              {Array.from(new Set(orders.map((order) => order.status)))
                .filter((status) => !terminalStatuses.has(status))
                .map((status) => (
                  <option key={status} value={status}>
                    {toLabel(status)}
                  </option>
                ))}
            </Select>
            <RefreshButton onClick={() => void loadData()} />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Active orders</p>
          <p className="font-display text-4xl font-semibold text-ink">{activeOrders.length}</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Online partners</p>
          <p className="font-display text-4xl font-semibold text-ink">{activePartners.length}</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delayed orders</p>
          <p className="font-display text-4xl font-semibold text-ink">
            {activeOrders.filter((order) => order.status === "DELAYED").length}
          </p>
        </SurfaceCard>
        <SurfaceCard className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Tips in flight</p>
          <p className="font-display text-4xl font-semibold text-ink">
            {formatCurrency(activeOrders.reduce((sum, order) => sum + order.tipAmount, 0))}
          </p>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard className="space-y-4">
          <SectionHeading
            title="Operations map"
            description="Restaurant markers, customer drop-offs, and active rider positions stay on one shared map."
          />
          <RouteMap markers={mapMarkers} interactive={false} />
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Active deliveries" description="ETA, status, and partner assignment at a glance." />
          <div className="space-y-3">
            {activeOrders.length ? (
              activeOrders.map((order) => (
                <div key={order.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{order.orderNumber}</p>
                      <p className="text-xs text-ink-muted">{order.restaurant.name}</p>
                    </div>
                    <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} />
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-ink-soft">
                    <p>ETA {order.estimatedDeliveryMinutes ? `${order.estimatedDeliveryMinutes} min` : "Pending"}</p>
                    <p>Distance {order.routeDistanceKm ? `${order.routeDistanceKm.toFixed(1)} km` : "Pending"}</p>
                    <p>Partner {order.deliveryPartner?.user.fullName ?? "Awaiting assignment"}</p>
                    <p>Tip {formatCurrency(order.tipAmount)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-ink-soft">
                No active delivery records match the current filter.
              </p>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
