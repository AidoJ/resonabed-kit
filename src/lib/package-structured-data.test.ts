import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packagesJsonLd } from "./package-structured-data";
import { applyPricing } from "./packages";
import { SOLFEGGIO } from "@/components/public-clinic/clinic-content";

describe("package search data", () => {
  const graph = packagesJsonLd(applyPricing([]))["@graph"];
  const byName = Object.fromEntries(graph.map((p) => [p.name, p.offers]));

  it("sends the full price incl. GST for all four packages, in AUD", () => {
    expect(byName["Resonabed Basic"].price).toBe("1399.00");
    expect(byName["Resonabed Pro"].price).toBe("1599.00");
    expect(byName["Resonabed Platinum"].price).toBe("1999.00");
    expect(byName["Resonabed for Home"].price).toBe("1699.00");
    for (const offer of graph.map((p) => p.offers)) {
      expect(offer.priceCurrency).toBe("AUD");
      expect(offer.priceSpecification.valueAddedTaxIncluded).toBe(true);
    }
  });

  it("marks every package in stock", () => {
    expect(graph).toHaveLength(4);
    for (const p of graph) expect(p.offers.availability).toBe("https://schema.org/InStock");
  });

  it("never sends the deposit, a plan payment or shipping", () => {
    const json = JSON.stringify(graph);
    expect(json).not.toMatch(/"100\.00"|shipping|deposit|monthly/i);
  });
});

describe("frequency wording", () => {
  const health = /\b(dna|repair\w*|heal\w*|detox\w*|miracle|cure\w*|treat\w*|pain)\b/i;

  it("tone cards never tie a frequency to a health outcome", () => {
    for (const tone of SOLFEGGIO) {
      expect(`${tone.label} ${tone.desc}`).not.toMatch(health);
    }
  });

  it("kit showcase and homepage use the approved wording", () => {
    const kit = readFileSync(join(__dirname, "../components/kit-showcase.tsx"), "utf8");
    expect(kit).toContain("help your clients relax and settle");
    expect(kit).not.toMatch(/ease pain/i);
    const home = readFileSync(join(__dirname, "../routes/index.tsx"), "utf8").replace(/\s+/g, " ");
    expect(home).toContain(
      "the tactile transducers turn the low-frequency layer of each track into gentle vibration you feel, while the Solfeggio tone is what you hear",
    );
  });
});
