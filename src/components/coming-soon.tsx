import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {children ?? "This section is part of a later phase."}
        </CardContent>
      </Card>
    </div>
  );
}
