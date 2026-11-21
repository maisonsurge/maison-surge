import "server-only";
import { createClient } from "@/server/supabase/server";

/**
 * Marketing consent given on the sign-up form is kept in user_metadata until
 * the e-mail address is verified, then copied to the profile exactly once
 * (with a timestamp) and removed from metadata. Called from /auth/confirm and
 * the account overview page. A later opt-out in the profile is never undone.
 */
export async function applyPendingSignupConsent(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || user.user_metadata?.marketing_consent !== true || !user.email_confirmed_at) return;
  const { data: profile } = await supabase.from("profiles").select("marketing_consent_at").eq("id", user.id).maybeSingle();
  if (profile && !profile.marketing_consent_at) {
    await supabase
      .from("profiles")
      .update({ marketing_consent: true, marketing_consent_at: new Date().toISOString() })
      .eq("id", user.id);
  }
  await supabase.auth.updateUser({ data: { marketing_consent: null } });
}
