"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingBag, Share2, Plus, Minus, CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatIDR } from "@/lib/format";
import { applyThemeToDocument } from "@/lib/theme-client";
import { normalizeThemeSettings } from "@/lib/themes";

type Item={id:string;name:string;sku?:string|null;unit:string;price:number|string;description?:string|null;category:string;image_url?:string|null};
type Field={id:string;key:string;label:string;type:string;help_text?:string|null;placeholder?:string|null;required:boolean;sort_order:number;options:{id:string;label:string;value:string}[]};
type Data={enabled:boolean;business:{id:string;name:string;logo_url?:string|null;address?:string|null;whatsapp?:string|null;email?:string|null};settings:Record<string,any>;items:Item[];fields:Field[]};

type CartItem={item:Item;qty:number};
const settingEnabled=(settings:Record<string,any>,key:string,def:boolean)=>settings?.[key]?.enabled ?? def;
const settingText=(settings:Record<string,any>,key:string,def:string)=>settings?.[key]?.text ?? def;
const safeHttpsUrl=(value:any)=>{try{const u=new URL(String(value??"").trim());return u.protocol==="https:"?u.toString():"";}catch{return "";}};

export function PublicCatalog({data,tenantSlug}:{data:Data;tenantSlug?:string}){
  useEffect(() => {
    const raw = data.settings?.appearance_theme;
    if (raw) applyThemeToDocument(normalizeThemeSettings(raw), false);
  }, [data.settings]);
  const supabase=useMemo(()=>createClient(),[]);
  const [promoOpen,setPromoOpen]=useState(false);
  const [q,setQ]=useState(""); const [category,setCategory]=useState("Semua"); const [cart,setCart]=useState<CartItem[]>([]); const [showCart,setShowCart]=useState(false); const [showForm,setShowForm]=useState(false); const [sent,setSent]=useState<{order_number:string;total:number}|null>(null); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [form,setForm]=useState<Record<string,string>>({name:"",whatsapp:"",email:"",address:"",expected_date:"",note:""});
  const popup = data.settings?.promo_popup ?? {};
  const marquee = data.settings?.promo_marquee ?? {};
  const popupUrl = safeHttpsUrl(popup.url);
  const marqueeUrl = safeHttpsUrl(marquee.url);
  const popupImageUrl = safeHttpsUrl(popup.image_url);
  const popupEnabled = Boolean(popup.enabled) && Boolean(popupUrl);
  const marqueeEnabled = Boolean(marquee.enabled) && Boolean(String(marquee.text ?? "").trim());
  useEffect(() => {
    if (!popupEnabled) return;
    const key = `imersorder:promo-popup:${data.business.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}
    const delay = Math.min(15000, Math.max(0, Number(popup.delay_seconds ?? 3) * 1000));
    const timer = window.setTimeout(() => {
      setPromoOpen(true);
      try { sessionStorage.setItem(key, "1"); } catch {}
    }, delay);
    return () => window.clearTimeout(timer);
  }, [popupEnabled, popup.delay_seconds, data.business.id]);
  const categories=useMemo(()=>["Semua",...Array.from(new Set(data.items.map(i=>i.category).filter(Boolean)))],[data.items]);
  const filtered=data.items.filter(i=>(category==="Semua"||i.category===category)&&`${i.name} ${i.description??""} ${i.sku??""}`.toLowerCase().includes(q.toLowerCase()));
  const total=cart.reduce((s,c)=>s+c.qty*Number(c.item.price),0); const count=cart.reduce((s,c)=>s+c.qty,0);
  function add(item:Item){setCart(c=>{const x=c.find(v=>v.item.id===item.id);return x?c.map(v=>v.item.id===item.id?{...v,qty:v.qty+1}:v):[...c,{item,qty:1}]});}
  function change(id:string,delta:number){setCart(c=>c.map(v=>v.item.id===id?{...v,qty:v.qty+delta}:v).filter(v=>v.qty>0));}
  async function submit(){setError("");if(!form.name.trim()||!form.whatsapp.trim())return setError("Nama dan WhatsApp wajib diisi.");if(!cart.length)return setError("Pilih minimal satu produk.");setSaving(true);const payload={...form,items:cart.map(c=>({catalog_item_id:c.item.id,qty:c.qty})),custom_fields:data.fields.map(f=>({definition_id:f.id,value:form[f.id]??""})).filter(x=>x.value!=="")};const {data:r,error:e}=await supabase.rpc("submit_public_catalog_order_by_slug",{p_slug:tenantSlug,p_payload:payload});setSaving(false);if(e){setError(e.message);return;}setSent({order_number:r.order_number,total:Number(r.total||0)});setCart([]);setShowForm(false);setShowCart(false);}
  if(sent)return <main className="publicCatalog"><div className="publicSuccess"><CheckCircle2 size={58}/><h1>Pesanan berhasil dikirim</h1><p>Terima kasih. Pesanan Anda sudah diterima oleh <strong>{data.business.name}</strong>.</p><div className="publicOrderCode">{sent.order_number}</div><p>Total pesanan <strong>{formatIDR(sent.total)}</strong></p><button className="catalogPrimary" onClick={()=>setSent(null)}>Kembali ke Katalog</button></div></main>;
  return <main className="publicCatalog">
    {marqueeEnabled ? <div className="catalogMarquee" role="status"><div className="catalogMarqueeTrack">{String(marquee.text)} &nbsp; • &nbsp; {String(marquee.text)}</div>{marqueeUrl ? <a href={marqueeUrl} target="_blank" rel="noopener noreferrer" aria-label="Buka promo">Buka</a> : null}</div> : null}
    <header className="catalogHeader"><div className="catalogBrand">{data.business.logo_url?<img src={data.business.logo_url} alt=""/>:<div className="catalogLogoFallback"><ShoppingBag size={24}/></div>}<div><strong>{data.business.name}</strong><span>{settingText(data.settings,"catalog_description","Katalog Online")}</span></div></div><div className="catalogHeaderActions"><button onClick={()=>navigator.share?navigator.share({title:data.business.name,url:location.href}):navigator.clipboard?.writeText(location.href)}><Share2 size={17}/> Bagikan</button>{count>0?<button className="catalogCartButton" onClick={()=>setShowCart(true)}><ShoppingBag size={17}/> Pesanan ({count})</button>:null}</div></header>
    <section className="catalogHero"><div><span className="catalogEyebrow">KATALOG ONLINE</span><h1>Pesan lebih mudah,<br/><em>langsung dari katalog.</em></h1><p>{settingText(data.settings,"catalog_description","Pilih produk yang Anda butuhkan, lalu kirim detail pesanan tanpa perlu login.")}</p></div></section>
    <section className="catalogBody"><label className="catalogSearch"><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari produk atau jasa..."/></label><div className="catalogCategories">{categories.map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <div className="publicProductGrid">{filtered.map(item=><article className="publicProductCard" key={item.id}><div className="productVisual">{item.image_url?<img src={item.image_url} alt={item.name} loading="lazy"/>:<ShoppingBag size={30}/>}</div><div className="productInfo"><span>{item.category}</span><h3>{item.name}</h3><p>{item.description||"Produk/jasa pilihan kami."}</p>{settingEnabled(data.settings,"catalog_show_prices",true)?<strong>{formatIDR(item.price)} <small>/ {item.unit}</small></strong>:null}<button onClick={()=>add(item)}><Plus size={16}/> Pesan</button></div></article>)}</div>
      {!filtered.length?<div className="catalogEmpty">Produk belum tersedia atau tidak ditemukan.</div>:null}
    </section>
    {count>0?<button className="floatingCatalogCart" onClick={()=>setShowCart(true)}><ShoppingBag size={20}/><span>{count} item</span><strong>{formatIDR(total)}</strong></button>:null}
    {showCart?<div className="catalogOverlay"><div className="catalogModal"><button className="modalClose" onClick={()=>setShowCart(false)}>×</button><h2>Pesanan Anda</h2>{cart.map(c=><div className="cartRow" key={c.item.id}><div><strong>{c.item.name}</strong><small>{formatIDR(c.item.price)} / {c.item.unit}</small></div><div className="qtyControl"><button onClick={()=>change(c.item.id,-1)}><Minus size={14}/></button><span>{c.qty}</span><button onClick={()=>change(c.item.id,1)}><Plus size={14}/></button></div></div>)}<div className="cartTotal"><span>Total</span><strong>{formatIDR(total)}</strong></div><button className="catalogPrimary" onClick={()=>{setShowCart(false);setShowForm(true)}}>Lanjutkan Pesanan</button></div></div>:null}
    {showForm?<div className="catalogOverlay"><div className="catalogModal"><button className="modalClose" onClick={()=>setShowForm(false)}>×</button><button className="catalogBack" onClick={()=>setShowForm(false)}><ArrowLeft size={16}/> Kembali</button><h2>Data Pesanan</h2><p className="modalIntro">Isi data berikut agar usaha dapat memproses pesanan Anda.</p><div className="catalogFormGrid"><label>Nama *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nama Anda"/></label><label>WhatsApp *<input value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} placeholder="08xxxxxxxxxx"/></label><label>Email<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Alamat<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Tanggal Pesanan<input type="date" value={form.expected_date} onChange={e=>setForm({...form,expected_date:e.target.value})}/></label><label className="full">Catatan<textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Catatan tambahan..."/></label>{data.fields.map(f=><label className="full" key={f.id}>{f.label}{f.required?" *":""}{f.type==="textarea"?<textarea value={form[f.id]??""} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.placeholder??""}/>:f.options?.length?<select value={form[f.id]??""} onChange={e=>setForm({...form,[f.id]:e.target.value})}><option value="">Pilih...</option>{f.options.map(o=><option key={o.id} value={o.value}>{o.label}</option>)}</select>:<input type={f.type==="date"?"date":f.type==="number"?"number":"text"} value={form[f.id]??""} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.placeholder??""}/>} {f.help_text?<small>{f.help_text}</small>:null}</label>)}</div>{error?<div className="catalogError">{error}</div>:null}<div className="catalogSubmitBar"><strong>{formatIDR(total)}</strong><button className="catalogPrimary" disabled={saving} onClick={()=>void submit()}>{saving?"Mengirim...":"Kirim Pesanan"}</button></div></div></div>:null}
    {promoOpen ? <div className="catalogOverlay promoOverlay" onClick={()=>setPromoOpen(false)}><div className="promoPopup" role="dialog" aria-modal="true" aria-label={String(popup.title ?? "Promo & Pengumuman")} onClick={e=>e.stopPropagation()}><button className="modalClose" onClick={()=>setPromoOpen(false)}>×</button>{popupImageUrl ? <div className="promoPopupImageWrap"><img className="promoPopupImage" src={popupImageUrl} alt="" /></div> : <div className="promoPopupIcon">✦</div>}<span className="promoPopupEyebrow">INFO & PROMO</span><h2>{String(popup.title ?? "Promo & Pengumuman")}</h2><p>{String(popup.text ?? "")}</p><div className="promoPopupActions"><button className="catalogSecondary" onClick={()=>setPromoOpen(false)}>Nanti</button><a className="catalogPrimary promoPopupButton" href={popupUrl} target="_blank" rel="noopener noreferrer">{String(popup.button ?? "Lihat Promo")}</a></div></div></div> : null}
  </main>;
}
