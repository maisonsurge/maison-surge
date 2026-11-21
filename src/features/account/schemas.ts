import { z } from "zod";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { format } from "@/i18n";

/** Mirrors the CHECK constraints in supabase/migrations/20261121000300_customers.sql. */
export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
export const POSTAL_RE = /^[0-9]{5}$/;

const optionalText = (max: number, t: Dictionary) =>
  z
    .string()
    .trim()
    .max(max, { message: format(t.validation.max, { n: max }) })
    .transform((v) => (v === "" ? null : v));

const requiredText = (min: number, max: number, t: Dictionary) =>
  z
    .string()
    .trim()
    .min(min, { message: min <= 1 ? t.validation.required : format(t.validation.min, { n: min }) })
    .max(max, { message: format(t.validation.max, { n: max }) });

export function makeAccountSchemas(t: Dictionary) {
  const phone = z.string().trim().regex(PHONE_RE, { message: t.validation.phone });

  const profile = z.object({
    full_name: optionalText(120, t),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || PHONE_RE.test(v), { message: t.validation.phone })
      .transform((v) => (v === "" ? null : v)),
    preferred_locale: z.enum(["tr", "en"]),
    marketing_consent: z.boolean(),
  });

  const address = z.object({
    id: z.uuid().optional(),
    label: optionalText(40, t),
    full_name: requiredText(2, 120, t),
    phone,
    line1: requiredText(3, 200, t),
    line2: optionalText(200, t),
    district: requiredText(2, 80, t),
    city: requiredText(2, 80, t),
    postal_code: z
      .string()
      .trim()
      .refine((v) => v === "" || POSTAL_RE.test(v), { message: t.validation.postalCode })
      .transform((v) => (v === "" ? null : v)),
    is_default: z.boolean(),
  });

  return { profile, address };
}

export function addressFromForm(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? "");
  const id = s("id");
  return {
    ...(id ? { id } : {}),
    label: s("label"),
    full_name: s("full_name"),
    phone: s("phone"),
    line1: s("line1"),
    line2: s("line2"),
    district: s("district"),
    city: s("city"),
    postal_code: s("postal_code"),
    is_default: formData.get("is_default") === "on",
  };
}
