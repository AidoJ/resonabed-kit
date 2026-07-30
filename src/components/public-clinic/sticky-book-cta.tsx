import { useEffect, useState } from "react";

/**
 * Mobile-only persistent booking CTA. Scrolls to the booking form.
 * Appears once the hero CTA has scrolled out of view.
 */
export function StickyBookCta({ label = "Request a booking" }: { label?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur transition-transform motion-reduce:transition-none md:hidden " +
        (show ? "translate-y-0" : "translate-y-full")
      }
    >
      <a
        href="#request"
        className="flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: "var(--clinic-accent)",
          color: "var(--clinic-accent-fg)",
        }}
      >
        {label}
      </a>
    </div>
  );
}
