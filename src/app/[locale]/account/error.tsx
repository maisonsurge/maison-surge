"use client";

import { useI18n } from "@/i18n/client";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <Alert tone="danger">{t.common.error}</Alert>
      <Button variant="outline" onClick={reset}>
        {t.common.tryAgain}
      </Button>
    </div>
  );
}
