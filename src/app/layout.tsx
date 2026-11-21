import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { montserrat, playfair } from "@/styles/fonts";
import { ToastProvider } from "@/components/ui/toast";
import { publicEnv } from "@/lib/env";
import { asLocale } from "@/i18n/config";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "MAISON SURGE", template: "%s — MAISON SURGE" },
  applicationName: "MAISON SURGE",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by src/proxy.ts from the URL's locale prefix (admin → tr).
  const locale = asLocale((await headers()).get("x-ms-locale"));
  return (
    <html lang={locale} suppressHydrationWarning className={`${playfair.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
