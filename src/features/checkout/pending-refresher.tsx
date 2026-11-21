"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a payment is awaiting server-side verification, re-fetch the page every 3 s (max ~90 s). */
export function PendingRefresher() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (n > 30) window.clearInterval(id);
      else router.refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
