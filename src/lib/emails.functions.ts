import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  orgName: z.string().min(1),
  orgId: z.string().uuid().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  tempPassword: z.string().min(8),
  isReset: z.boolean().optional().default(false),
});

const contactFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(100),
  email: z.string().trim().email({ message: "Please enter a valid email" }).max(255),
  phone: z.string().trim().min(6, { message: "Phone is required" }).max(50),
  message: z.string().trim().min(1, { message: "Message is required" }).max(2000),
  captchaToken: z.string().min(1),
  captchaAnswer: z.string().trim().min(1),
  // Honeypot: must stay empty; real users never see this field.
  website: z.string().max(0).optional().or(z.literal("")),
});


/**
 * Sends the admin/practitioner invite or password-reset email with the
 * temporary password. Callable by super_admin, or by an org_admin of the
 * supplied orgId. Best-effort: caller should not fail the whole flow if
 * email delivery errors out, the temp password is still shown in-app.
 */
export const sendAdminInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: superRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!superRole) {
      if (!data.orgId) throw new Error("Forbidden");
      const { data: adminRole } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("org_id", data.orgId)
        .eq("role", "org_admin")
        .maybeSingle();
      if (!adminRole) throw new Error("Forbidden");
    }

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const loginUrl = "https://resonabed.com";
    const result = await sendTemplateEmail("admin-invite", data.email, {
      templateData: {
        recipientName: data.recipientName ?? undefined,
        orgName: data.orgName,
        email: data.email,
        tempPassword: data.tempPassword,
        loginUrl,
        isReset: !!data.isReset,
      },
      replyTo: "info@resonabed.com",
      idempotencyKey: `admin-invite-${data.email}-${data.tempPassword.slice(0, 8)}`,
    });
    return { sent: result.sent, reason: "reason" in result ? result.reason : null };
  });

/**
 * Public: sends a contact form submission to the Resonabed inbox.
 * No authentication required.
 */
export const sendContactFormEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactFormSchema.parse(input))
  .handler(async ({ data }) => {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("contact-form", "info@resonabed.com", {
      templateData: {
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        message: data.message,
      },
      replyTo: data.email,
    });
    return { sent: result.sent, reason: "reason" in result ? result.reason : null };
  });
