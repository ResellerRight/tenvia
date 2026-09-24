"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { ModuleHeader, Notice } from "@/components/crud-ui";
import { downloadCsv } from "@/lib/client-utils";
import { formatDate, formatIDR } from "@/lib/format";

type Summary={order_today:number;order_need_process:number;order_value_period:number;cash_received_period:number;active_receivables:number;due_today:number;overdue:number};
type Order={order_number:string;order_date:string;status:string;grand_total:number|string;amount_paid:number|string;balance_due:number|string};
type Payment={paid_at:string;kind:string;amount:number|string;method:string;reference:string|null};
type Invoice={invoice_number:string;issue_date:string;due_date:string|null;payment_status:string;grand_total:number|string;amount_paid:number|string;balance_due:number|string;customer_snapshot:Record<string,unknown>|null};
type Business={name:string;logo_url:string|null;address:string|null;email:string|null;whatsapp:string|null};

function esc(v:unknown){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]!));}
function monthBounds(value:string){const [y,m]=value.split("-").map(Number); const first=new Date(y,m-1,1); const last=new Date(y,m,0); return [first.toISOString().slice(0,10),last.toISOString().slice(0,10)] as const;}

export function ReportsManager({businessId}:{businessId:string}){
  const supabase=useMemo(()=>createClient(),[]); const now=new Date();
  const [from,setFrom]=useState(()=>new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10));
  const [to,setTo]=useState(()=>now.toISOString().slice(0,10));
  const [preset,setPreset]=useState("month"); const [month,setMonth]=useState(()=>now.toISOString().slice(0,7));
  const [summary,setSummary]=useState<Summary|null>(null); const [orders,setOrders]=useState<Order[]>([]); const [payments,setPayments]=useState<Payment[]>([]); const [invoices,setInvoices]=useState<Invoice[]>([]); const [business,setBusiness]=useState<Business|null>(null); const [msg,setMsg]=useState("");

  useEffect(()=>{void(async()=>{
    const [b,s,o,p,i]=await Promise.all([
      supabase.from("businesses").select("name,logo_url,address,email,whatsapp").eq("id",businessId).single(),
      supabase.rpc("get_dashboard_summary",{p_business_id:businessId,p_from:from,p_to:to}),
      supabase.from("orders").select("order_number,order_date,status,grand_total,amount_paid,balance_due").eq("business_id",businessId).is("deleted_at",null).gte("order_date",from).lte("order_date",to).order("order_date",{ascending:false}),
      supabase.from("payments").select("paid_at,kind,amount,method,reference").eq("business_id",businessId).eq("status","posted").gte("paid_at",`${from}T00:00:00`).lte("paid_at",`${to}T23:59:59`).order("paid_at",{ascending:false}),
      supabase.from("invoices").select("invoice_number,issue_date,due_date,payment_status,grand_total,amount_paid,balance_due,customer_snapshot").eq("business_id",businessId).is("deleted_at",null).gte("issue_date",from).lte("issue_date",to).order("issue_date",{ascending:false})
    ]);
    if(b.error)setMsg(b.error.message); else setBusiness(b.data as Business);
    if(s.error)setMsg(s.error.message); else setSummary(s.data as Summary);
    if(o.error)setMsg(o.error.message); if(p.error)setMsg(p.error.message); if(i.error)setMsg(i.error.message);
    setOrders((o.data??[]) as Order[]); setPayments((p.data??[]) as Payment[]); setInvoices((i.data??[]) as Invoice[]);
  })()},[businessId,from,to,supabase]);

  function applyPreset(v:string){setPreset(v); const d=new Date(); let a="",z="";
    if(v==="month"){[a,z]=monthBounds(d.toISOString().slice(0,7)); setMonth(d.toISOString().slice(0,7));}
    else if(v==="lastmonth"){const x=new Date(d.getFullYear(),d.getMonth()-1,1); [a,z]=monthBounds(x.toISOString().slice(0,7)); setMonth(x.toISOString().slice(0,7));}
    else if(v==="7"){const x=new Date(d);x.setDate(x.getDate()-6);a=x.toISOString().slice(0,10);z=d.toISOString().slice(0,10);}
    else if(v==="30"){const x=new Date(d);x.setDate(x.getDate()-29);a=x.toISOString().slice(0,10);z=d.toISOString().slice(0,10);}
    if(a){setFrom(a);setTo(z);}
  }
  function applyMonth(v:string){setMonth(v);const [a,z]=monthBounds(v);setFrom(a);setTo(z);setPreset("month");}
  function exportOrders(){downloadCsv(`imersorder-laporan-order-${from}-${to}.csv`,[["Nomor Order","Tanggal","Status","Nilai Order","Dibayar","Sisa"],...orders.map(o=>[o.order_number,o.order_date,o.status,o.grand_total,o.amount_paid,o.balance_due])])}
  function exportPayments(){downloadCsv(`imersorder-laporan-pembayaran-${from}-${to}.csv`,[["Tanggal","Jenis","Nominal","Metode","Referensi"],...payments.map(p=>[p.paid_at,p.kind,p.amount,p.method,p.reference??""])])}
  function exportInvoices(){downloadCsv(`imersorder-laporan-invoice-${from}-${to}.csv`,[["Invoice","Tanggal","Jatuh Tempo","Status","Total","Dibayar","Sisa","Pelanggan"],...invoices.map(i=>[i.invoice_number,i.issue_date,i.due_date??"",i.payment_status,i.grand_total,i.amount_paid,i.balance_due,String(i.customer_snapshot?.name??"")])])}
  function printPdf(){
    if(!business){setMsg("Data usaha belum siap untuk PDF.");return;}
    const win=window.open("","_blank","noopener,noreferrer,width=1000,height=800"); if(!win){setMsg("Popup diblokir browser. Izinkan popup untuk membuka PDF/Cetak laporan.");return;}
    const logo=business.logo_url?`<img src="${esc(business.logo_url)}" style="height:58px;max-width:180px;object-fit:contain"/>`:"";
    const orderRows=orders.map(o=>`<tr><td>${esc(o.order_number)}</td><td>${esc(o.order_date)}</td><td>${esc(o.status)}</td><td class="num">${esc(formatIDR(o.grand_total))}</td><td class="num">${esc(formatIDR(o.amount_paid))}</td><td class="num">${esc(formatIDR(o.balance_due))}</td></tr>`).join("");
    const invoiceRows=invoices.map(i=>`<tr><td>${esc(i.invoice_number)}</td><td>${esc(i.issue_date)}</td><td>${esc(i.customer_snapshot?.name??"")}</td><td>${esc(i.payment_status)}</td><td class="num">${esc(formatIDR(i.grand_total))}</td><td class="num">${esc(formatIDR(i.balance_due))}</td></tr>`).join("");
    const paymentRows=payments.map(p=>`<tr><td>${esc(formatDate(p.paid_at))}</td><td>${esc(p.kind)}</td><td>${esc(p.method)}</td><td class="num">${esc(formatIDR(p.amount))}</td><td>${esc(p.reference??"")}</td></tr>`).join("");
    win.document.write(`<!doctype html><html><head><title>Laporan ${esc(business.name)} ${esc(from)} - ${esc(to)}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:36px;font-size:12px}header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:20px}h1{font-size:22px;margin:0 0 5px}h2{font-size:15px;margin:24px 0 8px}.muted{color:#64748b}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #e5e7eb;border-radius:10px;padding:12px}.box b{display:block;font-size:17px;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border-bottom:1px solid #e5e7eb;padding:7px 6px;text-align:left}th{background:#f8fafc}.num{text-align:right}@media print{body{margin:14mm}.no-print{display:none}}</style></head><body><header>${logo}<div><h1>Laporan Usaha</h1><strong>${esc(business.name)}</strong><div class="muted">Periode ${esc(from)} s/d ${esc(to)}</div></div></header><div class="grid"><div class="box">Nilai Order<b>${esc(formatIDR(summary?.order_value_period??0))}</b></div><div class="box">Uang Diterima<b>${esc(formatIDR(summary?.cash_received_period??0))}</b></div><div class="box">Piutang Aktif<b>${esc(formatIDR(summary?.active_receivables??0))}</b></div></div><h2>Order</h2><table><thead><tr><th>Order</th><th>Tanggal</th><th>Status</th><th>Nilai</th><th>Dibayar</th><th>Sisa</th></tr></thead><tbody>${orderRows||'<tr><td colspan="6">Tidak ada order.</td></tr>'}</tbody></table><h2>Invoice</h2><table><thead><tr><th>Invoice</th><th>Tanggal</th><th>Pelanggan</th><th>Status</th><th>Total</th><th>Sisa</th></tr></thead><tbody>${invoiceRows||'<tr><td colspan="6">Tidak ada invoice.</td></tr>'}</tbody></table><h2>Pembayaran</h2><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Metode</th><th>Nominal</th><th>Referensi</th></tr></thead><tbody>${paymentRows||'<tr><td colspan="5">Tidak ada pembayaran.</td></tr>'}</tbody></table><p class="muted">Dicetak dari iMersOrder · ${new Date().toLocaleString("id-ID")}</p><script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body></html>`);win.document.close();
  }

  return <><ModuleHeader title="Laporan" subtitle="Ringkasan order, invoice, pembayaran, dan piutang"/>{msg?<Notice kind="error">{msg}</Notice>:null}
    <section className="formPanel"><div className="fieldGrid"><label className="formField">Periode<select value={preset} onChange={e=>applyPreset(e.target.value)}><option value="month">Bulan ini</option><option value="lastmonth">Bulan lalu</option><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option><option value="custom">Tanggal custom</option></select></label><label className="formField">Bulan<input type="month" value={month} onChange={e=>applyMonth(e.target.value)} disabled={preset!=="month"&&preset!=="lastmonth"}/></label><label className="formField">Dari<input type="date" value={from} onChange={e=>{setPreset("custom");setFrom(e.target.value)}}/></label><label className="formField">Sampai<input type="date" value={to} onChange={e=>{setPreset("custom");setTo(e.target.value)}}/></label></div></section>
    {summary?<><div className="statsGrid"><div className="statCard"><span>Nilai Order</span><strong>{formatIDR(summary.order_value_period)}</strong></div><div className="statCard"><span>Uang Diterima</span><strong>{formatIDR(summary.cash_received_period)}</strong></div><div className="statCard red"><span>Piutang Aktif</span><strong>{formatIDR(summary.active_receivables)}</strong></div></div><div className="detailStats"><div className="detailStat"><span>Order Hari Ini</span><strong>{summary.order_today}</strong></div><div className="detailStat"><span>Perlu Diproses</span><strong>{summary.order_need_process}</strong></div><div className="detailStat"><span>Jatuh Tempo Hari Ini</span><strong>{summary.due_today}</strong></div><div className="detailStat"><span>Terlambat</span><strong>{summary.overdue}</strong></div></div></>:null}
    <section className="formPanel"><h2>Ekspor Laporan</h2><div className="crudCardActions"><button className="miniButton primary" onClick={printPdf}><Printer size={14}/> PDF / Cetak</button><button className="miniButton primary" onClick={exportOrders}><Download size={14}/> CSV Order ({orders.length})</button><button className="miniButton primary" onClick={exportInvoices}><FileDown size={14}/> CSV Invoice ({invoices.length})</button><button className="miniButton primary" onClick={exportPayments}><Download size={14}/> CSV Pembayaran ({payments.length})</button></div><div className="formHint" style={{marginTop:8}}>PDF menggunakan logo usaha yang tersimpan di Branding. Pilih Save as PDF pada dialog cetak browser.</div></section>
    <section className="formPanel"><h2>Order Periode</h2>{orders.length===0?<div className="emptyPanel">Tidak ada order di periode ini.</div>:<div className="tableLike">{orders.slice(0,50).map(o=><div className="tableRow" key={o.order_number}><div><strong>{o.order_number}</strong><small>{formatDate(o.order_date)} · {o.status}</small></div><b>{formatIDR(o.grand_total)}</b></div>)}</div>}</section>
  </>;
}
