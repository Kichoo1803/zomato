import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import { getOwnerOrders, updateOwnerOrderStatus, type OwnerOrder } from "@/lib/owner";
import {
  PAGE_SIZE,
  RefreshButton,
  formatCurrency,
  formatDateTime,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "@/pages/admin/admin-shared";

const OWNER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLACED: ["CONFIRMED", "ACCEPTED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "DELAYED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "DELAYED", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "DELAYED", "CANCELLED"],
  READY_FOR_PICKUP: ["LOOKING_FOR_DELIVERY_PARTNER", "DELAYED", "CANCELLED"],
  LOOKING_FOR_DELIVERY_PARTNER: ["DELAYED", "CANCELLED"],
  DELIVERY_PARTNER_ASSIGNED: ["DELAYED", "CANCELLED"],
  DELAYED: ["PREPARING", "READY_FOR_PICKUP", "LOOKING_FOR_DELIVERY_PARTNER", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
};

const OWNER_STATUS_FILTERS = [
  "ALL",
  "PLACED",
  "CONFIRMED",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "LOOKING_FOR_DELIVERY_PARTNER",
  "DELIVERY_PARTNER_ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
  "DELAYED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export const OwnerOrdersPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OwnerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OwnerOrder | null>(null);
  const [statusDraft, setStatusDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const highlightedOrderId = Number(searchParams.get("orderId") ?? "0");

  const loadOrders = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setIsLoading(true);
    }

    try {
      const nextOrders = await getOwnerOrders();
      setOrders(nextOrders);
      setSelectedOrder((currentOrder) => {
        if (!currentOrder) {
          return currentOrder;
        }

        const refreshedOrder = nextOrders.find((order) => order.id === currentOrder.id) ?? null;
        if (refreshedOrder) {
          setStatusDraft(refreshedOrder.status);
        }

        return refreshedOrder;
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load owner orders."));
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!highlightedOrderId) {
      return;
    }

    const nextOrder = orders.find((order) => order.id === highlightedOrderId);
    if (!nextOrder || selectedOrder?.id === nextOrder.id) {
      return;
    }

    setSelectedOrder(nextOrder);
    setStatusDraft(nextOrder.status);
  }, [highlightedOrderId, orders, selectedOrder?.id]);

  useRealtimeSubscription({
    enabled: user?.role === "RESTAURANT_OWNER",
    userId: user?.id,
    onNotification: (notification) => {
      if (notification.type === "ORDER") {
        void loadOrders({ quietly: true });
      }
    },
    onOrderStatusUpdate: () => {
      void loadOrders({ quietly: true });
    },
  });

  const filteredOrders = orders.filter((order) => {
    const haystack = `${order.orderNumber} ${order.restaurant.name} ${order.address.city}`;
    const orderedAt = new Date(order.orderedAt).getTime();
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const withinDateFilter =
      dateFilter === "TODAY"
        ? orderedAt >= startOfToday.getTime()
        : dateFilter === "LAST_7_DAYS"
          ? orderedAt >= now - 7 * 24 * 60 * 60 * 1000
          : dateFilter === "LAST_30_DAYS"
            ? orderedAt >= now - 30 * 24 * 60 * 60 * 1000
            : true;

    return (
      (!search || matchesSearch(haystack, search)) &&
      (statusFilter === "ALL" || order.status === statusFilter) &&
      withinDateFilter
    );
  });

  const pagedOrders = paginate(filteredOrders, page);

  const getStatusOptions = (order: OwnerOrder) => {
    const nextStatuses = OWNER_STATUS_TRANSITIONS[order.status] ?? [];
    return [order.status, ...nextStatuses].filter(
      (status, index, statuses) =>
        statuses.indexOf(status) === index &&
        (status !== "DELIVERY_PARTNER_ASSIGNED" || Boolean(order.deliveryPartner)),
    );
  };

  const openOrderDetails = (order: OwnerOrder) => {
    setSelectedOrder(order);
    setStatusDraft(order.status);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("orderId", String(order.id));
    setSearchParams(nextSearchParams, { replace: true });
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
    if (!searchParams.has("orderId")) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("orderId");
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder || statusDraft === selectedOrder.status) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedOrder = await updateOwnerOrderStatus(selectedOrder.id, { status: statusDraft });
      toast.success("Order status updated successfully.");
      setSelectedOrder(updatedOrder);
      await loadOrders();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this order."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner orders"
        title="Kitchen queue and order-status control."
        description="View only your own restaurant orders, inspect details, and move statuses forward while nearby rider search stays automatic."
        action={<RefreshButton onClick={() => void loadOrders()} />}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by order number, restaurant, or city"
        filters={
          <>
            <Select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[220px]"
            >
              {OWNER_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All order statuses" : toLabel(status)}
                </option>
              ))}
            </Select>
            <Select
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All dates</option>
              <option value="TODAY">Today</option>
              <option value="LAST_7_DAYS">Last 7 days</option>
              <option value="LAST_30_DAYS">Last 30 days</option>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedOrders.items}
            getRowKey={(order) => order.id}
            emptyTitle="No owner orders found"
            emptyDescription="New restaurant orders will appear here as soon as customers place them."
            columns={[
              {
                key: "order",
                label: "Order",
                render: (order) => (
                  <div>
                    <p className="font-semibold text-ink">{order.orderNumber}</p>
                    <p className="text-xs text-ink-muted">{order.restaurant.name}</p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (order) => (
                  <div>
                    <StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} />
                    <p className="mt-2 text-xs text-ink-muted">{order.items.length} line items</p>
                  </div>
                ),
              },
              {
                key: "payment",
                label: "Payment",
                render: (order) => (
                  <div>
                    <p className="font-semibold text-ink">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-ink-muted">
                      {toLabel(order.paymentStatus)}
                      {order.tipAmount ? ` • Tip ${formatCurrency(order.tipAmount)}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "placed",
                label: "Placed",
                render: (order) => formatDateTime(order.orderedAt),
              },
              {
                key: "actions",
                label: "Actions",
                render: (order) => (
                  <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => openOrderDetails(order)}>
                    Inspect
                  </Button>
                ),
              },
            ]}
          />
          {filteredOrders.length > PAGE_SIZE ? (
            <Pagination page={pagedOrders.currentPage} totalPages={pagedOrders.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Modal open={Boolean(selectedOrder)} onClose={closeOrderDetails} title={selectedOrder?.orderNumber} className="max-w-4xl">
        {selectedOrder ? (
          <div className="space-y-6">
            <AdminDetailsGrid
              items={[
                { label: "Restaurant", value: selectedOrder.restaurant.name },
                {
                  label: "Customer",
                  value: `${selectedOrder.user.fullName}${selectedOrder.user.phone ? ` • ${selectedOrder.user.phone}` : ""}`,
                },
                {
                  label: "Current status",
                  value: <StatusPill label={toLabel(selectedOrder.status)} tone={getToneForStatus(selectedOrder.status)} />,
                },
                { label: "Payment", value: `${toLabel(selectedOrder.paymentMethod)} / ${toLabel(selectedOrder.paymentStatus)}` },
                { label: "Total", value: formatCurrency(selectedOrder.totalAmount) },
                { label: "Tip", value: formatCurrency(selectedOrder.tipAmount) },
                { label: "Placed at", value: formatDateTime(selectedOrder.orderedAt) },
                { label: "Delivery partner", value: selectedOrder.deliveryPartner?.user.fullName ?? "Not assigned" },
                {
                  label: "ETA intelligence",
                  value:
                    selectedOrder.estimatedDeliveryMinutes != null
                      ? `${selectedOrder.estimatedDeliveryMinutes} min ETA`
                      : "Pending route estimate",
                },
                {
                  label: "Route distance",
                  value:
                    selectedOrder.routeDistanceKm != null
                      ? `${selectedOrder.routeDistanceKm.toFixed(1)} km`
                      : "Pending distance",
                },
              ]}
            />

            <SurfaceCard className="space-y-4">
              <SectionHeading title="Order items" description="Items and quantities for this restaurant order." />
              <div className="space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{item.itemName}</p>
                        <p className="text-xs text-ink-muted">
                          {item.quantity} x {formatCurrency(item.itemPrice)}
                        </p>
                      </div>
                      <p className="font-semibold text-ink">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <SectionHeading title="Delivery details" description="Status updates are limited to your own restaurant's valid next steps while rider assignment remains automatic." />
              <AdminDetailsGrid
                className="md:grid-cols-1"
                items={[
                  {
                    label: "Delivery address",
                    value: `${selectedOrder.address.houseNo ?? ""} ${selectedOrder.address.street ?? ""}, ${selectedOrder.address.area ?? ""}, ${selectedOrder.address.city}, ${selectedOrder.address.state} ${selectedOrder.address.pincode}`,
                  },
                  {
                    label: "Delay tracking",
                    value:
                      selectedOrder.delayMinutes > 0
                        ? `${selectedOrder.delayMinutes} min added`
                        : "No added delay",
                  },
                  {
                    label: "Prep baseline",
                    value: `${selectedOrder.restaurant.preparationTime} min prep time`,
                  },
                ]}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Update status" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  {getStatusOptions(selectedOrder).map((status) => (
                    <option key={status} value={status}>
                      {toLabel(status)}
                    </option>
                  ))}
                </Select>
                <div className="rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4 text-sm leading-7 text-ink-soft">
                  Ready orders are broadcast automatically to nearby eligible riders. Owners can monitor the assignment state, but normal rider selection no longer happens manually.
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => void handleSaveOrder()} disabled={isSaving || statusDraft === selectedOrder.status}>
                  {isSaving ? "Saving..." : "Save status update"}
                </Button>
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
