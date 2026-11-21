import { describe, expect, it } from "vitest";
import { computeCouponDiscount, computeShipping, computeTotals } from "@/lib/pricing";
import { formatMoney, parseMoneyInput, toDecimalString } from "@/lib/money";

describe("money (integer kuruş)", () => {
  it("formats TRY in both locales", () => {
    expect(formatMoney(129990, "tr")).toMatch(/1\.299,90/);
    expect(formatMoney(129990, "en")).toMatch(/1,299\.90/);
  });
  it("converts to provider decimal strings without floating point", () => {
    expect(toDecimalString(0)).toBe("0.00");
    expect(toDecimalString(5)).toBe("0.05");
    expect(toDecimalString(129990)).toBe("1299.90");
    expect(() => toDecimalString(1.5)).toThrow();
  });
  it("parses user input in TR and EN formats", () => {
    expect(parseMoneyInput("1.299,90")).toBe(129990);
    expect(parseMoneyInput("1299,9")).toBe(129990);
    expect(parseMoneyInput("1299.90")).toBe(129990);
    expect(parseMoneyInput("1,299.90")).toBe(129990);
    expect(parseMoneyInput("1.299")).toBe(129900);
    expect(parseMoneyInput("₺ 99")).toBe(9900);
    expect(parseMoneyInput("0,1")).toBe(10);
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("1,999")).toBeNull(); // ambiguous (3 decimals) → rejected, never guessed
  });
});

describe("pricing", () => {
  const lines = [
    { unitPrice: 79900, quantity: 2 },
    { unitPrice: 119900, quantity: 1 },
  ];
  it("sums lines exactly", () => {
    expect(computeTotals({ lines }).subtotal).toBe(279700);
  });
  it("percent coupons floor and respect the cap and minimum", () => {
    const c = { code: "X", type: "percent" as const, value: 15, min_subtotal: 0, max_discount: null };
    expect(computeCouponDiscount(c, 279700)).toBe(41955);
    expect(computeCouponDiscount({ ...c, max_discount: 20000 }, 279700)).toBe(20000);
    expect(computeCouponDiscount({ ...c, min_subtotal: 300000 }, 279700)).toBe(0);
    expect(computeCouponDiscount({ ...c, value: 33 }, 1001)).toBe(330); // floor(330.33)
  });
  it("fixed coupons never exceed the subtotal", () => {
    expect(computeCouponDiscount({ code: "F", type: "fixed", value: 500000, min_subtotal: 0, max_discount: null }, 279700)).toBe(279700);
  });
  it("free shipping threshold applies to the discounted subtotal", () => {
    expect(computeShipping({ price: 9900, free_over: 150000 }, 149999)).toBe(9900);
    expect(computeShipping({ price: 9900, free_over: 150000 }, 150000)).toBe(0);
    const t = computeTotals({
      lines: [{ unitPrice: 160000, quantity: 1 }],
      coupon: { code: "F", type: "fixed", value: 20000, min_subtotal: 0, max_discount: null },
      shipping: { price: 9900, free_over: 150000 },
    });
    expect(t).toMatchObject({ subtotal: 160000, discount: 20000, shipping: 9900, grandTotal: 149900, freeShippingRemaining: 10000 });
  });
  it("computes included VAT informationally with integer rounding", () => {
    const t = computeTotals({ lines: [{ unitPrice: 110000, quantity: 1 }], vatRateBps: 1000 });
    expect(t.vatIncluded).toBe(10000);
    expect(t.grandTotal).toBe(110000);
    expect(computeTotals({ lines: [{ unitPrice: 110000, quantity: 1 }], vatRateBps: null }).vatIncluded).toBe(0);
  });
  it("rejects invalid line input", () => {
    expect(() => computeTotals({ lines: [{ unitPrice: 10.5, quantity: 1 }] })).toThrow();
    expect(() => computeTotals({ lines: [{ unitPrice: 100, quantity: 0 }] })).toThrow();
  });
});
