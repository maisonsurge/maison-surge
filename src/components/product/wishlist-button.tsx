"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/features/wishlist/actions";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Guests: clicking redirects to sign-in with a return path (documented
 * behaviour, PROJECT_RULES §6). Signed-in users toggle via RLS-protected rows.
 */
export function WishlistButton({
  productId,
  initial,
  className,
  withLabel = false,
}: {
  productId: string;
  initial: boolean;
  className?: string;
  withLabel?: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(initial);
  const [pending, startTransition] = useTransition();
  const label = active ? t.product.removeFromWishlist : t.product.addToWishlist;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={pending}
      data-testid="wishlist-toggle"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          const res = await toggleWishlistAction(productId);
          if (!res.ok) {
            if (res.reason === "auth") {
              toast(t.product.wishlistLogin, "info");
              router.push(`${localePath(locale, "/auth/login")}?next=${encodeURIComponent(pathname)}`);
            } else toast(t.common.error, "error");
            return;
          }
          setActive(res.inWishlist);
        });
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60",
        withLabel ? "h-11 border border-line px-4 text-xs font-medium uppercase tracking-wide hover:border-ink" : "h-9 w-9 rounded-full bg-paper/90 hover:bg-paper",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", active ? "fill-burgundy text-burgundy" : "text-ink")} aria-hidden />
      {withLabel ? <span>{label}</span> : null}
    </button>
  );
}
