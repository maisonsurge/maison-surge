import Link from "next/link";

/** Fallback for paths outside the locale tree (e.g. /admin/unknown). */
export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center" data-testid="not-found">
      <p className="eyebrow text-muted">404</p>
      <h1 className="font-display text-4xl">Sayfa bulunamadı</h1>
      <p className="text-sm text-muted">Page not found</p>
      <Link href="/tr" className="mt-4 text-xs font-medium tracking-wide uppercase underline underline-offset-4">
        Ana sayfa / Home
      </Link>
    </main>
  );
}
