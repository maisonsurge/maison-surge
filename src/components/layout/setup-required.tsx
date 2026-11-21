import { Logo } from "@/components/brand/logo";
import type { Dictionary } from "@/i18n";

/** Rendered instead of the store when Supabase env vars are missing. */
export function SetupRequired({ t }: { t: Dictionary }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sand px-6 text-center" data-testid="setup-required">
      <Logo />
      <h1 className="font-display text-3xl">{t.setup.title}</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">{t.setup.body}</p>
      <code className="rounded-sm bg-paper px-3 py-2 text-xs">cp .env.example .env.local</code>
    </main>
  );
}
