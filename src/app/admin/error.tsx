"use client";

import { useEffect } from "react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] page error", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="max-w-xl">
      <Alert tone="danger" title="Sayfa yüklenemedi">
        Veriler alınırken bir hata oluştu. Bağlantınızı kontrol edip tekrar deneyin.
        {error.digest ? <span className="mt-1 block text-xs text-muted">Hata kodu: {error.digest}</span> : null}
      </Alert>
      <Button className="mt-4" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
