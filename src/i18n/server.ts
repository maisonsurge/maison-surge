import "server-only";
import { notFound } from "next/navigation";
import { getDictionary } from "./index";
import { isLocale, type Locale } from "./config";

/** Server pages/layouts: const { locale, t } = await pageContext(props.params); */
export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale: locale as Locale, t: getDictionary(locale as Locale) };
}
