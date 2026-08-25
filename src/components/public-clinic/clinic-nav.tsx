import { useState } from "react";
import { Menu, X } from "lucide-react";

export type ClinicNavItem = { label: string; href: string };

/**
 * Sticky section nav for the public clinic page. Sits under the logo band and
 * sticks to the top while scrolling. Desktop shows inline links; mobile shows
 * a hamburger that expands a full-width panel of large tap targets.
 *
 * Rendered inside the themed <main> so the clinic CSS vars are in scope.
 */
export function ClinicNav({ items }: { items: ClinicNavItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75"
      style={{ borderColor: "color-mix(in oklab, var(--clinic-ink) 10%, transparent)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 md:px-10">
        <span
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: "color-mix(in oklab, var(--clinic-ink) 55%, transparent)" }}
        >
          Menu
        </span>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              style={{ color: "color-mix(in oklab, var(--clinic-ink) 80%, transparent)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--clinic-accent)";
                e.currentTarget.style.background =
                  "color-mix(in oklab, var(--clinic-accent) 10%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color =
                  "color-mix(in oklab, var(--clinic-ink) 80%, transparent)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full md:hidden"
          style={{ color: "var(--clinic-ink)" }}
          aria-expanded={open}
          aria-controls="clinic-nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      {open ? (
        <div
          id="clinic-nav-panel"
          className="border-t md:hidden"
          style={{ borderColor: "color-mix(in oklab, var(--clinic-ink) 10%, transparent)" }}
        >
          <div className="mx-auto flex max-w-7xl flex-col px-6 py-2">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-b py-4 text-base font-medium last:border-b-0"
                style={{
                  color: "var(--clinic-ink)",
                  borderColor: "color-mix(in oklab, var(--clinic-ink) 8%, transparent)",
                }}
              >
                {item.label}
                <span aria-hidden style={{ color: "var(--clinic-accent)" }}>
                  →
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
