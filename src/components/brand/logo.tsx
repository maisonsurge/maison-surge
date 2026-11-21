import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * MAISON SURGE logo: Heritage Raven mark + typographic wordmark.
 * The raven is a RASTER crop of the supplied logo (white background), so it is
 * blended into the page: multiply on light surfaces, inverted + screen on dark
 * ones. Replace with the approved vector when available (docs/ASSET_GAPS.md).
 */
export function Logo({ tone = "light", mark = true, className }: { tone?: "light" | "dark"; mark?: boolean; className?: string }) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-3", dark && "text-paper", className)}>
      {mark && brand.logo.markSrc ? (
        <Image
          src={(dark ? brand.logo.markLightSrc : brand.logo.markSrc) ?? brand.logo.markSrc}
          alt=""
          width={616}
          height={465}
          priority
          className="h-8 w-auto sm:h-9"
        />
      ) : null}
      <span className="font-display text-[1.05rem] leading-none font-medium tracking-[var(--tracking-brand)] whitespace-nowrap uppercase sm:text-xl">
        {brand.name === "MAISON SURGE" ? "Maison Surge" : brand.name}
      </span>
    </span>
  );
}
