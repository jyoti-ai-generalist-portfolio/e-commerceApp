// Builds the shipping_address jsonb payload for orders, matching the
// customer_addresses columns (no state/country columns exist in schema).
export function buildShippingAddressPayload(address) {
  if (!address) return null;
  return {
    address_line1: address.address_line1,
    address_line2: address.address_line2 || null,
    city: address.city,
    pincode: address.pincode,
    mobilenumber: address.mobilenumber,
  };
}