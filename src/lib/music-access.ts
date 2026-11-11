/**
 * Pure rules for who may play the shared (global) music library and start
 * clinic sessions. Server code loads the rows; these functions decide.
 */

export interface OrgLicenceRow {
  music_licence_status: string;
  music_licence_expires_at: string | null;
}

/** A clinic's licence is usable while not marked expired and its expiry is in the future. */
export function orgLicenceOk(org: OrgLicenceRow | null | undefined, now: number = Date.now()): boolean {
  if (!org) return false;
  if (org.music_licence_status === "expired") return false;
  if (!org.music_licence_expires_at) return false;
  return new Date(org.music_licence_expires_at).getTime() > now;
}

/**
 * Shared tracks through the clinic playback path: super admins always; anyone
 * else only through a clinic with a usable licence. An account with no clinic
 * (for example a Home account) never gets shared tracks through this path.
 */
export function canPlayGlobalAsClinic(args: {
  isSuperAdmin: boolean;
  orgId: string | null;
  org: OrgLicenceRow | null | undefined;
  now?: number;
}): boolean {
  if (args.isSuperAdmin) return true;
  if (!args.orgId) return false;
  return orgLicenceOk(args.org, args.now);
}

export interface HomeCodeRow {
  status: string;
  access_level: string | null;
}

/** Home accounts play shared tracks only while their purchase code is live. */
export function homeCodeAllowsMusic(code: HomeCodeRow | null | undefined): boolean {
  if (!code) return false;
  return code.status === "redeemed";
}

export const MUSIC_LICENCE_EXPIRED_ERROR =
  "Music licence expired. Renew the clinic's music licence to start sessions.";
export const RENEW_LICENCE_EMAIL = "info@resonabed.com";

export function renewLicenceHref(clinicName?: string | null): string {
  const subject = `Music licence renewal${clinicName ? ` - ${clinicName}` : ""}`;
  return `mailto:${RENEW_LICENCE_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
