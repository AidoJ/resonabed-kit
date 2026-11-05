import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getHomeContext } from "@/lib/home.functions";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/home/help")({
  head: () => ({
    meta: [
      { title: "Help guide, Resonabed Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/home/login" });
    const ctx = await getHomeContext();
    if (ctx.kind !== "home") throw redirect({ to: "/help" });
  },
  component: HomeHelpPage,
});

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>{children}</div>
    </div>
  );
}

function HomeHelpPage() {
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <img src={logo.url} alt="Resonabed" className="h-9 w-auto" />
          <Link
            to="/home"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sessions
          </Link>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold">
              <BookOpen className="h-6 w-6 text-primary" />
              Help guide
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How to use your Resonabed at home, from first sign-in to the end of a
              session.
            </p>
          </div>

          <Section title="1. Signing in">
            <p>
              Sign in with the email and password you used when you activated your
              access code. If you forget your password, use the reset link on the
              sign-in page.
            </p>
            <p>
              New to the app? Enter the access code that came with your bed on the
              sign-up page, then choose your email and password.
            </p>
          </Section>

          <Section title="2. Setting up your table">
            <p>
              Before your first session, open <strong>Table setup</strong> at the top
              of the sessions page. Four short videos walk you through unpacking,
              positioning, connecting and checking your bed.
            </p>
            <Tip>
              Do this once, carefully. A well-set-up table makes every session feel
              better.
            </Tip>
          </Section>

          <Section title="3. The safety check">
            <p>
              The first time you use the app you will be asked to read and
              acknowledge a short safety notice. It explains who should check with
              their doctor before using vibroacoustic therapy.
            </p>
            <Warn>
              Resonabed is a wellbeing product, not a medical device. If you are
              pregnant, have a pacemaker or a serious health condition, talk to your
              doctor first.
            </Warn>
          </Section>

          <Section title="4. Starting a session">
            <p>Each session has three quick steps:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                <strong>How you feel.</strong> Tap anything that applies (stress,
                poor sleep, tension and so on). The app uses this to suggest a
                frequency.
              </li>
              <li>
                <strong>Frequency.</strong> Pick the suggested frequency or choose
                your own. Each frequency has its own character, try a few over time.
              </li>
              <li>
                <strong>Sound.</strong> Choose a session length, then optionally add{" "}
                <strong>Deep Feel</strong> (a stronger vibration mix) or{" "}
                <strong>Ambient Sound</strong> (water or wind woven into the music).
                Both start off.
              </li>
            </ol>
            <p>
              Press <strong>Start</strong>, lie down and relax. The music starts
              before the timer so you can settle in.
            </p>
          </Section>

          <Section title="5. During the session">
            <p>
              The screen shows the time remaining. You can pause or stop at any
              time. If your phone screen locks, the session keeps going, the ending
              is timed by the audio itself, not the screen.
            </p>
            <p>
              You can switch Deep Feel or Ambient Sound on or off mid-session; the
              music changes without restarting.
            </p>
          </Section>

          <Section title="6. The ending">
            <p>
              When the time is up, the music fades out gently over about 15 seconds,
              then a short closing recording plays with soft bells to bring you back
              slowly. Stay lying down until it finishes.
            </p>
            <Tip>
              Keep your phone plugged in or well charged for longer sessions, and
              leave the app open in the foreground when you can.
            </Tip>
          </Section>

          <Section title="7. Signing out">
            <p>
              Use <strong>Sign out</strong> at the top of the sessions page. Home
              sessions are private and are not recorded anywhere, nothing is saved
              about what you played.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
