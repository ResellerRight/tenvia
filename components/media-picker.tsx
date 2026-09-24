"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

type MediaItem = { name: string; url: string; path: string; created_at?: string | null };

type Props = {
  open: boolean;
  businessId: string;
  bucket: "branding" | "product-images";
  title?: string;
  currentUrl?: string | null;
  accept?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
};

function cleanUrl(url: string | null | undefined) {
  return String(url || "").split("?")[0];
}

function isImageName(name: string) {
  return /\.(png|jpe?g|webp|gif|ico)$/i.test(name);
}

export function MediaPicker({ open, businessId, bucket, title = "Media Tersedia", currentUrl, accept = "image/png,image/jpeg,image/webp", onClose, onSelect }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [protectedPaths, setProtectedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!open || !businessId) return;
    setLoading(true); setMsg("");
    const storage = supabase.storage.from(bucket);
    const { data, error } = await storage.list(businessId, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) { setMsg(error.message); setItems([]); setLoading(false); return; }
    const files = (data || []).filter((x) => x.name && isImageName(x.name));
    const refs = new Set<string>();
    const [{ data: biz }, { data: settings }, { data: products }] = await Promise.all([
      supabase.from("businesses").select("logo_url").eq("id", businessId).maybeSingle(),
      supabase.from("business_settings").select("key,value").eq("business_id", businessId).in("key", ["favicon_url", "promo_popup"]),
      supabase.from("catalog_items").select("image_url").eq("business_id", businessId).not("image_url", "is", null),
    ]);
    const urls: string[] = [];
    if (biz?.logo_url) urls.push(String(biz.logo_url));
    for (const row of settings || []) {
      const v = row.value as Record<string, unknown> | null;
      if (row.key === "favicon_url" && v?.url) urls.push(String(v.url));
      if (row.key === "promo_popup" && v?.image_url) urls.push(String(v.image_url));
    }
    for (const p of products || []) if (p.image_url) urls.push(String(p.image_url));
    for (const u of urls) {
      const raw = cleanUrl(u);
      const marker = `/${bucket}/`;
      const i = raw.indexOf(marker);
      if (i >= 0) refs.add(decodeURIComponent(raw.slice(i + marker.length)));
    }
    setProtectedPaths(refs);
    setItems(files.map((f) => {
      const path = `${businessId}/${f.name}`;
      const pub = storage.getPublicUrl(path).data.publicUrl;
      const stamp = f.created_at ? new Date(f.created_at).getTime() : Date.now();
      return { name: f.name, path, url: `${pub}?v=${stamp}`, created_at: f.created_at };
    }));
    setLoading(false);
  }, [bucket, businessId, open, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function upload(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMsg("File harus berupa gambar.");
    if (file.size > 2 * 1024 * 1024) return setMsg("Ukuran gambar maksimal 2 MB.");
    setUploading(true); setMsg("");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const prefix = bucket === "product-images" ? "media" : "media";
    const path = `${businessId}/${prefix}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
    if (error) { setUploading(false); return setMsg(error.message); }
    const pub = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const url = `${pub}?v=${Date.now()}`;
    setUploading(false);
    await load();
    onSelect(url);
    onClose();
  }

  async function remove(item: MediaItem) {
    if (protectedPaths.has(item.path)) { setMsg("Media ini sedang digunakan dan tidak bisa dihapus."); return; }
    if (!confirm("Hapus media ini dari Supabase Storage?")) return;
    setDeleting(item.path); setMsg("");
    const { error } = await supabase.storage.from(bucket).remove([item.path]);
    if (error) setMsg(error.message);
    else await load();
    setDeleting(null);
  }

  if (!open) return null;
  return <div className="mediaPickerOverlay" onClick={onClose}>
    <div className="mediaPicker" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="mediaPickerHead">
        <div><h2>{title}</h2><p>Pilih gambar yang sudah ada atau upload media baru. Media yang sedang dipakai tidak bisa dihapus.</p></div>
        <button className="modalClose" onClick={onClose} aria-label="Tutup"><X size={18}/></button>
      </div>
      {msg ? <div className="mediaPickerNotice">{msg}</div> : null}
      <div className="mediaPickerToolbar">
        <label className="miniButton primary"><Upload size={14}/> {uploading ? "Mengunggah..." : "Upload Media Baru"}<input type="file" hidden accept={accept} disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void upload(f); }}/></label>
        <span>{items.length} media tersedia</span>
      </div>
      {loading ? <div className="mediaPickerEmpty"><Loader2 className="spin" size={22}/> Memuat media...</div> : items.length === 0 ? <div className="mediaPickerEmpty"><ImageIcon size={28}/><strong>Belum ada media</strong><span>Upload gambar baru untuk mulai membuat koleksi media.</span></div> : <div className="mediaGrid">{items.map((item) => {
        const selected = cleanUrl(currentUrl) === cleanUrl(item.url);
        const used = protectedPaths.has(item.path);
        return <div className={`mediaTile${selected ? " selected" : ""}`} key={item.path}>
          <button className="mediaTilePick" onClick={() => { onSelect(item.url); onClose(); }} title="Gunakan media ini"><img src={item.url} alt={item.name}/>{selected ? <span className="mediaSelected"><Check size={13}/></span> : null}</button>
          <div className="mediaTileFoot"><span title={item.name}>{item.name}</span><button className="mediaDelete" disabled={used || deleting === item.path} title={used ? "Sedang digunakan" : "Hapus media"} onClick={() => void remove(item)}>{deleting === item.path ? <Loader2 className="spin" size={13}/> : <Trash2 size={13}/>}</button></div>
        </div>;
      })}</div>}
    </div>
  </div>;
}
