/**
 * Versioned safety screening checklist.
 *
 * This definition is snapshotted verbatim into every `client_screenings` row
 * so a historic record always reproduces exactly what the client was shown,
 * even after this file changes.
 *
 * `clearable` is a per-item capability. Pregnancy is explicitly NOT clearable:
 * no doctor's letter can ever clear it, and it is re-screened fresh every
 * time. The database enforces the same rule (check constraint on
 * `client_clearance_letters` plus `public.client_item_cleared`).
 */
export const SCREENING_CHECKLIST_VERSION = "SCREENING_CHECKLIST_V1" as const;

export interface ScreeningItem {
  key: string;
  label: string;
  /** Can a doctor's clearance letter neutralise this item indefinitely? */
  clearable: boolean;
}

export const SCREENING_CHECKLIST: readonly ScreeningItem[] = [
  { key: "pacemaker", label: "Pacemaker or implanted electronic device", clearable: true },
  { key: "pregnancy", label: "Pregnancy", clearable: false },
  { key: "recent_surgery", label: "Recent surgery", clearable: true },
  { key: "dvt", label: "DVT or thrombosis", clearable: true },
  { key: "acute_inflammation", label: "Acute inflammation", clearable: true },
  { key: "low_blood_pressure", label: "Severe low blood pressure", clearable: true },
  { key: "epilepsy", label: "Epilepsy", clearable: true },
] as const;

export const NON_CLEARABLE_ITEMS: readonly string[] = SCREENING_CHECKLIST.filter(
  (i) => !i.clearable,
).map((i) => i.key);

export function isClearableItem(key: string): boolean {
  return SCREENING_CHECKLIST.find((i) => i.key === key)?.clearable === true;
}

export function screeningItemLabel(key: string): string {
  return SCREENING_CHECKLIST.find((i) => i.key === key)?.label ?? key;
}

export const SCREENING_ATTESTATION_TEXT =
  "I confirm that the answers above are true and complete to the best of my knowledge, " +
  "that I have read the policies listed, and that I consent to this session proceeding.";
