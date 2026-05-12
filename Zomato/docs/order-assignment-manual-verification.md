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
7. Confirm the customer success page shows `Finding nearby delivery partner...` while assignment is pending.
8. Confirm the restaurant owner sees the order immediately, even before rider acceptance.
9. Confirm only the nearest eligible <= 5 km partner receives the delivery request first.
10. Confirm partners outside 5 km do not see the order.

Expected:
- Order is created successfully.
- Payment is not blocked.
- `assignmentRadiusKm` is `5`.
- `deliveryAssignmentStatus` moves from `FINDING_PARTNER` to `PARTNER_REQUESTED`.

## Scenario B: Partner Between 5 km and 7 km

1. Ensure no partner is within 5 km.
2. Place one available partner between 5 km and 7 km.
3. Open payment for a valid cart and address.
4. Confirm fallback coverage is shown and the order can still be placed.
5. Confirm `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` returns `available: true` with fallback coverage.
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
2. Place the order.
3. Reject the request from the first partner.
4. Confirm the next eligible partner receives the request.
5. Accept from the second partner.
6. Confirm the delivery partner can open `Delivery` and view the full order details page.
7. Confirm the customer and restaurant owner both show `Partner accepted`.

Expected:
- The rejecting partner does not receive the same order again.
- The next eligible partner receives the order.
- Order status moves to `DELIVERY_PARTNER_ASSIGNED`.
- Payment remains paid, not refunded.
- `deliveryAssignmentStatus` ends at `PARTNER_ACCEPTED`.

## Scenario E: No Partner Accepts

1. Seed exactly one eligible partner, or have every eligible partner reject/expire.
2. Place the order.
3. Reject or let expire the final eligible offer.

Expected:
- Order is not auto-cancelled by dispatch failure alone.
- `deliveryAssignmentStatus` becomes `NO_PARTNER_AVAILABLE`.
- Customer success/tracking shows `No delivery partner accepted yet.`
- Restaurant owner, admin, and regional manager views show `No partner available`.

## Scenario F: Delivery Notification Deep Link

1. Place an order with at least one eligible rider.
2. Open the delivery partner notification center after the request arrives.
3. Click `View delivery`.

Expected:
- The link opens `/delivery/deliveries?orderId=<id>`.
- The page shows the actual delivery request tied to that notification.
- If the request was already accepted, rejected, or expired, the detail view shows the correct status and does not allow duplicate actions.
