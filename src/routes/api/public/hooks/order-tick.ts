/**
 * Cron endpoint for the deposit-first order lifecycle. Runs daily from pg_cron
 * (job `order-tick-daily`), the same mechanism as the booking offer sweep:
 *   - deletes abandoned drafts (checkout opened, deposit never paid)
 *   - expires orders still unpaid on the balance after the 30 day hold
 *   - sends the day 7 and day 25 balance nudges
 *   - runs the payment-plan arrears sweep: dunning ladder, arrears at day 10,
 *     the proportionate default gate at day 24, clinic wind-downs, and the
 *     card-expiry pre-warning
 *
 * Idempotent, safe to call as often as you like.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/order-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accepted = [
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
        ].filter((k): k is string => !!k);
        const provided = request.headers.get("apikey") ?? "";
        if (accepted.length === 0 || !accepted.includes(provided)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { tickOrders } = await import("@/lib/orders.server");
        const { tickPlanArrears } = await import("@/lib/plan-arrears.server");
        const result = await tickOrders();
        const arrears = await tickPlanArrears();
        return Response.json({ ok: true, ...result, arrears });
      },
    },
  },
});
