import { describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { addressFromForm, makeAccountSchemas, PHONE_RE } from "@/features/account/schemas";
import { makeContactSchema } from "@/features/contact/schema";
import tr from "@/i18n/dictionaries/tr";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));

const { address, profile } = makeAccountSchemas(tr);

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("address schema (mirrors DB checks)", () => {
  const valid = {
    full_name: "Ayşe Yılmaz",
    phone: "+90 555 111 22 33",
    line1: "Moda Cad. No:1",
    line2: "",
    district: "Kadıköy",
    city: "İstanbul",
    postal_code: "34710",
    label: "",
  };

  it("accepts a valid address and turns empty optionals into null", () => {
    const r = address.safeParse(addressFromForm(form(valid)));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.line2).toBeNull();
      expect(r.data.label).toBeNull();
      expect(r.data.is_default).toBe(false);
      expect(r.data.id).toBeUndefined();
    }
  });

  it("postal code is optional but must be 5 digits when present", () => {
    expect(address.safeParse(addressFromForm(form({ ...valid, postal_code: "" }))).success).toBe(true);
    expect(address.safeParse(addressFromForm(form({ ...valid, postal_code: "3471" }))).success).toBe(false);
    expect(address.safeParse(addressFromForm(form({ ...valid, postal_code: "ABCDE" }))).success).toBe(false);
  });

  it("rejects invalid phone, short fields and bad ids", () => {
    expect(address.safeParse(addressFromForm(form({ ...valid, phone: "abc" }))).success).toBe(false);
    expect(address.safeParse(addressFromForm(form({ ...valid, district: "K" }))).success).toBe(false);
    expect(address.safeParse(addressFromForm(form({ ...valid, id: "not-a-uuid" }))).success).toBe(false);
    expect(address.safeParse(addressFromForm(form({ ...valid, is_default: "on" }))).success).toBe(true);
  });

  it("phone regex matches the database constraint", () => {
    expect(PHONE_RE.test("+905551112233")).toBe(true);
    expect(PHONE_RE.test("(0212) 555-11-22")).toBe(true);
    expect(PHONE_RE.test("12345")).toBe(false);
  });
});

describe("profile schema", () => {
  it("allows empty optional values and validates locale", () => {
    const r = profile.safeParse({ full_name: "", phone: "", preferred_locale: "en", marketing_consent: true });
    expect(r.success && r.data.full_name === null && r.data.phone === null).toBe(true);
    expect(profile.safeParse({ full_name: "", phone: "", preferred_locale: "de", marketing_consent: false }).success).toBe(false);
  });
});

describe("contact schema", () => {
  it("enforces message length 10–5000", () => {
    const base = { name: "Ali Veli", email: "ali@example.com", subject: "Soru", order_number: "", message: "kısa" };
    expect(makeContactSchema(tr).safeParse(base).success).toBe(false);
    expect(makeContactSchema(tr).safeParse({ ...base, message: "Merhaba, bir sorum var." }).success).toBe(true);
    expect(makeContactSchema(tr).safeParse({ ...base, message: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("guest order token", () => {
  it("matches only the exact token (constant-time hash compare)", async () => {
    const { guestTokenMatches, isValidOrderNumber } = await import("@/server/orders");
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    expect(guestTokenMatches(token, hash)).toBe(true);
    expect(guestTokenMatches(`${token}x`, hash)).toBe(false);
    expect(guestTokenMatches("", hash)).toBe(false);
    expect(guestTokenMatches(token, null)).toBe(false);
    expect(isValidOrderNumber("MS-261121-01001")).toBe(true);
    expect(isValidOrderNumber("MS-261121-01001' or 1=1")).toBe(false);
  });
});
