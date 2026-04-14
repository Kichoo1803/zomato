import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getPayments, type AdminPayment } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  PAGE_SIZE,
  RefreshButton,
  formatCurrency,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

export const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      setPayments(await getPayments());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load payments."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
  }, []);

  const filteredPayments = payments.filter((payment) => {
    const haystack = `${payment.transactionId ?? ""} ${payment.order.orderNumber} ${payment.order.restaurant.name} ${payment.order.user.fullName}`;
    return (!search || matchesSearch(haystack, search)) && (statusFilter === "ALL" || payment.status === statusFilter);
  });

  const pagedPayments = paginate(filteredPayments, page);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Payments"
        title="Financial flow tracking."
        description="Review settlements, payment gateways, and order-level payment states."
        action={<RefreshButton onClick={() => void loadPayments()} />}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by transaction, order, restaurant, or customer"
        filters={
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[180px]">
            <option value="ALL">All payment states</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedPayments.items}
            getRowKey={(payment) => payment.id}
            emptyTitle="No payments found"
            emptyDescription="Payment records matching the current filters will appear here."
            columns={[
              { key: "payment", label: "Payment", render: (payment) => <div><p className="font-semibold text-ink">{payment.transactionId ?? "Cash on delivery"}</p><p className="text-xs text-ink-muted">{payment.paymentGateway ?? "Manual settlement"}</p></div> },
              { key: "order", label: "Order", render: (payment) => <div><p className="font-semibold text-ink">{payment.order.orderNumber}</p><p className="text-xs text-ink-muted">{payment.order.restaurant.name}</p></div> },
              { key: "customer", label: "Customer", render: (payment) => <div><p className="font-semibold text-ink">{payment.order.user.fullName}</p><p className="text-xs text-ink-muted">{payment.order.user.email}</p></div> },
              { key: "amount", label: "Amount", render: (payment) => <span className="font-semibold text-ink">{formatCurrency(payment.amount)}</span> },
              { key: "status", label: "Status", render: (payment) => <StatusPill label={toLabel(payment.status)} tone={getToneForStatus(payment.status)} /> },
            ]}
          />
          {filteredPayments.length > PAGE_SIZE ? <Pagination page={pagedPayments.currentPage} totalPages={pagedPayments.totalPages} onPageChange={setPage} /> : null}
        </>
      )}
    </div>
  );
};
