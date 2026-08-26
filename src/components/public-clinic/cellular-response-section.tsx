/**
 * The Cellular Response section for the public clinic page and marketing page.
 *
 * LIABILITY CONTROL: every word here is hardcoded template content. Nothing
 * may be sourced from an operator-editable field.
 */

const CELLULAR_STEPS = [
  {
    title: "They feel the squeeze",
    body: "Cells are squishy, and low-frequency vibrations physically push and pull on them like a microscopic massage.",
  },
  {
    title: "They open their doors",
    body: "This physical stretching forces tiny gates on the cell's outer skin to snap open.",
  },
  {
    title: "They take a sip",
    body: "Nutrients and chemical signals—especially calcium—rush through these open doors to supercharge the cell.",
  },
  {
    title: "They stretch their internal spine",
    body: "The cell's internal skeleton reshapes itself to better handle the physical rhythm.",
  },
  {
    title: "They pull on the control center",
    body: "This stretching pulls directly on the cell's nucleus, which holds its DNA master plan.",
  },
  {
    title: "They change their instructions",
    body: "The nucleus reads this physical pulling as a command to build repair proteins and turn down inflammation.",
  },
];

export function CellularResponseSection() {
  return (
    <section
      id="cellular-response"
      className="scroll-mt-16 border-b"
      style={{ background: "var(--clinic-tint-soft)" }}
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
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CELLULAR_STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border p-6"
              style={{
                background: "var(--clinic-tint)",
                borderColor: "color-mix(in oklab, var(--clinic-accent) 25%, transparent)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    background: "var(--clinic-accent)",
                    color: "var(--clinic-accent-fg)",
                  }}
                >
                  {i + 1}
                </span>
                <h3 className="text-base font-medium tracking-tight">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
