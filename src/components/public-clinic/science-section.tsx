/**
 * Clinical credibility section for the public clinic page.
 *
 * LIABILITY CONTROL: every word here is hardcoded template content, identical
 * on every clinic page. Nothing in this file may be sourced from an
 * operator-editable field, and no operator-editable content may be rendered
 * inside or adjacent to this section — the hedged wording must never be
 * strengthened or amplified by an individual clinic.
 */

const BENEFITS = [
  "Reduced chronic musculoskeletal pain and fibromyalgia symptoms",
  "Lower stress and anxiety",
  "Improved sleep quality",
  "Reduced muscle tension and stiffness",
  "Enhanced comfort and quality of life for people living with chronic illness",
  "Promising outcomes in neurological rehabilitation, including Parkinson\u2019s disease and cerebral palsy",
];

const REFERENCES = [
  "Kantor J, Campbell EA, Kantorova L, et al. Exploring Vibroacoustic Therapy in Adults Experiencing Pain: A Scoping Review. BMJ Open. 2022;12.",
  "Punkanen M, Ala-Ruona E. Contemporary Vibroacoustic Therapy. Music and Medicine. 2012;4(3):128\u2013135.",
  "Campbell EA, Hynynen J, Burger B, et al. Exploring the Use of Vibroacoustic Treatment for Managing Chronic Pain and Comorbid Mood Disorders. Nordic Journal of Music Therapy. 2019;28(4):291\u2013314.",
];

export function ScienceSection() {
  return (
    <section
      id="science"
      className="border-y"
      style={{ background: "var(--clinic-tint-soft)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--clinic-accent)" }}
          >
            Backed by three decades of research
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">
            The science of vibroacoustic therapy
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Vibroacoustic therapy (VAT) combines specially designed low-frequency sound vibrations
            with calming music, delivered through a purpose-built table or chair, so you feel sound
            as gentle vibration while soothing music calms the mind.
          </p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-14">
          <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
            <p>
              VAT has been the subject of clinical research for more than three decades. It is not
              intended to replace conventional medical care, but growing evidence suggests it can be
              an effective complementary therapy for reducing stress, supporting pain management,
              improving sleep, and enhancing overall wellbeing.
            </p>
            <p>
              Research indicates low-frequency vibration may help regulate the autonomic nervous
              system, encouraging a shift from the body&rsquo;s fight-or-flight response toward the
              restorative rest-and-digest state &mdash; associated with reduced muscle tension,
              slower breathing, lower perceived stress, and improved relaxation.
            </p>
            <div
              className="rounded-2xl border p-6"
              style={{
                background: "var(--clinic-tint)",
                borderColor: "color-mix(in oklab, var(--clinic-accent) 25%, transparent)",
              }}
            >
              <p className="text-foreground">
                A 2022 <span className="italic">BMJ Open</span> scoping review of 20 clinical
                studies concluded that VAT shows considerable promise as a complementary
                intervention for pain management and rehabilitation, while highlighting the need for
                larger, high-quality clinical trials to strengthen the evidence base.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium tracking-tight">
              Clinical studies have reported benefits including
            </h3>
            <ul className="mt-5 space-y-3">
              {BENEFITS.map((b) => (
                <li
                  key={b}
                  className="flex gap-3 rounded-xl border px-5 py-4 text-sm leading-relaxed"
                  style={{ background: "var(--clinic-tint-soft)" }}
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--clinic-accent)" }}
                  />
                  <span className="text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-14 max-w-3xl text-center text-base leading-relaxed text-muted-foreground">
          Whether incorporated into massage therapy, physiotherapy, wellness programs,
          rehabilitation, or recovery, VAT offers a multisensory experience that supports body and
          mind. Many clients describe leaving a session feeling calmer, lighter, and deeply restored.
        </p>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
          Vibroacoustic therapy is intended to complement, not replace, professional medical care.
          Individual results may vary, and anyone with significant health concerns should consult
          their healthcare professional before commencing treatment.
        </p>

        <div className="mx-auto mt-12 max-w-3xl border-t pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Selected clinical references
          </p>
          <ul className="mt-3 space-y-1.5">
            {REFERENCES.map((r) => (
              <li key={r} className="text-xs leading-relaxed text-muted-foreground">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
