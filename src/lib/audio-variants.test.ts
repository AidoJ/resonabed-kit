import { describe, expect, it } from "vitest";
import { buildAvailability, pickTrack, variantFor } from "./audio-variants";

describe("audio variants", () => {
  it("maps the two switches to the four recordings", () => {
    expect(variantFor(false, false)).toBe("original");
    expect(variantFor(true, false)).toBe("deep");
    expect(variantFor(false, true)).toBe("original_amb");
    expect(variantFor(true, true)).toBe("deep_amb");
  });

  it("falls back to the Gentle recording when a version is missing", () => {
    const tracks = [
      { id: "a", frequency_id: "f1", variant: "original" },
      { id: "b", frequency_id: "f1", variant: "deep" },
    ];
    expect(pickTrack(tracks, "f1", "deep")?.id).toBe("b");
    expect(pickTrack(tracks, "f1", "deep_amb")?.id).toBe("a");
  });

  it("reports availability per frequency with its ambience", () => {
    const a = buildAvailability([
      { frequency_id: "f1", variant: "original", ambience_kind: null },
      { frequency_id: "f1", variant: "original_amb", ambience_kind: "wind" },
    ]);
    expect(a.f1?.variants.sort()).toEqual(["original", "original_amb"]);
    expect(a.f1?.ambience).toBe("wind");
  });
});
