import {
  Waves,
  HeartHandshake,
  BrainCircuit,
  Clock3,
  Users,
} from "lucide-react";

export const EXPECT_STEPS = [
  {
    n: "01",
    title: "A short check-in",
    body: "We ask how you're feeling, what's bothering you and anything we should know. It only takes a few minutes.",
  },
  {
    n: "02",
    title: "Settle onto the table",
    body: "You stay fully clothed, lie back and get comfortable. Nothing is applied to you and nothing is asked of you.",
  },
  {
    n: "03",
    title: "Sound and vibration",
    body: "Low-frequency tones play through the table itself. You hear the music and you feel it moving gently through your body.",
  },
  {
    n: "04",
    title: "Ease back gently",
    body: "The sound fades out and you take your time getting up. Most people leave calm, loose and unhurried.",
  },
];

export const REASONS = [
  {
    icon: Waves,
    title: "Deep relaxation",
    body: "Slow, steady vibration gives the body something simple to settle into.",
  },
  {
    icon: BrainCircuit,
    title: "Stillness for a busy mind",
    body: "There's nothing to do and nothing to think about, just sound you can feel.",
  },
  {
    icon: Clock3,
    title: "Time that's just yours",
    body: "Half an hour to an hour with no phone, no talking and nothing asked of you.",
  },
  {
    icon: Users,
    title: "Suited to nearly everyone",
    body: "Passive, fully clothed and gentle. We'll check in first if anything needs care.",
  },
];

export const SOLFEGGIO = [
  {
    hz: "174 Hz",
    label: "Ease and comfort",
    desc: "A settling, grounding tone to soften into as the session begins.",
    tag: "Grounding",
    toneA: "#4c1e91",
    toneB: "#7c3eba",
  },
  {
    hz: "285 Hz",
    label: "Restore and renew",
    desc: "A gently restorative tone, a sense of quiet repair and fresh energy.",
    tag: "Renewal",
    toneA: "#5a2a9e",
    toneB: "#8a48c4",
  },
  {
    hz: "396 Hz",
    label: "Letting go of tension",
    desc: "A warm, releasing tone that invites held tension to unwind.",
    tag: "Release",
    toneA: "#6832ab",
    toneB: "#9150c8",
  },
  {
    hz: "417 Hz",
    label: "Shifting and clearing",
    desc: "A light, clearing tone to ease mental clutter and reset.",
    tag: "Change",
    toneA: "#763bb4",
    toneB: "#9d5cce",
  },
  {
    hz: "528 Hz",
    label: "Balance and repair",
    desc: "A balanced, even tone, a calm middle ground for body and mind.",
    tag: "Harmony",
    toneA: "#7048b8",
    toneB: "#5fb3b3",
  },
  {
    hz: "639 Hz",
    label: "Connection and calm",
    desc: "A warm, comforting tone with a soft sense of ease.",
    tag: "Connection",
    toneA: "#4a7fb0",
    toneB: "#5fb3b3",
  },
  {
    hz: "741 Hz",
    label: "Clarity and release",
    desc: "A brighter, clearer tone that leaves the mind feeling open.",
    tag: "Clarity",
    toneA: "#3f95a0",
    toneB: "#6cc0bd",
  },
  {
    hz: "852 Hz",
    label: "Quiet focus",
    desc: "A calm, still tone for settled, meditative quiet.",
    tag: "Stillness",
    toneA: "#2f8f8f",
    toneB: "#5fb3b3",
  },
  {
    hz: "963 Hz",
    label: "Deep stillness",
    desc: "A soft, airy tone for the deepest rest and serenity.",
    tag: "Serenity",
    toneA: "#1f8a8a",
    toneB: "#7bc4bf",
  },
];

export const QUICK_FACTS = [
  { k: "Fully clothed", v: "Nothing is applied to you" },
  { k: "30–60 min", v: "Depending on the session" },
  { k: "Gentle & passive", v: "You simply lie back" },
];

export const CARE_ICON = HeartHandshake;
