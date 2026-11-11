import type { DirectoryClinic } from "./directory.server";

const STATE_ORDER = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
export const STATE_NAMES: Record<string, string> = {
  ACT: "Australian Capital Territory",
  NSW: "New South Wales",
  NT: "Northern Territory",
  QLD: "Queensland",
  SA: "South Australia",
  TAS: "Tasmania",
  VIC: "Victoria",
  WA: "Western Australia",
};

type Group = { state: string; suburbs: { suburb: string; clinics: DirectoryClinic[] }[] };

/** Opted-in clinics grouped by state, then suburb, both alphabetical. */
export function groupDirectory(clinics: DirectoryClinic[]): Group[] {
  const byState = new Map<string, Map<string, DirectoryClinic[]>>();
  for (const c of clinics) {
    const state = c.state || "Other";
    const suburb = c.suburb || "Other";
    const suburbs = byState.get(state) ?? new Map<string, DirectoryClinic[]>();
    suburbs.set(suburb, [...(suburbs.get(suburb) ?? []), c]);
    byState.set(state, suburbs);
  }
  const rank = (s: string) => {
    const i = STATE_ORDER.indexOf(s);
    return i === -1 ? STATE_ORDER.length : i;
  };
  return [...byState.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([state, suburbs]) => ({
      state,
      suburbs: [...suburbs.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([suburb, list]) => ({
          suburb,
          clinics: [...list].sort((x, y) => x.name.localeCompare(y.name)),
        })),
    }));
}

