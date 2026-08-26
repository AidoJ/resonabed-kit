/**
 * The Cellular Response section for the public clinic page and marketing page.
 *
 * LIABILITY CONTROL: every word here is hardcoded template content. Nothing
 * may be sourced from an operator-editable field.
 */

import { useEffect, useState } from "react";

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
    c: "#159B84",
    t: "Repair helpers get made",
    x: "The nucleus reads the tug as a signal to build repair helpers and calm things down.",
    on: ["repair"],
  },
];

const CSS = `
@keyframes cellFlow { 0%{transform:translateX(0);opacity:1} 70%{opacity:1} 100%{transform:translateX(14px);opacity:0} }
.cell-flow circle { animation: cellFlow 1.4s linear infinite; }
@keyframes cellWave { 0%{opacity:.15;transform:translateX(-4px)} 50%{opacity:1;transform:translateX(0)} 100%{opacity:.15;transform:translateX(-4px)} }
.cell-wave path { animation: cellWave 1.8s ease-in-out infinite; }
@keyframes cellSqueeze { 0%,100%{transform:scale(1,1)} 50%{transform:scale(.955,1.045)} }
.cell-squeeze { animation: cellSqueeze 2.2s ease-in-out infinite; transform-origin: 200px 130px; }
@keyframes cellTug { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-6px)} }
.cell-tug { animation: cellTug 2.2s ease-in-out infinite; }
@keyframes cellRepair { 0%{r:2;opacity:.2} 50%{opacity:1} 100%{r:4.5;opacity:0} }
.cell-repair circle { animation: cellRepair 1.9s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cell-flow circle, .cell-wave path, .cell-squeeze, .cell-tug, .cell-repair circle { animation: none; }
}
.cell-part { transition: opacity .5s ease; }
`;

function CellVibrationAnimation() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[i]!;
  const dim = (id: PartId) => (step.on.includes(id) ? 1 : 0.16);

  return (
    <div className="mx-auto mt-14 max-w-3xl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="rounded-3xl border bg-card p-6 shadow-soft md:p-8">
        <svg
          viewBox="0 0 400 260"
          className="w-full"
          role="img"
          aria-label="Illustration of how a cell responds to low-frequency vibration"
        >
          {/* sound waves */}
          <g className="cell-part cell-wave" opacity={dim("waves")} stroke="#6C30A8" fill="none">
            <path d="M18 130 q14 -34 0 -68 M18 130 q14 34 0 68" strokeWidth="3" opacity=".5" />
            <path d="M38 130 q16 -28 0 -56 M38 130 q16 28 0 56" strokeWidth="3" opacity=".7" />
            <path d="M58 130 q18 -22 0 -44 M58 130 q18 22 0 44" strokeWidth="3" />
          </g>

          {/* cell body */}
          <g className={step.on.includes("squeeze") ? "cell-squeeze" : undefined}>
            <ellipse
              cx="200"
              cy="130"
              rx="118"
              ry="88"
              fill="#F3ECFA"
              stroke="#5A2488"
              strokeWidth="3"
            />

            {/* membrane doors */}
            <g className="cell-part" opacity={dim("doors")}>
              {[
                [96, 72],
                [88, 130],
                [96, 188],
                [304, 72],
                [312, 130],
                [304, 188],
              ].map(([x, y]) => (
                <g key={`${x}-${y}`}>
                  <rect
                    x={(x as number) - 7}
                    y={(y as number) - 9}
                    width="14"
                    height="18"
                    rx="4"
                    fill="#ffffff"
                    stroke="#159B84"
                    strokeWidth="2.5"
                  />
                  <line
                    x1={(x as number) - 7}
                    y1={(y as number) - 9}
                    x2={(x as number) + 7}
                    y2={(y as number) - 9}
                    stroke="#159B84"
                    strokeWidth="2.5"
                  />
                </g>
              ))}
            </g>

            {/* cytoskeleton frame */}
            <g
              className="cell-part"
              opacity={dim("frame")}
              stroke="#7A3CB0"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="104" y1="86" x2="184" y2="122" />
              <line x1="104" y1="176" x2="184" y2="142" />
              <line x1="296" y1="86" x2="220" y2="120" />
              <line x1="296" y1="176" x2="220" y2="144" />
              <line x1="200" y1="46" x2="200" y2="102" />
              <line x1="200" y1="214" x2="200" y2="160" />
            </g>

            {/* nucleus */}
            <g className={step.on.includes("tug") ? "cell-tug" : undefined}>
              <circle cx="200" cy="130" r="34" fill="#3B1E78" opacity=".92" />
              <circle cx="200" cy="130" r="14" fill="#8B5CD6" opacity=".85" />
              <text
                x="200"
                y="184"
                textAnchor="middle"
                fontSize="11"
                fill="#3B1E78"
                fontWeight="600"
              >
                Nucleus
              </text>
              <text x="200" y="198" textAnchor="middle" fontSize="9" fill="#6b6580">
                Control center
              </text>

              {/* repair proteins */}
              <g className="cell-part cell-repair" opacity={dim("repair")} fill="#159B84">
                <circle cx="168" cy="100" r="3" />
                <circle cx="236" cy="104" r="3" />
                <circle cx="170" cy="162" r="3" />
                <circle cx="234" cy="158" r="3" />
              </g>
            </g>

            {/* fuel entering */}
            <g className="cell-part cell-flow" opacity={dim("fuel")} fill="#159B84">
              <circle cx="104" cy="72" r="4" />
              <circle cx="98" cy="130" r="4" />
              <circle cx="104" cy="188" r="4" />
            </g>
          </g>
        </svg>
      </div>

      {/* progress dots */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {STEPS.map((s, j) => (
          <button
            key={s.n}
            type="button"
            aria-label={`Step ${s.n}: ${s.t}`}
            onClick={() => setI(j)}
            className="h-2 rounded-full transition-all"
            style={{
              width: j === i ? 28 : 8,
              background: j === i ? step.c : "color-mix(in oklab, #3B1E78 22%, #ffffff)",
            }}
          />
        ))}
      </div>

      {/* caption */}
      <div className="mt-6 flex items-start gap-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: step.c }}
        >
          {step.n}
        </span>
        <div aria-live="polite">
          <h3 className="text-base font-medium tracking-tight">{step.t}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.x}</p>
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
            Vibroacoustic therapy (VAT)... a gentle wake-up call and a cellular workout.
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
