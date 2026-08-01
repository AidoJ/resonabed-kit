import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import logo from "@/assets/resonabed-logo.svg.asset.json";
import logoMark from "@/assets/resonabed-logo-mark.svg";

const searchSchema = z.object({
  redirect: z.string().optional(),
  reset: z.enum(["success"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in, Resonabed" },
      { name: "description", content: "Sign in to your Resonabed practitioner account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: search.redirect ?? "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        navigate({ to: search.redirect ?? "/dashboard", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, search.redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: search.redirect ?? "/dashboard", replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url(${logoMark})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(140vw, 1400px) auto",
          opacity: 0.08,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 20%, color-mix(in oklab, var(--brand-violet) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <img
            src={logo.url}
            alt="Resonabed"
            className="h-36 w-auto"
            draggable={false}
          />
        </div>
        <div className="shadow-soft rounded-2xl bg-card p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-light tracking-tight text-brand-indigo">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your practitioner account.
            </p>
            {search.reset === "success" ? (
              <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                Password updated. Sign in with your new password.
              </p>
            ) : null}
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium text-brand-indigo">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-[12px] font-medium text-brand-violet-strong hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created by administrators. Contact your organisation admin if you need
          access.
        </p>
      </div>
    </main>
  );
}
