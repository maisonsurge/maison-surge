"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { getSessionUser } from "@/server/auth";
import { asLocale, getDictionary, localePath } from "@/i18n";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { addressFromForm, makeAccountSchemas } from "./schemas";

function ctx(formData: FormData) {
  const locale = asLocale(formData.get("locale"));
  return { locale, t: getDictionary(locale) };
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, t } = ctx(formData);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: t.auth.loginRequired };
  const parsed = makeAccountSchemas(t).profile.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    preferred_locale: String(formData.get("preferred_locale") ?? locale),
    marketing_consent: formData.get("marketing_consent") === "on",
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("marketing_consent").eq("id", user.id).maybeSingle();
  const consentChanged = (current?.marketing_consent ?? false) !== parsed.data.marketing_consent;
  const { error } = await supabase
    .from("profiles")
    .update({
      ...parsed.data,
      // Timestamp of the latest consent decision (opt-in or opt-out).
      ...(consentChanged ? { marketing_consent_at: new Date().toISOString() } : {}),
    })
    .eq("id", user.id);
  if (error) return { ok: false, message: t.common.error };
  revalidatePath(localePath(locale, "/account"));
  return { ok: true, message: t.account.profileSaved };
}

export async function saveAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, t } = ctx(formData);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: t.auth.loginRequired };
  const parsed = makeAccountSchemas(t).address.safeParse(addressFromForm(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  // Only one default per user (partial unique index) → clear the others first.
  if (values.is_default) {
    let q = supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
    if (id) q = q.neq("id", id);
    await q;
  }

  const { error } = id
    ? await supabase.from("addresses").update(values).eq("id", id).eq("user_id", user.id)
    : await supabase.from("addresses").insert({ ...values, user_id: user.id });
  if (error) return { ok: false, message: t.common.error };
  revalidatePath(localePath(locale, "/account/addresses"));
  return { ok: true, message: t.account.addressSaved };
}

const idSchema = z.uuid();

export async function deleteAddressAction(addressId: string, localeRaw: string): Promise<ActionState> {
  const t = getDictionary(asLocale(localeRaw));
  const user = await getSessionUser();
  if (!user || !idSchema.safeParse(addressId).success) return { ok: false, message: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", addressId).eq("user_id", user.id);
  if (error) return { ok: false, message: t.common.error };
  revalidatePath(localePath(asLocale(localeRaw), "/account/addresses"));
  return { ok: true, message: t.account.addressDeleted };
}

export async function setDefaultAddressAction(addressId: string, localeRaw: string): Promise<ActionState> {
  const t = getDictionary(asLocale(localeRaw));
  const user = await getSessionUser();
  if (!user || !idSchema.safeParse(addressId).success) return { ok: false, message: t.common.error };
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", addressId).eq("user_id", user.id);
  if (error) return { ok: false, message: t.common.error };
  revalidatePath(localePath(asLocale(localeRaw), "/account/addresses"));
  return { ok: true, message: t.account.addressSaved };
}
