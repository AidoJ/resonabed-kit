import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WizardShellProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}

export function WizardShell({ step, totalSteps, title, subtitle, children, footer }: WizardShellProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="rounded-lg border bg-card p-6">{children}</div>
      <div className="mt-6 flex items-center justify-between gap-3">{footer}</div>
    </div>
  );
}
