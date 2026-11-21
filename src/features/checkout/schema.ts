import { z } from "zod";
import type { Dictionary } from "@/i18n";

/** Mirrors the CHECK constraints in public.addresses / public.orders. */
export function addressSchema(t: Dictionary) {
  return z.object({
    full_name: z.string().trim().min(2, t.validation.required).max(120, t.validation.invalid),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, t.validation.phone),
    line1: z.string().trim().min(3, t.validation.required).max(200, t.validation.invalid),
    line2: z.string().trim().max(200, t.validation.invalid).optional().transform((v) => v || null),
    district: z.string().trim().min(2, t.validation.required).max(80, t.validation.invalid),
    city: z.string().trim().min(2, t.validation.required).max(80, t.validation.invalid),
    postal_code: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || /^[0-9]{5}$/.test(v), t.validation.postalCode),
    country: z.literal("TR").default("TR"),
  });
}

export type AddressInput = z.infer<ReturnType<typeof addressSchema>>;

export function checkoutSchema(t: Dictionary) {
  const address = addressSchema(t);
  return z
    .object({
      idempotency_key: z.uuid(),
      email: z.email(t.validation.email).max(254).transform((v) => v.toLowerCase()),
      phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, t.validation.phone),
      shipping: address,
      billing_same: z.boolean(),
      billing: address.optional(),
      billing_type: z.enum(["individual", "corporate"]),
      company_name: z.string().trim().max(160).optional(),
      tax_office: z.string().trim().max(80).optional(),
      tax_number: z.string().trim().optional(),
      shipping_method_id: z.uuid(t.validation.required),
      customer_note: z.string().trim().max(500, t.validation.invalid).optional(),
      terms: z.literal(true, { error: t.checkout.termsRequired }),
      save_address: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!v.billing_same && !v.billing) ctx.addIssue({ code: "custom", path: ["billing", "full_name"], message: t.validation.required });
      if (v.billing_type === "corporate") {
        if (!v.company_name || v.company_name.length < 2) ctx.addIssue({ code: "custom", path: ["company_name"], message: t.validation.required });
        if (!v.tax_office || v.tax_office.length < 2) ctx.addIssue({ code: "custom", path: ["tax_office"], message: t.validation.required });
        if (!v.tax_number || !/^[0-9]{10,11}$/.test(v.tax_number)) ctx.addIssue({ code: "custom", path: ["tax_number"], message: t.validation.invalid });
      }
    });
}

export type CheckoutInput = z.infer<ReturnType<typeof checkoutSchema>>;

function addressFrom(fd: FormData, prefix: string) {
  const get = (k: string) => String(fd.get(`${prefix}_${k}`) ?? "");
  return { full_name: get("full_name"), phone: get("phone"), line1: get("line1"), line2: get("line2"), district: get("district"), city: get("city"), postal_code: get("postal_code"), country: "TR" };
}

/** FormData → raw object for checkoutSchema. */
export function checkoutFormToObject(fd: FormData) {
  const billingSame = fd.get("billing_same") === "on";
  return {
    idempotency_key: String(fd.get("idempotency_key") ?? ""),
    email: String(fd.get("email") ?? ""),
    phone: String(fd.get("ship_phone") ?? ""),
    shipping: addressFrom(fd, "ship"),
    billing_same: billingSame,
    billing: billingSame ? undefined : addressFrom(fd, "bill"),
    billing_type: fd.get("billing_type") === "corporate" ? "corporate" : "individual",
    company_name: String(fd.get("company_name") ?? "") || undefined,
    tax_office: String(fd.get("tax_office") ?? "") || undefined,
    tax_number: String(fd.get("tax_number") ?? "") || undefined,
    shipping_method_id: String(fd.get("shipping_method_id") ?? ""),
    customer_note: String(fd.get("customer_note") ?? "") || undefined,
    terms: fd.get("terms") === "on",
    save_address: fd.get("save_address") === "on",
  };
}
