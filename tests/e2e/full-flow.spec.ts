import { expect, test, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * FULL suite — requires a dedicated TEST Supabase project with all migrations
 * and supabase/seed.sql applied, the app built with that project's env, and:
 *   E2E_FULL=1, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   MOCK_PAYMENT_WEBHOOK_SECRET (same as the app), E2E_CUSTOMER_EMAIL/PASSWORD
 *   (confirmed customer), E2E_ADMIN_EMAIL/PASSWORD (user granted "admin").
 * Never point this at production: it creates orders and changes stock.
 */
const FULL = process.env.E2E_FULL === "1";
test.skip(!FULL, "Set E2E_FULL=1 with a TEST Supabase project to run the full suite");
test.describe.configure({ mode: "serial" });

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function signIn(page: Page, email: string, password: string, next = "/tr/account") {
  await page.goto(`/tr/auth/login?next=${encodeURIComponent(next)}`);
  await page.locator("#f-email").fill(email);
  await page.locator("#f-password").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((u) => !u.pathname.includes("/auth/login"));
}

async function addFirstAvailableProductToCart(page: Page) {
  await page.goto("/tr");
  await page.getByTestId("category-card").first().click();
  await expect(page).toHaveURL(/\/tr\/shop\//);
  await page.getByTestId("product-card").first().getByRole("link").first().click();
  await expect(page.getByTestId("product-title")).toBeVisible();
  // choose the first enabled size (colour is preselected to one with stock)
  const size = page.locator('input[name="size"]:not([disabled])').first();
  await size.check({ force: true });
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toBeVisible();
}

async function fillCheckout(page: Page, email: string | null) {
  if (email) await page.locator("#f-email").fill(email);
  await page.locator("#f-ship_full_name").fill("Test Müşteri");
  await page.locator("#f-ship_phone").fill("+905551112233");
  await page.locator("#f-ship_line1").fill("Test Mah. Deneme Sok. No:1");
  await page.locator("#f-ship_district").fill("Kadıköy");
  await page.locator("#f-ship_city").fill("İstanbul");
  await page.locator("#f-ship_postal_code").fill("34710");
  await page.getByTestId("terms").check();
}

function signMock(raw: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", process.env.MOCK_PAYMENT_WEBHOOK_SECRET!).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

test("guest: home → category → product → variant → cart → checkout → sandbox payment → verified confirmation, stock decremented once, webhook replay is a no-op", async ({ page, request }) => {
  await addFirstAvailableProductToCart(page);
  await page.goto("/tr/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);

  // capture variant + stock before buying
  const supabase = db();
  const sku = (await page.getByTestId("cart-line").first().locator("p.text-muted").innerText()).split("·").pop()!.trim();
  const { data: before } = await supabase.from("product_variants").select("id, stock_on_hand").eq("sku", sku).single();

  await page.getByTestId("go-checkout").click();
  await fillCheckout(page, `guest-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("sandbox")).toBeVisible();
  await page.getByTestId("sandbox-succeed").click();

  const status = page.getByTestId("order-status");
  await expect(status).toHaveAttribute("data-payment", "paid", { timeout: 20_000 });
  await expect(status).toHaveAttribute("data-status", "confirmed");
  const orderNumber = new URL(page.url()).pathname.split("/").pop()!;

  const { data: after } = await supabase.from("product_variants").select("stock_on_hand").eq("id", before!.id).single();
  expect(after!.stock_on_hand).toBe(before!.stock_on_hand - 1);

  // Replay: a new signed success event for the same order must not change anything.
  const { data: order } = await supabase.from("orders").select("id, grand_total").eq("order_number", orderNumber).single();
  const event = { id: `evt_e2e_${randomUUID()}`, type: "payment.succeeded", session_id: "ms_e2e_replay_session_x", order_id: order!.id, payment_id: "mock_pay_replay", amount: order!.grand_total, currency: "TRY" };
  const raw = JSON.stringify(event);
  const first = await request.post("/api/webhooks/payments/mock", { data: raw, headers: { "content-type": "application/json", "x-ms-signature": signMock(raw) } });
  expect(await first.json()).toMatchObject({ result: "already_paid" });
  const second = await request.post("/api/webhooks/payments/mock", { data: raw, headers: { "content-type": "application/json", "x-ms-signature": signMock(raw) } });
  expect(await second.json()).toMatchObject({ result: "duplicate_event" });
  const { data: final } = await supabase.from("product_variants").select("stock_on_hand").eq("id", before!.id).single();
  expect(final!.stock_on_hand).toBe(before!.stock_on_hand - 1);
  const { count } = await supabase.from("inventory_movements").select("id", { count: "exact", head: true }).eq("order_id", order!.id).eq("type", "sale");
  expect(count).toBe(1);
});

test("failed sandbox payment keeps the order retryable", async ({ page }) => {
  await addFirstAvailableProductToCart(page);
  await page.goto("/tr/checkout");
  await fillCheckout(page, `guest-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByTestId("place-order").click();
  await page.getByTestId("sandbox-fail").click();
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-payment", "failed");
  await expect(page.getByTestId("retry-payment")).toBeVisible();
});

test("catalog filters and sorting are reflected in the URL", async ({ page }) => {
  await page.goto("/tr/shop");
  await page.getByTestId("sort-select").selectOption("price_asc");
  await expect(page).toHaveURL(/sort=price_asc/);
  await page.goto("/tr/shop?size=M&stock=1&sort=price_desc");
  await expect(page.locator('input[name="size"][value="M"]')).toBeChecked();
  await expect(page.getByTestId("result-count")).toBeVisible();
});

test("registration shows the check-email step (no account enumeration)", async ({ page }) => {
  await page.goto("/tr/auth/register");
  await page.locator("#f-fullName").fill("E2E Kayıt");
  await page.locator("#f-email").fill(`e2e-${randomUUID().slice(0, 8)}@example.com`);
  await page.locator("#f-password").fill("GucluSifre12345");
  await page.locator("#f-passwordConfirm").fill("GucluSifre12345");
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(page).toHaveURL(/check-email/);
});

test("customer: sign in, wishlist add/remove, and admin is denied", async ({ page }) => {
  test.skip(!process.env.E2E_CUSTOMER_EMAIL, "E2E_CUSTOMER_EMAIL not set");
  await signIn(page, process.env.E2E_CUSTOMER_EMAIL!, process.env.E2E_CUSTOMER_PASSWORD!);
  await page.goto("/tr/shop");
  const heart = page.getByTestId("product-card").first().getByTestId("wishlist-toggle");
  const wasPressed = (await heart.getAttribute("aria-pressed")) === "true";
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", String(!wasPressed));
  await page.goto("/tr/wishlist");
  if (!wasPressed) await expect(page.getByTestId("product-card")).not.toHaveCount(0);

  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404); // non-staff users must not see the admin surface
});

test("guest wishlist click redirects to sign-in", async ({ page }) => {
  await page.goto("/tr/shop");
  await page.getByTestId("product-card").first().getByTestId("wishlist-toggle").click();
  await page.waitForURL(/\/tr\/auth\/login/);
});

test("admin: dashboard loads for an admin", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set");
  await signIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!, "/admin");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
