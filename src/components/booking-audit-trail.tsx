import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History } from "lucide-react";
import { listBookingEvents } from "@/lib/booking-safety.functions";
import { DECLINE_REASON_LABELS, type DeclineReasonCode } from "@/lib/vetting-guide";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { formatInTz } from "@/lib/timezone";

const EVENT_LABELS: Record<string, string> = {
  request_received: "Request received through the public page",
  viewed: "Opened for review",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  blocked_attempt: "Blocked person attempted to book",
  blocked: "Person added to the block list",
  unblocked: "Person removed from the block list",
};

/**
 * Append-only history for a booking. Reason codes only — nothing a client
 * told the therapist in confidence appears here; that lives in protected
 * client notes.
 */
export function BookingAuditTrail({ bookingId }: { bookingId: string }) {
  const tz = useOrgTimezone();
  const listFn = useServerFn(listBookingEvents);
  const { data: events } = useQuery({
    queryKey: ["booking-events", bookingId],
    queryFn: () => listFn({ data: { booking_id: bookingId, limit: 100 } }),
  });

  if (!events || events.length === 0) return null;

  return (
    <div className="mt-6 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">History</p>
      </div>
      <ol className="mt-3 space-y-3">
        {events.map((e: any) => (
          <li key={e.id} className="border-l-2 border-muted pl-3 text-sm">
            <p className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
            <p className="text-xs text-muted-foreground">
              {formatInTz(e.created_at, tz, {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {e.actor_name ? ` · ${e.actor_name}` : ""}
            </p>
            {e.reason_code ? (
              <p className="text-xs text-muted-foreground">
                Reason:{" "}
                {DECLINE_REASON_LABELS[e.reason_code as DeclineReasonCode] ?? e.reason_code}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
