"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";

/**
 * Cookie consent (KVKK / ePrivacy style). Analytics & marketing are OFF by
 * default and only switch on after an explicit choice. Choice is stored in a
 * first-party cookie `ms_consent`. No analytics/marketing scripts are bundled
 * today; any future script must be gated with `useConsent()`.
 */
export const CONSENT_COOKIE = "ms_consent";
const VERSION = 1;
type Consent = { v: number; analytics: boolean; marketing: boolean; ts: number };
const OPEN_EVENT = "ms:open-cookie-preferences";
const CHANGE_EVENT = "ms:consent-change";

function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1))) as Consent;
    return parsed.v === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsent(c: Omit<Consent, "v" | "ts">) {
  const value: Consent = { v: VERSION, ts: Date.now(), ...c };
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

let cachedRaw: string | null = null;
let cachedValue: Consent | null = null;
function snapshot(): Consent | null {
  const raw = document.cookie;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readConsent();
  }
  return cachedValue;
}

/** Returns null until the visitor has decided. */
export function useConsent(): Consent | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function CookieConsent() {
  const { t, locale } = useI18n();
  const consent = useConsent();
  const [mounted, setMounted] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: banner depends on a browser-only cookie
    setMounted(true);
    const open = () => {
      const c = readConsent();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const save = useCallback((a: boolean, m: boolean) => {
    writeConsent({ analytics: a, marketing: m });
    setPrefsOpen(false);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {!consent && !prefsOpen ? (
        <section
          aria-label={t.cookies.title}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper px-4 py-5 shadow-[0_-8px_30px_rgba(26,26,26,0.08)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md sm:border"
          data-testid="cookie-banner"
        >
          <p className="font-display text-lg">{t.cookies.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t.cookies.body}{" "}
            <Link href={localePath(locale, "/pages/cerez-politikasi")} className="underline underline-offset-4">
              {t.cookies.policy}
            </Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => save(true, true)}>
              {t.cookies.acceptAll}
            </Button>
            <Button size="sm" variant="outline" onClick={() => save(false, false)} data-testid="cookie-reject">
              {t.cookies.rejectAll}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
              {t.cookies.customize}
            </Button>
          </div>
        </section>
      ) : null}
      <Dialog open={prefsOpen} onClose={() => setPrefsOpen(false)} title={t.cookies.title} closeLabel={t.common.close}>
        <div className="space-y-4 text-sm">
          <fieldset className="border-b border-line pb-4">
            <legend className="font-medium">{t.cookies.necessary}</legend>
            <p className="mt-1 text-muted">{t.cookies.necessaryDesc}</p>
          </fieldset>
          <label className="flex items-start gap-3 border-b border-line pb-4">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-olive)]" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            <span>
              <span className="font-medium">{t.cookies.analytics}</span>
              <span className="mt-1 block text-muted">{t.cookies.analyticsDesc}</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-olive)]" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>
              <span className="font-medium">{t.cookies.marketing}</span>
              <span className="mt-1 block text-muted">{t.cookies.marketingDesc}</span>
            </span>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => save(false, false)}>
            {t.cookies.rejectAll}
          </Button>
          <Button size="sm" onClick={() => save(analytics, marketing)}>
            {t.cookies.save}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {t.footer.cookiePrefs}
    </button>
  );
}
