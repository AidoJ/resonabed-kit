/**
 * Server-only helpers for home-user kit access codes.
 *
 * A code is issued by the payment path (Stripe webhook, or the EFT/manual
 * invoice path), emailed to the buyer, and redeemed exactly once to create a
 * perpetual personal account. Nothing here touches clinic or health data.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

function randomBlock(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function generateAccessCode(): string {
  return `RB-${randomBlock(4)}-${randomBlock(4)}`;
}

export type IssueCodeInput = {
  buyerEmail: string;
  buyerPhone?: string | null;
  buyerName?: string | null;
  packageKey?: string | null;
  /** 'stripe' | 'eft' | 'manual' */
  source: string;
  /** Stripe checkout session id, or invoice number. Used for idempotency. */
  sourceRef?: string | null;
  /** 'personal' | 'business'. Business buyers only get a code on request. */
  buyerType?: string | null;
};

export type IssuedCode = {
  id: string;
  code: string;
  buyerEmail: string;
  alreadyExisted: boolean;
};

/**
 * Issues a code for an order, idempotently. If a live (issued or redeemed)
 * code already exists for this source reference, it is returned untouched and
 * no second email goes out.
 */
export async function issueAccessCode(input: IssueCodeInput): Promise<IssuedCode> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = input.buyerEmail.trim().toLowerCase();

  if (input.sourceRef) {
    const { data: existing } = await supabaseAdmin
      .from("kit_access_codes")
      .select("id, code, buyer_email")
      .eq("source", input.source)
      .eq("source_ref", input.sourceRef)
      .in("status", ["issued", "redeemed"])
      .maybeSingle();
    if (existing) {
      return {
        id: existing.id,
        code: existing.code,
        buyerEmail: existing.buyer_email,
        alreadyExisted: true,
      };
    }
  }

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode();
    const { data, error } = await supabaseAdmin
      .from("kit_access_codes")
      .insert({
        code,
        buyer_email: email,
        buyer_phone: input.buyerPhone ?? null,
        buyer_name: input.buyerName ?? null,
        package_key: input.packageKey ?? null,
        source: input.source,
        source_ref: input.sourceRef ?? null,
        buyer_type: input.buyerType ?? "personal",
        status: "issued",
      })
      .select("id, code, buyer_email")
      .single();

    if (!error && data) {
      await sendAccessCodeEmail({
        to: data.buyer_email,
        code: data.code,
        name: input.buyerName ?? null,
        isResend: false,
      });
      return { id: data.id, code: data.code, buyerEmail: data.buyer_email, alreadyExisted: false };
    }

    // 23505 on the source_ref index means a concurrent issue won the race.
    if (error?.code === "23505" && input.sourceRef) {
      const { data: raced } = await supabaseAdmin
        .from("kit_access_codes")
        .select("id, code, buyer_email")
        .eq("source", input.source)
        .eq("source_ref", input.sourceRef)
        .in("status", ["issued", "redeemed"])
        .maybeSingle();
      if (raced) {
        return {
          id: raced.id,
          code: raced.code,
          buyerEmail: raced.buyer_email,
          alreadyExisted: true,
        };
      }
    }
    lastError = error?.message ?? "unknown error";
  }
  throw new Error(`Could not issue an access code: ${lastError}`);
}

export async function sendAccessCodeEmail(args: {
  to: string;
  code: string;
  name?: string | null;
  isResend: boolean;
}): Promise<{ sent: boolean }> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("home-access-code", args.to, {
      templateData: {
        recipientName: args.name ?? undefined,
        code: args.code,
        signupUrl: "https://resonabed.com/home/signup",
        isResend: args.isResend,
      },
      replyTo: "info@resonabed.com",
      idempotencyKey: `home-access-code-${args.code}`,
    });
    return { sent: result.sent };
  } catch (err) {
    // Delivery problems must never lose the code: it is stored and a platform
    // admin can resend it from Kit sales, Access codes.
    console.error("sendAccessCodeEmail failed", err);
    return { sent: false };
  }
}
