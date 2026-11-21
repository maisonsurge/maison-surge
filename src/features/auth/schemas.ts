import { z } from "zod";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { format } from "@/i18n";

/** Pure validation schemas (no server imports) so they can be unit-tested. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt limit used by Supabase Auth

export function isStrongPassword(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX && /\p{L}/u.test(pw) && /\d/.test(pw);
}

export function makeAuthSchemas(t: Dictionary) {
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .max(254, { message: format(t.validation.max, { n: 254 }) })
    .pipe(z.email({ message: t.validation.email }));
  const password = z.string().refine(isStrongPassword, { message: t.auth.passwordRules });

  const signIn = z.object({
    email,
    password: z.string().min(1, { message: t.validation.required }).max(PASSWORD_MAX),
  });

  const signUp = z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, { message: format(t.validation.min, { n: 2 }) })
        .max(120, { message: format(t.validation.max, { n: 120 }) }),
      email,
      password,
      passwordConfirm: z.string(),
      marketingConsent: z.boolean(),
    })
    .refine((v) => v.password === v.passwordConfirm, { message: t.auth.passwordMismatch, path: ["passwordConfirm"] });

  const forgot = z.object({ email });

  const reset = z
    .object({ password, passwordConfirm: z.string() })
    .refine((v) => v.password === v.passwordConfirm, { message: t.auth.passwordMismatch, path: ["passwordConfirm"] });

  return { signIn, signUp, forgot, reset };
}
