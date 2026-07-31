/**
 * Copy shown to the therapist on the confirm screen for a FIRST-TIME public
 * booking request.
 *
 * This is a glanceable prompt, not a form. Nothing here is captured as
 * structured data: anything the therapist learns on the call goes into the
 * protected client notes, never into the audit trail and never anywhere the
 * public flow can read.
 */

export const VETTING_CALL_RECOMMENDATION =
  "For a first-time client, we recommend a quick phone call before you confirm. " +
  "It lets you get a feel for the person, understand what they're looking for, " +
  "and flag anything that might make the session unsuitable — saving them a wasted trip.";

export interface VettingSection {
  heading: string;
  subheading?: string;
  questions: readonly string[];
}

export const VETTING_SECTIONS: readonly VettingSection[] = [
  {
    heading: "Getting to know them",
    questions: [
      "What attracted you to vibroacoustic therapy?",
      "How did you hear about us?",
      "Are you local to the area?",
    ],
  },
  {
    heading: "What they're looking for",
    questions: [
      "Is there something specific you're hoping the session will help with?",
      "How long has that been going on for?",
      "Have you tried other treatments or therapies for it?",
    ],
  },
  {
    heading: "A few quick health checks",
    subheading:
      "So we know it's suitable — you'll go through these properly at the first session.",
    questions: [
      "Do you have a pacemaker or any implanted electronic device?",
      "Are you pregnant?",
      "Any recent surgery, or a history of DVT or thrombosis?",
      "Any acute inflammation, epilepsy, or very low blood pressure?",
      "Are you currently taking any medication?",
    ],
  },
] as const;

export const VETTING_CLOSING_LINE =
  "If any health items come up, that is not necessarily a no — it means a short conversation " +
  "about whether the session is right for them. Their full screening and consent happen in " +
  "person before the first session.";

/**
 * Decline reason CODES. Codes only ever land in the audit trail; no health
 * detail goes with them. Specifics belong in protected client notes.
 */
export const DECLINE_REASON_CODES = [
  "health_item_clearance_advised",
  "not_suitable_at_this_time",
  "unable_to_accommodate",
  "other",
] as const;

export type DeclineReasonCode = (typeof DECLINE_REASON_CODES)[number];

export const DECLINE_REASON_LABELS: Record<DeclineReasonCode, string> = {
  health_item_clearance_advised: "Health item raised — doctor's clearance advised",
  not_suitable_at_this_time: "Not suitable at this time",
  unable_to_accommodate: "Unable to accommodate",
  other: "Other",
};

/**
 * What the therapist should say when a health item surfaces on the call.
 * Keyed off the item's `clearable` flag in SCREENING_CHECKLIST so this stays
 * consistent with the screening gate: pregnancy can never be cleared by a
 * letter, so it is framed as "not suitable at this time".
 */
export const CLEARABLE_ITEM_GUIDANCE =
  "Explain you can't proceed as things stand. If they'd still like to go ahead, they need to " +
  "see their doctor and get a letter clearing them specifically for vibroacoustic therapy — " +
  "they can bring it to a future booking. Decline this request as \"health item raised — " +
  "doctor's clearance advised\".";

export const NON_CLEARABLE_ITEM_GUIDANCE =
  "This one can't be cleared by a doctor's letter, so frame it as \"not suitable at this time\" " +
  "rather than asking them to get a letter. Decline this request as \"not suitable at this time\".";
