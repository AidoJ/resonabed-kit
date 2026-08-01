/**
 * Server-only helpers for BUSINESS (clinic) kit orders.
 *
 * A paid business order never auto-provisions a clinic. It lands in the
 * super-admin onboarding queue, where a human sets the slug, ABN and, above
 * all, the clinic type (home-based vs retail) before the org is created.
 * Clinic type drives the whole address-privacy behaviour, so it is never
 * guessed from checkout details.
 */

export type RecordOnboardingOrderInput = {
  /** 'stripe' | 'eft' | 'manual' */
  source: string;
  /** Stripe checkout session id or invoice number. Used for idempotency. */
  sourceRef?: string | null;
  businessName?: string | null;
  abn?: string | null;
  contactName?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  packageKey?: string | null;
  plan?: string | null;
  shippingAddress?: string | null;
  amountCents?: number | null;
  notes?: string | null;
};

export type RecordedOnboardingOrder = {
  id: string;
  alreadyExisted: boolean;
};

/**
 * Records a paid business order in the clinic onboarding queue, idempotently
 * on (source, source_ref), and emails the buyer a "being set up" note so the
 * deliberate provisioning delay never reads as a failed purchase.
 */
export async function recordOnboardingOrder(
  input: RecordOnboardingOrderInput,
): Promise<RecordedOnboardingOrder> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = input.contactEmail.trim().toLowerCase();

  if (input.sourceRef) {
    const { data: existing } = await supabaseAdmin
      .from("kit_onboarding_orders")
      .select("id")
      .eq("source", input.source)
      .eq("source_ref", input.sourceRef)
      .maybeSingle();
    if (existing) return { id: existing.id, alreadyExisted: true };
  }

  const { data, error } = await supabaseAdmin
    .from("kit_onboarding_orders")
    .insert({
      source: input.source,
      source_ref: input.sourceRef ?? null,
      business_name: input.businessName ?? null,
      abn: input.abn ?? null,
      contact_name: input.contactName ?? null,
      contact_email: email,
      contact_phone: input.contactPhone ?? null,
      package_key: input.packageKey ?? null,
      plan: input.plan ?? null,
      shipping_address: input.shippingAddress ?? null,
      amount_cents: input.amountCents ?? null,
      notes: input.notes ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // 23505 means a concurrent write already queued this order.
    if (error.code === "23505" && input.sourceRef) {
      const { data: raced } = await supabaseAdmin
        .from("kit_onboarding_orders")
        .select("id")
        .eq("source", input.source)
        .eq("source_ref", input.sourceRef)
        .maybeSingle();
      if (raced) return { id: raced.id, alreadyExisted: true };
    }
    throw new Error(`Could not queue the clinic order: ${error.message}`);
  }

  await sendClinicOrderReceivedEmail({
    to: email,
    name: input.contactName ?? null,
    businessName: input.businessName ?? null,
    reference: input.sourceRef ?? null,
  });

  return { id: data.id, alreadyExisted: false };
}

export async function sendClinicOrderReceivedEmail(args: {
  to: string;
  name?: string | null;
  businessName?: string | null;
  reference?: string | null;
}): Promise<{ sent: boolean }> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("clinic-order-received", args.to, {
      templateData: {
        recipientName: args.name ?? undefined,
        businessName: args.businessName ?? undefined,
      },
      replyTo: "info@resonabed.com",
      idempotencyKey: `clinic-order-received-${args.reference ?? args.to}`,
    });
    return { sent: result.sent };
  } catch (err) {
    // Delivery problems must never block the order being queued.
    console.error("sendClinicOrderReceivedEmail failed", err);
    return { sent: false };
  }
}
