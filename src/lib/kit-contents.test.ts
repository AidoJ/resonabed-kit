import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  INSTALL_FAQ_ANSWER,
  INSTALL_SPEC,
  WIRING_CARD,
  packageKitList,
} from "./kit-contents";

const src = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(src, rel), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("per-package kit lists", () => {
  it("every package gets the transducers, amplifier, headphones, wiring and setup videos", () => {
    for (const key of ["essentials", "pro", "platinum", "home"] as const) {
      const list = packageKitList(key);
      expect(list).toContain("2 Douk Audio tactile transducers");
      expect(list).toContain("100W Nobo Sound amplifier");
      expect(list).toContain("JBL Tune 530 headphones");
      expect(list).toContain(
        "Wiring and mounting hardware: 4 banana plugs, 1.5m and 0.5m speaker wire, 8 M4 well nuts and screws, cable ties and double-sided mounting pads",
      );
      expect(list).toContain("Step-by-step setup videos in the Resonabed app");
    }
  });

  it("Basic has no tablet and says so", () => {
    const basic = packageKitList("essentials");
    expect(basic).toContain("Runs on your own tablet. Tablet not included.");
    expect(basic.some((l) => l.includes('10" tablet'))).toBe(false);
  });

  it("only Platinum and Home include the fitted table", () => {
    expect(packageKitList("platinum")).toContain("Fully fitted therapy table");
    expect(packageKitList("home")).toContain("Fully fitted therapy table");
    expect(packageKitList("essentials").join()).not.toMatch(/fitted therapy table/);
    expect(packageKitList("pro").join()).not.toMatch(/fitted therapy table/);
  });

  it("Home has the personal app and no covers or flyers", () => {
    const home = packageKitList("home");
    expect(home).toContain('10" tablet with the personal Resonabed app');
    expect(home.join()).not.toMatch(/headphone covers|flyers/);
  });
});

describe("fitting wording", () => {
  it("uses the owner's wording for the card, spec row and FAQ", () => {
    expect(WIRING_CARD.title).toBe("Wiring, mounting and setup videos");
    expect(INSTALL_SPEC).toBe("Wiring, mounting hardware and setup videos in the app. 1 to 3 hours.");
    expect(INSTALL_FAQ_ANSWER).toBe(
      "The kit comes with all the wiring and mounting hardware, and step-by-step setup videos in the Resonabed app. Fitting takes 1 to 3 hours, depending on how handy you are with tools. Home and Platinum packages arrive with the table already fitted.",
    );
  });

  it("no page uses the old fitting times or the old kit line", () => {
    const old = /inside an hour|around an hour|one to two hours|1\s*[–-]\s*2 hours|Wiring, fittings/i;
    const offenders = sourceFiles(src).filter((f) => old.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("bed pages are separate", () => {
  const sound = read("routes/vibroacoustic-sound-bed.tsx").replace(/\s+/g, " ");
  const therapy = read("routes/vibroacoustic-therapy-bed.tsx").replace(/\s+/g, " ");

  it("have the owner's titles and headings", () => {
    expect(sound).toContain('"Vibroacoustic Sound Bed Kit for Your Own Table | Resonabed"');
    expect(sound).toContain("Turn your own table into{\" \"} <br /> <span");
    expect(sound).toContain("a vibroacoustic sound bed </span> </h1>");
    expect(therapy).toContain('"Vibroacoustic Therapy Bed for Clinics | Resonabed"');
    expect(therapy).toContain("Vibroacoustic therapy bed{\" \"} <br /> <span");
    expect(therapy).toContain("for your clinic </span> </h1>");
  });

  it("carry no science section; the research page does", () => {
    expect(sound).not.toContain("ScienceSection");
    expect(therapy).not.toContain("ScienceSection");
    expect(read("routes/research.tsx")).toContain("<ScienceSection />");
    for (const page of [sound, therapy]) expect(page).toContain("See the research behind vibroacoustic therapy");
  });

  it("link to each other exactly once", () => {
    expect(sound.match(/to="\/vibroacoustic-therapy-bed"/g)).toHaveLength(1);
    expect(sound).toContain("Running a clinic?");
    expect(therapy.match(/to="\/vibroacoustic-sound-bed"/g)).toHaveLength(1);
    expect(therapy).toContain("Setting up at home or on your own table?");
  });
});
