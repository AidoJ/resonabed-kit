import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/sessions.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/sessions/$id")({
  head: () => ({ meta: [{ title: "Session summary — ResonaBed" }] }),
  component: SessionSummary,
});

function SessionSummary() {
  const { id } = Route.useParams();
  const fn = useServerFn(getSession);
  const { data: s, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading || !s) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const client = s.client as { first_name: string; last_name: string } | null;
  const service = s.service as { name: string; duration_minutes: number; price: number } | null;
  const freq = s.frequency as { hz: number; name: string; color: string | null } | null;

  if (s.status === "draft") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p>This session is still a draft.</p>
        <Button asChild>
          <Link to="/sessions/$id/play" params={{ id }}>Resume session</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {client ? `${client.first_name} ${client.last_name}` : "—"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(s.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">{s.status}</Badge>
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-6 text-sm">
        <Field label="Service" value={service?.name ?? "—"} />
        <Field label="Duration" value={service ? `${service.duration_minutes} min` : "—"} />
        <Field
          label="Frequency"
          value={freq ? `${freq.hz} Hz · ${freq.name}` : "—"}
        />
        <Field label="Payment" value={`${s.payment_method}${s.payment_amount != null ? ` · $${Number(s.payment_amount).toFixed(2)}` : ""}`} />
        <Field label="Pain" value={String(s.pain_level ?? "—")} />
        <Field label="Stress" value={String(s.stress_level ?? "—")} />
        <Field label="Sleep" value={String(s.sleep_quality ?? "—")} />
        <Field label="Body areas" value={(s.body_areas ?? []).join(", ") || "—"} />
        <Field label="Goals" value={(s.primary_goals ?? []).join(", ") || "—"} />
        <Field label="Contraindications" value={(s.contraindications ?? []).join(", ") || "None"} />
      </dl>

      {s.practitioner_notes ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="whitespace-pre-wrap text-sm">{s.practitioner_notes}</p>
        </div>
      ) : null}

      <Button asChild variant="outline">
        <Link to="/sessions">Back to sessions</Link>
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
