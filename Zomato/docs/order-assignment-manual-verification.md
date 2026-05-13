# Nearby Discovery And Pickup Verification

Verify these flows against real backend data with fresh restaurant coordinates and fresh delivery-partner live locations.

API checks:
- `GET /api/v1/restaurants?...selected location query...`
- `GET /api/v1/delivery/availability?restaurantId=<id>`
- Optional ETA check: `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>`

Default radii:
- Customer restaurant discovery: `10 km`
- Delivery partner pickup assignment: `3 km`

## Preconditions

- Restaurant is `ACTIVE`.
- Restaurant owner account is active.
- Delivery partner is approved, active, online, and not already busy with another active delivery.
- Delivery partner live location is fresh.
- Customer selected delivery location is saved with coordinates, or has enough text fields for fallback matching.

## Test Case A

Customer nearby restaurant discovery in Nagercoil or Kanyakumari.

1. Set the customer delivery location to a Nagercoil or Kanyakumari address.
2. Use restaurant `SSS` with coordinates `8.1699, 76.4221`.
3. Keep the restaurant status `ACTIVE`.
4. Open the customer Restaurants page.
5. Confirm the backend returns the restaurant within the nearby results when the selected location is within `10 km`.

Expected:
- `SSS` appears on the customer Restaurants page.
- The restaurant is sorted with other nearby results by nearest distance first when coordinates are available.
- The page does not show `No nearby restaurants found in your area`.

## Test Case B

Nearby delivery partner availability within `0.2 km` to `3 km`.

1. Keep one approved online delivery partner within `0.2 km` to `3 km` of the restaurant pickup point.
2. Open checkout or payment for that restaurant with a valid cart.
3. Confirm the payment page shows `Checking nearby delivery partners...` while the backend check is running.
4. Confirm the payment page changes to `Delivery partner available nearby`.
5. Confirm `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` returns `available: true`.
6. Place the order.
7. Confirm the order enters delivery assignment without showing `delivery partner unavailable`.

Expected:
- Checkout is allowed.
- The nearest eligible partner is selected first.
- Partner distance is measured from `partner live location <-> restaurant pickup location`.

## Test Case C

Delivery partner farther than `3 km`.

1. Move every otherwise eligible delivery partner beyond `3 km` from the restaurant pickup point.
2. Refresh checkout delivery availability.
3. Confirm `GET /api/v1/delivery/availability?restaurantId=<id>&addressId=<id>` returns `available: false`.

Expected:
- Checkout shows `No delivery partner available near this restaurant`.
- The partner is not selected for pickup assignment.
- No pickup request is sent to partners beyond the configured pickup radius.

## Test Case D

Restaurant farther than `10 km` from the selected customer location.

1. Pick a restaurant more than `10 km` away from the customer delivery location.
2. Refresh the Restaurants page.

Expected:
- The restaurant does not appear in the nearby customer list.
- If no other matches exist, the page shows `No nearby restaurants found in your area`.

## Extra Checks

1. Test one saved address without coordinates but with city, district, state, or pincode filled in.
Expected:
The backend falls back to text-area matching instead of silently hiding all restaurants.

2. Test one restaurant without valid coordinates but with valid address fields.
Expected:
The backend can still use text fallback when customer coordinates are unavailable.

3. Test one online partner with missing or stale live location.
Expected:
The partner is excluded and development logs explain whether the reason was missing coordinates or stale location.
