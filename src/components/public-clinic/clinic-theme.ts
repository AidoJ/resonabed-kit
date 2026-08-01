/**
 * Per-clinic theming for the public page.
 *
 * Same colour roles and the same derivation the dashboard shell uses
 * (`app-shell.tsx`), but scoped to the page wrapper as inline CSS variables
 * instead of mutating `:root`, so it renders correctly during SSR, never
 * flashes, and never leaks into other routes.
 *
 * Contrast is guaranteed upstream: the settings page refuses to save a
 * sidebar/primary colour that fails the white-text contrast check. We trust
 * the saved values as-is and add no correction here.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

function lum(h: string) {
  const r = parseInt(h.slice(1, 3), 16),
    g = parseInt(h.slice(3, 5), 16),
    b = parseInt(h.slice(5, 7), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Identical to the shell's fgFor(). */
export function fgFor(h: string) {
  return lum(h) > 0.45 ? "#100a2e" : "#ffffff";
}

export function clinicThemeVars(
  themeSidebar: string | null | undefined,
  themePrimary: string | null | undefined,
): React.CSSProperties {
  const sidebar = themeSidebar && HEX.test(themeSidebar) ? themeSidebar : "#100a2e"; // brand-ink
  const primary = themePrimary && HEX.test(themePrimary) ? themePrimary : "#702abb"; // brand-violet-strong

  return {
    // Dominant surface: dark hero, dark band, footer.
    "--clinic-ink": sidebar,
    "--clinic-ink-fg": fgFor(sidebar),
    // Accent role: buttons, eyebrows, small accents.
    "--clinic-accent": primary,
    "--clinic-accent-fg": fgFor(primary),
    // Derived tints, same color-mix approach as --sidebar-accent in the shell.
    "--clinic-tint": `color-mix(in oklab, ${sidebar} 22%, transparent)`,
    "--clinic-tint-soft": `color-mix(in oklab, ${sidebar} 8%, transparent)`,
    "--clinic-accent-tint": `color-mix(in oklab, ${primary} 22%, transparent)`,
  } as React.CSSProperties;
}
