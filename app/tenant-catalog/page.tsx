import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PublicCatalog } from "@/components/public-catalog";

export const dynamic = "force-dynamic";

export default async function TenantCatalogPage() {
  const h = await headers();
  const slug = h.get("x-imerscloud-tenant-slug");
  if (!slug) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_catalog_by_slug", { p_slug: slug });
  if (error || !data?.enabled) notFound();
  return <PublicCatalog data={data} tenantSlug={slug} />;
}
