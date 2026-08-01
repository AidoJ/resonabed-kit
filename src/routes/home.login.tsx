import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/home/login")({
  head: () => ({
    meta: [
      { title: "Sign in to your Resonabed app" },
      {
        name: "description",
        content: "Sign in to your personal Resonabed app to start a session at home.",
      },
      { property: "og:title", content: "Sign in to your Resonabed app" },
      {
        property: "og:description",
        content: "Sign in to your personal Resonabed app to start a session at home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeLogin,
});

function HomeLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError("That email and password did not match. Please try again.");
      return;
    }
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-dvh bg-background px-5 py-16">
      <div className="mx-auto w-full max-w-sm">
        <img src={logo.url} alt="Resonabed" className="mx-auto mb-8 h-11 w-auto" />
        <h1 className="text-center text-2xl font-medium">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in to your personal Resonabed app.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5"
              required
            />
          </div>
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="h-12 w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Have a kit but no account yet?{" "}
            <Link to="/home/signup" className="text-primary underline-offset-4 hover:underline">
              Redeem your code
            </Link>
          </p>
          <p>
            <Link to="/forgot-password" className="underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
