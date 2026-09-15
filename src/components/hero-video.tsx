import { useEffect, useRef, useState } from "react";
import videoAsset from "@/assets/resonabed-music-web.mp4.asset.json";
import posterAsset from "@/assets/resonabed-poster.jpg.asset.json";

export const heroPosterUrl = posterAsset.url;

export function HeroVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(mq.matches);
      const v = videoRef.current;
      if (!v) return;
      if (mq.matches) {
        v.pause();
        v.muted = true;
        setMuted(true);
      } else {
        v.play().catch(() => {});
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleSound = async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) {
      try {
        await v.play();
      } catch {
        v.muted = true;
        setMuted(true);
      }
    }
  };

  return (
    <div className={className} style={{ position: "relative" }}>
      {reducedMotion ? (
        <img
          src={posterAsset.url}
          width={1280}
          height={724}
          alt="Client resting on a Resonabed vibroacoustic therapy table"
          className="h-auto w-full"
          draggable={false}
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={posterAsset.url}
          width={1280}
          height={724}
          aria-label="Resonabed treatment with gentle animated vibration waves and optional music."
          className="h-auto w-full"
        >
          <source src={videoAsset.url} type="video/mp4" />
        </video>
      )}
      {!reducedMotion && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Turn music on" : "Turn music off"}
          aria-pressed={!muted}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/40 bg-[#30243c]/85 px-4 py-2.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-[#513961] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
          </svg>
          <span>{muted ? "Sound on" : "Sound off"}</span>
        </button>
      )}
    </div>
  );
}
