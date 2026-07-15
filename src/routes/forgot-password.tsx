import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Resonabed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
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
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your account email and we'll send you a reset link.
            </p>
          </div>
          {sent ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-success/10 px-3 py-3 text-sm text-success">
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
                Check your inbox and spam folder.
              </p>
              <p className="text-xs text-muted-foreground">
                Note: email delivery depends on this project's email configuration. If you don't
                receive a message, ask your administrator to confirm SMTP is set up.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-[10px]"
                onClick={() => navigate({ to: "/auth" })}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-medium text-brand-indigo">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                disabled={loading}
                className="h-12 w-full rounded-[10px] text-[15px] font-medium"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Remembered it?{" "}
                <Link to="/auth" className="font-medium text-brand-violet-strong hover:underline">
                  Back to sign in
                </Link>
              </p>
              <p className="rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Password reset emails require SMTP to be configured on this project. Until an
                email provider is set up, reset links may not be delivered.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
