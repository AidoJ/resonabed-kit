/**
 * The Cellular Response section for the public clinic page and marketing page.
 *
 * LIABILITY CONTROL: every word here is hardcoded template content. Nothing
 * may be sourced from an operator-editable field.
 */

import { useEffect, useRef, useState } from "react";

type PartId = "waves" | "squeeze" | "doors" | "fuel" | "frame" | "tug" | "repair";




const STEPS: { n: number; c: string; t: string; x: string; on: PartId[] }[] = [
  {
    n: 1,
    c: "#6C30A8",
    t: "Sound waves press the cell",
    x: "Low, slow vibrations you can feel gently push and pull on the cell, like a tiny massage.",
    on: ["waves", "squeeze"],
  },
  {
    n: 2,
    c: "#5A2488",
    t: "Tiny doors pop open",
    x: "The squeezing stretches the cell's skin, and little doors in the wall snap open.",
    on: ["doors"],
  },
  {
    n: 3,
    c: "#159B84",
    t: "Fuel rushes in",
    x: "Food and calcium slip through the open doors to give the cell a boost of energy.",
    on: ["doors", "fuel"],
  },
  {
    n: 4,
    c: "#7A3CB0",
    t: "The inner frame tightens",
    x: "The cell's built-in scaffolding pulls taut to keep up with the rhythm.",
    on: ["frame"],
  },
  {
    n: 5,
    c: "#3B1E78",
    t: "The control center gets tugged",
    x: "That tightening tugs on the nucleus, the part that holds the cell's master plans.",
    on: ["frame", "tug"],
  },
  {
    n: 6,
    c: "#C8871A",
    t: "Repair helpers get made",
    x: "The nucleus reads the tug as a signal to build repair helpers and  calm things down.",
    on: ["repair"],
  },
];

const CSS = `
@keyframes rbFlow { 0%{transform:translateX(0);opacity:1} 70%{opacity:1} 100%{transform:translateX(14px);opacity:0} }
.rb-flow circle { animation: rbFlow 1.4s linear infinite; }
@keyframes rbTighten { 0%,100% { transform: scale(1); } 50% { transform: scale(0.94); } }
.rb-tighten { transform-box: fill-box; transform-origin: center; animation: rbTighten 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .rb-flow circle { animation: none; } .rb-tighten { animation: none; } }
.rb-part { transition: opacity .5s ease; }
`;

