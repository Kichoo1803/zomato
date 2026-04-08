import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthLayout } from "@/layouts/auth-layout";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { RootLayout } from "@/layouts/root-layout";
import {
  FavoritesPage,
  MembershipPage,
  OffersPage,
  RestaurantDetailsPage,
  RestaurantListingPage,
  SearchResultsPage,
} from "@/pages/customer/discovery-pages";
import {
  NotificationsPage,
  ProfilePage,
  SavedAddressesPage,
  WalletPage,
} from "@/pages/customer/account-pages";
import {
  CartPage,
  CheckoutPage,
  OrderDetailsPage,
  OrderSuccessPage,
  OrderTrackingPage,
  OrdersHistoryPage,
  PaymentPage,
} from "@/pages/customer/order-pages";
import {
  AdminDashboardPage,
  AdminDeliveryPartnersPage,
  AdminOffersPage,
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminReportsPage,
  AdminRestaurantsPage,
  AdminReviewsPage,
  AdminSettingsPage,
  AdminUsersPage,
} from "@/pages/admin/admin-pages";
import {
  DeliveryActivePage,
  DeliveryDashboardPage,
  DeliveryEarningsPage,
  DeliveryHistoryPage,
  DeliveryProfilePage,
} from "@/pages/delivery/delivery-pages";
import {
  PartnerDashboardPage,
  PartnerEarningsPage,
  PartnerMenuPage,
  PartnerOrdersPage,
  PartnerReviewsPage,
  PartnerSettingsPage,
} from "@/pages/partner/partner-pages";
import { LandingPage } from "@/pages/shared/landing-page";
import { ForgotPasswordPage, OtpVerificationPage } from "@/pages/shared/auth-support-pages";
import { LoginPage } from "@/pages/shared/login-page";
import { NotFoundPage } from "@/pages/shared/not-found-page";
import { ProtectedRoute } from "./protected-route";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/restaurants" element={<RestaurantListingPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/restaurants/:slug" element={<RestaurantDetailsPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/membership" element={<MembershipPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/order-success" element={<OrderSuccessPage />} />

          <Route element={<ProtectedRoute roles={["CUSTOMER"]} />}>
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/track-order/:orderId" element={<OrderTrackingPage />} />
            <Route path="/orders" element={<OrdersHistoryPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/addresses" element={<SavedAddressesPage />} />
            <Route path="/wallet" element={<WalletPage />} />
          </Route>
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<OtpVerificationPage />} />
          <Route path="/partner/login" element={<LoginPage />} />
          <Route path="/delivery/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN", "RESTAURANT_OWNER"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/partner" element={<PartnerDashboardPage />} />
            <Route path="/partner/menu" element={<PartnerMenuPage />} />
            <Route path="/partner/orders" element={<PartnerOrdersPage />} />
            <Route path="/partner/reviews" element={<PartnerReviewsPage />} />
            <Route path="/partner/earnings" element={<PartnerEarningsPage />} />
            <Route path="/partner/settings" element={<PartnerSettingsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN", "DELIVERY_PARTNER"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/delivery" element={<DeliveryDashboardPage />} />
            <Route path="/delivery/active" element={<DeliveryActivePage />} />
            <Route path="/delivery/history" element={<DeliveryHistoryPage />} />
            <Route path="/delivery/earnings" element={<DeliveryEarningsPage />} />
            <Route path="/delivery/profile" element={<DeliveryProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/restaurants" element={<AdminRestaurantsPage />} />
            <Route path="/admin/delivery-partners" element={<AdminDeliveryPartnersPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/offers" element={<AdminOffersPage />} />
            <Route path="/admin/payments" element={<AdminPaymentsPage />} />
            <Route path="/admin/reviews" element={<AdminReviewsPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/analytics" element={<Navigate to="/admin/reports" replace />} />
            <Route path="/team" element={<Navigate to="/admin/users" replace />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
