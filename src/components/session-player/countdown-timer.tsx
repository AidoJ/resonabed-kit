import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  durationSeconds: number;
  onComplete?: () => void;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function CountdownTimer({ durationSeconds, onComplete }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const endTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    setRemaining(durationSeconds);
    setCompleted(false);
    completedRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const now = performance.now();
      const end = endTsRef.current ?? now;
      const rem = Math.max(0, (end - now) / 1000);
      setRemaining(rem);
      if (rem <= 0) {
        setRunning(false);
        if (!completedRef.current) {
          completedRef.current = true;
          setCompleted(true);
          playChime();
          onComplete?.();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, onComplete]);

  const start = () => {
    if (remaining <= 0) return;
    endTsRef.current = performance.now() + remaining * 1000;
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setRemaining(durationSeconds);
    setCompleted(false);
    completedRef.current = false;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-7xl font-bold tabular-nums md:text-8xl">{fmt(remaining)}</div>
      {completed ? (
        <p className="text-lg font-medium text-primary">Session time complete</p>
      ) : null}
      <div className="flex gap-3">
        {!running ? (
          <Button size="lg" onClick={start} disabled={remaining <= 0} className="h-14 px-8 text-base">
            <Play className="mr-2 h-5 w-5" /> Start
          </Button>
        ) : (
          <Button size="lg" onClick={pause} variant="secondary" className="h-14 px-8 text-base">
            <Pause className="mr-2 h-5 w-5" /> Pause
          </Button>
        )}
        <Button size="lg" onClick={reset} variant="outline" className="h-14 px-6 text-base">
          <RotateCcw className="mr-2 h-5 w-5" /> Reset
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
