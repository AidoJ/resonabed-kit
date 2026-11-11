import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ORGANIZATION_JSON_LD, breadcrumbJsonLd } from "./seo";
import { groupDirectory } from "./directory-groups";
import type { DirectoryClinic } from "./directory.server";

describe("Organization structured data", () => {
  it("uses the owner's contact details and the non-www address", () => {
    expect(ORGANIZATION_JSON_LD.url).toBe("https://resonabed.com");
    expect(ORGANIZATION_JSON_LD.email).toBe("info@resonabed.com");
    expect(ORGANIZATION_JSON_LD.telephone).toBe("+61494825281");
    expect(ORGANIZATION_JSON_LD.address.addressLocality).toBe("Scarborough");
    expect(ORGANIZATION_JSON_LD.address.addressRegion).toBe("QLD");
    expect(ORGANIZATION_JSON_LD.areaServed).toBe("AU");
    expect(ORGANIZATION_JSON_LD.sameAs).toEqual([]);
  });
});

describe("breadcrumbs", () => {
  it("start at Home and use absolute resonabed.com URLs", () => {
    const b = breadcrumbJsonLd([{ name: "Research", path: "/research" }]);
    expect(b.itemListElement.map((i) => i.item)).toEqual([
      "https://resonabed.com/",
      "https://resonabed.com/research",
    ]);
  });
});

const clinic = (slug: string, suburb: string, state: string): DirectoryClinic => ({
  slug,
  name: slug,
  suburb,
  state,
  postcode: null,
  telephone: null,
  updated_at: "2026-11-11T00:00:00Z",
});

describe("practitioner directory", () => {
  it("groups clinics by state, then suburb", () => {
    const groups = groupDirectory([
      clinic("c", "Robina", "QLD"),
      clinic("a", "Mount Duneed", "VIC"),
      clinic("b", "South Brisbane", "QLD"),
      clinic("d", "Robina", "QLD"),
    ]);
    expect(groups.map((g) => g.state)).toEqual(["QLD", "VIC"]);
    expect(groups[0].suburbs.map((s) => s.suburb)).toEqual(["Robina", "South Brisbane"]);
    expect(groups[0].suburbs[0].clinics.map((c) => c.slug)).toEqual(["c", "d"]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("frequency wording", () => {
  it("never calls 40 Hz optimal or best", () => {
    const bad = /40 ?Hz[^.]{0,80}\b(optimal|best)\b|\b(optimal|best)\b[^.]{0,80}40 ?Hz/i;
    const offenders = sourceFiles(join(__dirname, "..")).filter((f) =>
      bad.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
