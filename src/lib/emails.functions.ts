import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  orgName: z.string().min(1),
  recipientName: z.string().optional().nullable(),
  tempPassword: z.string().min(8),
  isReset: z.boolean().optional().default(false),
});

/**
 * Sends the admin invite / password-reset email with the temporary password.
 * Super-admin only. Best-effort: caller should not fail the whole flow if
 * email delivery errors out — the temp password is still shown in-app.
 */
export const sendAdminInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is super_admin.
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

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
