import { createFileRoute } from '@tanstack/react-router'
import { createEmailWebhookHandler } from '@lovable.dev/email-js'

async function findProfileIdsByEmail(email: string): Promise<string[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const matches: string[] = []
  const perPage = 200
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) break
    for (const u of data.users) {
      if ((u.email ?? '').toLowerCase() === email) matches.push(u.id)
    }
    if (data.users.length < perPage) break
  }
  return matches
}

async function markRecipient(
  recipient: string,
  status: 'bounced' | 'complained' | 'unsubscribed' | 'valid',
) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const now = new Date().toISOString()
  const email = recipient.toLowerCase().trim()
  const patch = { email_status: status, email_status_updated_at: now }

  await supabaseAdmin.from('clients').update(patch).ilike('email', email)

  const profileIds = await findProfileIdsByEmail(email)
  if (profileIds.length > 0) {
    await supabaseAdmin.from('profiles').update(patch).in('id', profileIds)
  }
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
