import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import closingTrack from "@/assets/session-closing.m4a.asset.json";

interface Props {
  durationSeconds: number;
  onComplete?: () => void;
  /** Fires once when the remaining time drops below fadeLeadSeconds. */
  onFadeStart?: (seconds: number) => void;
  fadeLeadSeconds?: number;
  onRunningChange?: (running: boolean) => void;
  /** May return a promise; the countdown only begins once it settles (music playing). */
  onStart?: () => void | Promise<unknown>;
  onPause?: () => void;
  onReset?: () => void;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function CountdownTimer({
  durationSeconds,
  onComplete,
  onFadeStart,
  fadeLeadSeconds = 15,
  onRunningChange,
  onStart,
  onPause,
  onReset,
}: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [starting, setStarting] = useState(false);
  const endTsRef = useRef<number | null>(null);
  
  const completedRef = useRef(false);
  const fadeStartedRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    setRemaining(durationSeconds);
    setCompleted(false);
    completedRef.current = false;
    fadeStartedRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  // Screen Wake Lock while running.
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
      };
      if (!nav.wakeLock) return;
      try {
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        /* ignore */
      }
    }
    if (running) void acquire();
    return () => {
      cancelled = true;
      const s = wakeLockRef.current;
      wakeLockRef.current = null;
      if (s) void s.release().catch(() => {});
    };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    // Interval + wall-clock end timestamp: requestAnimationFrame is paused in
    // background tabs / locked screens, which meant long sessions never fired
    // the fade or the chime. Timers still fire (throttled) when hidden, and the
    // remaining time is always derived from the end timestamp, so no drift.
    const tick = () => {
      const now = Date.now();
      const end = endTsRef.current ?? now;
      const rem = Math.max(0, (end - now) / 1000);
      setRemaining(rem);
      if (rem > 0 && rem <= fadeLeadSeconds && !fadeStartedRef.current) {
        fadeStartedRef.current = true;
        onFadeStart?.(rem);
      }
      if (rem <= 0) {
        if (!completedRef.current) {
          completedRef.current = true;
          // A throttled tick can jump straight past the fade window, still
          // fade rather than cutting the music dead.
          if (!fadeStartedRef.current) {
            fadeStartedRef.current = true;
            onFadeStart?.(2);
          }
          setCompleted(true);
          playChime();
          onComplete?.();
        }
        setRunning(false);
        return;
      }
    };
    const id = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running, onComplete, onFadeStart, fadeLeadSeconds]);


  const start = async () => {
    if (remaining <= 0 || starting) return;
    primeClosing();
    const result = onStart?.();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setStarting(true);
      try {
        await result;
      } catch {
        /* start the clock anyway */
      }
      setStarting(false);
    }
    endTsRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const pause = () => {
    setRunning(false);
    onPause?.();
  };
  const reset = () => {
    setRunning(false);
    setRemaining(durationSeconds);
    setCompleted(false);
    completedRef.current = false;
    fadeStartedRef.current = false;
    onReset?.();
  };

  const progress =
    durationSeconds > 0 ? Math.max(0, Math.min(1, 1 - remaining / durationSeconds)) : 0;

  const size = 360;
  const stroke = 3;
  const radius = size / 2 - stroke;
  const circ = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-8">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          className="absolute inset-0 -rotate-90"
          width={size}
          height={size}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="color-mix(in oklab, var(--foreground) 12%, transparent)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            style={{ transition: running ? "stroke-dashoffset 0.2s linear" : undefined }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span
            className="font-light tabular-nums text-foreground"
            style={{ fontSize: "clamp(72px, 12vw, 112px)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            {fmt(remaining)}
          </span>
          {completed ? (
            <p className="mt-4 text-[15px] font-medium uppercase tracking-[0.16em] text-primary">
              Session complete
            </p>
          ) : (
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {starting
                ? "Starting your music…"
                : running
                  ? "In session"
                  : remaining < durationSeconds
                    ? "Paused"
                    : "Ready"}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!running ? (
          <Button
            onClick={() => void start()}
            disabled={remaining <= 0 || starting}
            aria-busy={starting}
            className="h-16 min-w-16 rounded-full px-8 text-[15px] font-medium shadow-lift"
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading music…
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" fill="currentColor" strokeWidth={0} />
                Start
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={pause}
            variant="secondary"
            className="h-16 min-w-16 rounded-full px-8 text-[15px] font-medium"
          >
            <Pause className="mr-2 h-5 w-5" fill="currentColor" strokeWidth={0} />
            Pause
          </Button>
        )}
        <Button
          onClick={reset}
          variant="ghost"
          className="h-16 rounded-full px-6 text-[15px] font-medium text-foreground/80 hover:bg-white/5"
        >
          <RotateCcw className="mr-2 h-5 w-5" />
          Reset
        </Button>
      </div>
    </div>
  );
}

// Closing track: softly fades in once the session music has faded out.
let closingEl: HTMLAudioElement | null = null;
let closingFade: ReturnType<typeof setInterval> | null = null;

function getClosing(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!closingEl) {
    closingEl = new Audio(closingTrack.url);
    closingEl.preload = "auto";
    closingEl.setAttribute("playsinline", "");
  }
  return closingEl;
}

/** Unlock the closing track during the Start tap so it may play later. */
function primeClosing() {
  const el = getClosing();
  if (!el) return;
  stopClosing();
  el.muted = true;
  void el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    })
    .catch(() => {
      el.muted = false;
    });
}

function stopClosing() {
  if (closingFade) clearInterval(closingFade);
  closingFade = null;
  if (closingEl) {
    closingEl.pause();
    closingEl.currentTime = 0;
  }
}

function playChime() {
  const el = getClosing();
  if (!el) return;
  stopClosing();
  window.setTimeout(() => {
    el.muted = false;
    el.volume = 0;
    el.currentTime = 0;
    void el.play().catch(() => {});
    const target = 0.8;
    const steps = 50; // ~5 second gentle fade-in
    let i = 0;
    closingFade = setInterval(() => {
      i += 1;
      el.volume = Math.min(target, target * Math.sin(((i / steps) * Math.PI) / 2));
      if (i >= steps && closingFade) {
        clearInterval(closingFade);
        closingFade = null;
      }
    }, 100);
  }, 1500); // short pause after the session music fades away
}
