import Link from "next/link";
import { Heart, ShoppingBag, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getCategories, getSiteSettings } from "@/server/catalog";
import { getCartCount } from "@/server/cart";
import { getSessionUser } from "@/server/auth";
import { paymentModeInfo } from "@/server/payments";
import { getDictionary } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { pickLocale } from "@/lib/utils";
import { MobileMenu } from "./mobile-menu";
import { SearchButton } from "./search-dialog";
import { LanguageSwitcher } from "./language-switcher";

export async function Header({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [categories, settings, cartCount, user] = await Promise.all([getCategories(locale), getSiteSettings(), getCartCount(), getSessionUser()]);
  const topLevel = categories.filter((c) => !c.parent_id);
  const announcement = settings?.announcement_enabled ? pickLocale(settings.announcement, locale) : "";
  const payment = paymentModeInfo();
  const nav = [
    { href: localePath(locale, "/shop"), label: t.nav.allProducts },
    ...topLevel.map((c) => ({ href: localePath(locale, `/shop/${c.slug}`), label: c.name })),
  ];

  return (
    <>
      {announcement || payment.isTest ? (
        <div className="bg-forest px-4 py-2 text-center text-[0.7rem] font-medium tracking-[0.18em] text-paper uppercase" data-testid="announcement">
          {announcement}
          {payment.isTest && !announcement ? t.common.testMode : null}
        </div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="container-ms grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 md:h-20 lg:h-24">
          <div className="flex items-center gap-1">
            <MobileMenu
              locale={locale}
              items={nav}
              extra={[
                { href: localePath(locale, "/pages/hakkimizda"), label: t.nav.about },
                { href: localePath(locale, "/contact"), label: t.nav.contact },
                { href: localePath(locale, user ? "/account" : "/auth/login"), label: user ? t.common.account : t.common.signIn },
              ]}
            />
          </div>

          <Link href={localePath(locale)} className="justify-self-center" aria-label="MAISON SURGE — ana sayfa / home">
            <Logo />
          </Link>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <SearchButton />
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <Link
              href={localePath(locale, user ? "/account" : "/auth/login")}
              className="hidden h-11 w-11 items-center justify-center hover:bg-sand-100 sm:inline-flex"
              aria-label={user ? t.common.account : t.common.signIn}
            >
              <User className="h-5 w-5" aria-hidden />
            </Link>
            <Link href={localePath(locale, "/wishlist")} className="hidden h-11 w-11 items-center justify-center hover:bg-sand-100 sm:inline-flex" aria-label={t.common.wishlist}>
              <Heart className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              href={localePath(locale, "/cart")}
              className="relative inline-flex h-11 w-11 items-center justify-center hover:bg-sand-100"
              aria-label={`${t.common.cart} (${cartCount})`}
              data-testid="header-cart"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {cartCount > 0 ? (
                <span className="absolute top-1.5 right-1 min-w-4 rounded-full bg-burgundy px-1 text-center text-[0.6rem] leading-4 font-semibold text-paper" data-testid="cart-count">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
        <nav aria-label={t.nav.shop} className="hidden border-t border-line/70 lg:block">
          <ul className="container-ms flex h-12 items-center justify-center gap-10">
            {nav.slice(0, 7).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[0.72rem] font-medium tracking-[0.16em] whitespace-nowrap uppercase underline-offset-8 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}
