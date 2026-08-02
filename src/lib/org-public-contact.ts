/**
 * ONE source of truth for "may this clinic's direct phone/email be shown to a
 * client?".
 *
 * A home-based operator working alone must not have their personal mobile or
 * personal email broadcast to anonymous visitors, so publishing them is an
 * explicit opt-in (`public_show_phone` / `public_show_email`). The public page
 * and every client-facing email read this same helper, so the two surfaces can
 * never contradict each other: private means private everywhere.
 */
export type OrgContactRow = {
  public_contact_email?: string | null;
  public_contact_phone?: string | null;
  public_show_email?: boolean | null;
  public_show_phone?: boolean | null;
};

export interface PublishedContact {
  /** Empty string when the operator has not opted to publish it. */
  email: string;
  phone: string;
  /** Safe to use as an email Reply-To, undefined when the address is private. */
  replyTo: string | undefined;
}

export function publishedContact(org: OrgContactRow | null | undefined): PublishedContact {
  const email = org?.public_show_email ? (org.public_contact_email ?? "") : "";
  const phone = org?.public_show_phone ? (org.public_contact_phone ?? "") : "";
  return { email, phone, replyTo: email || undefined };
}

/** Columns to select whenever a client-facing surface needs contact details. */
export const ORG_CONTACT_COLUMNS =
  "public_contact_email, public_contact_phone, public_show_email, public_show_phone";

/**
 * Contact details for a client whose booking is CONFIRMED.
 *
 * The public opt-in gates (`public_show_phone` / `public_show_email`) exist to
 * stop anonymous visitors harvesting a home operator's personal details. Once
 * the operator has actively confirmed a booking they have already chosen to
 * deal with this person, and the client needs a way to call if they are running
 * late, so the details are included regardless of the public toggles.
 */
export function confirmedClientContact(
  org: (OrgContactRow & { contact_email?: string | null }) | null | undefined,
  practitioner?: { phone?: string | null; display_name?: string | null } | null,
): PublishedContact {
  const email = org?.public_contact_email || org?.contact_email || "";
  const phone = org?.public_contact_phone || practitioner?.phone || "";
  return { email, phone, replyTo: email || undefined };
}
