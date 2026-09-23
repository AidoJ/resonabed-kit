import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value.length === 0 || value.length >= 6, {
    message: "Please enter a valid phone number or leave it blank.",
  });

const demoEnquirySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Your name is required.").max(100),
  email: z.string().trim().email("Please enter a valid email address.").max(254),
  practice: z.string().trim().min(1, "Practice name is required.").max(150),
  suburb: z.string().trim().min(1, "Suburb or city is required.").max(100),
  phone: optionalPhone,
  website: z.string().max(0).optional().or(z.literal("")),
  captchaToken: z.string().min(1).max(500),
  captchaAnswer: z.string().trim().min(1).max(10),
  source: z.string().trim().max(200).optional().default(""),
  medium: z.string().trim().max(200).optional().default(""),
  campaign: z.string().trim().max(200).optional().default(""),
  content: z.string().trim().max(200).optional().default(""),
});

export const getDemoCaptcha = createServerFn({ method: "GET" }).handler(async () => {
  const { issueChallenge } = await import("@/lib/contact-captcha.server");
  return issueChallenge();
});

export const submitDemoEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => demoEnquirySchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Your enquiry could not be sent. Please try again.");

    const { verifyChallenge } = await import("@/lib/contact-captcha.server");
    const verdict = verifyChallenge(data.captchaToken, data.captchaAnswer);
    if (!verdict.ok) {
      throw new Error(
        verdict.reason === "expired"
          ? "The security check expired. Please try the new question."
          : "The security check answer was incorrect. Please try again.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedEmail = data.email.toLowerCase();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("demo_enquiries")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .gte("created_at", since);
    if (countError) throw new Error("Your enquiry could not be saved. Please try again.");
    if ((count ?? 0) >= 3) {
      throw new Error("We already have your recent requests. Please allow us time to respond.");
    }

    const reference = `RB-${data.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const row = {
      id: data.id,
      reference,
      name: data.name,
      email: normalizedEmail,
      practice: data.practice,
      suburb: data.suburb,
      phone: data.phone || null,
      utm_source: data.source,
      utm_medium: data.medium,
      utm_campaign: data.campaign,
      utm_content: data.content,
    };

    const { error: insertError } = await supabaseAdmin.from("demo_enquiries").insert(row);
    if (insertError?.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("demo_enquiries")
        .select("reference, email")
        .eq("id", data.id)
        .maybeSingle();
      if (existing?.email === normalizedEmail) return { saved: true as const, reference: existing.reference };
      throw new Error("Your enquiry could not be saved. Please try again.");
    }
    if (insertError) throw new Error("Your enquiry could not be saved. Please try again.");

    const attribution = [data.source, data.medium, data.campaign, data.content]
      .filter(Boolean)
      .join(" / ");
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const sent = await sendTemplateEmail("demo-enquiry", "info@resonabed.com", {
        templateData: {
          reference,
          name: data.name,
          email: normalizedEmail,
          practice: data.practice,
          suburb: data.suburb,
          phone: data.phone || undefined,
          attribution: attribution || undefined,
        },
        replyTo: normalizedEmail,
        idempotencyKey: `demo-enquiry-${data.id}`,
      });
      await supabaseAdmin
        .from("demo_enquiries")
        .update({ notification_status: sent.sent ? "sent" : "suppressed" })
        .eq("id", data.id);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Notification failed";
      await supabaseAdmin
        .from("demo_enquiries")
        .update({ notification_status: "failed", notification_error: message })
        .eq("id", data.id);
      console.error("Demo enquiry notification failed", { reference, message });
    }

    return { saved: true as const, reference };
  });
