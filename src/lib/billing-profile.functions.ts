import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BILLING_PROFILE_KEY = "kit_billing_profile";

const profileSchema = z.object({
  businessName: z.string().max(120).default("ResonaBed"),
  abn: z.string().max(40).default(""),
  address: z.string().max(200).default(""),
  email: z.string().max(120).default(""),
  bankName: z.string().max(80).default(""),
  bsb: z.string().max(20).default(""),
  accountNumber: z.string().max(30).default(""),
  accountName: z.string().max(80).default(""),
});

export type BillingProfileData = z.infer<typeof profileSchema>;

export const EMPTY_BILLING_PROFILE: BillingProfileData = {
  businessName: "ResonaBed",
  abn: "",
  address: "",
  email: "",
  bankName: "",
  bsb: "",
  accountNumber: "",
  accountName: "",
};

export const getBillingProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingProfileData> => {
    const { data } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", BILLING_PROFILE_KEY)
      .maybeSingle();
    if (!data?.value) return EMPTY_BILLING_PROFILE;
    try {
      return profileSchema.parse(JSON.parse(data.value as string));
    } catch {
      return EMPTY_BILLING_PROFILE;
    }
  });

export const saveBillingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Forbidden");
    const { error } = await context.supabase.from("app_settings").upsert(
      { key: BILLING_PROFILE_KEY, value: JSON.stringify(data), updated_by: context.userId },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
