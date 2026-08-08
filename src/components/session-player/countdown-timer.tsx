import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  durationSeconds: number;
  onComplete?: () => void;
  /** Fires once when the remaining time drops below fadeLeadSeconds. */
  onFadeStart?: (seconds: number) => void;
  fadeLeadSeconds?: number;
  onRunningChange?: (running: boolean) => void;
  onStart?: () => void;
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


  const start = () => {
    if (remaining <= 0) return;
    endTsRef.current = Date.now() + remaining * 1000;
    setRunning(true);
    onStart?.();
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
              {running ? "In session" : remaining < durationSeconds ? "Paused" : "Ready"}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!running ? (
          <Button
            onClick={start}
            disabled={remaining <= 0}
            className="h-16 min-w-16 rounded-full px-8 text-[15px] font-medium shadow-lift"
          >
            <Play className="mr-2 h-5 w-5" fill="currentColor" strokeWidth={0} />
            Start
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

function playChime() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    play(660, 0, 0.6);
    play(880, 0.25, 0.8);
    setTimeout(() => ctx.close(), 2000);
  } catch {
    /* noop */
  }
}
