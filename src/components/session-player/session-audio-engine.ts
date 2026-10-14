// Session sound engine: schedules the end-of-session fade and the closing
// track on the device's audio clock, so the ending happens on time even when
// the screen locks or the browser pauses page timers. The closing track is
// only ever started by the schedule, never at the start of a session.
import closingTrack from "@/assets/session-closing.m4a.asset.json";

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let musicGain: GainNode | null = null;
let attachedEl: HTMLMediaElement | null = null;
let closingBuffer: AudioBuffer | null = null;
let closingLoading: Promise<AudioBuffer | null> | null = null;
let closingSource: AudioBufferSourceNode | null = null;
let closingGain: GainNode | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let scheduleToken = 0;

const CLOSING_VOLUME = 0.8;
const CLOSING_GAP = 1.5; // quiet pause between the fade-out and the closing track
const CLOSING_FADE_IN = 5;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

/** Call synchronously inside the Start tap so the device allows sound. */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state !== "running") void c.resume().catch(() => {});
  void loadClosing();
}

function loadClosing(): Promise<AudioBuffer | null> {
  if (closingBuffer) return Promise.resolve(closingBuffer);
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  if (!closingLoading) {
    closingLoading = fetch(closingTrack.url)
      .then((r) => r.arrayBuffer())
      .then(
        (buf) =>
          new Promise<AudioBuffer>((resolve, reject) => c.decodeAudioData(buf, resolve, reject)),
      )
      .then((b) => (closingBuffer = b))
      .catch(() => {
        closingLoading = null;
        return null;
      });
  }
  return closingLoading;
}

/** Route the session music through the engine so its fade runs on the audio clock. */
export function attachMusic(el: HTMLMediaElement): boolean {
  const c = getCtx();
  if (!c) return false;
  if (attachedEl === el && musicGain) return true;
  try {
    const src = c.createMediaElementSource(el);
    const g = c.createGain();
    src.connect(g).connect(c.destination);
    musicGain = g;
    attachedEl = el;
    return true;
  } catch {
    return false;
  }
}

export function isMusicAttached(el?: HTMLMediaElement | null) {
  return !!musicGain && (!el || el === attachedEl);
}

function stopClosingNow() {
  if (closingSource) {
    try {
      closingSource.stop();
    } catch {
      /* not started */
    }
    closingSource.disconnect();
  }
  closingGain?.disconnect();
  closingSource = null;
  closingGain = null;
}

/** Cancel any booked ending and bring the music back to full level. */
export function cancelEnding() {
  scheduleToken += 1;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  stopClosingNow();
  const c = ctx;
  if (c && musicGain) {
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(1, c.currentTime);
  }
}

/**
 * Book the ending: the music fades out over the last `fadeSeconds` of the
 * session, then the closing track fades in. Returns true when the music fade
 * is handled by the engine (otherwise the caller should fade it itself).
 */
export function scheduleEnding(remainingSeconds: number, fadeSeconds = 15): boolean {
  cancelEnding();
  const c = getCtx();
  if (!c) return false;
  const token = scheduleToken;
  const now = c.currentTime;
  const end = now + Math.max(0, remainingSeconds);
  const fadeStart = Math.max(now, end - fadeSeconds);

  if (musicGain) {
    const g = musicGain.gain;
    g.setValueAtTime(1, now);
    g.setValueAtTime(1, fadeStart);
    g.linearRampToValueAtTime(0, Math.max(fadeStart + 0.05, end));
  }

  void loadClosing().then((buf) => {
    if (!buf || token !== scheduleToken || !ctx) return;
    const startAt = Math.max(ctx.currentTime + 0.05, end + CLOSING_GAP);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(CLOSING_VOLUME, startAt + CLOSING_FADE_IN);
    src.connect(g).connect(ctx.destination);
    src.start(startAt);
    src.onended = () => {
      if (closingSource === src) {
        closingSource = null;
        closingGain = null;
      }
    };
    closingSource = src;
    closingGain = g;
  });

  return !!musicGain;
}

/** Ending has run (or the session was reset): restore music level for next time. */
export function resetMusicLevel() {
  const c = ctx;
  if (c && musicGain) {
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(1, c.currentTime);
  }
}
