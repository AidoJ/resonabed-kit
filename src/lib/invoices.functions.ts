import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KitInvoice = {
  id: string;
  invoice_number: string;
  stripe_session_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  package_key: string;
  package_label: string;
  plan: string;
  currency: string;
  list_cents: number;
  discount_cents: number;
  shipping_cents: number;
  shipping_region: string | null;
  shipping_gst_inclusive: boolean;
  total_cents: number;
  gst_cents: number;
  payment_terms: string;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export type KitPayment = {
  id: string;
  receipt_number: string;
  invoice_id: string;
  amount_cents: number;
  gst_cents: number;
  method: string;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

/** GST is 1/11 of a GST-inclusive amount (Australia, 10%). */
export function gstOf(inclusiveCents: number) {
  return Math.round(inclusiveCents / 11);
}

async function assertSuper(context: any) {
  const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (!isSuper) throw new Error("Forbidden");
}

const invoiceInput = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().nullable(),
  customerPhone: z.string().max(40).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  shippingAddress: z.string().max(500).optional().nullable(),
  packageKey: z.string().min(1),
  packageLabel: z.string().min(1),
  plan: z.enum(["full", "installments"]).default("full"),
  listCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
  shippingCents: z.number().int().min(0).default(0),
  shippingRegion: z.string().max(60).optional().nullable(),
  shippingGstInclusive: z.boolean().default(true),
  paymentTerms: z.enum(["eft", "card"]).default("eft"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const listKitInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const sb = context.supabase as any;
    const [{ data: invoices, error: invErr }, { data: payments, error: payErr }] =
      await Promise.all([
        sb.from("kit_invoices").select("*").order("created_at", { ascending: false }),
        sb.from("kit_payments").select("*").order("paid_at", { ascending: false }),
      ]);
    if (invErr) throw new Error(invErr.message);
    if (payErr) throw new Error(payErr.message);
    return {
      invoices: (invoices ?? []) as KitInvoice[],
      payments: (payments ?? []) as KitPayment[],
    };
  });

export const createKitInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => invoiceInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const sb = context.supabase as any;

    const totalCents = Math.max(0, data.listCents - data.discountCents + data.shippingCents);
    const taxable = totalCents - (data.shippingGstInclusive ? 0 : data.shippingCents);
    const gstCents = gstOf(Math.max(0, taxable));

    const { data: numberRow, error: numErr } = await sb.rpc("next_kit_invoice_number");
    if (numErr) throw new Error(numErr.message);

    const { data: row, error } = await sb
      .from("kit_invoices")
      .insert({
        invoice_number: numberRow as string,
        customer_name: data.customerName,
        customer_email: data.customerEmail ?? null,
        customer_phone: data.customerPhone ?? null,
        billing_address: data.billingAddress ?? null,
        shipping_address: data.shippingAddress ?? null,
        package_key: data.packageKey,
        package_label: data.packageLabel,
        plan: data.plan,
        list_cents: data.listCents,
        discount_cents: data.discountCents,
        shipping_cents: data.shippingCents,
        shipping_region: data.shippingRegion ?? null,
        shipping_gst_inclusive: data.shippingGstInclusive,
        total_cents: totalCents,
        gst_cents: gstCents,
        payment_terms: data.paymentTerms,
        due_date: data.dueDate || null,
        notes: data.notes ?? null,
        status: "draft",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as KitInvoice;
  });

export const setKitInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "sent", "paid", "void"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const sb = context.supabase as any;
    const { data: invoice, error } = await sb
      .from("kit_invoices")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Marking an invoice paid by hand fulfils the order exactly like a card
    // payment does: personal buyers get their access code emailed, business
    // buyers land in the onboarding queue. Idempotent, so it is safe if a
    // payment was already recorded against this invoice.
    if (data.status === "paid" && invoice) {
      try {
        const { fulfilPaidInvoice } = await import("@/lib/invoice-fulfilment.server");
        return { ok: true, fulfilment: await fulfilPaidInvoice(invoice) };
      } catch (err) {
        console.error("fulfilPaidInvoice (status change) failed", err);
      }
    }
    return { ok: true };
  });


export const deleteKitInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const sb = context.supabase as any;
    const { error } = await sb.from("kit_invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordKitPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        invoiceId: z.string().uuid(),
        amountCents: z.number().int().min(1),
        method: z.enum(["eft", "card", "cash", "other"]).default("eft"),
        paidAt: z.string().min(4),
        reference: z.string().max(200).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const sb = context.supabase as any;

    const { data: invoice, error: invErr } = await sb
      .from("kit_invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .single();
    if (invErr) throw new Error(invErr.message);

    const { data: numberRow, error: numErr } = await sb.rpc("next_kit_receipt_number");
    if (numErr) throw new Error(numErr.message);

    const { data: row, error } = await sb
      .from("kit_payments")
      .insert({
        receipt_number: numberRow as string,
        invoice_id: data.invoiceId,
        amount_cents: data.amountCents,
        gst_cents: gstOf(data.amountCents),
        method: data.method,
        paid_at: data.paidAt,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Mark the invoice paid once payments cover the total.
    const { data: paid } = await sb
      .from("kit_payments")
      .select("amount_cents")
      .eq("invoice_id", data.invoiceId);
    const sum = (paid ?? []).reduce(
      (a: number, p: { amount_cents: number }) => a + p.amount_cents,
      0,
    );
    if (sum >= (invoice?.total_cents ?? 0) && invoice?.status !== "void") {
      await sb.from("kit_invoices").update({ status: "paid" }).eq("id", data.invoiceId);
      // A fully paid kit invoice follows the same fork as a card order:
      // business buyers go to the clinic onboarding queue, personal buyers get
      // their home-app access code.
      if (invoice?.customer_email) {
        if ((invoice.buyer_type as string | null) === "business") {
          const { recordOnboardingOrder } = await import("@/lib/onboarding.server");
          await recordOnboardingOrder({
            source: "eft",
            sourceRef: invoice.invoice_number as string,
            businessName: (invoice.business_name as string | null) ?? null,
            abn: (invoice.abn as string | null) ?? null,
            contactName: (invoice.customer_name as string | null) ?? null,
            contactEmail: invoice.customer_email as string,
            contactPhone: (invoice.customer_phone as string | null) ?? null,
            packageKey: (invoice.package_key as string | null) ?? null,
            plan: (invoice.plan as string | null) ?? null,
            shippingAddress: (invoice.shipping_address as string | null) ?? null,
            amountCents: (invoice.total_cents as number | null) ?? null,
            notes: `Invoice ${invoice.invoice_number} paid in full.`,
          }).catch((err) => console.error("recordOnboardingOrder (invoice) failed", err));
        } else {
          const { issueAccessCode } = await import("@/lib/home-access.server");
          await issueAccessCode({
            buyerEmail: invoice.customer_email as string,
            buyerName: (invoice.customer_name as string | null) ?? null,
            buyerPhone: (invoice.customer_phone as string | null) ?? null,
            packageKey: (invoice.package_key as string | null) ?? null,
            source: "eft",
            sourceRef: invoice.invoice_number as string,
            buyerType: "personal",
          }).catch((err) => console.error("issueAccessCode (invoice) failed", err));
        }
      }
    } else if (invoice?.status === "draft") {
      await sb.from("kit_invoices").update({ status: "sent" }).eq("id", data.invoiceId);
    }

    return row as KitPayment;
  });

export const deleteKitPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const sb = context.supabase as any;
    const { error } = await sb.from("kit_payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
