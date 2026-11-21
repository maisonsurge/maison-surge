"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[storefront] render error", error.digest ?? "");
  }, [error]);
  return (
    <section className="container-ms flex flex-col items-center py-28 text-center" role="alert">
      <h1 className="font-display text-3xl">{t.common.error}</h1>
      {error.digest ? <p className="mt-3 text-xs text-muted">Ref: {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>
        {t.common.tryAgain}
      </Button>
    </section>
  );
}
