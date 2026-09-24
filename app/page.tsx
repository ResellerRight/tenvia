import Link from "next/link";
import { Search, Store, ArrowRight, BookOpen, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CloudHome() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_cloud_directory");
  const tenants = Array.isArray(data) ? data : [];
  return <main className="cloudHome">
    <header className="cloudHeader"><div className="cloudBrand"><div className="cloudLogo">iO</div><div><strong>iMersOrders Cloud</strong><span>Katalog Online & Manajemen Pesanan</span></div></div><nav><Link href="/panduan"><BookOpen size={16}/> Panduan</Link><Link href="/auth/login"><LogIn size={16}/> Login</Link></nav></header>
    <section className="cloudHero"><span className="cloudEyebrow">MULTI-TENANT PLATFORM</span><h1>Setiap bisnis punya ruangnya sendiri.</h1><p>Temukan katalog bisnis yang tersedia atau masuk ke workspace Anda.</p><div className="cloudSearch"><Search size={20}/><input placeholder="Cari nama bisnis atau katalog..." readOnly /></div></section>
    <section className="cloudDirectory"><div className="cloudSectionTitle"><div><span className="cloudEyebrow">DIRECTORY</span><h2>Bisnis & Katalog</h2></div><span>{tenants.length} katalog</span></div><div className="tenantGrid">{tenants.map((t:any)=><Link href={`/${t.slug}`} className="tenantCard" key={t.id}><div className="tenantLogo">{t.logo_url?<img src={t.logo_url} alt=""/>:<Store size={24}/>}</div><div><strong>{t.name}</strong><p>{t.description || "Katalog online"}</p><small>/{t.slug}</small></div><ArrowRight size={18}/></Link>)}</div>{!tenants.length?<div className="cloudEmpty">Belum ada katalog publik yang tersedia.</div>:null}</section>
    <footer className="cloudFooter">© iMersOrders Cloud · <Link href="/panduan">Panduan</Link></footer>
  </main>;
}
