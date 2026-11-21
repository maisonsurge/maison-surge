import { describe, expect, it } from "vitest";
import { isStrongPassword, makeAuthSchemas } from "@/features/auth/schemas";
import tr from "@/i18n/dictionaries/tr";
import en from "@/i18n/dictionaries/en";

const s = makeAuthSchemas(tr);

describe("password policy", () => {
  it("requires ≥10 chars with a letter and a digit", () => {
    expect(isStrongPassword("short1")).toBe(false);
    expect(isStrongPassword("onlyletterslong")).toBe(false);
    expect(isStrongPassword("1234567890123")).toBe(false);
    expect(isStrongPassword("güçlüŞifre12")).toBe(true);
    expect(isStrongPassword("a1".repeat(40))).toBe(false); // > 72 chars
  });
});

describe("sign-in schema", () => {
  it("normalises e-mail and rejects invalid input", () => {
    const ok = s.signIn.safeParse({ email: "  User@Example.COM ", password: "x" });
    expect(ok.success && ok.data.email).toBe("user@example.com");
    const bad = s.signIn.safeParse({ email: "not-an-email", password: "" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const paths = bad.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("email");
      expect(paths).toContain("password");
    }
  });
});

describe("sign-up schema", () => {
  const base = { fullName: "Ayşe Yılmaz", email: "a@example.com", password: "Parola12345", passwordConfirm: "Parola12345", marketingConsent: false };

  it("accepts valid data", () => {
    expect(s.signUp.safeParse(base).success).toBe(true);
  });

  it("flags mismatching confirmation on passwordConfirm", () => {
    const r = s.signUp.safeParse({ ...base, passwordConfirm: "Parola12346" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["passwordConfirm"]);
  });

  it("uses localized messages", () => {
    const r = makeAuthSchemas(en).signUp.safeParse({ ...base, password: "weak", passwordConfirm: "weak" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain(en.auth.passwordRules);
  });
});

describe("reset schema", () => {
  it("enforces policy and confirmation", () => {
    expect(s.reset.safeParse({ password: "Parola12345", passwordConfirm: "Parola12345" }).success).toBe(true);
    expect(s.reset.safeParse({ password: "Parola12345", passwordConfirm: "x" }).success).toBe(false);
  });
});
