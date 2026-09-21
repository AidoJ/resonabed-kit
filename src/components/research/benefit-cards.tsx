import { useEffect, useRef, useState } from "react";
import { Moon, HeartPulse, Activity, Sparkles, Pause, Play } from "lucide-react";

type BenefitCard = {
  id: string;
  title: string;
  main: string;
  note: string;
  links: { label: string; href: string }[];
  more?: string;
  Icon: typeof Moon;
};

const CARDS: BenefitCard[] = [
  {
    id: "relaxation",
    title: "Relaxation and stress",
    main: "VAT has been studied as an approach to supporting relaxation.",
    note: "A 54-person pilot found changes in some heart-rate-variability measures. Self-reported stress improved in both groups, without a significant advantage over the music-only comparison.",
    links: [
      { label: "Read the pilot study", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9606670/" },
    ],
    Icon: HeartPulse,
  },
  {
    id: "tension",
    title: "Perceived muscle tension",
    main: "Participants have reported feeling less tense after sessions.",
    note: "In the same pilot, perceived muscle relaxation improved in both groups; an additional benefit from vibration was not established on that measure.",
    links: [
      { label: "Read the pilot study", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9606670/" },
    ],
    Icon: Activity,
  },
  {
    id: "pain",
    title: "Pain and comfort",
    main: "Some small studies have reported improvements in pain-related outcomes.",
    note: "Findings remain uncertain. A 2022 scoping review concluded that randomised trials are needed to establish effectiveness for acute and chronic pain.",
    links: [
      { label: "Scoping review (BMJ Open)", href: "https://doi.org/10.1136/bmjopen-2020-046591" },
      { label: "2015 fibromyalgia study", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4325896/" },
    ],
    more: "The 2015 fibromyalgia study involved 19 women and had no control group. Its reported changes cannot be treated as expected results for any customer.",
    Icon: Sparkles,
  },
  {
    id: "sleep",
    title: "Sleep quality",
    main: "A small study reported sleep improvements after a combined vibration-and-audio programme.",
    note: "Thirty participants completed the study. The programme included in-clinic stimulation and at-home audio; it does not isolate the effect of a bed or establish results for Resonabed.",
    links: [
      { label: "Read the sleep study", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7024098/" },
    ],
    Icon: Moon,
  },
];

/** Calm whole-person silhouette. Decorative only. */
function Silhouette({ active }: { active: number }) {
  return (
    <svg
      viewBox="0 0 120 220"
      aria-hidden="true"
      className="h-full w-full text-brand-violet/25"
      role="presentation"
    >
      <defs>
        <linearGradient id="bc-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          cx="60"
          cy="120"
          rx={38 + i * 14 + active * 2}
          ry={78 + i * 16}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18 - i * 0.05}
        />
      ))}
      <circle cx="60" cy="34" r="17" fill="url(#bc-glow)" />
      <path
        d="M60 54c-17 0-27 12-28 30l-4 62c-.6 10 4 16 12 16h40c8 0 12.6-6 12-16l-4-62c-1-18-11-30-28-30z"
        fill="url(#bc-glow)"
      />
    </svg>
  );
}

export function VatBenefitCards() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    sync();
    media.addEventListener("change", sync);
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        update();
      },
      { threshold: 0.2 },
    );
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!playing || reduced || !visible) return;
    const timer = window.setTimeout(() => setActive((n) => (n + 1) % CARDS.length), 6000);
    return () => window.clearTimeout(timer);
  }, [active, playing, reduced, visible]);

  return (
    <div ref={root} className="mx-auto max-w-6xl px-6 py-14 md:px-10">
      <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
        Research has explored relaxation, perceived tension, pain and sleep. Findings are preliminary
        and vary with the equipment, session protocol and population studied.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={active === i}
            onClick={() => {
              setActive(i);
              setPlaying(false);
            }}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              active === i
                ? "border-brand-violet bg-brand-tint text-brand-indigo"
                : "border-border text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {card.title}
          </button>
        ))}
        {!reduced && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause the benefit cards" : "Play the benefit cards"}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary/60"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-8 rounded-3xl border border-border bg-card p-6 shadow-soft md:grid-cols-[1fr_260px] md:p-10">
        <div>
          {CARDS.map((card, i) => {
            const CardIcon = card.Icon;
            if (i !== active) return null;
            return (
              <div key={card.id} className="animate-in fade-in duration-500">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint text-brand-violet-strong">
                    <CardIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-violet-strong">
                    {card.title}
                  </p>
                </div>
                <h3 className="mt-5 text-2xl font-light leading-snug text-brand-indigo md:text-3xl">
                  {card.main}
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {card.note}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  {card.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-violet-strong underline underline-offset-4"
                    >
                      {link.label} ↗
                    </a>
                  ))}
                </div>
                {card.more && (
                  <div className="mt-5">
                    <button
                      type="button"
                      aria-expanded={expanded === card.id}
                      onClick={() => setExpanded((e) => (e === card.id ? null : card.id))}
                      className="text-sm font-medium text-brand-indigo underline underline-offset-4"
                    >
                      {expanded === card.id ? "Hide study details" : "Show study details"}
                    </button>
                    {expanded === card.id && (
                      <p className="mt-3 max-w-2xl rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
                        {card.more}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="hidden h-64 items-center justify-center md:flex">
          <Silhouette active={active} />
        </div>
      </div>

      <p className="mt-6 rounded-xl bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground">
        These studies did not test Resonabed. Results vary; this research does not establish the same
        outcomes for this product.
      </p>
    </div>
  );
}

export default VatBenefitCards;
