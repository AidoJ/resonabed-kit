/**
 * Shared formatter for an organisation's private street address.
 *
 * The address is operational data. It is never returned by a public function
 * and is only rendered in two places: the operator's own settings, and the
 * client confirmation email sent after the operator confirms a booking.
 */
export type OrgAddressParts = {
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postcode?: string | null;
  address_country?: string | null;
};

export function formatOrgAddress(parts: OrgAddressParts): string {
  const statePostcode = [parts.address_state, parts.address_postcode]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return [
    parts.address_line1,
    parts.address_line2,
    parts.address_city,
    statePostcode,
  ]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");
}
