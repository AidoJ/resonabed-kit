import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  src: string;
  title: string;
  onPlayingChange?: (playing: boolean) => void;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({ src, title, onPlayingChange }: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.8);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onDur = () => setDur(el.duration);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("ended", onEnd);
    el.volume = vol;
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("ended", onEnd);
    };
  }, [vol]);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const stop = () => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
    setTime(0);
  };

  const seek = (v: number) => {
    const el = ref.current;
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
      <audio ref={ref} src={src} preload="metadata" />
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
        >
          {playing ? (
            <Pause className="h-6 w-6" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="h-6 w-6" fill="currentColor" strokeWidth={0} />
          )}
        </Button>
        <Button
          onClick={stop}
          variant="ghost"
          className="h-12 w-12 rounded-full p-0 text-foreground/80 hover:bg-white/5"
          aria-label="Stop"
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
}

