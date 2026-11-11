import { describe, expect, it } from "vitest";
import { canPlayGlobalAsClinic, homeCodeAllowsMusic, orgLicenceOk } from "./music-access";

const NOW = Date.parse("2026-11-11T08:00:00Z");
const future = "2027-01-01T00:00:00Z";
const past = "2026-11-01T00:00:00Z";

describe("music access", () => {
  it("allows a clinic whose licence is active and not yet expired", () => {
    expect(orgLicenceOk({ music_licence_status: "active", music_licence_expires_at: future }, NOW)).toBe(true);
    expect(orgLicenceOk({ music_licence_status: "trial", music_licence_expires_at: future }, NOW)).toBe(true);
  });

  it("blocks a clinic whose licence is marked expired or whose expiry date has passed", () => {
    expect(orgLicenceOk({ music_licence_status: "expired", music_licence_expires_at: future }, NOW)).toBe(false);
    expect(orgLicenceOk({ music_licence_status: "active", music_licence_expires_at: past }, NOW)).toBe(false);
    expect(orgLicenceOk({ music_licence_status: "active", music_licence_expires_at: null }, NOW)).toBe(false);
  });

  it("never gives shared tracks through the clinic path to an account with no clinic", () => {
    expect(canPlayGlobalAsClinic({ isSuperAdmin: false, orgId: null, org: null, now: NOW })).toBe(false);
  });

  it("lets super admins play shared tracks in support and admin mode", () => {
    expect(canPlayGlobalAsClinic({ isSuperAdmin: true, orgId: null, org: null, now: NOW })).toBe(true);
  });

  it("gives Home accounts music only while their purchase code is redeemed", () => {
    expect(homeCodeAllowsMusic({ status: "redeemed", access_level: "full" })).toBe(true);
    expect(homeCodeAllowsMusic({ status: "revoked", access_level: "full" })).toBe(false);
    expect(homeCodeAllowsMusic(null)).toBe(false);
  });
});
