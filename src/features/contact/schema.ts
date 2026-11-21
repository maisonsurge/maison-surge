import { z } from "zod";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { format } from "@/i18n";

/** Mirrors contact_messages CHECK constraints (migration 0500). */
export function makeContactSchema(t: Dictionary) {
  const text = (min: number, max: number) =>
    z
      .string()
      .trim()
      .min(min, { message: format(t.validation.min, { n: min }) })
      .max(max, { message: format(t.validation.max, { n: max }) });
  return z.object({
    name: text(2, 120),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: t.validation.email })),
    subject: text(2, 160),
    order_number: z
      .string()
      .trim()
      .max(40, { message: format(t.validation.max, { n: 40 }) })
      .transform((v) => (v === "" ? null : v)),
    message: text(10, 5000),
  });
}
