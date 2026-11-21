import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseCatalogParams, withParams } from "@/features/catalog/query";
import { checkoutFormToObject, checkoutSchema } from "@/features/checkout/schema";
import { getDictionary } from "@/i18n";
import { localePath, switchLocalePath } from "@/i18n/config";
import { isSafeRelativePath, pickLocale, slugify } from "@/lib/utils";
import { allowedAdminTransitions, canRefund } from "@/lib/orders/transitions";
import tr from "@/i18n/dictionaries/tr";
import en from "@/i18n/dictionaries/en";

describe("catalog URL params", () => {
  it("parses and sanitises filters", () => {
    const q = parseCatalogParams({ q: "  polo ", size: ["M", "L", "bad size!"], color: "zeytin", min: "100", max: "2000", stock: "1", sort: "price_desc", page: "3" });
    expect(q).toMatchObject({ q: "polo", sizes: ["M", "L"], colors: ["zeytin"], minPrice: 10000, maxPrice: 200000, inStock: true, sort: "price_desc", page: 3 });
  });
  it("falls back safely on junk", () => {
    const q = parseCatalogParams({ sort: "drop table", page: "-4", min: "abc", q: "a" });
    expect(q).toMatchObject({ sort: "newest", page: 1, q: null, minPrice: 0 });
  });
  it("builds query strings that keep other filters", () => {
    expect(withParams({ size: ["M", "L"], page: "2" }, { page: "3" })).toBe("?size=M&size=L&page=3");
    expect(withParams({ page: "2" }, { page: null })).toBe("");
    expect(hasActiveFilters({ sort: "name" })).toBe(false);
    expect(hasActiveFilters({ size: "M" })).toBe(true);
  });
});

describe("checkout schema", () => {
  const t = getDictionary("tr");
  const fd = (overrides: Record<string, string> = {}) => {
    const f = new FormData();
    const base: Record<string, string> = {
      idempotency_key: "4f9c1d3e-2b7a-4c8d-9e0f-1a2b3c4d5e6f",
      email: "Ayse@Example.com",
      ship_full_name: "Ayşe Yılmaz",
      ship_phone: "+90 555 111 22 33",
      ship_line1: "Moda Cad. No:1",
      ship_district: "Kadıköy",
      ship_city: "İstanbul",
      ship_postal_code: "34710",
      billing_same: "on",
      billing_type: "individual",
      shipping_method_id: "8a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d",
      terms: "on",
      ...overrides,
    };
    for (const [k, v] of Object.entries(base)) f.set(k, v);
    return f;
  };
  it("accepts a valid guest checkout and lower-cases email", () => {
    const r = checkoutSchema(t).safeParse(checkoutFormToObject(fd()));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("ayse@example.com");
  });
  it("requires accepting the agreements", () => {
    const f = fd();
    f.delete("terms");
    const r = checkoutSchema(t).safeParse(checkoutFormToObject(f));
    expect(r.success).toBe(false);
  });
  it("requires company fields for corporate invoices", () => {
    const r = checkoutSchema(t).safeParse(checkoutFormToObject(fd({ billing_type: "corporate", tax_number: "12" })));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["company_name", "tax_office", "tax_number"]));
  });
  it("validates postal codes and phone numbers like the database does", () => {
    expect(checkoutSchema(t).safeParse(checkoutFormToObject(fd({ ship_postal_code: "347" }))).success).toBe(false);
    expect(checkoutSchema(t).safeParse(checkoutFormToObject(fd({ ship_phone: "call me" }))).success).toBe(false);
    expect(checkoutSchema(t).safeParse(checkoutFormToObject(fd({ ship_postal_code: "" }))).success).toBe(true);
  });
});

describe("i18n & utils", () => {
  it("EN dictionary has exactly the same keys as TR", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });
  it("locale paths", () => {
    expect(localePath("en", "/shop")).toBe("/en/shop");
    expect(localePath("tr")).toBe("/tr");
    expect(switchLocalePath("/tr/product/x", "en")).toBe("/en/product/x");
  });
  it("rejects open redirects", () => {
    expect(isSafeRelativePath("/tr/account")).toBe(true);
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
  });
  it("slugify handles Turkish characters", () => {
    expect(slugify("Kapüşonlu Örgü Çanta — İnce")).toBe("kapusonlu-orgu-canta-ince");
  });
  it("pickLocale falls back to TR", () => {
    expect(pickLocale({ tr: "Kazak", en: "" }, "en")).toBe("Kazak");
    expect(pickLocale({ tr: "Kazak", en: "Knit" }, "en")).toBe("Knit");
    expect(pickLocale(null, "tr")).toBe("");
  });
});

describe("order transitions (UI mirror of SQL)", () => {
  it("never offers payment-status changes and blocks terminal states", () => {
    expect(allowedAdminTransitions("delivered")).toEqual([]);
    expect(allowedAdminTransitions("cancelled")).toEqual([]);
    expect(allowedAdminTransitions("confirmed").map((x) => x.to)).toEqual(["processing", "shipped", "cancelled"]);
    expect(canRefund("delivered", "paid")).toBe(true);
    expect(canRefund("pending_payment", "pending")).toBe(false);
  });
});
