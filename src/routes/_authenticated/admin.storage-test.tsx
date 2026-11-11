import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import {
  TEST_SIZES_MB,
  checkTestFile,
  formatBytes,
  readEstimate,
  readManifest,
  removeTestFile,
  sizeLabel,
  storeTestFile,
  type CheckResult,
  type StorageEstimateInfo,
  type StorageManifest,
} from "@/lib/storage-test";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Hidden Stage B device test: not in the admin tabs, platform admins only.
export const Route = createFileRoute("/_authenticated/admin/storage-test")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Device storage test, ResonaBed" },
      { name: "description", content: "Check how much storage this device allows the app." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StorageTestGate,
});

function StorageTestGate() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data, isLoading } = useQuery({ queryKey: ["user-context"], queryFn: () => fetchCtx() });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data?.roles?.includes("super_admin")) return <Navigate to="/dashboard" />;
  return <StorageTestPage />;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daysSince(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Math.max(0, Math.floor(d));
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function StorageTestPage() {
  const [est, setEst] = useState<StorageEstimateInfo | null>(null);
  const [manifest, setManifest] = useState<StorageManifest | null>(null);
  const [sizeMb, setSizeMb] = useState<number>(1024);
  const [busy, setBusy] = useState<"store" | "check" | "remove" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const stopRef = useRef(false);

  const refresh = useCallback(async () => {
    setEst(await readEstimate());
    setManifest(readManifest());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onStore() {
    setError(null);
    setCheck(null);
    setRemoved(false);
    stopRef.current = false;
    setBusy("store");
    setProgress({ done: 0, total: sizeMb * 1024 * 1024 });
    try {
      const m = await storeTestFile(
        sizeMb,
        (done, total) => setProgress({ done, total }),
        () => stopRef.current,
      );
      setManifest(m);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function onCheck() {
    setError(null);
    setBusy("check");
    try {
      setCheck(await checkTestFile());
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function onRemove() {
    setError(null);
    setBusy("remove");
    try {
      await removeTestFile();
      setCheck(null);
      setRemoved(true);
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  const room = est?.quota != null && est.usage != null ? est.quota - est.usage : null;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Device storage test for the offline checks. Open this page in the installed app on the
        device you are testing, because the installed app and the browser can have separate
        storage. Nothing here is sent to the server.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storage on this device</CardTitle>
        </CardHeader>
        <CardContent>
          {!est ? (
            <Skeleton className="h-24 w-full" />
          ) : !est.supported ? (
            <p className="text-sm text-destructive">
              This browser doesn't report its storage allowance.
            </p>
          ) : (
            <div>
              <Row label="Storage the browser allows the app" value={formatBytes(est.quota)} />
              <Row label="Used by the app" value={formatBytes(est.usage)} />
              <Row label="Room left" value={formatBytes(room)} />
              <Row
                label="Protected from automatic clearing"
                value={est.persisted == null ? "unknown" : est.persisted ? "Yes" : "No"}
              />
              <Row label="Running as installed app" value={est.installed ? "Yes" : "No"} />
            </div>
          )}
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={!!busy}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Store a test file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Test file size">
            {TEST_SIZES_MB.map((mb) => (
              <button
                key={mb}
                type="button"
                role="radio"
                aria-checked={sizeMb === mb}
                disabled={!!busy}
                onClick={() => setSizeMb(mb)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition-colors",
                  sizeMb === mb
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {sizeLabel(mb)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The full music library is about 4.8 GB. Storing a new test file replaces the old one.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onStore()} disabled={!!busy}>
              Store {sizeLabel(sizeMb)} test file
            </Button>
            {busy === "store" ? (
              <Button variant="outline" onClick={() => (stopRef.current = true)}>
                Stop
              </Button>
            ) : null}
          </div>
          {busy === "store" && progress ? (
            <div className="space-y-1">
              <Progress value={pct} />
              <p className="text-xs text-muted-foreground">
                Stored {formatBytes(progress.done)} of {formatBytes(progress.total)}. Keep this
                page open.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test file on this device</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!manifest ? (
            <p className="text-sm text-muted-foreground">
              {removed
                ? "Test file removed."
                : `No test file record on this device.${
                    check ? " If one was stored here, the device has cleared it." : ""
                  }`}
            </p>
          ) : (
            <div>
              <Row label="Size asked for" value={sizeLabel(manifest.sizeMb)} />
              <Row label="Stored" value={formatBytes(manifest.storedBytes)} />
              <Row
                label="Result"
                value={
                  manifest.complete ? (
                    "Stored in full"
                  ) : (
                    <span className="text-destructive">
                      Not complete{manifest.stopReason ? `: ${manifest.stopReason}` : ""}
                    </span>
                  )
                }
              />
              <Row
                label="Stored on"
                value={`${fmtDate(manifest.finishedAt ?? manifest.startedAt)} (${daysSince(
                  manifest.finishedAt ?? manifest.startedAt,
                )} days ago)`}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void onCheck()} disabled={!!busy}>
              {busy === "check" ? "Checking…" : "Check it's still there"}
            </Button>
            <Button variant="outline" onClick={() => void onRemove()} disabled={!!busy}>
              Remove test file
            </Button>
          </div>

          {check ? (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                check.manifest && check.partsFound === check.manifest.storedParts && check.partsFound > 0
                  ? "border-primary/40 bg-primary/5"
                  : "border-destructive/40 bg-destructive/5 text-destructive",
              )}
            >
              {check.manifest && check.manifest.storedParts > 0 ? (
                check.partsFound === check.manifest.storedParts ? (
                  <>
                    Still there: all {formatBytes(check.bytesFound)} found, checked{" "}
                    {fmtDate(check.checkedAt)}.
                  </>
                ) : (
                  <>
                    Partly or fully cleared: {formatBytes(check.bytesFound)} of{" "}
                    {formatBytes(check.manifest.storedBytes)} found, checked{" "}
                    {fmtDate(check.checkedAt)}.
                  </>
                )
              ) : check.partsFound > 0 ? (
                <>
                  Found {formatBytes(check.bytesFound)} of test data, but the record of when it
                  was stored has been cleared.
                </>
              ) : (
                <>Nothing found, checked {fmtDate(check.checkedAt)}.</>
              )}
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
