/**
 * What ships in each package, in the owner's exact wording. Every kit list on
 * the site (package cards, Home panel, compare table, bed pages) reads from
 * here so the lists can never drift apart.
 */

export const ALL_PACKAGES_INCLUDE = [
  "2 Douk Audio tactile transducers",
  "100W Nobsound amplifier",
  "JBL Tune 530 headphones",
  "Wiring and mounting hardware: 4 banana plugs, 1.5m and 0.5m speaker wire, 8 M4 well nuts and screws, cable ties and double-sided mounting pads",
  "Step-by-step setup videos in the Resonabed app",
] as const;

export const BASIC_TABLET_NOTE = "Runs on the phone, tablet or laptop you already use. Tablet not included.";
export const BUSINESS_APP_LINE = "Full business app and bookable clinic webpage";

export const PACKAGE_ADDS = {
  essentials: [
    "100 disposable headphone covers",
    "100 Resonabed marketing flyers, customised for your clinic",
    BASIC_TABLET_NOTE,
    BUSINESS_APP_LINE,
  ],
  pro: [
    '10" tablet with the Resonabed app',
    "100 disposable headphone covers",
    "100 customised marketing flyers",
    BUSINESS_APP_LINE,
  ],
  platinum: [
    "Fully fitted therapy table",
    '10" tablet with the Resonabed app',
    "100 disposable headphone covers",
    "100 customised marketing flyers",
    BUSINESS_APP_LINE,
    "Tested as a complete system before dispatch",
  ],
  home: [
    "Fully fitted therapy table",
    '10" tablet with the personal Resonabed app',
    "App and music access for home use without renewal",
  ],
} as const;

export type KitPackageKey = keyof typeof PACKAGE_ADDS;

export const PACKAGE_NAMES: Record<KitPackageKey, string> = {
  essentials: "Basic",
  pro: "Pro",
  platinum: "Platinum",
  home: "Home",
};

/** Full kit list for one package: everything every package gets, then its additions. */
export function packageKitList(key: KitPackageKey): string[] {
  return [...ALL_PACKAGES_INCLUDE, ...PACKAGE_ADDS[key]];
}

/** Fitting time for a retrofit, used wherever the site mentions it. */
export const FITTING_TIME = "1 to 3 hours";

export const WIRING_CARD = {
  title: "Wiring, mounting and setup videos",
  body: "Speaker wire, banana plugs, M4 well nuts and screws, cable ties and mounting pads, with step-by-step setup videos in the Resonabed app, to fit the kit to the massage, chiropractic, osteopathic or other therapeutic table you already own.",
} as const;

export const INSTALL_SPEC = `Wiring, mounting hardware and setup videos in the app. ${FITTING_TIME}.`;

/** Answer to the installation-time FAQ on the homepage and the sound bed page. */
export const INSTALL_FAQ_ANSWER = `The kit comes with all the wiring and mounting hardware, and step-by-step setup videos in the Resonabed app. Fitting takes ${FITTING_TIME}, depending on how handy you are with tools. Home and Platinum packages arrive with the table already fitted.`;
