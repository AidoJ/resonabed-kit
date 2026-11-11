import { CheckCircle2, Speaker, Volume2, Tablet, Music, Package, Headphones } from "lucide-react";
import { KitCard, kitImages, type KitItem } from "@/components/kit-card";
import { PACKAGE_ADDS, PACKAGE_NAMES, WIRING_CARD, type KitPackageKey } from "@/lib/kit-contents";

/**
 * The kit list shown on both bed pages. One shared component so the wording is
 * identical everywhere it appears; per-package extras come from kit-contents.
 */
export const KIT_ITEMS: KitItem[] = [
  {
    icon: Speaker,
    title: "Two Douk Audio tactile transducers",
    body: "Premium transducers that send low-frequency sound as gentle vibration through your existing table, so clients do not just hear the music, they feel it moving through them.",
    image: kitImages.transducer,
    imageAlt: "Two tactile transducers included in the Resonabed kit",
    pair: true,
  },
  {
    icon: Volume2,
    title: "100W Nobo Sound amplifier",
    body: "Compact 100W amplifier with clean, professional power. Simple controls, no audio engineering required.",
    image: kitImages.amplifier,
    imageAlt: "100W amplifier included in the Resonabed kit",
  },
  {
    icon: Headphones,
    title: "JBL Tune 530 Headphones",
    body: "The JBL Tune 530 Headphones deliver powerful sound and long-lasting comfort in a lightweight on-ear design, featuring JBL Pure Bass sound.",
    image: kitImages.headphones,
    imageAlt: "White JBL Tune 530 on-ear headphones",
  },
  {
    icon: Tablet,
    title: "Session player and booking app",
    body: "One calm app for client intake, frequency selection, playback, timer, session records and diary bookings. Practitioners pick it up in minutes.",
    image: kitImages.tablet,
    imageAlt: "Resonabed session player app running on a tablet",
  },
  {
    icon: Music,
    title:
      "9 sound engineer designed tracks: Solfeggio tones over a 25 to 120 Hz vibroacoustic base",
    body: "Nine therapeutic, wellbeing-focused tones matched to how clients describe what they want. Licensed and ready to play, with no separate music agreement.",
    image: kitImages.solfeggio,
    imageAlt: "Sheet music representing the nine licensed Solfeggio frequency tracks",
  },
  { icon: Package, title: WIRING_CARD.title, body: WIRING_CARD.body },
  {
    icon: CheckCircle2,
    title: "Marketing pack",
    body: "Your own customisable booking page plus 100 professionally designed DL flyers carrying your clinic details and a QR code that links straight to it.",
  },
];

const ORDER: KitPackageKey[] = ["essentials", "pro", "platinum", "home"];

export function KitList() {
  return (
    <>
      <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {KIT_ITEMS.map((item) => (
          <KitCard key={item.title} {...item} />
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-border bg-card p-8">
        <h3 className="text-lg font-medium text-brand-indigo">What each package adds</h3>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((key) => (
            <div key={key}>
              <p className="text-sm font-medium text-brand-indigo">{PACKAGE_NAMES[key]}</p>
              <ul className="mt-2 space-y-1.5">
                {PACKAGE_ADDS[key].map((line) => (
                  <li key={line} className="text-sm leading-relaxed text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
