/**
 * Server-only: redeem a kit access code into a perpetual home account.
 * Single-use is enforced by an atomic conditional update, so two concurrent
 * redemptions cannot both win.
 */

export type RedeemResult = { ok: true; email: string };

export class RedeemError extends Error {}

export async function redeemAccessCodeForAccount(args: {
  code: string;
  email: string;
  password: string;
  displayName?: string | null;
}): Promise<RedeemResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = args.code.trim().toUpperCase();
  const email = args.email.trim().toLowerCase();

  const { data: row, error } = await supabaseAdmin
    .from("kit_access_codes")
    .select("id, code, buyer_email, buyer_name, status")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new RedeemError("We could not check that code. Please try again.");
  if (!row) throw new RedeemError("That access code was not recognised. Check it and try again.");
  if (row.status === "revoked") {
    throw new RedeemError(
      "That access code has been replaced. Please use the newest code we emailed you.",
    );
  }
  if (row.status === "redeemed") {
    throw new RedeemError("That access code has already been used to create an account.");
  }
  if (row.buyer_email.trim().toLowerCase() !== email) {
    throw new RedeemError(
      "That email doesn't match the one on your order. Use the email your code was sent to, or contact us to have it corrected.",
    );
  }

  // Already a home account on this email? Point them at sign-in.
  const { data: existingHome } = await supabaseAdmin
    .from("home_accounts")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();
  if (existingHome) {
    throw new RedeemError("A home account already exists for this email. Please sign in instead.");
  }

  // Claim the code atomically. Only a row still in 'issued' can be taken.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("kit_access_codes")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (claimError) throw new RedeemError("We could not redeem that code. Please try again.");
  if (!claimed)
    throw new RedeemError("That access code has already been used to create an account.");

  const release = async () => {
    await supabaseAdmin
      .from("kit_access_codes")
      .update({ status: "issued", redeemed_at: null, redeemed_by: null })
      .eq("id", row.id);
  };

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: {
      display_name: args.displayName || row.buyer_name || null,
      account_kind: "home",
    },
  });

  if (createError || !created?.user) {
    await release();
    const msg = createError?.message ?? "";
    if (/already|registered|exists/i.test(msg)) {
      throw new RedeemError(
        "This email is already registered as a clinic account, please use a different email for your home account.",
      );
    }
    throw new RedeemError(msg || "We could not create your account. Please try again.");
  }

  const userId = created.user.id;

  const { error: linkError } = await supabaseAdmin.from("home_accounts").insert({
    user_id: userId,
    access_code_id: row.id,
    email,
    display_name: args.displayName || row.buyer_name || null,
  });
  if (linkError) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    await release();
    throw new RedeemError("We could not finish setting up your account. Please try again.");
  }

  await supabaseAdmin.from("kit_access_codes").update({ redeemed_by: userId }).eq("id", row.id);

  // Home accounts must never carry a clinic org.
  await supabaseAdmin.from("profiles").update({ org_id: null }).eq("id", userId);

  return { ok: true, email };
}
