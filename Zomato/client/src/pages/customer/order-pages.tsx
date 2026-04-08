import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CreditCard, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Tabs } from "@/components/ui/tabs";
import { getOrderById, getStatusTone, orders, paymentMethods, savedAddresses } from "@/lib/demo-data";

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft";

export const CartPage = () => {
  const order = orders[0];

  return (
    <PageShell
      eyebrow="Cart"
      title="A calm final review before dinner arrives."
      description="Every line item, note, and total stays visible with a refined summary on larger screens."
      actions={<Link to="/checkout" className={linkButtonClassName}>Proceed to checkout</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {order.items.map((item, index) => (
            <SurfaceCard key={item} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-3xl font-semibold text-ink">{item}</p>
                <p className="mt-2 text-sm text-ink-soft">Prepared by {order.restaurantName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-soft">Qty {index + 1}</p>
                <p className="mt-2 text-lg font-semibold text-ink">₹{index === 0 ? "545" : "195"}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
        <SurfaceCard className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
          <SectionHeading title="Order summary" description="Refined totals with room for delivery notes and promo savings." />
          <div className="space-y-3 text-sm text-ink-soft">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>₹1,040</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delivery fee</span>
              <span>₹95</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Taxes</span>
              <span>₹110</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-ink">
              <span>Total payable</span>
              <span>{order.total}</span>
            </div>
          </div>
          <Button className="w-full" type="button">
            Continue to checkout
          </Button>
        </SurfaceCard>
      </div>
    </PageShell>
  );
};

export const CheckoutPage = () => {
  return (
    <PageShell
      eyebrow="Checkout"
      title="Confirm address, timing, and handoff details."
      description="Structured checkout keeps addresses, delivery notes, and order recap separated without changing the broader layout language."
      actions={<Link to="/payment" className={linkButtonClassName}>Continue to payment</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SurfaceCard className="space-y-4">
            <SectionHeading title="Saved addresses" description="Choose the handoff point that fits tonight’s plan." />
            <div className="grid gap-4">
              {savedAddresses.map((address) => (
                <div key={address.title} className="rounded-[1.5rem] bg-cream px-5 py-4">
                  <p className="font-semibold text-ink">{address.title}</p>
                  <p className="mt-2 text-sm text-ink-soft">{address.line1}</p>
                  <p className="text-sm text-ink-soft">{address.line2}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
          <SurfaceCard className="space-y-4">
            <SectionHeading title="Delivery notes" description="Share gate codes, floor numbers, or preferred handoff details." />
            <Input placeholder="Add instructions for the rider" />
          </SurfaceCard>
        </div>
        <SurfaceCard className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
          <SectionHeading title="Tonight’s order" description="Saffron Story" />
          {orders[0].items.map((item) => (
            <div key={item} className="flex items-center justify-between text-sm text-ink-soft">
              <span>{item}</span>
              <span>₹{item.includes("Biryani") ? "545" : "195"}</span>
            </div>
          ))}
          <div className="border-t border-accent/10 pt-4 text-sm font-semibold text-ink">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span>{orders[0].total}</span>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
};

export const PaymentPage = () => {
  const [activeMethod, setActiveMethod] = useState("card");

  return (
    <PageShell
      eyebrow="Payment"
      title="Choose the payment rhythm that feels effortless."
      description="A polished payment surface with cards, wallet, and UPI options that still sits naturally in the current design system."
      actions={<Link to="/order-success" className={linkButtonClassName}>Complete payment</Link>}
    >
      <SurfaceCard className="space-y-6">
        <Tabs
          items={[
            { value: "card", label: "Cards" },
            { value: "upi", label: "UPI" },
            { value: "wallet", label: "Wallet" },
          ]}
          value={activeMethod}
          onChange={setActiveMethod}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {paymentMethods.map((method) => (
            <div key={method.title} className="rounded-[1.75rem] bg-cream px-5 py-5">
              <p className="font-semibold text-ink">{method.title}</p>
              <p className="mt-2 text-sm text-ink-soft">{method.subtitle}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[1.75rem] border border-accent/10 bg-accent/[0.03] px-5 py-4 text-sm text-ink-soft">
          Selected method: <span className="font-semibold text-ink">{activeMethod.toUpperCase()}</span>
        </div>
      </SurfaceCard>
    </PageShell>
  );
};

export const OrderSuccessPage = () => {
  return (
    <PageShell
      eyebrow="Order confirmed"
      title="Dinner is in motion."
      description="Your order has been placed successfully and the kitchen has everything it needs."
      actions={
        <>
          <Link to={`/track-order/${orders[0].id}`} className={linkButtonClassName}>
            Track live order
          </Link>
          <Link
            to="/orders"
            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
          >
            View order history
          </Link>
        </>
      }
    >
      <SurfaceCard className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <Sparkles className="h-8 w-8 text-accent" />
          <h2 className="font-display text-4xl font-semibold text-ink">Order {orders[0].orderNumber}</h2>
          <p className="text-sm leading-7 text-ink-soft">Saffron Story has accepted your order and the kitchen is preparing it.</p>
        </div>
        <div className="rounded-[1.75rem] bg-cream px-5 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Estimated arrival</p>
          <p className="mt-2 font-display text-4xl font-semibold text-ink">{orders[0].eta}</p>
        </div>
        <div className="rounded-[1.75rem] bg-cream px-5 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delivery address</p>
          <p className="mt-2 text-sm text-ink-soft">{orders[0].deliveryAddress}</p>
        </div>
      </SurfaceCard>
    </PageShell>
  );
};

export const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const order = getOrderById(orderId) ?? orders[0];

  return (
    <PageShell
      eyebrow="Live order tracking"
      title={`Track ${order.restaurantName} in real time.`}
      description="This screen uses the existing route structure and demo timeline data until live socket events are hooked in page-by-page."
      actions={<Link to={`/orders/${order.id}`} className={linkButtonClassName}>Open order details</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Delivery partner" description="Your handoff contact for tonight." />
          <div className="rounded-[1.75rem] bg-cream px-5 py-5">
            <p className="font-semibold text-ink">{order.rider.name}</p>
            <p className="mt-2 text-sm text-ink-soft">{order.rider.phone}</p>
            <p className="text-sm text-ink-soft">{order.rider.vehicle}</p>
          </div>
          <div className="rounded-[1.75rem] border border-dashed border-accent/20 bg-white/60 px-5 py-16 text-center text-sm text-ink-soft">
            Live map area ready for Socket.IO location updates.
          </div>
        </SurfaceCard>
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Order timeline" description={order.orderNumber} />
          {order.timeline.map((step) => (
            <div key={step.label} className="flex items-start gap-4">
              <div className={`mt-1 h-3 w-3 rounded-full ${step.done ? "bg-accent" : "bg-accent/20"}`} />
              <div>
                <p className="font-semibold text-ink">{step.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{step.time}</p>
              </div>
            </div>
          ))}
        </SurfaceCard>
      </div>
    </PageShell>
  );
};

export const OrdersHistoryPage = () => {
  return (
    <PageShell
      eyebrow="Order history"
      title="Every recent order, neatly organized."
      description="A customer-friendly order archive with quick access to tracking and detail views."
    >
      <div className="grid gap-5">
        {orders.map((order) => (
          <SurfaceCard key={order.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{order.orderNumber}</p>
              <h2 className="font-display text-4xl font-semibold text-ink">{order.restaurantName}</h2>
              <p className="text-sm text-ink-soft">{order.placedAt}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={order.status.replace(/_/g, " ")} tone={getStatusTone(order.status)} />
              <p className="text-sm font-semibold text-ink">{order.total}</p>
              <Link to={`/orders/${order.id}`} className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft">
                View details
              </Link>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PageShell>
  );
};

export const OrderDetailsPage = () => {
  const { orderId } = useParams();
  const order = getOrderById(orderId);

  if (!order) {
    return <Navigate to="/404" replace />;
  }

  return (
    <PageShell
      eyebrow="Order details"
      title={order.orderNumber}
      description={`A detailed record of your ${order.restaurantName} order, payment method, and delivery timeline.`}
      actions={<Link to={`/track-order/${order.id}`} className={linkButtonClassName}>Track this order</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title={order.restaurantName} description={order.placedAt} />
          {order.items.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-sm font-semibold text-ink">{item}</p>
              <p className="text-sm text-ink-soft">Included</p>
            </div>
          ))}
          <div className="space-y-4 pt-2">
            {order.timeline.map((step) => (
              <div key={step.label} className="flex items-center justify-between text-sm text-ink-soft">
                <span>{step.label}</span>
                <span>{step.time}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Payment & delivery" />
          <div className="space-y-3 text-sm text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Paid via:</span> {order.paymentMethod}
            </p>
            <p>
              <span className="font-semibold text-ink">Total:</span> {order.total}
            </p>
            <p>
              <span className="font-semibold text-ink">Delivering to:</span> {order.deliveryAddress}
            </p>
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
};
