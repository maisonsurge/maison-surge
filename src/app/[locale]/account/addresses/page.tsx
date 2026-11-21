import type { Metadata } from "next";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { requireUser } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { AddressManager } from "@/features/account/address-manager";
import type { LocalePageProps } from "@/features/account/page-props";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.account.addresses, robots: { index: false, follow: false } };
}

export default async function AddressesPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  const user = await requireUser(locale, localePath(locale, "/account/addresses"));
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("id, label, full_name, phone, line1, line2, district, city, postal_code, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <section aria-labelledby="addresses-title">
      <h2 id="addresses-title" className="mb-6 text-2xl">
        {t.account.addresses}
      </h2>
      <AddressManager addresses={data ?? []} />
    </section>
  );
}
