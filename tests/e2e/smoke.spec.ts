import { expect, test } from "@playwright/test";

/**
 * Smoke suite — runs with or without Supabase credentials. Verifies routing,
 * guards, security headers and responsive layout of whatever renders.
 */
test.describe("smoke", () => {
  test("root redirects to the Turkish storefront", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
    expect(new URL(page.url()).pathname).toBe("/tr");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  });

  test("English locale renders with lang=en", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("admin is not reachable while signed out (redirected to sign-in)", async ({ page }) => {
    await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/tr/auth/login");
    await page.goto("/admin/products");
    expect(new URL(page.url()).pathname).toBe("/tr/auth/login");
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/tr");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("webhook rejects unsigned events", async ({ request }) => {
    const res = await request.post("/api/webhooks/payments/mock", { data: { id: "evt_x", type: "payment.succeeded" } });
    expect([400, 500]).toContain(res.status()); // 400 invalid signature (500 only if DB unreachable)
  });

  test("cron endpoint requires the secret", async ({ request }) => {
    const res = await request.get("/api/cron/release-reservations");
    expect(res.status()).toBe(401);
  });

  test("robots.txt disallows private areas", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Sitemap:");
  });

  test("no horizontal overflow at this viewport", async ({ page }) => {
    for (const path of ["/tr", "/tr/shop", "/tr/auth/login", "/en/cart"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });

  test("unknown pages return 404", async ({ page }) => {
    const res = await page.goto("/tr/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
  });
});
