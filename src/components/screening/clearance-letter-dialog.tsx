import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Ban, Upload, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  recordClearanceLetter,
  revokeClearanceLetter,
  getClearanceLetterUrl,
} from "@/lib/screening.functions";
import { isClearableItem, screeningItemLabel } from "@/lib/screening-checklist";

export interface ClearanceLetter {
  id: string;
  item_key: string;
  issuer_name: string;
  issued_on: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  orgId: string;
  itemKey: string;
  letters: ClearanceLetter[];
  onChanged: () => void;
}

/**
 * Doctor's clearance letters are append-only. A mistaken entry is neutralised
 * with a revocation carrying a reason, never edited or deleted.
 */
export function ClearanceLetterDialog({
  open,
  onOpenChange,
  clientId,
  orgId,
  itemKey,
  letters,
  onChanged,
}: Props) {
  const recordFn = useServerFn(recordClearanceLetter);
  const revokeFn = useServerFn(revokeClearanceLetter);
  const urlFn = useServerFn(getClearanceLetterUrl);
  const qc = useQueryClient();

  const [issuer, setIssuer] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const clearable = isClearableItem(itemKey);
  const forItem = letters.filter((l) => l.item_key === itemKey);

  const save = useMutation({
    mutationFn: async () => {
      let filePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
        filePath = `${orgId}/${clientId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("clearance-letters")
          .upload(filePath, file, { upsert: false });
        if (error) throw new Error(error.message);
      }
      return recordFn({
        data: {
          client_id: clientId,
          item_key: itemKey,
          issuer_name: issuer.trim(),
          issued_on: issuedOn || null,
          file_path: filePath,
          notes: notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Clearance letter recorded");
      setIssuer("");
      setIssuedOn("");
      setNotes("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["screening-context"] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (letterId: string) =>
      revokeFn({ data: { letter_id: letterId, reason: reason.trim() } }),
    onSuccess: () => {
      toast.success("Letter revoked, the trail is preserved");
      setRevokingId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["screening-context"] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openFile = async (id: string) => {
    try {
      const { url } = await urlFn({ data: { letter_id: id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Doctor's clearance, {screeningItemLabel(itemKey)}</DialogTitle>
          <DialogDescription>
            {clearable
              ? "A letter on file clears this item indefinitely until it is revoked."
              : "This item can never be cleared by a letter. It is re-screened every session and always blocks."}
          </DialogDescription>
        </DialogHeader>

        {forItem.length > 0 && (
          <div className="space-y-2">
            <Label>Letters on file</Label>
            {forItem.map((l) => (
              <div key={l.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{l.issuer_name}</p>
                    <p className="text-muted-foreground text-xs">
                      Recorded {new Date(l.created_at).toLocaleDateString()}
                      {l.issued_on ? ` · issued ${l.issued_on}` : ""}
                    </p>
                    {l.notes && <p className="mt-1 text-xs">{l.notes}</p>}
                    {l.revoked_at && (
                      <p className="mt-1 text-xs text-destructive">
                        Revoked {new Date(l.revoked_at).toLocaleDateString()}, {l.revoked_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {l.revoked_at ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                    {l.file_path && (
                      <Button size="sm" variant="ghost" onClick={() => openFile(l.id)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {!l.revoked_at && (
                      <Button size="sm" variant="ghost" onClick={() => setRevokingId(l.id)}>
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {revokingId === l.id && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <Label className="text-xs">Reason for revoking (required)</Label>
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Entered against the wrong client"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={reason.trim().length < 5 || revoke.isPending}
                        onClick={() => revoke.mutate(l.id)}
                      >
                        Revoke letter
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevokingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {clearable && (
          <div className="space-y-3 border-t pt-4">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Record a new letter
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">Issuing doctor / clinic</Label>
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Date issued</Label>
                <Input
                  type="date"
                  value={issuedOn}
                  onChange={(e) => setIssuedOn(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Scan / photo (optional)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              disabled={issuer.trim().length < 2 || save.isPending}
              onClick={() => save.mutate()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {save.isPending ? "Saving…" : "Record letter"}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
