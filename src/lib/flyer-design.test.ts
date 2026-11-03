import { describe, expect, it } from "vitest";
import { defaultFlyerDesign, flyerDesignSchema } from "./flyer-design";
describe("locked six-panel flyer", () => {
  it("provides F1 F2 F3 B1 B2 B3 independently", () => {
    const design = defaultFlyerDesign();
    expect(Object.keys(design.panels)).toEqual(["F1", "F2", "F3", "B1", "B2", "B3"]);
    design.panels.F1.background = "#123456";
    expect(design.panels.F2.background).toBe("#e1c9ad");
  });
  it("accepts only logo, phone and panel colours, not content", () => {
    expect(flyerDesignSchema.safeParse({ ...defaultFlyerDesign(), content: "Changed wording" }).success).toBe(false);
    expect(flyerDesignSchema.safeParse({ ...defaultFlyerDesign(), layout: { x: 100 } }).success).toBe(false);
    expect(flyerDesignSchema.safeParse({ ...defaultFlyerDesign("0400123456", "clinic/flyer.png") }).success).toBe(true);
  });
  it("rejects incomplete colours", () => {
    const design = defaultFlyerDesign(); design.panels.B3.accent = "#123";
    expect(flyerDesignSchema.safeParse(design).success).toBe(false);
  });
  it("starts with every logo backing switched off", () => {
    const design = defaultFlyerDesign();
    expect(["F2", "F3", "B1"].map((id) => design.panels[id as "F2"].logoBacking)).toEqual([false, false, false]);
  });
});
