# Order Assignment Manual Verification

Verify these flows against a restaurant with valid latitude/longitude and delivery partners whose live location is fresh.

API check:
- `GET /api/v1/delivery/availability?restaurantId=<id>`
- Optional for checkout ETA: `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>`

## Preconditions

- Restaurant has coordinates saved.
- Delivery partners are verified and active.
- Use partner availability `ONLINE` for eligible riders.
- Keep at least one separate partner busy with an active assigned order to confirm exclusion.

## Scenario A: Partner Within 5 km

1. Place one available partner within 5 km of the restaurant.
2. Open checkout and payment with a valid cart and serviceable address.
3. Confirm the payment page shows successful nearby partner coverage.
4. Confirm `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` returns `available: true`.
5. Use the payment page refresh check button and confirm the result stays available.
6. Complete the order.
7. Move the restaurant order to `READY_FOR_PICKUP` or `LOOKING_FOR_DELIVERY_PARTNER`.
8. Confirm only the <= 5 km partner receives the delivery request.
9. Confirm partners outside 5 km do not see the order.

Expected:
- Order is created successfully.
- Payment is not blocked.
- `assignmentRadiusKm` is `5`.

## Scenario B: Partner Between 5 km and 7 km

1. Ensure no partner is within 5 km.
2. Place one available partner between 5 km and 7 km.
3. Open payment for a valid cart and address.
4. Confirm fallback coverage is shown and the order can still be placed.
5. Confirm `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` returns `available: true` with fallback coverage.
6. Move the order into the dispatch-ready state.
7. Confirm the eligible partner sees:
   - `Nearby area order`
   - restaurant area/name
   - distance from restaurant

Expected:
- Order is created successfully.
- Only 5-7 km eligible partners receive the request.
- `assignmentRadiusKm` is `7`.

## Scenario C: No Partner Within 7 km

1. Ensure there are no eligible partners within 7 km.
2. Open payment for a valid cart and address.
3. Confirm `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` returns `available: false`.
4. Attempt to complete payment/order placement.

Expected:
- User sees: `No delivery partner available near this restaurant right now. Please try again later.`
- No order is created.
- No payment row is captured for the attempted placement.

## Scenario C1: Toggle Online Or Move Out Of Radius

1. Start with one verified online partner inside 1 km of the restaurant.
2. Open payment and confirm availability is shown.
3. Switch the partner to `OFFLINE` or move the live location outside the allowed radius.
4. Refresh the payment page or use the refresh check button.

Expected:
- `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` reflects the latest backend state.
- Payment shows the unavailable warning after the partner moves offline or out of range.
- Refreshing the page keeps the same backend-driven result.

## Scenario D: Partner Rejects, Next Partner Accepts

1. Seed at least two eligible partners within the allowed 7 km range.
2. Place the order and move it into the dispatch-ready state.
3. Reject the request from the first partner.
4. Confirm the next eligible partner receives the request.
5. Accept from the second partner.

Expected:
- The rejecting partner does not receive the same order again.
- The next eligible partner receives the order.
- Order status moves to `DELIVERY_PARTNER_ASSIGNED`.
- Payment remains paid, not refunded.

## Scenario E: Partner Rejects, Order Cancels And Refunds

1. Seed exactly one eligible partner, or have every eligible partner reject/expire.
2. Place the order and move it into the dispatch-ready state.
3. Reject the final eligible offer.

Expected:
- Order status becomes `CANCELLED`.
- Payment status becomes `REFUNDED` for prepaid orders.
- Order `refundStatus` becomes `REFUNDED` for prepaid orders.
- Customer timeline/notification shows: `Order cancelled because no delivery partner accepted the order. Amount refunded.`
- Admin and regional manager order views show the cancellation reason and refund status.
