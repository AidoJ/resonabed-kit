import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { redeemHomeAccessCode } from "@/lib/home.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/home/signup")({
  head: () => ({
    meta: [
      { title: "Set up your Resonabed app" },
      {
        name: "description",
        content:
          "Redeem the access code from your Resonabed kit purchase and set up your personal app.",
      },
      { property: "og:title", content: "Set up your Resonabed app" },
      {
        property: "og:description",
        content: "Redeem your kit access code and create your personal Resonabed account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeSignup,
});

const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "A capital letter", test: (v) => /[A-Z]/.test(v) },
  { label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "A number", test: (v) => /[0-9]/.test(v) },
  { label: "A symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function HomeSignup() {
  const navigate = useNavigate();
  const redeem = useServerFn(redeemHomeAccessCode);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordOk = RULES.every((r) => r.test(password));
  const canSubmit = code.trim().length >= 6 && email.includes("@") && passwordOk && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await redeem({
        data: {
          code: code.trim().toUpperCase(),
          email: email.trim(),
          password,
          displayName: name.trim() || undefined,
        },
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        navigate({ to: "/home/login" });
        return;
      }
      navigate({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <img src={logo.url} alt="Resonabed" className="mx-auto mb-8 h-11 w-auto" />
        <h1 className="text-center text-2xl font-medium">Set up your Resonabed app</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Enter the access code we emailed you after your kit purchase. It works once, and your
          account then stays with you for good.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <Label htmlFor="code">Access code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RB-XXXX-XXXX"
              autoComplete="off"
              className="mt-1.5 tracking-[0.15em]"
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Order email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-1.5"
              required
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Must match the email your code was sent to.
            </p>
          </div>
          <div>
            <Label htmlFor="name">Your name (optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="password">Create a password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5"
              required
            />
            <ul className="mt-2.5 space-y-1">
              {RULES.map((r) => {
                const ok = r.test(password);
                return (
                  <li
                    key={r.label}
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      ok ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Check className={cn("h-3.5 w-3.5", !ok && "opacity-30")} />
                    {r.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={!canSubmit} className="h-12 w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create my account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already set up?{" "}
          <Link to="/home/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
