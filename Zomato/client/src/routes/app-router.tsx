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
  AdminAddonsPage,
  AdminCategoriesPage,
  AdminCombosPage,
  AdminDashboardPage,
  AdminDeliveryPartnersPage,
  AdminDishesPage,
  AdminLiveMapPage,
  AdminNotificationsPage,
  AdminOffersPage,
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminProfilePage,
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
  OwnerAddonsPage,
  OwnerAnalyticsPage,
  OwnerCombosPage,
  OwnerDashboardPage,
  OwnerMenuPage,
  OwnerOffersPage,
  OwnerOrdersPage,
  OwnerProfilePage,
  OwnerRestaurantPage,
  OwnerReviewsPage,
} from "@/pages/owner/owner-pages";
import {
  OpsAssignmentsPage,
  OpsCommunicationsPage,
  OpsDashboardPage,
  OpsDeliveryPartnersPage,
  OpsProfilePage,
  OpsRegionsPage,
  OpsRestaurantOwnersPage,
} from "@/pages/ops/ops-pages";
import { LandingPage } from "@/pages/shared/landing-page";
import { ForgotPasswordPage, OtpVerificationPage } from "@/pages/shared/auth-support-pages";
import { LoginPage } from "@/pages/shared/login-page";
import { NotFoundPage } from "@/pages/shared/not-found-page";
import {
  DeliveryNotificationsPage,
  OperationsNotificationsPage,
  OwnerNotificationsPage,
} from "@/pages/shared/dashboard-notifications-pages";
import { ProtectedRoute } from "./protected-route";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<LandingPage />} />

          <Route element={<ProtectedRoute roles={["CUSTOMER"]} />}>
            <Route path="/restaurants" element={<RestaurantListingPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/restaurants/:slug" element={<RestaurantDetailsPage />} />
            <Route path="/offers" element={<OffersPage />} />
            <Route path="/membership" element={<MembershipPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
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
          <Route path="/owner/login" element={<LoginPage />} />
          <Route path="/delivery/login" element={<LoginPage />} />
          <Route path="/ops/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN", "RESTAURANT_OWNER"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/partner" element={<Navigate to="/owner/dashboard" replace />} />
            <Route path="/partner/menu" element={<Navigate to="/owner/menu" replace />} />
            <Route path="/partner/combos" element={<Navigate to="/owner/combos" replace />} />
            <Route path="/partner/addons" element={<Navigate to="/owner/addons" replace />} />
            <Route path="/partner/orders" element={<Navigate to="/owner/orders" replace />} />
            <Route path="/partner/notifications" element={<Navigate to="/owner/notifications" replace />} />
            <Route path="/partner/reviews" element={<Navigate to="/owner/reviews" replace />} />
            <Route path="/partner/earnings" element={<Navigate to="/owner/analytics" replace />} />
            <Route path="/partner/settings" element={<Navigate to="/owner/profile" replace />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["RESTAURANT_OWNER"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />
            <Route path="/owner/dashboard" element={<OwnerDashboardPage />} />
            <Route path="/owner/orders" element={<OwnerOrdersPage />} />
            <Route path="/owner/notifications" element={<OwnerNotificationsPage />} />
            <Route path="/owner/restaurant" element={<OwnerRestaurantPage />} />
            <Route path="/owner/menu" element={<OwnerMenuPage />} />
            <Route path="/owner/combos" element={<OwnerCombosPage />} />
            <Route path="/owner/addons" element={<OwnerAddonsPage />} />
            <Route path="/owner/offers" element={<OwnerOffersPage />} />
            <Route path="/owner/reviews" element={<OwnerReviewsPage />} />
            <Route path="/owner/analytics" element={<OwnerAnalyticsPage />} />
            <Route path="/owner/profile" element={<OwnerProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN", "DELIVERY_PARTNER"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/delivery" element={<DeliveryDashboardPage />} />
            <Route path="/delivery/active" element={<DeliveryActivePage />} />
            <Route path="/delivery/notifications" element={<DeliveryNotificationsPage />} />
            <Route path="/delivery/history" element={<DeliveryHistoryPage />} />
            <Route path="/delivery/earnings" element={<DeliveryEarningsPage />} />
            <Route path="/delivery/profile" element={<DeliveryProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["OPERATIONS_MANAGER"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/ops" element={<Navigate to="/ops/dashboard" replace />} />
            <Route path="/ops/dashboard" element={<OpsDashboardPage />} />
            <Route path="/ops/regions" element={<OpsRegionsPage />} />
            <Route path="/ops/restaurant-owners" element={<OpsRestaurantOwnersPage />} />
            <Route path="/ops/delivery-partners" element={<OpsDeliveryPartnersPage />} />
            <Route path="/ops/assignments" element={<OpsAssignmentsPage />} />
            <Route path="/ops/communications" element={<OpsCommunicationsPage />} />
            <Route path="/ops/notifications" element={<OperationsNotificationsPage />} />
            <Route path="/ops/profile" element={<OpsProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/live-map" element={<AdminLiveMapPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/restaurants" element={<AdminRestaurantsPage />} />
            <Route path="/admin/delivery-partners" element={<AdminDeliveryPartnersPage />} />
            <Route path="/admin/dishes" element={<AdminDishesPage />} />
            <Route path="/admin/combos" element={<AdminCombosPage />} />
            <Route path="/admin/addons" element={<AdminAddonsPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/offers" element={<AdminOffersPage />} />
            <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
            <Route path="/admin/payments" element={<AdminPaymentsPage />} />
            <Route path="/admin/reviews" element={<AdminReviewsPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/profile" element={<AdminProfilePage />} />
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
