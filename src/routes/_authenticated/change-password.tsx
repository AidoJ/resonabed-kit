import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({ meta: [{ title: "Change password — ResonaBed" }] }),
  component: ChangePassword,
});

const rules = [
  { label: "At least 8 characters", test: (s: string) => s.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (s: string) => /[A-Z]/.test(s) },
  { label: "One lowercase letter (a–z)", test: (s: string) => /[a-z]/.test(s) },
  { label: "One number (0–9)", test: (s: string) => /[0-9]/.test(s) },
  { label: "One symbol (e.g. ! @ # $ %)", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
];

function ChangePassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nav = useNavigate();
  const qc = useQueryClient();

  const ruleResults = rules.map((r) => ({ ...r, ok: r.test(pw) }));
  const allRulesPass = ruleResults.every((r) => r.ok);
  const canSubmit = allRulesPass && pw === pw2 && !busy;

  const onSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setMessage(null);
    if (!allRulesPass) {
      setMessage("Password must meet all the requirements below.");
      return;
    }
    if (pw !== pw2) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        if (error.code === "same_password") {
          throw new Error("Choose a password that is different from the temporary password.");
        }
        throw new Error(error.message);
      }
      const { error: fnErr } = await supabase.functions.invoke("manage-team-member", {
        body: {
          type: "clear_must_change_password",
          user_id: (await supabase.auth.getUser()).data.user?.id,
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      await supabase.auth.refreshSession();
      qc.invalidateQueries({ queryKey: ["user-context"] });
      toast.success("Password updated");
      nav({ to: "/dashboard" });
    } catch (e) {
      const text = (e as Error).message;
      setMessage(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
          <Alert>
            <AlertDescription>
              Your account uses a temporary password. Choose a new one to continue.
            </AlertDescription>
          </Alert>
          {message ? (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Label>New password</Label>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
            <div className="font-medium mb-1">Password must include:</div>
            <ul className="space-y-1">
              {ruleResults.map((r) => (
                <li key={r.label} className={r.ok ? "text-green-600" : "text-muted-foreground"}>
                  <span aria-hidden className="inline-block w-4">{r.ok ? "✓" : "○"}</span>
                  {r.label}
                </li>
              ))}
              <li className={pw.length > 0 && pw === pw2 ? "text-green-600" : "text-muted-foreground"}>
                <span aria-hidden className="inline-block w-4">{pw.length > 0 && pw === pw2 ? "✓" : "○"}</span>
                Passwords match
              </li>
            </ul>
          </div>
          <div>
            <Label>Confirm password</Label>
            <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={!canSubmit} className="w-full">
            {busy ? "Updating…" : "Update password"}
          </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
