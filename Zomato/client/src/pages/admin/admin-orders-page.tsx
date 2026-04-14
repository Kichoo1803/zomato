import { useEffect, useState } from "react";
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
import {
  assignDeliveryPartnerToOrder,
  getDeliveryPartners,
  getOrders,
  updateOrderStatus,
  type AdminDeliveryPartner,
  type AdminOrder,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  ORDER_STATUS_OPTIONS,
  PAGE_SIZE,
  RefreshButton,
  formatCurrency,
  formatDateTime,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

export const AdminOrdersPage = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [partners, setPartners] = useState<AdminDeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [statusDraft, setStatusDraft] = useState("");
  const [assignedPartnerId, setAssignedPartnerId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orderRows, partnerRows] = await Promise.all([getOrders(), getDeliveryPartners()]);
      setOrders(orderRows);
      setPartners(partnerRows.filter((partner) => partner.user.isActive));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load orders."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const haystack = `${order.orderNumber} ${order.restaurant.name} ${order.address.city}`;
    return (!search || matchesSearch(haystack, search)) && (statusFilter === "ALL" || order.status === statusFilter);
  });

  const pagedOrders = paginate(filteredOrders, page);

  const openOrderDetails = (order: AdminOrder) => {
    setSelectedOrder(order);
    setStatusDraft(order.status);
    setAssignedPartnerId(order.deliveryPartnerId ? String(order.deliveryPartnerId) : "");
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder) {
      return;
    }

    setIsSaving(true);
    try {
      let latestOrder = selectedOrder;
      if (statusDraft && statusDraft !== selectedOrder.status) {
        latestOrder = await updateOrderStatus(selectedOrder.id, { status: statusDraft });
      }

      if (assignedPartnerId && Number(assignedPartnerId) !== (latestOrder.deliveryPartnerId ?? 0)) {
        latestOrder = await assignDeliveryPartnerToOrder(latestOrder.id, Number(assignedPartnerId));
      }

      toast.success("Order updated successfully.");
      setSelectedOrder(latestOrder);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this order."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Orders"
        title="Live platform order visibility."
        description="Search, filter, inspect, and update order status or delivery assignment without breaking historic records."
        action={<RefreshButton onClick={() => void loadData()} />}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by order number, restaurant, or city"
        filters={
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[220px]">
            <option value="ALL">All order statuses</option>
            {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{toLabel(status)}</option>)}
          </Select>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedOrders.items}
            getRowKey={(order) => order.id}
            emptyTitle="No orders match these filters"
            emptyDescription="Try another status or refresh the live order feed."
            columns={[
              { key: "order", label: "Order", render: (order) => <div><p className="font-semibold text-ink">{order.orderNumber}</p><p className="text-xs text-ink-muted">{order.restaurant.name}</p></div> },
              { key: "delivery", label: "Delivery", render: (order) => <div><StatusPill label={toLabel(order.status)} tone={getToneForStatus(order.status)} /><p className="mt-2 text-xs text-ink-muted">{order.deliveryPartner?.user.fullName ?? "Not assigned yet"}</p></div> },
              {
                key: "payment",
                label: "Payment",
                render: (order) => (
                  <div>
                    <p className="font-semibold text-ink">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-ink-muted">
                      {toLabel(order.paymentStatus)}
                      {order.tipAmount ? ` | Tip ${formatCurrency(order.tipAmount)}` : ""}
                    </p>
                  </div>
                ),
              },
              { key: "placed", label: "Placed", render: (order) => formatDateTime(order.orderedAt) },
              { key: "actions", label: "Actions", render: (order) => <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => openOrderDetails(order)}>Inspect</Button> },
            ]}
          />
          {filteredOrders.length > PAGE_SIZE ? <Pagination page={pagedOrders.currentPage} totalPages={pagedOrders.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <Modal open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title={selectedOrder?.orderNumber} className="max-w-4xl">
        {selectedOrder ? (
          <div className="space-y-6">
            <AdminDetailsGrid
              items={[
                { label: "Restaurant", value: selectedOrder.restaurant.name },
                { label: "Current status", value: <StatusPill label={toLabel(selectedOrder.status)} tone={getToneForStatus(selectedOrder.status)} /> },
                { label: "Payment", value: `${toLabel(selectedOrder.paymentMethod)} • ${toLabel(selectedOrder.paymentStatus)}` },
                { label: "Total", value: formatCurrency(selectedOrder.totalAmount) },
                { label: "Tip", value: formatCurrency(selectedOrder.tipAmount) },
                { label: "Placed at", value: formatDateTime(selectedOrder.orderedAt) },
                { label: "Delivery partner", value: selectedOrder.deliveryPartner?.user.fullName ?? "Unassigned" },
                {
                  label: "ETA intelligence",
                  value:
                    selectedOrder.estimatedDeliveryMinutes != null
                      ? `${selectedOrder.estimatedDeliveryMinutes} minutes`
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
              <SectionHeading title="Order items" description="Items and addon breakdown for this order." />
              <div className="space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{item.itemName}</p>
                        <p className="text-xs text-ink-muted">{item.quantity} x {formatCurrency(item.itemPrice)}</p>
                      </div>
                      <p className="font-semibold text-ink">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <SectionHeading title="Address and controls" description="Update status or assign a rider while keeping order integrity intact." />
              <AdminDetailsGrid
                className="md:grid-cols-1"
                items={[
                  {
                    label: "Delivery address",
                    value: `${selectedOrder.address.houseNo ?? ""} ${selectedOrder.address.street ?? ""}, ${selectedOrder.address.area ?? ""}, ${selectedOrder.address.city}, ${selectedOrder.address.state} ${selectedOrder.address.pincode}`,
                  },
                  {
                    label: "Restaurant coordinates",
                    value:
                      selectedOrder.restaurant.latitude != null && selectedOrder.restaurant.longitude != null
                        ? `${selectedOrder.restaurant.latitude.toFixed(4)}, ${selectedOrder.restaurant.longitude.toFixed(4)}`
                        : "Unavailable",
                  },
                  {
                    label: "Customer coordinates",
                    value:
                      selectedOrder.address.latitude != null && selectedOrder.address.longitude != null
                        ? `${selectedOrder.address.latitude.toFixed(4)}, ${selectedOrder.address.longitude.toFixed(4)}`
                        : "Unavailable",
                  },
                ]}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Update status" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{toLabel(status)}</option>)}
                </Select>
                <Select label="Assign delivery partner" value={assignedPartnerId} onChange={(event) => setAssignedPartnerId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.user.fullName} • {partner.vehicleNumber ?? "Vehicle pending"}</option>)}
                </Select>
              </div>
              <div className="rounded-[1.5rem] border border-accent/10 bg-white/60 px-4 py-4 text-sm leading-7 text-ink-soft">Order deletion stays disabled in admin to preserve payment and status history.</div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => void handleSaveOrder()} disabled={isSaving}>{isSaving ? "Saving..." : "Save order changes"}</Button>
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
