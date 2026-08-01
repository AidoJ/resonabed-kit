/**
 * The screening gate is enforced by database triggers on `sessions` and
 * `bookings`. These messages just translate the trigger's exception into
 * something a practitioner can act on.
 */
export function screeningErrorMessage(message: string): string | null {
  if (message.includes("screening_required"))
    return "A signed, countersigned screening is required before this session can start.";
  if (message.includes("screening_blocked"))
    return "This screening flagged a contraindication without valid clearance, the session cannot proceed.";
  if (message.includes("screening_already_used"))
    return "That screening has already authorised another session. Complete a new screening.";
  if (message.includes("screening_mismatch"))
    return "The screening on file does not match this client and clinic.";
  if (message.includes("screening_not_found")) return "The screening record could not be found.";
  if (message.includes("screening_link_immutable"))
    return "The screening attached to a session cannot be changed.";
  return null;
}

