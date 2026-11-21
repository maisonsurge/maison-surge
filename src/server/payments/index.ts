import "server-only";
import { serverEnv } from "@/server/env";
import { mockProvider } from "./mock";
import { iyzicoProvider } from "./iyzico";
import type { PaymentProvider, ProviderId } from "./types";

export type { PaymentProvider, ProviderId } from "./types";

const providers: Record<ProviderId, PaymentProvider> = { mock: mockProvider, iyzico: iyzicoProvider };

export function getProviderById(id: string): PaymentProvider | null {
  return id === "mock" || id === "iyzico" ? providers[id] : null;
}

/** The provider used for new checkouts (PAYMENT_PROVIDER), if available in this environment. */
export function getActivePaymentProvider(): PaymentProvider | null {
  const p = providers[serverEnv.PAYMENT_PROVIDER];
  return p.isAvailable() ? p : null;
}

export function paymentModeInfo() {
  const p = getActivePaymentProvider();
  return { provider: p?.id ?? null, isTest: p?.isTest ?? true, available: Boolean(p) };
}
