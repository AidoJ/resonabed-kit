/**
 * Home-user safety content. Client-safe (no server imports).
 *
 * The acknowledgement is versioned and immutable: `home_safety_acknowledgements`
 * stores ONLY user id, this version string, a timestamp and a typed signature.
 * It never stores which items applied to the person, or any other health
 * detail. The checklist below is shown for the reader to self-assess; their
 * answers are never transmitted or persisted.
 */
export const HOME_SAFETY_VERSION = "HOME_SAFETY_V1" as const;

export const HOME_SAFETY_HEADING = "Before you use your Resonabed";

export const HOME_SAFETY_INTRO =
  "Resonabed is a personal relaxation product. It is not a medical device, and it is not " +
  "intended to diagnose, treat, cure or prevent any condition.";

/** Lead-in for the checklist below. */
export const HOME_SAFETY_CHECK_LEAD =
  "Check with your doctor before use if any of the following are present:";

/** Self-assessment prompts. Answers are NOT collected or stored. */
export const HOME_SAFETY_POINTS: readonly string[] = [
  "A pacemaker or any implanted electronic device",
  "Pregnancy",
  "Recent surgery, a blood clot, or acute inflammation",
  "Epilepsy or very low blood pressure",
];

/** Always applies, regardless of the checklist above. */
export const HOME_SAFETY_GENERAL: readonly string[] = [
  "Stop the session if you feel unwell, dizzy or uncomfortable at any point.",
  "Keep the volume and intensity at a level that feels comfortable to you.",
];

export const HOME_SAFETY_ATTESTATION =
  "I have read the notes above, I understand Resonabed is a relaxation product and not a " +
  "medical device, and I take responsibility for deciding whether it is suitable for me.";

/** Shown at the start of every session. Stores nothing. */
export const HOME_SESSION_REMINDER =
  "A gentle reminder: keep it comfortable, and stop the session if anything feels off. " +
  "If your circumstances have changed, check with your doctor before continuing.";

export const HOME_DURATION_PRESETS = [20, 30, 45, 60] as const;
export type HomeDurationPreset = (typeof HOME_DURATION_PRESETS)[number];
