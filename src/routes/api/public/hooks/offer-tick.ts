/**
 * Cron endpoint: expires stale alternate-time offers and sends the ~13 hour
 * reminder. Idempotent — safe to call as often as you like.
 *
 * Authenticated with the project's anon key in the `apikey` header, matching
 * every other scheduled job here.
 */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/offer-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accepted = [
          process.env.SUPABASE_ANON_KEY,
          process.env.SUPABASE_PUBLISHABLE_KEY,
        ].filter((k): k is string => !!k)
        const provided = request.headers.get('apikey') ?? ''
        if (accepted.length === 0 || !accepted.includes(provided)) {
          return new Response('Unauthorized', { status: 401 })
        }


        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { tickOffers } = await import('@/lib/booking-offers.server')
        const result = await tickOffers(supabaseAdmin)
        return Response.json({ ok: true, ...result })
      },
    },
  },
})
