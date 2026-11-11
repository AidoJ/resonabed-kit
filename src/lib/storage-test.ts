/**
 * Browser storage test for the Stage B device checks (platform admin only).
 * Stores a test file in Cache Storage as fixed-size parts, so even a 5 GB test
 * never holds more than one part in memory, then checks later that every part
 * is still there. Nothing here runs on the server.
 */

export const STORAGE_TEST_CACHE = "rb-storage-test";
const MANIFEST_KEY = "rb-storage-test-manifest";
const PART_URL = (i: number) => `/__storage-test/part-${String(i).padStart(5, "0")}`;
export const PART_BYTES = 16 * 1024 * 1024;
const MB = 1024 * 1024;

export const TEST_SIZES_MB = [100, 500, 1024, 2048, 5120] as const;

export type StorageManifest = {
  sizeMb: number;
  parts: number;
  storedParts: number;
  storedBytes: number;
  startedAt: string;
  finishedAt: string | null;
  complete: boolean;
  stopReason: string | null;
};

export type StorageEstimateInfo = {
  supported: boolean;
  quota: number | null;
  usage: number | null;
  persisted: boolean | null;
  installed: boolean;
};

export type CheckResult = {
  manifest: StorageManifest | null;
  partsFound: number;
  bytesFound: number;
  checkedAt: string;
};

export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "unknown";
  if (n >= 1024 * MB) return `${(n / (1024 * MB)).toLocaleString("en-AU", { maximumFractionDigits: 2 })} GB`;
  return `${Math.round(n / MB).toLocaleString("en-AU")} MB`;
}

export function sizeLabel(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

export function partsFor(sizeMb: number): number {
  return Math.ceil((sizeMb * MB) / PART_BYTES);
}

function partLength(sizeMb: number, i: number): number {
  const total = sizeMb * MB;
  return Math.min(PART_BYTES, total - i * PART_BYTES);
}

export async function readEstimate(): Promise<StorageEstimateInfo> {
  const installed =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!navigator.storage?.estimate) {
    return { supported: false, quota: null, usage: null, persisted: null, installed };
  }
  const est = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
  return {
    supported: true,
    quota: est.quota ?? null,
    usage: est.usage ?? null,
    persisted,
    installed,
  };
}

export function readManifest(): StorageManifest | null {
  try {
    const raw = window.localStorage.getItem(MANIFEST_KEY);
    return raw ? (JSON.parse(raw) as StorageManifest) : null;
  } catch {
    return null;
  }
}

function writeManifest(m: StorageManifest) {
  window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
}

/** A recognisable header per part, so the check proves the right data survived. */
function header(i: number): Uint8Array {
  const h = new Uint8Array(16);
  const tag = new TextEncoder().encode("RBTEST");
  h.set(tag, 0);
  new DataView(h.buffer).setUint32(8, i);
  return h;
}

export async function removeTestFile(): Promise<void> {
  await caches.delete(STORAGE_TEST_CACHE);
  window.localStorage.removeItem(MANIFEST_KEY);
}

export async function storeTestFile(
  sizeMb: number,
  onProgress: (storedBytes: number, totalBytes: number) => void,
  shouldStop: () => boolean,
): Promise<StorageManifest> {
  await removeTestFile();
  const parts = partsFor(sizeMb);
  const manifest: StorageManifest = {
    sizeMb,
    parts,
    storedParts: 0,
    storedBytes: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    complete: false,
    stopReason: null,
  };
  writeManifest(manifest);
  const cache = await caches.open(STORAGE_TEST_CACHE);

  // One random 64 KB block repeated across the part (filled once).
  const buf = new Uint8Array(PART_BYTES);
  const block = new Uint8Array(65536);
  crypto.getRandomValues(block);
  for (let off = 0; off < PART_BYTES; off += block.length) buf.set(block, off);

  for (let i = 0; i < parts; i++) {
    if (shouldStop()) {
      manifest.stopReason = "Stopped before the end.";
      break;
    }
    const len = partLength(sizeMb, i);
    buf.set(header(i), 0);
    const blob = new Blob([buf.subarray(0, len)], { type: "application/octet-stream" });
    try {
      await cache.put(PART_URL(i), new Response(blob, { headers: { "content-length": String(len) } }));
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      manifest.stopReason =
        name === "QuotaExceededError"
          ? "The browser refused to store any more (storage full or limit reached)."
          : `The browser stopped the test: ${String((e as Error)?.message ?? e)}`;
      break;
    }
    manifest.storedParts = i + 1;
    manifest.storedBytes += len;
    writeManifest(manifest);
    onProgress(manifest.storedBytes, sizeMb * MB);
  }
  manifest.complete = manifest.storedParts === parts;
  manifest.finishedAt = new Date().toISOString();
  writeManifest(manifest);
  return manifest;
}

export async function checkTestFile(): Promise<CheckResult> {
  const manifest = readManifest();
  let partsFound = 0;
  let bytesFound = 0;
  if ((await caches.keys()).includes(STORAGE_TEST_CACHE)) {
    const cache = await caches.open(STORAGE_TEST_CACHE);
    const total = manifest?.parts ?? (await cache.keys()).length;
    for (let i = 0; i < total; i++) {
      const res = await cache.match(PART_URL(i));
      if (!res) continue;
      const blob = await res.blob();
      const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
      const want = header(i);
      if (head.length === 16 && head.every((b, k) => b === want[k])) {
        partsFound += 1;
        bytesFound += blob.size;
      }
    }
  }
  return { manifest, partsFound, bytesFound, checkedAt: new Date().toISOString() };
}
