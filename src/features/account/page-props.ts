export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type LocalePageProps = { params: Promise<{ locale: string }>; searchParams: SearchParams };

export type LocaleParamPageProps<K extends string> = {
  params: Promise<{ locale: string } & Record<K, string>>;
  searchParams: SearchParams;
};

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
