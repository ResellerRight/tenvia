import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const slug = cookieStore.get("imerscloud_tenant")?.value || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let branding: Record<string, unknown> | null = null;
  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = slug
        ? await supabase.rpc("get_public_branding_by_slug", { p_slug: slug })
        : { data: null };
      branding = data && typeof data === "object" ? data as Record<string, unknown> : null;
    } catch {}
  }
  const name = String(branding?.name ?? "iMersOrders Cloud");
  const iconVersion = encodeURIComponent(String(branding?.logo_url ?? "cloud-v1").slice(-80));
  return {
    name,
    short_name: name,
    description: "Multi-tenant Katalog Online & Manajemen Pesanan.",
    start_url: slug ? `/${slug}/dashboard` : "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f9ff",
    theme_color: "#071A3A",
    icons: [
      { src: `/api/pwa/icon?size=192&v=${iconVersion}`, sizes: "192x192", purpose: "any" },
      { src: `/api/pwa/icon?size=512&v=${iconVersion}`, sizes: "512x512", purpose: "maskable" },
    ],
  };
}
