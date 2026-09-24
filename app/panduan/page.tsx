import Link from "next/link";
import { ArrowLeft, BookOpen, ExternalLink, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function youtubeEmbed(url:string){ try { const u=new URL(url); if(u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`; if(u.hostname.includes("youtube.com")){ const id=u.searchParams.get("v"); if(id) return `https://www.youtube.com/embed/${id}`; } } catch {} return ""; }

export default async function PanduanPage(){
 const supabase=await createClient(); const {data}=await supabase.rpc("get_published_cloud_guides"); const guides=Array.isArray(data)?data:[];
 return <main className="guideStage"><header className="guideHeader"><Link href="/" className="guideBack"><ArrowLeft size={18}/> iMersOrders Cloud</Link><div><BookOpen size={20}/><strong>Panduan</strong></div></header><section className="guideHero"><span className="cloudEyebrow">PUSAT PANDUAN</span><h1>Pelajari iMersOrders Cloud</h1><p>Panduan penggunaan, video tutorial, dan tautan referensi untuk membantu Anda menjalankan workspace dengan lebih mudah.</p></section><section className="guideList">{guides.map((g:any)=>{const embed=g.youtube_url?youtubeEmbed(g.youtube_url):"";return <article className="guideCard" key={g.id}><div className="guideCardTop"><BookOpen size={22}/><div><h2>{g.title}</h2>{g.description?<p>{g.description}</p>:null}</div></div>{g.content?<div className="guideContent">{g.content}</div>:null}{embed?<div className="guideVideo"><iframe src={embed} title={g.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>:null}<div className="guideLinks">{g.youtube_url?<a href={g.youtube_url} target="_blank" rel="noreferrer"><PlayCircle size={17}/> Buka YouTube</a>:null}{g.external_url?<a href={g.external_url} target="_blank" rel="noreferrer"><ExternalLink size={17}/> Buka Link Referensi</a>:null}</div></article>})}{!guides.length?<div className="cloudEmpty">Belum ada panduan yang dipublikasikan.</div>:null}</section></main>;
}
