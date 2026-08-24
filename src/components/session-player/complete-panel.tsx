import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { getCheckinSettings, getSessionCheckins } from "@/lib/checkins.functions";
import { CheckinPanel } from "@/components/checkin/checkin-panel";
import type { CheckinRow } from "@/lib/checkins";
import { toast } from "sonner";

type PayMethod = "cash" | "eftpos" | "payid" | "other" | "unpaid" | "comp";
const PAID_METHODS: PayMethod[] = ["cash", "eftpos", "payid", "other"];
const DEFERRED_METHODS: PayMethod[] = ["unpaid", "comp"];

interface Props {
  sessionId: string;
  defaultAmount: number;
  defaultNotes?: string | null;
}

export function CompletePanel({ sessionId, defaultAmount, defaultNotes }: Props) {
  const ctxFn = useServerFn(getCurrentUserContext);
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });

  // Post-session check-in (optional client self-rating).
  const checkinSettingsFn = useServerFn(getCheckinSettings);
  const checkinsFn = useServerFn(getSessionCheckins);
  const { data: checkinSettings } = useQuery({
    queryKey: ["checkin-settings"],
    queryFn: () => checkinSettingsFn(),
  });
  const { data: checkins, refetch: refetchCheckins } = useQuery({
    queryKey: ["session-checkins", sessionId],
    queryFn: () => checkinsFn({ data: { session_id: sessionId } }),
  });
  const afterCheckin =
    (checkins?.find((c) => c.phase === "after") as CheckinRow | undefined) ?? null;
  const [redoAfter, setRedoAfter] = useState(false);

  // A bare practitioner (no admin roles + not in support mode) is subject to
  // the org's "complete unpaid" toggle. Admins can always pick deferred outcomes.
  const roles = ctx?.roles ?? [];
  const isAdmin =
    roles.includes("super_admin") ||
    roles.includes("org_admin") ||
    !!ctx?.activeSupportSession;
  const canCompleteUnpaid = isAdmin || ctx?.permissions.completeUnpaid !== false;

  // Force a conscious choice: no default that silently closes the session.
  const [method, setMethod] = useState<PayMethod | "">("");
  const [amount, setAmount] = useState<string>(defaultAmount.toFixed(2));
  const [notes, setNotes] = useState(defaultNotes ?? "");
  const [busy, setBusy] = useState<"complete" | "cancel" | null>(null);
  const completeFn = useServerFn(completeSession);
  const cancelFn = useServerFn(cancelSession);
  const navigate = useNavigate();

  const isPaid = method !== "" && (PAID_METHODS as string[]).includes(method);
  const isDeferred = method !== "" && (DEFERRED_METHODS as string[]).includes(method);

  const validationError = useMemo(() => {
    if (method === "") return "Choose a payment outcome to complete the session.";
    if (isPaid) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return "Enter the amount collected.";
    }
    return null;
  }, [method, isPaid, amount]);

  const submitComplete = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy("complete");
    try {
      const numeric = isPaid ? Number(amount) : null;
      await completeFn({
        data: {
          id: sessionId,
          payment_method: method as PayMethod,
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
      {/* Post-session check-in (optional) */}
      {checkinSettings ? (
        afterCheckin && !redoAfter ? (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
            <span>Post-session check-in recorded.</span>
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => setRedoAfter(true)}
            >
              Redo
            </button>
          </div>
        ) : (
          <CheckinPanel
            sessionId={sessionId}
            phase="after"
            items={checkinSettings.items}
            existing={afterCheckin}
            onSaved={() => {
              setRedoAfter(false);
              refetchCheckins();
            }}
          />
        )
      ) : null}

      <h3 className="text-lg font-semibold">Complete session</h3>
      <p className="text-sm text-muted-foreground">
        A payment decision is required to complete every session. Record the
        payment or, if permitted, mark it as unpaid or comp.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Payment outcome</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select outcome…" />
            </SelectTrigger>
            <SelectContent className="z-[80]">
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="eftpos">EFTPOS</SelectItem>
              <SelectItem value="payid">PayID</SelectItem>
              <SelectItem value="other">Other paid method</SelectItem>
              <SelectItem value="unpaid" disabled={!canCompleteUnpaid}>
                Unpaid, to be collected
              </SelectItem>
              <SelectItem value="comp" disabled={!canCompleteUnpaid}>
                Comp / no charge
              </SelectItem>
            </SelectContent>
          </Select>
          {!canCompleteUnpaid && (
            <p className="text-xs text-muted-foreground">
              Your organisation requires a recorded payment to complete a
              session. Ask an admin to close a session as unpaid or comp.
            </p>
          )}
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
            disabled={!isPaid}
          />
          {isDeferred && (
            <p className="text-xs text-muted-foreground">
              {method === "unpaid"
                ? "Flagged as unpaid, visible to org admins for follow-up."
                : "Recorded as no charge (comp)."}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Practitioner notes (optional)</Label>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {validationError && method !== "" && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
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
        <Button
          size="lg"
          className="h-12"
          onClick={submitComplete}
          disabled={busy !== null || validationError !== null}
        >
          {busy === "complete" ? "Saving…" : "Complete session"}
        </Button>
      </div>
    </div>
  );
}
