"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function Brand({ compact = false, showTagline = false }: { compact?: boolean; showTagline?: boolean }) {
  const [logo, setLogo] = useState("/icon.png");
  const [name, setName] = useState("iMersOrders Cloud");
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const applyFavicon = (icon: string) => {
      if (!icon) return;
      document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach((el) => el.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = icon;
      link.type = "image/png";
      document.head.appendChild(link);
      const apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = icon;
      document.head.appendChild(apple);
    };

    const load = async () => {
      // Read the business row directly so the header never falls back to the
      // bundled icon when a logo has already been uploaded.
      const { data: context } = await supabase.rpc("get_single_business_context");
      const ctx = context && typeof context === "object" ? context as Record<string, unknown> : null;
      const businessId = String(ctx?.id ?? ctx?.business_id ?? "");
      let business: Record<string, unknown> | null = null;

      if (businessId) {
        const { data } = await supabase.from("businesses").select("id,name,logo_url").eq("id", businessId).maybeSingle();
        business = data as Record<string, unknown> | null;
      }

      // Fallback to the RPC payload for older database functions.
      if (!business && ctx) business = ctx;

      // Login happens before a Supabase auth session exists, so the authenticated
      // business context above is unavailable there. Read only non-sensitive
      // branding through the public branding RPC so login can use the uploaded
      // logo too.
      let publicBranding: Record<string, unknown> | null = null;
      if (!business) {
        const { data } = await supabase.rpc("get_public_branding");
        if (data && typeof data === "object") publicBranding = data as Record<string, unknown>;
        if (publicBranding) business = publicBranding;
      }
      if (!active || !business) return;

      const businessLogo = String(business.logo_url ?? "");
      if (businessLogo) { setLogo(businessLogo); setImageFailed(false); }
      else { setLogo("/icon.png"); setImageFailed(false); }
      if (business.name) setName(String(business.name));

      let custom = String(publicBranding?.favicon_url ?? "");
      let useLogo = Boolean(publicBranding?.use_logo_as_favicon ?? true);
      if (businessId) {
        const { data: rows } = await supabase
          .from("business_settings")
          .select("key,value")
          .in("key", ["favicon_url", "use_logo_as_favicon"]);
        const map = new Map((rows ?? []).map((row) => [row.key, row.value as Record<string, unknown>]));
        custom = String(map.get("favicon_url")?.url ?? custom);
        useLogo = Boolean(map.get("use_logo_as_favicon")?.enabled ?? useLogo);
      }
      applyFavicon(custom || (useLogo && businessLogo ? businessLogo : "/icon.png"));
    };

    void load();
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ logoUrl?: string | null; faviconUrl?: string | null }>).detail;
      if (detail?.logoUrl !== undefined && detail.logoUrl) { setLogo(detail.logoUrl); setImageFailed(false); }
      if (detail?.faviconUrl !== undefined && detail.faviconUrl) applyFavicon(detail.faviconUrl);
      void load();
    };
    window.addEventListener("imersorder:branding-updated", refresh);
    return () => { active = false; window.removeEventListener("imersorder:branding-updated", refresh); };
  }, []);

  return (
    <div className={`brand ${showTagline ? "brandWithTagline" : ""}`}>
      <img className="brandLogo" src={imageFailed ? "/icon.png" : logo} width={44} height={44} alt={`Logo ${name}`} onError={() => setImageFailed(true)} />
      {!compact ? <span className="brandCopy"><span className="brandName">{name}</span>{showTagline ? <span className="brandTagline">Katalog online, pesanan lebih teratur.</span> : null}</span> : null}
    </div>
  );
}
