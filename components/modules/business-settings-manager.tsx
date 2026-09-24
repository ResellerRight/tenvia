"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Shuffle, Trash2, Upload, Image as ImageIcon, X, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { FormActions, ModuleHeader, Notice } from "@/components/crud-ui";
import { MediaPicker } from "@/components/media-picker";
import {
  DEFAULT_DASHBOARD_QUOTES,
  normalizeDashboardMotivation,
} from "@/lib/dashboard-personalization";

type F = {
  name: string;
  address: string;
  whatsapp: string;
  email: string;
  timezone: string;
  currency: string;
  invoice_prefix: string;
  order_prefix: string;
  sku_prefix: string;
};

const empty: F = {
  name: "",
  address: "",
  whatsapp: "",
  email: "",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  invoice_prefix: "INV",
  order_prefix: "ORD",
  sku_prefix: "SKU",
};

const cleanPrefix = (value: string, fallback: string) =>
  value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12) || fallback;

const safeExternalUrl = (value: string) => {
  const v = value.trim();
  if (!v) return "";
  try { const u = new URL(v); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
};

export function BusinessSettingsManager({ businessId, role }: { businessId: string; role: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<F>(empty);
  const [provider, setProvider] = useState("manual");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [useLogoAsFavicon, setUseLogoAsFavicon] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingPromoImage, setUploadingPromoImage] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [faviconPreviewError, setFaviconPreviewError] = useState(false);
  const [autoReminder, setAutoReminder] = useState(false);
  const [templateSlug, setTemplateSlug] = useState("catering");
  const [catalogEnabled, setCatalogEnabled] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [catalogDescription, setCatalogDescription] = useState("Bagikan katalog dan terima pesanan online dengan lebih rapi.");
  const [catalogShowPrices, setCatalogShowPrices] = useState(true);
  const [catalogAcceptOrders, setCatalogAcceptOrders] = useState(true);
  const [promoPopupEnabled, setPromoPopupEnabled] = useState(false);
  const [promoPopupTitle, setPromoPopupTitle] = useState("Promo & Pengumuman");
  const [promoPopupText, setPromoPopupText] = useState("Ada promo terbaru untuk pelanggan Anda.");
  const [promoPopupButton, setPromoPopupButton] = useState("Lihat Promo");
  const [promoPopupUrl, setPromoPopupUrl] = useState("");
  const [promoPopupDelay, setPromoPopupDelay] = useState(3);
  const [promoPopupImageUrl, setPromoPopupImageUrl] = useState<string | null>(null);
  const [promoImagePreviewError, setPromoImagePreviewError] = useState(false);
  const [mediaPicker, setMediaPicker] = useState<"logo" | "favicon" | "promo" | null>(null);
  const [promoMarqueeEnabled, setPromoMarqueeEnabled] = useState(false);
  const [promoMarqueeText, setPromoMarqueeText] = useState("🔥 Promo terbaru tersedia — klik untuk melihat detail.");
  const [promoMarqueeUrl, setPromoMarqueeUrl] = useState("");
  const [motivationEnabled, setMotivationEnabled] = useState(true);
  const [quotes, setQuotes] = useState<string[]>([...DEFAULT_DASHBOARD_QUOTES]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const canOwner = role === "owner";

  useEffect(() => {
    void (async () => {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase
          .from("businesses")
          .select("name,address,whatsapp,email,timezone,currency,invoice_prefix,order_prefix,sku_prefix,logo_url,template_slug")
          .eq("id", businessId)
          .single(),
        supabase
          .from("business_settings")
          .select("key,value")
          .eq("business_id", businessId)
          .in("key", ["whatsapp_provider", "auto_reminder", "dashboard_motivation", "favicon_url", "use_logo_as_favicon", "catalog_enabled", "catalog_description", "catalog_show_prices", "catalog_accept_orders", "promo_popup", "promo_marquee"]),
      ]);

      if (b) {
        setTemplateSlug(String(b.template_slug ?? "catering"));
        setLogoUrl(b.logo_url ? String(b.logo_url) : null);
        setLogoPreviewError(false);
        setForm({
          name: b.name,
          address: b.address ?? "",
          whatsapp: b.whatsapp ?? "",
          email: b.email ?? "",
          timezone: b.timezone ?? "Asia/Jakarta",
          currency: b.currency ?? "IDR",
          invoice_prefix: b.invoice_prefix ?? "INV",
          order_prefix: b.order_prefix ?? "ORD",
          sku_prefix: b.sku_prefix ?? "SKU",
        });
      }

      for (const row of s ?? []) {
        if (row.key === "whatsapp_provider") {
          setProvider(String((row.value as Record<string, unknown>)?.provider ?? "manual"));
        }
        if (row.key === "auto_reminder") {
          setAutoReminder(Boolean((row.value as Record<string, unknown>)?.enabled));
        }
        if (row.key === "favicon_url") { setFaviconUrl(String((row.value as Record<string, unknown>)?.url ?? "") || null); setFaviconPreviewError(false); }
        if (row.key === "use_logo_as_favicon") setUseLogoAsFavicon(Boolean((row.value as Record<string, unknown>)?.enabled ?? true));
        if (row.key === "catalog_enabled") setCatalogEnabled(Boolean((row.value as Record<string, unknown>)?.enabled));
        if (row.key === "catalog_description") setCatalogDescription(String((row.value as Record<string, unknown>)?.text ?? ""));
        if (row.key === "catalog_show_prices") setCatalogShowPrices(Boolean((row.value as Record<string, unknown>)?.enabled ?? true));
        if (row.key === "catalog_accept_orders") setCatalogAcceptOrders(Boolean((row.value as Record<string, unknown>)?.enabled ?? true));
        if (row.key === "promo_popup") {
          const v = (row.value ?? {}) as Record<string, unknown>;
          setPromoPopupImageUrl(String(v.image_url ?? "") || null);
          setPromoImagePreviewError(false);
          setPromoPopupEnabled(Boolean(v.enabled));
          setPromoPopupTitle(String(v.title ?? "Promo & Pengumuman"));
          setPromoPopupText(String(v.text ?? "Ada promo terbaru untuk pelanggan Anda."));
          setPromoPopupButton(String(v.button ?? "Lihat Promo"));
          setPromoPopupUrl(String(v.url ?? ""));
          setPromoPopupDelay(Math.min(15, Math.max(0, Number(v.delay_seconds ?? 3))));
        }
        if (row.key === "promo_marquee") {
          const v = (row.value ?? {}) as Record<string, unknown>;
          setPromoMarqueeEnabled(Boolean(v.enabled));
          setPromoMarqueeText(String(v.text ?? "🔥 Promo terbaru tersedia — klik untuk melihat detail."));
          setPromoMarqueeUrl(String(v.url ?? ""));
        }
        if (row.key === "dashboard_motivation") {
          const parsed = normalizeDashboardMotivation(row.value);
          setMotivationEnabled(parsed.enabled);
          setQuotes(parsed.quotes);
        }
      }
    })();
  }, [businessId, supabase]);

  function updateQuote(index: number, value: string) {
    setQuotes((current) => current.map((quote, i) => (i === index ? value : quote)));
  }

  function addQuote() {
    setQuotes((current) => (current.length >= 20 ? current : [...current, ""]));
  }

  function removeQuote(index: number) {
    setQuotes((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [""];
    });
  }

  function resetQuotes() {
    setQuotes([...DEFAULT_DASHBOARD_QUOTES]);
    setMotivationEnabled(true);
  }

  async function uploadBrandAsset(kind: "logo" | "favicon" | "promo", file: File) {
    if (!canOwner) return;
    const setter = kind === "logo" ? setUploadingLogo : kind === "favicon" ? setUploadingFavicon : setUploadingPromoImage;
    setter(true);
    setMsg(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
      if (file.size > 2 * 1024 * 1024) throw new Error("Ukuran file maksimal 2 MB.");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${businessId}/${kind}-${Date.now()}.${ext}`;
      const bucket = supabase.storage.from("branding");
      const { error: uploadError } = await bucket.upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (uploadError) {
        const message = String(uploadError.message || "");
        if (/bucket.*not found|not found.*bucket/i.test(message)) {
          throw new Error("Storage branding belum tersedia. Jalankan migration supabase/migrations/202609240005_branding_uploads_hardening.sql di Supabase, lalu coba upload lagi.");
        }
        if (/row-level security|rls|policy/i.test(message)) {
          throw new Error(`Upload ditolak oleh policy Storage branding. Pastikan migration 202609240005_branding_uploads_hardening.sql sudah dijalankan dan akun ini adalah Owner aktif. Detail: ${message}`);
        }
        throw uploadError;
      }
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      if (kind === "logo") {
        const { data: savedBusiness, error } = await supabase
          .from("businesses")
          .update({ logo_url: url })
          .eq("id", businessId)
          .select("id,logo_url")
          .single();
        if (error) throw error;
        const savedUrl = String(savedBusiness?.logo_url ?? "");
        if (!savedUrl) throw new Error("Logo berhasil di-upload tetapi belum tersimpan di data usaha.");
        setLogoUrl(savedUrl);
        setLogoPreviewError(false);
      } else if (kind === "favicon") {
        const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "favicon_url", value: { url } }, { onConflict: "business_id,key" });
        if (error) throw error;
        setFaviconUrl(url);
        setFaviconPreviewError(false);
      } else {
        const { error } = await supabase.from("business_settings").upsert({
          business_id: businessId,
          key: "promo_popup",
          value: {
            enabled: promoPopupEnabled,
            title: promoPopupTitle.trim(),
            text: promoPopupText.trim(),
            button: promoPopupButton.trim(),
            url: safeExternalUrl(promoPopupUrl),
            delay_seconds: Math.min(15, Math.max(0, Number(promoPopupDelay) || 0)),
            image_url: url,
          },
        }, { onConflict: "business_id,key" });
        if (error) throw error;
        setPromoPopupImageUrl(url);
        setPromoImagePreviewError(false);
      }
      window.dispatchEvent(new CustomEvent("imersorder:branding-updated", { detail: { logoUrl: kind === "logo" ? url : logoUrl, faviconUrl: kind === "favicon" ? url : faviconUrl, promoImageUrl: kind === "promo" ? url : promoPopupImageUrl } }));
      setMsg({ kind: "success", text: `${kind === "logo" ? "Logo" : kind === "favicon" ? "Favicon" : "Gambar popup"} berhasil diperbarui.` });
    } catch (e) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string; statusCode?: string | number };
      const detail = [err?.message, err?.details, err?.hint].filter(Boolean).join(" — ");
      const text = detail || (e instanceof Error ? e.message : "Gagal mengunggah gambar.");
      setMsg({ kind: "error", text });
    } finally {
      setter(false);
    }
  }

  async function selectBrandMedia(kind: "logo" | "favicon" | "promo", url: string) {
    if (!canOwner) return;
    setMsg(null);
    try {
      if (kind === "logo") {
        const { error } = await supabase.from("businesses").update({ logo_url: url }).eq("id", businessId);
        if (error) throw error;
        setLogoUrl(url); setLogoPreviewError(false);
      } else if (kind === "favicon") {
        const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "favicon_url", value: { url } }, { onConflict: "business_id,key" });
        if (error) throw error;
        setFaviconUrl(url); setFaviconPreviewError(false);
      } else {
        const { error } = await supabase.from("business_settings").upsert({
          business_id: businessId, key: "promo_popup", value: {
            enabled: promoPopupEnabled, title: promoPopupTitle.trim(), text: promoPopupText.trim(), button: promoPopupButton.trim(),
            url: safeExternalUrl(promoPopupUrl), delay_seconds: Math.min(15, Math.max(0, Number(promoPopupDelay) || 0)), image_url: url,
          },
        }, { onConflict: "business_id,key" });
        if (error) throw error;
        setPromoPopupImageUrl(url); setPromoImagePreviewError(false);
      }
      window.dispatchEvent(new CustomEvent("imersorder:branding-updated", { detail: { logoUrl: kind === "logo" ? url : logoUrl, faviconUrl: kind === "favicon" ? url : faviconUrl, promoImageUrl: kind === "promo" ? url : promoPopupImageUrl } }));
      setMediaPicker(null);
      setMsg({ kind: "success", text: `${kind === "logo" ? "Logo" : kind === "favicon" ? "Favicon" : "Gambar popup"} berhasil dipilih dari Media.` });
    } catch (e) {
      const err = e as { message?: string };
      setMsg({ kind: "error", text: err?.message || "Gagal menggunakan media." });
    }
  }

  async function removePromoImage() {
    if (!canOwner) return;
    setMsg(null);
    const current = {
      enabled: promoPopupEnabled, title: promoPopupTitle.trim(), text: promoPopupText.trim(), button: promoPopupButton.trim(),
      url: safeExternalUrl(promoPopupUrl), delay_seconds: Math.min(15, Math.max(0, Number(promoPopupDelay) || 0)), image_url: null,
    };
    const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "promo_popup", value: current }, { onConflict: "business_id,key" });
    if (error) return setMsg({ kind: "error", text: error.message });
    setPromoPopupImageUrl(null);
    setPromoImagePreviewError(false);
    setMsg({ kind: "success", text: "Gambar popup dihapus." });
  }

  async function removeBrandAsset(kind: "logo" | "favicon") {
    if (!canOwner) return;
    setMsg(null);
    if (kind === "logo") {
      const { error } = await supabase.from("businesses").update({ logo_url: null }).eq("id", businessId);
      if (error) return setMsg({ kind: "error", text: error.message });
      setLogoUrl(null);
      setLogoPreviewError(false);
    } else {
      const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "favicon_url", value: { url: null } }, { onConflict: "business_id,key" });
      if (error) return setMsg({ kind: "error", text: error.message });
      setFaviconUrl(null);
      setFaviconPreviewError(false);
    }
    window.dispatchEvent(new Event("imersorder:branding-updated"));
    setMsg({ kind: "success", text: `${kind === "logo" ? "Logo" : "Favicon"} dihapus.` });
  }

  async function saveFaviconPreference(enabled: boolean) {
    setUseLogoAsFavicon(enabled);
    if (!canOwner) return;
    const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "use_logo_as_favicon", value: { enabled } }, { onConflict: "business_id,key" });
    if (error) setMsg({ kind: "error", text: error.message });
    window.dispatchEvent(new Event("imersorder:branding-updated"));
  }

  async function seedExistingDemo() {
    if (!canOwner || templateSlug !== "catering") return;
    if (!window.confirm("Isi usaha ini dengan data contoh Katering: 10 pelanggan, 6 produk, 10 transaksi, invoice, pembayaran, dan piutang? Data contoh akan ditambahkan dan tidak akan diulang jika sudah pernah diisi.")) return;
    setSeedingDemo(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("seed_catering_demo_data", { p_business_id: businessId });
    setSeedingDemo(false);
    if (error) {
      setMsg({ kind: "error", text: error.message });
      return;
    }
    const result = (data ?? {}) as { seeded?: boolean; already_seeded?: boolean };
    if (result.already_seeded) {
      setMsg({ kind: "success", text: "Data contoh Katering sudah pernah ditambahkan ke usaha ini." });
      return;
    }
    setMsg({ kind: "success", text: "Data contoh berhasil ditambahkan: 10 pelanggan, 6 produk, dan 10 transaksi Katering lengkap dengan invoice, pembayaran, dan sisa piutang." });
    setTimeout(() => window.location.reload(), 700);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canOwner) {
      setMsg({ kind: "error", text: "Hanya owner yang dapat mengubah pengaturan usaha." });
      return;
    }

    const cleanedQuotes = quotes.map((quote) => quote.trim()).filter(Boolean).slice(0, 20);
    if (motivationEnabled && cleanedQuotes.length === 0) {
      setMsg({ kind: "error", text: "Isi minimal satu quote motivasi atau nonaktifkan quote dashboard." });
      return;
    }
    const popupUrl = safeExternalUrl(promoPopupUrl);
    const marqueeUrl = safeExternalUrl(promoMarqueeUrl);
    if (promoPopupEnabled && !popupUrl) {
      setMsg({ kind: "error", text: "URL Popup wajib berupa alamat HTTPS yang valid." });
      return;
    }
    if (promoMarqueeEnabled && promoMarqueeUrl.trim() && !marqueeUrl) {
      setMsg({ kind: "error", text: "URL Marquee harus berupa alamat HTTPS yang valid." });
      return;
    }

    setSaving(true);
    setMsg(null);
    const skuPrefix = cleanPrefix(form.sku_prefix, "SKU");
    const { error } = await supabase
      .from("businesses")
      .update({
        ...form,
        name: form.name.trim(),
        address: form.address.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        invoice_prefix: cleanPrefix(form.invoice_prefix, "INV"),
        order_prefix: cleanPrefix(form.order_prefix, "ORD"),
        sku_prefix: skuPrefix,
      })
      .eq("id", businessId);

    if (!error) {
      const settings = await supabase.from("business_settings").upsert(
        [
          { business_id: businessId, key: "whatsapp_provider", value: { provider } },
          { business_id: businessId, key: "auto_reminder", value: { enabled: provider !== "manual" && autoReminder } },
          { business_id: businessId, key: "use_logo_as_favicon", value: { enabled: useLogoAsFavicon } },
          { business_id: businessId, key: "catalog_enabled", value: { enabled: catalogEnabled } },
          { business_id: businessId, key: "catalog_description", value: { text: catalogDescription.trim() } },
          { business_id: businessId, key: "catalog_show_prices", value: { enabled: catalogShowPrices } },
          { business_id: businessId, key: "catalog_accept_orders", value: { enabled: catalogAcceptOrders } },
          { business_id: businessId, key: "promo_popup", value: { enabled: promoPopupEnabled, title: promoPopupTitle.trim(), text: promoPopupText.trim(), button: promoPopupButton.trim(), url: popupUrl, delay_seconds: Math.min(15, Math.max(0, Number(promoPopupDelay) || 0)), image_url: promoPopupImageUrl } },
          { business_id: businessId, key: "promo_marquee", value: { enabled: promoMarqueeEnabled, text: promoMarqueeText.trim(), url: marqueeUrl } },
          {
            business_id: businessId,
            key: "dashboard_motivation",
            value: { enabled: motivationEnabled, quotes: cleanedQuotes },
          },
        ],
        { onConflict: "business_id,key" },
      );
      if (settings.error) {
        setSaving(false);
        setMsg({ kind: "error", text: settings.error.message });
        return;
      }
    }

    setSaving(false);
    if (error) {
      setMsg({ kind: "error", text: error.message });
      return;
    }

    setForm((value) => ({ ...value, sku_prefix: skuPrefix }));
    if (cleanedQuotes.length) setQuotes(cleanedQuotes);
    setMsg({ kind: "success", text: "Pengaturan usaha dan quote dashboard tersimpan." });
  }

  return (
    <>
      <ModuleHeader
        title="Pengaturan Usaha"
        subtitle="Profil, sapaan dashboard, kode otomatis, nomor dokumen, dan preferensi integrasi"
      />
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <form className="formPanel" onSubmit={save}>
        <h2>Profil Usaha</h2>
        <div className="fieldGrid">
          <label className="formField full">
            Nama Usaha
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="formField full">
            Alamat
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="formField">
            WhatsApp
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </label>
          <label className="formField">
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>

        <div className="settingsSectionHead">
          <div>
            <h2>Branding & Identitas</h2>
            <p>Upload logo usaha dan favicon langsung dari Pengaturan. File disimpan di Supabase Storage instalasi ini.</p>
          </div>
          <span className="settingsFeatureIcon"><ImageIcon size={17} /></span>
        </div>
        <div className="brandingCurrent">
          <div className="brandingCurrentPreview">
            {logoUrl && !logoPreviewError ? <img key={logoUrl} src={logoUrl} alt="Logo usaha yang sedang digunakan" onError={() => setLogoPreviewError(true)} /> : <ImageIcon size={34} />}
          </div>
          <div className="brandingCurrentCopy">
            <span className={logoUrl && !logoPreviewError ? "brandingStatus active" : "brandingStatus"}>{logoUrl && !logoPreviewError ? "✓ LOGO AKTIF" : "BELUM ADA LOGO"}</span>
            <strong>{logoUrl && !logoPreviewError ? "Logo ini sedang digunakan aplikasi" : "Upload logo usaha untuk mengganti identitas aplikasi"}</strong>
            <small>{logoUrl && !logoPreviewError ? "Logo yang tampil di sini akan digunakan pada header, dashboard, login, dan katalog publik." : "Setelah upload berhasil, preview ini langsung berubah agar bisa dipastikan sebelum pindah halaman."}</small>
          </div>
        </div>
        <div className="brandingUploadGrid">
          <div className="brandingUploadCard">
            <div className="brandingPreview">{logoUrl && !logoPreviewError ? <img key={logoUrl} src={logoUrl} alt="Logo usaha" onError={() => setLogoPreviewError(true)} /> : <ImageIcon size={28} />}</div>
            <div className="brandingUploadCopy"><strong>Logo Usaha</strong><small>PNG, JPG, WEBP · maksimal 2 MB</small></div>
            {canOwner ? <div className="brandingActions">
              <button type="button" className="miniButton primary" disabled={!canOwner} onClick={() => setMediaPicker("logo")}><ImageIcon size={14} /> {logoUrl ? "Ganti / Pilih Logo" : "Pilih Logo"}</button>
              {logoUrl ? <button type="button" className="miniButton danger" onClick={() => void removeBrandAsset("logo")}><X size={14}/> Hapus</button> : null}
            </div> : null}
          </div>
          <div className="brandingUploadCard">
            <div className="brandingPreview faviconPreview">{faviconUrl && !faviconPreviewError ? <img key={faviconUrl} src={faviconUrl} alt="Favicon" onError={() => setFaviconPreviewError(true)} /> : <ImageIcon size={24} />}</div>
            <div className="brandingUploadCopy"><strong>Favicon</strong><small>Ikon tab browser/PWA · maksimal 2 MB</small></div>
            {canOwner ? <div className="brandingActions">
              <button type="button" className="miniButton primary" disabled={!canOwner} onClick={() => setMediaPicker("favicon")}><ImageIcon size={14} /> {faviconUrl ? "Ganti / Pilih Favicon" : "Pilih Favicon"}</button>
              {faviconUrl ? <button type="button" className="miniButton danger" onClick={() => void removeBrandAsset("favicon")}><X size={14}/> Hapus</button> : null}
            </div> : null}
          </div>
        </div>
        <label className="checkboxField brandingFaviconToggle">
          <input type="checkbox" checked={useLogoAsFavicon} disabled={!canOwner} onChange={(e) => void saveFaviconPreference(e.target.checked)} />
          Gunakan logo utama sebagai favicon jika favicon khusus tidak digunakan
        </label>

        {canOwner && templateSlug === "catering" ? (
          <div className="catalogSettingsBox" style={{ marginTop: 16 }}>
            <div className="settingsSectionHead" style={{ marginTop: 0 }}>
              <div>
                <h2>Data Contoh Katering</h2>
                <p>Untuk usaha yang sudah dibuat, data demo tetap bisa ditambahkan tanpa membuat usaha baru.</p>
              </div>
            </div>
            <button type="button" className="miniButton primary" onClick={() => void seedExistingDemo()} disabled={seedingDemo}>
              {seedingDemo ? "Menambahkan data..." : "Isi Data Contoh Katering"}
            </button>
            <div className="formHint" style={{ marginTop: 8 }}>10 pelanggan · 6 produk · 10 transaksi · invoice · pembayaran · sisa piutang. Data demo hanya bisa di-seed sekali untuk usaha ini.</div>
          </div>
        ) : null}

        <div className="settingsSectionHead">
          <div>
            <h2>Katalog Online</h2>
            <p>Aktifkan halaman katalog publik di alamat utama aplikasi. Pengunjung tidak perlu login untuk melihat dan mengirim pesanan.</p>
          </div>
          <span className="settingsFeatureIcon"><ShoppingBag size={17} /></span>
        </div>
        <div className="catalogSettingsBox">
          <label className="checkboxField catalogMainToggle"><input type="checkbox" checked={catalogEnabled} disabled={!canOwner} onChange={e=>setCatalogEnabled(e.target.checked)} /><span><strong>Katalog Online Aktif</strong><small>{catalogEnabled ? "URL utama akan membuka katalog publik." : "URL utama tetap meminta login."}</small></span></label>
          <div className="fieldGrid">
            <label className="formField full">Deskripsi Katalog<input value={catalogDescription} disabled={!canOwner} onChange={e=>setCatalogDescription(e.target.value)} placeholder="Katering, kue, custom, jasa, dan lainnya" /></label>
            <label className="checkboxField"><input type="checkbox" checked={catalogShowPrices} disabled={!canOwner} onChange={e=>setCatalogShowPrices(e.target.checked)} />Tampilkan harga</label>
            <label className="checkboxField"><input type="checkbox" checked={catalogAcceptOrders} disabled={!canOwner} onChange={e=>setCatalogAcceptOrders(e.target.checked)} />Terima pesanan online</label>
          </div>
          <div className="catalogUrlHint"><strong>URL katalog:</strong> alamat utama aplikasi ini. Customer cukup membuka URL tersebut tanpa login.</div>
        </div>

        <div className="settingsSectionHead">
          <div>
            <h2>Promosi Katalog</h2>
            <p>Tambahkan pengumuman atau promo ringan di katalog publik. Keduanya opsional dan default-nya mati.</p>
          </div>
          <span className="settingsFeatureIcon"><ShoppingBag size={17} /></span>
        </div>
        <div className="catalogSettingsBox promoSettingsBox">
          <label className="checkboxField catalogMainToggle"><input type="checkbox" checked={promoPopupEnabled} disabled={!canOwner} onChange={e=>setPromoPopupEnabled(e.target.checked)} /><span><strong>Popup Promo Aktif</strong><small>Popup hanya muncul di katalog publik. Klik popup/tombol akan membuka URL tujuan.</small></span></label>
          <div className="fieldGrid">
            <label className="formField"><span>Judul Popup</span><input value={promoPopupTitle} disabled={!canOwner} onChange={e=>setPromoPopupTitle(e.target.value)} maxLength={80} /></label>
            <label className="formField"><span>Teks Tombol</span><input value={promoPopupButton} disabled={!canOwner} onChange={e=>setPromoPopupButton(e.target.value)} maxLength={40} /></label>
            <label className="formField full"><span>Isi Popup</span><textarea value={promoPopupText} disabled={!canOwner} onChange={e=>setPromoPopupText(e.target.value)} maxLength={240} /></label>
            <div className="formField full">
              <span>Gambar / Banner Popup</span>
              <div className="promoImageUploadRow">
                {promoPopupImageUrl && !promoImagePreviewError ? <img className="promoImagePreview" src={promoPopupImageUrl} alt="Preview promo" onError={()=>setPromoImagePreviewError(true)} /> : <div className="promoImagePlaceholder"><ImageIcon size={20}/><span>Belum ada gambar</span></div>}
                <div className="promoImageUploadActions">
                  <button type="button" className="miniButton primary" disabled={!canOwner} onClick={() => setMediaPicker("promo")}><ImageIcon size={14}/> {promoPopupImageUrl ? "Ganti / Pilih Gambar" : "Pilih Gambar"}</button>
                  {promoPopupImageUrl ? <button type="button" className="miniButton danger" disabled={!canOwner || uploadingPromoImage} onClick={()=>void removePromoImage()}><X size={14}/> Hapus</button> : null}
                  <small>Media yang sudah pernah di-upload bisa dipakai kembali. Upload baru hanya jika belum tersedia. Media yang tidak digunakan bisa dihapus dari Media.</small>
                </div>
              </div>
            </div>
            <label className="formField"><span>URL Tujuan</span><input type="url" value={promoPopupUrl} disabled={!canOwner} onChange={e=>setPromoPopupUrl(e.target.value)} placeholder="https://contoh.com/promo" /></label>
            <label className="formField"><span>Muncul Setelah (detik)</span><input type="number" min={0} max={15} value={promoPopupDelay} disabled={!canOwner} onChange={e=>setPromoPopupDelay(Number(e.target.value || 0))} /></label>
          </div>
          <div className="formHint">Popup dibatasi sekali per sesi browser agar tidak mengganggu pelanggan.</div>
          <div className="promoDivider" />
          <label className="checkboxField catalogMainToggle"><input type="checkbox" checked={promoMarqueeEnabled} disabled={!canOwner} onChange={e=>setPromoMarqueeEnabled(e.target.checked)} /><span><strong>Text Marquee Aktif</strong><small>Teks berjalan di bagian atas katalog dan bisa diarahkan ke hyperlink.</small></span></label>
          <div className="fieldGrid">
            <label className="formField full"><span>Teks Marquee</span><input value={promoMarqueeText} disabled={!canOwner} onChange={e=>setPromoMarqueeText(e.target.value)} maxLength={180} /></label>
            <label className="formField full"><span>URL Tujuan (opsional)</span><input type="url" value={promoMarqueeUrl} disabled={!canOwner} onChange={e=>setPromoMarqueeUrl(e.target.value)} placeholder="https://contoh.com/promo" /></label>
          </div>
          <div className="formHint">Kalau URL diisi, marquee menjadi link yang bisa diklik. Warna otomatis mengikuti tema katalog.</div>
        </div>

        <div className="settingsSectionHead">
          <div>
            <h2>Sapaan & Quote Dashboard</h2>
            <p>Nama mengikuti akun yang sedang login. Quote dipilih acak setiap kali Dashboard dibuka.</p>
          </div>
          <span className="settingsFeatureIcon"><Shuffle size={17} /></span>
        </div>
        <label className="checkboxField motivationToggle">
          <input
            type="checkbox"
            checked={motivationEnabled}
            onChange={(e) => setMotivationEnabled(e.target.checked)}
          />
          Tampilkan quote motivasi di bawah sapaan
        </label>
        <div className="quoteEditorList">
          {quotes.map((quote, index) => (
            <div className="quoteEditorRow" key={`quote-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <textarea
                value={quote}
                maxLength={180}
                onChange={(e) => updateQuote(index, e.target.value)}
                placeholder={`Quote motivasi ${index + 1}`}
                disabled={!canOwner}
              />
              {canOwner ? (
                <button type="button" className="quoteDelete" onClick={() => removeQuote(index)} aria-label={`Hapus quote ${index + 1}`}>
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {canOwner ? (
          <div className="quoteEditorActions">
            <button type="button" className="miniButton primary" onClick={addQuote} disabled={quotes.length >= 20}>
              <Plus size={14} /> Tambah Quote
            </button>
            <button type="button" className="miniButton" onClick={resetQuotes}>Isi 10 Quote Bawaan</button>
            <small>{quotes.length}/20 quote</small>
          </div>
        ) : null}

        <h2 style={{ marginTop: 20 }}>Kode Otomatis</h2>
        <div className="fieldGrid">
          <label className="formField">
            Prefix SKU Produk/Jasa
            <input
              maxLength={12}
              value={form.sku_prefix}
              onChange={(e) => setForm({ ...form, sku_prefix: cleanPrefix(e.target.value, "") })}
              placeholder="SKU"
            />
            <span className="formHint">
              Contoh hasil: {cleanPrefix(form.sku_prefix, "SKU")}-000001. Nomor dibuat otomatis dan aman dari duplikat.
            </span>
          </label>
          <label className="formField">
            Prefix Order
            <input value={form.order_prefix} onChange={(e) => setForm({ ...form, order_prefix: e.target.value })} />
          </label>
          <label className="formField">
            Prefix Invoice
            <input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} />
          </label>
          <label className="formField">
            Timezone
            <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </label>
          <label className="formField">
            Currency
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </label>
        </div>

        <h2 style={{ marginTop: 20 }}>WhatsApp</h2>
        <div className="fieldGrid">
          <label className="formField">
            Provider
            <select value={provider} onChange={(e) => { const next=e.target.value; setProvider(next); if(next==="manual") setAutoReminder(false); }}>
              <option value="manual">Manual wa.me</option>
              <option value="fonnte">Fonnte</option>
              <option value="starsender">Starsender</option>
            </select>
            <span className="formHint">Token provider tetap disimpan server-side, bukan di database.</span>
          </label>
          <label className="checkboxField">
            <input
              type="checkbox"
              checked={provider !== "manual" && autoReminder}
              disabled={provider === "manual"}
              onChange={(e) => setAutoReminder(e.target.checked)}
            />
            Auto kirim reminder WhatsApp
          </label>
          <div className="full">
            <Notice kind="info">
              Reminder jatuh tempo di Dashboard/Piutang selalu aktif. Pengiriman WhatsApp otomatis hanya berjalan jika Fonnte/Starsender dipilih, token gateway tersedia, dan Auto kirim reminder diaktifkan.
            </Notice>
          </div>
        </div>
        <FormActions saving={saving} submitLabel="Simpan Pengaturan" />
      </form>
      {!canOwner ? (
        <Notice kind="info">Role Anda hanya dapat melihat pengaturan. Perubahan profil usaha khusus owner.</Notice>
      ) : null}
      <MediaPicker
        open={mediaPicker !== null}
        businessId={businessId}
        bucket="branding"
        title={mediaPicker === "logo" ? "Pilih Logo dari Media" : mediaPicker === "favicon" ? "Pilih Favicon dari Media" : "Pilih Gambar Popup dari Media"}
        currentUrl={mediaPicker === "logo" ? logoUrl : mediaPicker === "favicon" ? faviconUrl : promoPopupImageUrl}
        accept={mediaPicker === "favicon" ? "image/png,image/jpeg,image/webp,image/x-icon" : "image/png,image/jpeg,image/webp"}
        onClose={() => setMediaPicker(null)}
        onSelect={(url) => { if (mediaPicker) void selectBrandMedia(mediaPicker, url); }}
      />
    </>
  );
}
