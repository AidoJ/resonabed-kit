import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listClientScreenings, getScreeningRecord } from "@/lib/screening.functions";

interface ChecklistSnapshotItem {
  key: string;
  label: string;
  clearable: boolean;
}

/**
 * Renders a historic screening exactly as it was signed, the snapshot stored
 * on the row, never today's wording.
 */
export function ClientScreeningHistory({ clientId }: { clientId: string }) {
  const listFn = useServerFn(listClientScreenings);
  const getFn = useServerFn(getScreeningRecord);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["client-screenings", clientId],
    queryFn: () => listFn({ data: { client_id: clientId } }),
  });

  const { data: record } = useQuery({
    queryKey: ["screening-record", openId],
    queryFn: () => getFn({ data: { id: openId! } }),
    enabled: !!openId,
  });

  const snapshot = (record?.checklist_snapshot ?? null) as {
    items?: ChecklistSnapshotItem[];
    attestation_text?: string;
  } | null;
  const labelOf = (key: string) =>
    snapshot?.items?.find((i) => i.key === key)?.label ?? key;

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <FileSignature className="h-4 w-4" /> Signed screenings
      </h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (rows ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No screenings recorded.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p>{new Date(r.created_at as string).toLocaleString()}</p>
                <p className="text-muted-foreground text-xs">
                  {r.response === "none_apply"
                    ? "Attested: none of the listed items apply"
                    : `Flagged: ${(r.flagged_items as string[]).join(", ")}`}{" "}
                  · {r.checklist_version as string}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.outcome === "cleared" ? "secondary" : "destructive"}>
                  {r.outcome as string}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setOpenId(r.id as string)}>
                  View record
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Screening record</DialogTitle>
            <DialogDescription>
              Reproduced verbatim from the signed record, {record?.checklist_version as string}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {record ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Clinic</p>
                  <p>{(record.org_name_snapshot as string) ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Answers</p>
                  {record.response === "none_apply" ? (
                    <p>Client attested that none of the listed items apply.</p>
                  ) : (
                    <ul className="list-disc pl-5">
                      {(record.flagged_items as string[]).map((f) => (
                        <li key={f}>
                          {labelOf(f)}
                          {(record.blocking_items as string[])?.includes(f)
                            ? ", blocking"
                            : ", cleared by letter on file"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {snapshot?.attestation_text ? (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Attestation
                    </p>
                    <p className="whitespace-pre-wrap">{snapshot.attestation_text}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Consent text as shown
                  </p>
                  <p className="whitespace-pre-wrap">
                    {(record.consent_text_snapshot as string) || "—"}
                  </p>
                </div>
                {record.health_text_snapshot ? (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Health &amp; safety as shown
                    </p>
                    <p className="whitespace-pre-wrap">{record.health_text_snapshot as string}</p>
                  </div>
                ) : null}
                {record.privacy_text_snapshot ? (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Privacy as shown
                    </p>
                    <p className="whitespace-pre-wrap">{record.privacy_text_snapshot as string}</p>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Client signature
                    </p>
                    <img
                      src={record.client_signature as string}
                      alt="Client signature"
                      className="mt-1 h-20 rounded border bg-white object-contain"
                    />
                    <p className="text-muted-foreground text-xs">
                      {new Date(record.client_signed_at as string).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Practitioner countersignature
                    </p>
                    <img
                      src={record.practitioner_signature as string}
                      alt="Practitioner signature"
                      className="mt-1 h-20 rounded border bg-white object-contain"
                    />
                    <p className="text-muted-foreground text-xs">
                      {new Date(record.practitioner_signed_at as string).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Loading…</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
