import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardShellProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  stepLabels?: readonly string[];
}

export function WizardShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  footer,
  stepLabels,
}: WizardShellProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-[880px] flex-col">
      {/* Step indicator */}
      <ol className="mb-8 flex items-start justify-between gap-2 px-2" aria-label="Progress">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li
              key={i}
              className="flex flex-1 flex-col items-center gap-2"
              aria-current={current ? "step" : undefined}
            >
              <div className="relative flex w-full items-center">
                {/* left connector */}
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute right-1/2 top-1/2 h-px w-full -translate-y-1/2",
                      i <= step ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-medium transition-all",
                    done && "bg-primary text-primary-foreground",
                    current &&
                      "bg-card text-primary ring-2 ring-primary shadow-soft",
                    !done && !current && "bg-secondary/60 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
                </span>
              </div>
              {stepLabels?.[i] && (
                <span
                  className={cn(
                    "text-center text-[11px] font-medium uppercase tracking-[0.1em]",
                    current
                      ? "text-primary"
                      : done
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {stepLabels[i]}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="shadow-soft flex-1 rounded-2xl bg-card p-8 sm:p-10">
        <div className="mb-6">
          <h1 className="text-[26px] font-light tracking-tight text-primary">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div>{children}</div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">{footer}</div>
    </div>
  );
}