function CellVibrationAnimation() {
  const [i, setI] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setTimeout(function advance() {
        setI((p) => (p + 1) % STEPS.length);
        timer = setTimeout(advance, 4600);
      }, 4600);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) start();
        else stop();
      },
      { threshold: 0.15 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      stop();
    };
  }, []);

  const step = STEPS[i]!;
  const dim = (id: PartId) => (step.on.includes(id) ? 1 : 0.16);

  return (
    <div ref={rootRef} className="mx-auto mt-14 max-w-3xl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div
        className="rounded-2xl border bg-card p-2"
        style={{ borderColor: "#E4DBF2" }}
      >
        <svg
          viewBox="0 0 680 340"
          className="w-full"
          role="img"
          aria-label="A cell responding to gentle vibration in six stages: sound waves press the cell, doors open, teal fuel flows in, the inner frame tightens, the nucleus is tugged, and gold repair helpers are made."
        >
          <g className="rb-part" opacity={dim("waves")}>
            <path
              d="M30 120Q46 155,30 190Q46 225,30 260"
              fill="none"
              stroke="#6C30A8"
              strokeWidth="3"
            />
            <path
              d="M48 120Q64 155,48 190Q64 225,48 260"
              fill="none"
              stroke="#8A54C4"
              strokeWidth="3"
              opacity=".7"
            />
            <path
              d="M66 120Q82 155,66 190Q82 225,66 260"
              fill="none"
              stroke="#8A54C4"
              strokeWidth="3"
              opacity=".45"
            />
          </g>

          <g className="rb-part" opacity={dim("squeeze")} fill="#6C30A8">
            <path d="M300 66l-7 14 14 0z" />
            <path d="M360 60l-7 14 14 0z" />
            <path d="M420 66l-7 14 14 0z" />
            <path d="M300 314l-7 -14 14 0z" />
            <path d="M360 320l-7 -14 14 0z" />
            <path d="M420 314l-7 -14 14 0z" />
          </g>

          <ellipse
            cx="360"
            cy="190"
            rx="250"
            ry="118"
            fill="#B9A6E0"
            fillOpacity=".22"
            stroke="#8A54C4"
            strokeWidth="2.5"
          />

          <g
            id="rb-frame"
            className={`rb-part${step.n === 4 ? " rb-tighten" : ""}`}
            opacity={dim("frame")}
          >
            <line x1="130" y1="190" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".7"/>
            <line x1="590" y1="190" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".7"/>
            <line x1="185" y1="120" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".65"/>
            <line x1="185" y1="260" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".65"/>
            <line x1="535" y1="120" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".65"/>
            <line x1="535" y1="260" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".65"/>
            <line x1="290" y1="80" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".6"/>
            <line x1="430" y1="80" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".6"/>
            <line x1="290" y1="300" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".6"/>
            <line x1="430" y1="300" x2="360" y2="190" stroke="#7A3CB0" strokeWidth="1.8" opacity=".6"/>
            <path d="M235 155 L300 110 L420 110 L485 155 L500 190 L485 225 L420 270 L300 270 L235 225 L220 190 Z" fill="none" stroke="#7A3CB0" strokeWidth="1.6" opacity=".55"/>
            <circle cx="130" cy="190" r="3.2" fill="#7A3CB0" opacity=".8"/>
            <circle cx="590" cy="190" r="3.2" fill="#7A3CB0" opacity=".8"/>
            <circle cx="185" cy="120" r="3" fill="#7A3CB0" opacity=".75"/>
            <circle cx="185" cy="260" r="3" fill="#7A3CB0" opacity=".75"/>
            <circle cx="535" cy="120" r="3" fill="#7A3CB0" opacity=".75"/>
            <circle cx="535" cy="260" r="3" fill="#7A3CB0" opacity=".75"/>
            <circle cx="290" cy="80" r="3" fill="#7A3CB0" opacity=".7"/>
            <circle cx="430" cy="80" r="3" fill="#7A3CB0" opacity=".7"/>
            <circle cx="290" cy="300" r="3" fill="#7A3CB0" opacity=".7"/>
            <circle cx="430" cy="300" r="3" fill="#7A3CB0" opacity=".7"/>
          </g>

          <g className="rb-part" opacity={dim("doors")}>
            <rect
              x="112"
              y="170"
              width="17"
              height="17"
              rx="4"
              fill="#9B6BD0"
              stroke="#5A2488"
              strokeWidth="1.5"
            />
            <rect
              x="112"
              y="193"
              width="17"
              height="17"
              rx="4"
              fill="#9B6BD0"
              stroke="#5A2488"
              strokeWidth="1.5"
            />
          </g>

          <g
            className={`rb-part${step.on.includes("fuel") ? " rb-flow" : ""}`}
            opacity={dim("fuel")}
          >
            <circle cx="150" cy="182" r="8" fill="#159B84" />
            <circle cx="186" cy="192" r="8" fill="#159B84" />
            <circle cx="220" cy="182" r="7" fill="#4FC2AC" />
          </g>

          <circle
            cx="360"
            cy="190"
            r="60"
            fill="#3B1E78"
            fillOpacity=".82"
            stroke="#1A0C54"
            strokeWidth="2.5"
          />
          <path d="M337 168Q360 180,383 168" fill="none" stroke="#C9B6ED" strokeWidth="2.5" />
          <path d="M337 190Q360 202,383 190" fill="none" stroke="#C9B6ED" strokeWidth="2.5" />
          <path d="M337 212Q360 224,383 212" fill="none" stroke="#C9B6ED" strokeWidth="2.5" />

          <g className="rb-part" opacity={dim("tug")}>
            <path
              d="M300 174l-14 -5M300 190l-16 0M300 206l-14 5"
              stroke="#5A2488"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          <g className="rb-part" opacity={dim("repair")}>
            <circle cx="470" cy="190" r="8" fill="#E0A030" />
            <circle cx="505" cy="175" r="8" fill="#E0A030" />
            <circle cx="505" cy="205" r="8" fill="#E0A030" />
            <circle cx="540" cy="190" r="8" fill="#F0C060" />
          </g>

          <text
            x="360"
            y="126"
            textAnchor="middle"
            fill="#5A2488"
            fontSize="13"
            fontWeight="500"
          >
            Nucleus
          </text>
          <text
            x="360"
            y="262"
            textAnchor="middle"
            fill="#3B1E78"
            fontSize="13"
            fontWeight="500"
          >
            Control center
          </text>
        </svg>
      </div>

      {/* progress dots */}
      <div className="mt-3.5 mb-3 flex items-center justify-center gap-[7px]">
        {STEPS.map((s, j) => (
          <button
            key={s.n}
            type="button"
            aria-label={`Step ${s.n}: ${s.t}`}
            onClick={() => setI(j)}
            className="h-[9px] w-[9px] rounded-full transition-all duration-300"
            style={{
              background: j === i ? "#6C30A8" : "#D4C9E8",
              transform: j === i ? "scale(1.4)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* caption */}
      <div
        className="flex min-h-[78px] items-start gap-3.5 rounded-2xl border px-4 py-3.5"
        style={{ background: "#F5F1FB", borderColor: "#E4DBF2" }}
      >
        <span
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-base font-medium text-white transition-colors duration-500"
          style={{ background: step.c }}
        >
          {step.n}
        </span>
        <div aria-live="polite">
          <h3 className="text-base font-medium tracking-tight">{step.t}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.x}</p>
        </div>
      </div>
    </div>
  );
}

export function CellularResponseSection() {
  return (
    <section
      id="cellular-response"
      className="scroll-mt-16 border-b"
      style={{ background: "var(--clinic-accent-tint)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--clinic-accent)" }}
          >
            The Cellular Response
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
            Vibroacoustic therapy .. a gentle wake-up call and a cellular workout.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Gentle vibrations give your cells a tiny wake-up call.
          </p>
        </div>

        <CellVibrationAnimation />
      </div>
    </section>
  );
}

