import { beforeEach, describe, expect, it, vi } from "vitest";

// --- mocks for server-side dependencies --------------------------------------
const rpc = vi.fn();
vi.mock("@/server/supabase/admin", () => ({ createServiceClient: () => ({ rpc, from: vi.fn() }) }));
vi.mock("@/server/env", () => ({
  serverEnv: { MOCK_PAYMENT_WEBHOOK_SECRET: "unit-test-secret-0123456789abcdef", ALLOW_MOCK_PAYMENTS_IN_PRODUCTION: "false", PAYMENT_PROVIDER: "mock", IYZICO_BASE_URL: "https://sandbox-api.iyzipay.com" },
  isProductionDeployment: false,
}));
vi.mock("@/server/email", () => ({ sendEmail: vi.fn(async () => ({ sent: false })), orderConfirmationEmail: vi.fn(() => ({ subject: "", html: "", text: "" })) }));
vi.mock("@/server/orders", () => ({ getOrderViewById: vi.fn(async () => null) }));

const { signMockPayload, verifyMockSignature, MOCK_SIGNATURE_HEADER } = await import("@/server/payments/mock");
const { handlePaymentWebhook } = await import("@/server/payments/process");
const { buildBasket } = await import("@/server/payments/iyzico");

const SECRET = "unit-test-secret-0123456789abcdef";
const ORDER = "7d8f2f7e-3c1b-4b8e-9a51-2a2c3e4f5a6b";

function signedRequest(body: object, secret = SECRET, ts?: number) {
  const raw = JSON.stringify(body);
  return { raw, headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signMockPayload(secret, raw, ts) }) };
}

const success = { id: "evt_unit_000001", type: "payment.succeeded", session_id: "ms_session_abcdefghij", order_id: ORDER, payment_id: "mock_pay_1", amount: 129900, currency: "TRY" };

describe("mock provider webhook signature", () => {
  it("accepts a valid signature and rejects tampering, wrong secret and stale timestamps", () => {
    const raw = JSON.stringify(success);
    const header = signMockPayload(SECRET, raw);
    expect(verifyMockSignature(SECRET, raw, header)).toBe(true);
    expect(verifyMockSignature(SECRET, raw.replace("129900", "1"), header)).toBe(false);
    expect(verifyMockSignature("another-secret-xxxxxxxxxxxxxxxx", raw, header)).toBe(false);
    const old = signMockPayload(SECRET, raw, Math.floor(Date.now() / 1000) - 3600);
    expect(verifyMockSignature(SECRET, raw, old)).toBe(false);
    expect(verifyMockSignature(SECRET, raw, null)).toBe(false);
    expect(verifyMockSignature(SECRET, raw, "garbage")).toBe(false);
  });
});

describe("handlePaymentWebhook", () => {
  beforeEach(() => rpc.mockReset());

  it("rejects an unsigned or forged event without touching the database", async () => {
    const { raw } = signedRequest(success);
    const res = await handlePaymentWebhook("mock", raw, new Headers());
    expect(res).toEqual({ status: 400, result: "invalid_signature" });
    const forged = signedRequest(success, "attacker-secret-xxxxxxxxxxxxxxx");
    expect((await handlePaymentWebhook("mock", forged.raw, forged.headers)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the provider event id to confirm_payment so redeliveries are idempotent", async () => {
    rpc.mockResolvedValueOnce({ data: "confirmed", error: null }).mockResolvedValueOnce({ data: "duplicate_event", error: null });
    const req = signedRequest(success);
    expect(await handlePaymentWebhook("mock", req.raw, req.headers)).toEqual({ status: 200, result: "confirmed" });
    expect(await handlePaymentWebhook("mock", req.raw, req.headers)).toEqual({ status: 200, result: "duplicate_event" });
    expect(rpc).toHaveBeenCalledTimes(2);
    for (const call of rpc.mock.calls) {
      expect(call[0]).toBe("confirm_payment");
      expect(call[1]).toMatchObject({ p_provider: "mock", p_event_id: "evt_unit_000001", p_order_id: ORDER, p_amount: 129900, p_currency: "TRY" });
    }
  });

  it("routes failures to fail_payment", async () => {
    rpc.mockResolvedValueOnce({ data: "failed", error: null });
    const req = signedRequest({ id: "evt_unit_000002", type: "payment.failed", session_id: "ms_session_abcdefghij", order_id: ORDER, reason: "declined" });
    expect(await handlePaymentWebhook("mock", req.raw, req.headers)).toEqual({ status: 200, result: "failed" });
    expect(rpc.mock.calls[0]![0]).toBe("fail_payment");
  });

  it("rejects schema-invalid payloads and unknown providers", async () => {
    const bad = signedRequest({ ...success, order_id: "not-a-uuid" });
    expect((await handlePaymentWebhook("mock", bad.raw, bad.headers)).status).toBe(400);
    expect(await handlePaymentWebhook("stripe", "{}", new Headers())).toEqual({ status: 400, result: "unknown_provider" });
  });

  it("returns 500 (so the provider retries) when the database call fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "connection reset" } });
    const req = signedRequest({ ...success, id: "evt_unit_000003" });
    expect(await handlePaymentWebhook("mock", req.raw, req.headers)).toEqual({ status: 500, result: "processing_error" });
  });
});

describe("iyzico basket", () => {
  it("distributes discounts with integer math so the basket sums to the grand total", () => {
    const items = [
      { id: "1", sku: "A", name: "A", lineTotal: 33333, quantity: 1 },
      { id: "2", sku: "B", name: "B", lineTotal: 66667, quantity: 1 },
    ];
    const basket = buildBasket({ items, discountTotal: 10001, shippingTotal: 9900 });
    const sum = basket.reduce((n, b) => n + b.amount, 0);
    expect(sum).toBe(100000 - 10001 + 9900);
    expect(basket.every((b) => Number.isInteger(b.amount) && b.amount > 0)).toBe(true);
    expect(basket.at(-1)).toMatchObject({ id: "SHIPPING", amount: 9900 });
  });
});
