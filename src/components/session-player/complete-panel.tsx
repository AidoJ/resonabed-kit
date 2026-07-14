import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeSession, cancelSession } from "@/lib/sessions.functions";
import { toast } from "sonner";

type PayMethod = "cash" | "eftpos" | "payid" | "other" | "none";

interface Props {
  sessionId: string;
  defaultAmount: number;
  defaultNotes?: string | null;
}

export function CompletePanel({ sessionId, defaultAmount, defaultNotes }: Props) {
  const [method, setMethod] = useState<PayMethod>("cash");
  const [amount, setAmount] = useState<string>(defaultAmount.toFixed(2));
  const [notes, setNotes] = useState(defaultNotes ?? "");
  const [busy, setBusy] = useState<"complete" | "cancel" | null>(null);
  const completeFn = useServerFn(completeSession);
  const cancelFn = useServerFn(cancelSession);
  const navigate = useNavigate();

  const submitComplete = async () => {
    setBusy("complete");
    try {
      const numeric = method === "none" ? null : Number(amount);
      await completeFn({
        data: {
          id: sessionId,
          payment_method: method,
          payment_amount: numeric,
          practitioner_notes: notes,
        },
      });
      toast.success("Session completed");
      navigate({ to: "/sessions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete session");
    } finally {
      setBusy(null);
    }
  };

  const submitCancel = async () => {
    if (!confirm("Cancel this session?")) return;
    setBusy("cancel");
    try {
      await cancelFn({ data: { id: sessionId } });
      toast.success("Session cancelled");
      navigate({ to: "/sessions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel session");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="text-lg font-semibold">Complete session</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Payment method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="eftpos">EFTPOS</SelectItem>
              <SelectItem value="payid">PayID</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="none">No payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-12"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={method === "none"}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Practitioner notes (optional)</Label>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          className="h-12"
          onClick={submitCancel}
          disabled={busy !== null}
        >
          Cancel session
        </Button>
        <Button size="lg" className="h-12" onClick={submitComplete} disabled={busy !== null}>
          {busy === "complete" ? "Saving…" : "Complete session"}
        </Button>
      </div>
    </div>
  );
}
