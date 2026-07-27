import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  src: string;
  title: string;
  onPlayingChange?: (playing: boolean) => void;
}

export interface AudioPlayerHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
  fadeOut: (seconds?: number) => void;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(function AudioPlayer(
  { src, title, onPlayingChange },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.8);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onDur = () => setDur(el.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnd);
    el.volume = vol;
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnd);
    };
  }, [vol]);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const doPlay = () => {
    const el = audioRef.current;
    if (!el) return;
    void el.play().catch(() => {});
  };
  const doPause = () => {
    audioRef.current?.pause();
  };
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearFade = () => {
    if (fadeTimerRef.current != null) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const doFadeOut = (seconds = 15) => {
    const el = audioRef.current;
    if (!el || el.paused) return;
    clearFade();
    const startVol = el.volume;
    const stepMs = 100;
    const steps = Math.max(1, Math.round((seconds * 1000) / stepMs));
    let i = 0;
    fadeTimerRef.current = setInterval(() => {
      i += 1;
      const next = startVol * (1 - i / steps);
      if (!audioRef.current) return clearFade();
      audioRef.current.volume = Math.max(0, next);
      if (i >= steps) {
        clearFade();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = startVol;
        setTime(0);
      }
    }, stepMs);
  };

  useEffect(() => clearFade, []);

  const doStop = () => {
    clearFade();
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setTime(0);
  };

  useImperativeHandle(
    ref,
    () => ({ play: doPlay, pause: doPause, stop: doStop, fadeOut: doFadeOut }),
    [],
  );

  const toggle = () => (playing ? doPause() : doPlay());

  const seek = (v: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = v;
    setTime(v);
  };

  return (
    <div className="shadow-soft space-y-5 rounded-2xl bg-card/70 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="truncate text-[15px] font-medium">{title}</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {fmt(time)} / {fmt(dur)}
        </span>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
      <Slider
        min={0}
        max={dur || 1}
        step={0.5}
        value={[time]}
        onValueChange={(v) => seek(v[0] ?? 0)}
        className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
      />
      <div className="flex items-center gap-4">
        <Button
          onClick={toggle}
          className="h-16 w-16 rounded-full p-0 shadow-lift"
          aria-label={playing ? "Pause" : "Play"}
          type="button"
        >
          {playing ? (
            <Pause className="h-6 w-6" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="h-6 w-6" fill="currentColor" strokeWidth={0} />
          )}
        </Button>
        <Button
          onClick={doStop}
          variant="ghost"
          className="h-12 w-12 rounded-full p-0 text-foreground/80 hover:bg-white/5"
          aria-label="Stop"
          type="button"
        >
          <Square className="h-5 w-5" fill="currentColor" strokeWidth={0} />
        </Button>
        <div className="ml-auto flex flex-1 items-center gap-3">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[vol]}
            onValueChange={(v) => setVol(v[0] ?? 0)}
            className="max-w-xs [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
          />
        </div>
      </div>
    </div>
  );
});
