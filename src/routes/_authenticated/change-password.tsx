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

function ChangePassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();

  const onSubmit = async () => {
    if (pw.length < 10) return toast.error("Minimum 10 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      const { error: fnErr } = await supabase.functions.invoke("manage-team-member", {
        body: {
          type: "clear_must_change_password",
          user_id: (await supabase.auth.getUser()).data.user?.id,
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      // Refresh session so the JWT reflects cleared app_metadata
      await supabase.auth.refreshSession();
      qc.invalidateQueries({ queryKey: ["user-context"] });
      toast.success("Password updated");
      nav({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertDescription>
              Your account uses a temporary password. Choose a new one to continue.
            </AlertDescription>
          </Alert>
          <div>
            <Label>New password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <Label>Confirm password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button onClick={onSubmit} disabled={busy} className="w-full">
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
