# Order Assignment Manual Verification

Verify these flows against a restaurant with valid latitude/longitude and delivery partners whose live location is fresh.

## Preconditions

- Restaurant has coordinates saved.
- Delivery partners are verified and active.
- Use partner availability `ONLINE` for eligible riders.
- Keep at least one separate partner busy with an active assigned order to confirm exclusion.

## Scenario A: Partner Within 5 km

1. Place one available partner within 5 km of the restaurant.
2. Open checkout and payment with a valid cart and serviceable address.
3. Confirm the payment page shows successful nearby partner coverage.
4. Complete the order.
5. Move the restaurant order to `READY_FOR_PICKUP` or `LOOKING_FOR_DELIVERY_PARTNER`.
6. Confirm only the <= 5 km partner receives the delivery request.
7. Confirm partners outside 5 km do not see the order.

Expected:
- Order is created successfully.
- Payment is not blocked.
- `assignmentRadiusKm` is `5`.

## Scenario B: Partner Between 5 km and 7 km

1. Ensure no partner is within 5 km.
2. Place one available partner between 5 km and 7 km.
3. Open payment for a valid cart and address.
4. Confirm fallback coverage is shown and the order can still be placed.
5. Move the order into the dispatch-ready state.
6. Confirm the eligible partner sees:
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
3. Attempt to complete payment/order placement.

Expected:
- User sees: `No delivery partner available near this restaurant right now. Please try again later.`
- No order is created.
- No payment row is captured for the attempted placement.

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
