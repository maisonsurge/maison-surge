"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { mergeGuestCartIntoUser } from "@/server/cart";
import { getClientIp, rateLimit } from "@/server/security";
import { getSessionUser } from "@/server/auth";
import { asLocale, getDictionary, localePath, type Locale } from "@/i18n";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { isSafeRelativePath } from "@/lib/utils";
import { publicEnv } from "@/lib/env";
import { makeAuthSchemas } from "./schemas";

function ctx(formData: FormData) {
  const locale = asLocale(formData.get("locale"));
  return { locale, t: getDictionary(locale) };
}

function safeNext(raw: FormDataEntryValue | null, locale: Locale, fallback: string): string {
  const next = typeof raw === "string" ? raw : "";
  return isSafeRelativePath(next) && !next.startsWith("/auth/") ? next : localePath(locale, fallback);
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, t } = ctx(formData);
  const parsed = makeAuthSchemas(t).signIn.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const ip = await getClientIp();
  if (!(await rateLimit("login", `${ip}:${parsed.data.email}`, 5, 300))) {
    return { ok: false, message: t.common.rateLimited };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { ok: false, message: t.auth.emailNotConfirmed };
    if (error?.status === 429 || error?.code === "over_request_rate_limit") return { ok: false, message: t.common.rateLimited };
    // Same message for unknown email / wrong password (no account enumeration).
    return { ok: false, message: t.auth.invalidCredentials };
  }

  try {
    await mergeGuestCartIntoUser(data.user.id);
  } catch (err) {
    console.error("[auth] cart merge failed", err instanceof Error ? err.message : "unknown");
  }
  redirect(safeNext(formData.get("next"), locale, "/account"));
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, t } = ctx(formData);
  const parsed = makeAuthSchemas(t).signUp.safeParse({
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
    marketingConsent: formData.get("marketingConsent") === "on",
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  if (String(formData.get("website") ?? "").length > 0) redirect(`${localePath(locale, "/auth/check-email")}`);

  const ip = await getClientIp();
  if (!(await rateLimit("signup", ip, 5, 3600))) return { ok: false, message: t.common.rateLimited };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(localePath(locale, "/account"))}`,
      data: {
        full_name: parsed.data.fullName,
        locale,
        // Applied to the profile once the address is verified (see applyPendingSignupConsent).
        marketing_consent: parsed.data.marketingConsent || null,
      },
    },
  });
  if (error) {
    if (error.status === 429 || error.code?.startsWith("over_")) return { ok: false, message: t.common.rateLimited };
    if (error.code === "weak_password") return { ok: false, errors: { password: [t.auth.passwordRules] } };
    // Any other error (incl. "user already registered") → same neutral outcome.
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      console.error("[auth] signUp error", error.code ?? error.status);
    }
  }
  redirect(localePath(locale, "/auth/check-email"));
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, t } = ctx(formData);
  const parsed = makeAuthSchemas(t).forgot.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const ip = await getClientIp();
  if (!(await rateLimit("forgot", `${ip}:${parsed.data.email}`, 3, 900))) return { ok: false, message: t.common.rateLimited };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(localePath(locale, "/auth/reset-password"))}`,
  });
  if (error && error.status !== 429) console.error("[auth] reset request error", error.code ?? error.status);
  return { ok: true, message: t.auth.resetSent };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, t } = ctx(formData);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: t.auth.linkInvalid };
  const parsed = makeAuthSchemas(t).reset.safeParse({
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password" || error.code === "same_password") return { ok: false, errors: { password: [t.auth.passwordRules] } };
    return { ok: false, message: t.common.error };
  }
  redirect(`${localePath(locale, "/account")}?updated=password`);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = asLocale(formData.get("locale"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(localePath(locale));
}
