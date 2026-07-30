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
    title: "Settle onto the bed",
    body: "You stay fully clothed, lie back and get comfortable. Nothing is applied to you and nothing is asked of you.",
  },
  {
    n: "03",
    title: "Sound and vibration",
    body: "Low-frequency tones play through the bed itself. You hear the music and you feel it moving gently through your body.",
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
    body: "There's nothing to do and nothing to think about — just sound you can feel.",
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
  { hz: "174 Hz", label: "Ease and comfort" },
  { hz: "285 Hz", label: "Restore and renew" },
  { hz: "396 Hz", label: "Letting go of tension" },
  { hz: "417 Hz", label: "Shifting and clearing" },
  { hz: "528 Hz", label: "Balance and repair" },
  { hz: "639 Hz", label: "Connection and calm" },
  { hz: "741 Hz", label: "Clarity and release" },
  { hz: "852 Hz", label: "Quiet focus" },
  { hz: "963 Hz", label: "Deep stillness" },
];

export const QUICK_FACTS = [
  { k: "Fully clothed", v: "Nothing is applied to you" },
  { k: "30–60 min", v: "Depending on the session" },
  { k: "Gentle & passive", v: "You simply lie back" },
];

export const CARE_ICON = HeartHandshake;
