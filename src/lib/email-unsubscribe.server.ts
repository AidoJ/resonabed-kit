/**
 * Looks up which buyer emails have unsubscribed from Resonabed app emails.
 * An unsubscribe stops every app email to that address (order secured, balance
 * invoice, access code), and it can't be overridden from the app, so admin
 * screens show a warning instead. Server only. A failed lookup reads as
 * "not unsubscribed" so it never blocks the page.
 */
export async function loadUnsubscribedEmails(emails: string[]): Promise<Set<string>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const out = new Set<string>();
  if (!apiKey) return out;
  const { getEmailUnsubscribe } = await import("@lovable.dev/email-js");
  const { SENDER_DOMAIN } = await import("@/lib/email-templates/send-email");
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
  await Promise.all(
    unique.map(async (recipient) => {
      try {
        const res = await getEmailUnsubscribe({ recipient, domain: SENDER_DOMAIN }, { apiKey });
        if (res.subscribed === false) out.add(recipient);
      } catch (err) {
        console.error("Unsubscribe lookup failed", recipient, err);
      }
    }),
  );
  return out;
}
