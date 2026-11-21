import tr, { type Dictionary } from "./dictionaries/tr";
import en from "./dictionaries/en";
import type { Locale } from "./config";

export type { Dictionary };
export * from "./config";

const dictionaries: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? tr;
}

/** Replaces {name} placeholders. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
}
