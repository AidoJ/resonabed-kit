import { SOLFEGGIO } from "@/components/public-clinic/clinic-content";

export function SolfeggioFrequenciesSection() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, var(--clinic-tint-soft, #f4eefb) 100%)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--clinic-accent, #702abb)" }}
          >
            The frequencies
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
            Tuned to how you feel
          </h2>
          <p className="mt-4 text-muted-foreground">
            Nine tones, each with its own character. Your practitioner chooses the one that suits
            how you&rsquo;re feeling on the day, so every session meets you where you are.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOLFEGGIO.map((f) => (
            <div
              key={f.hz}
              className="group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border bg-card p-6 pl-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg"
              style={{ borderColor: "rgba(124,62,186,.10)" }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[5px] transition-all duration-300 group-hover:w-2"
                style={{
                  background: `linear-gradient(180deg, ${f.toneA}, ${f.toneB})`,
                }}
              />
              <span
                aria-hidden
                className="relative mb-4 block h-11 w-11 shrink-0 rounded-full shadow-md"
                style={{
                  background: `radial-gradient(circle at 32% 30%, ${f.toneA}, ${f.toneB})`,
                  boxShadow: `0 4px 14px rgba(44,16,117,.18), inset 0 0 12px rgba(255,255,255,.35), 0 0 0 7px color-mix(in srgb, ${f.toneA} 14%, transparent)`,
                }}
              />
              <h3 className="text-lg font-medium tracking-tight">{f.label}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
              <p
                className="mt-4 text-xs font-semibold uppercase tracking-[0.12em]"
                style={{ color: "#1f8a8a" }}
              >
                {f.hz} · {f.tag}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-center text-muted-foreground">
          Not sure which one is right for you?{" "}
          <strong className="font-semibold" style={{ color: "var(--clinic-accent, #702abb)" }}>
            You don&rsquo;t need to be.
          </strong>{" "}
          Tell us how you&rsquo;re feeling at check-in, and we&rsquo;ll choose the tone for your
          session.
        </p>
      </div>
    </section>
  );
}
