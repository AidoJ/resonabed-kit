import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set new password — Resonabed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Supabase parses the recovery token from the URL hash on load and emits a
  // PASSWORD_RECOVERY event. Wait for it (or an existing session) before
  // allowing the password update.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 10) return setError("Password must be at least 10 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { reset: "success" }, replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <img src={logo.url} alt="Resonabed" className="h-24 w-auto" draggable={false} />
        </div>
        <div className="shadow-soft rounded-2xl bg-card p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-light tracking-tight text-brand-indigo">
              Set a new password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a strong password of at least 10 characters.
            </p>
          </div>
          {!ready ? (
            <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
              Verifying your reset link… If nothing happens, request a new link from the sign-in
              page.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="pw" className="text-[13px] font-medium text-brand-indigo">
                  New password
                </Label>
                <PasswordInput
                  id="pw"
                  autoComplete="new-password"
                  required
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="h-12 rounded-[10px] border-border bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2" className="text-[13px] font-medium text-brand-indigo">
                  Confirm password
                </Label>
                <PasswordInput
                  id="pw2"
                  autoComplete="new-password"
                  required
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="h-12 rounded-[10px] border-border bg-background"
                />
              </div>
              {error ? (
                <p
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-[10px] text-[15px] font-medium"
              >
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
