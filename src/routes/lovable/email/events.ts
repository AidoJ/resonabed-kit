import { createFileRoute } from '@tanstack/react-router'
import { createEmailWebhookHandler } from '@lovable.dev/email-js'

async function markRecipient(
  recipient: string,
  status: 'bounced' | 'complained' | 'unsubscribed' | 'valid',
) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const now = new Date().toISOString()
  const email = recipient.toLowerCase().trim()
  await Promise.all([
    supabaseAdmin
      .from('clients')
      .update({ email_status: status, email_status_updated_at: now })
      .ilike('email', email),
    supabaseAdmin
      .from('profiles')
      .update({ email_status: status, email_status_updated_at: now })
      .in(
        'id',
        (
          await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
        ).data.users
          .filter((u) => (u.email ?? '').toLowerCase() === email)
          .map((u) => u.id),
      ),
  ])
}

const handler = createEmailWebhookHandler({
  apiKey: process.env.LOVABLE_API_KEY!,
  on: {
    'email.bounced': async (event) => {
      await markRecipient(event.data.recipient, 'bounced')
    },
    'email.complaint': async (event) => {
      await markRecipient(event.data.recipient, 'complained')
    },
    'email.unsubscribed': async (event) => {
      await markRecipient(event.data.recipient, 'unsubscribed')
    },
    'email.resubscribed': async (event) => {
      await markRecipient(event.data.recipient, 'valid')
    },
  },
})

export const Route = createFileRoute('/lovable/email/events')({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
    },
  },
})
