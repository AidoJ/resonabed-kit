import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  src: string;
  title: string;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({ src, title }: Props) {
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
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="truncate text-sm font-medium">{title}</p>
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
        className="[&_[role=slider]]:h-6 [&_[role=slider]]:w-6"
      />
      <div className="flex items-center gap-3">
        <Button size="lg" onClick={toggle} className="h-12 min-w-24">
          {playing ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button size="lg" onClick={stop} variant="outline" className="h-12">
          <Square className="h-5 w-5" />
        </Button>
        <div className="ml-auto flex flex-1 items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[vol]}
            onValueChange={(v) => setVol(v[0] ?? 0)}
            className="max-w-xs [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
          />
        </div>
      </div>
    </div>
  );
}
