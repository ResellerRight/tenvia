"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { EmptyState, FormActions, ModuleHeader, Notice, Pagination, SearchBar } from "@/components/crud-ui";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/client-utils";

 type Customer = { id:string; name:string; whatsapp:string|null; email:string|null; address:string|null; notes:string|null; is_active:boolean; created_at:string; deleted_at:string|null };
 type FormState = { name:string; whatsapp:string; email:string; address:string; notes:string; is_active:boolean };
 const empty:FormState = { name:"", whatsapp:"", email:"", address:"", notes:"", is_active:true };

export function CustomersManager({ businessId, role }: { businessId:string; role:string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows,setRows]=useState<Customer[]>([]); const [loading,setLoading]=useState(true); const [query,setQuery]=useState(""); const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(10);
  const [editing,setEditing]=useState<Customer|null>(null); const [form,setForm]=useState<FormState>(empty); const [showForm,setShowForm]=useState(false); const [saving,setSaving]=useState(false); const [msg,setMsg]=useState<{kind:"success"|"error";text:string}|null>(null);
  const canDelete = role === "owner" || role === "admin";
  const load = useCallback(async()=>{ setLoading(true); const {data,error}=await supabase.from("customers").select("id,name,whatsapp,email,address,notes,is_active,created_at,deleted_at").eq("business_id",businessId).is("deleted_at",null).order("name"); if(error)setMsg({kind:"error",text:error.message}); setRows((data??[]) as Customer[]); setLoading(false); },[businessId,supabase]);
  useEffect(()=>{void load()},[load]);
  const filtered=rows.filter(r=>`${r.name} ${r.whatsapp??""} ${r.email??""}`.toLowerCase().includes(query.toLowerCase())); const pages=Math.max(1,Math.ceil(filtered.length/pageSize)); const view=filtered.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>{setPage(1)},[query,pageSize]);
  async function exportCustomers(){
    setMsg(null);
    const [{data: orders,error:oe},{data: invoices,error:ie}] = await Promise.all([
      supabase.from("orders").select("customer_id,grand_total,amount_paid,balance_due").eq("business_id",businessId).is("deleted_at",null),
      supabase.from("invoices").select("customer_id,grand_total,amount_paid,balance_due").eq("business_id",businessId).is("deleted_at",null).neq("payment_status","void")
    ]);
    if(oe||ie){setMsg({kind:"error",text:(oe||ie)?.message||"Gagal mengekspor pelanggan."});return;}
    const om=new Map<string,{orders:number;value:number;paid:number;balance:number}>();
    for(const o of (orders??[]) as Array<{customer_id:string;grand_total:number|string;amount_paid:number|string;balance_due:number|string}>){const x=om.get(o.customer_id)||{orders:0,value:0,paid:0,balance:0};x.orders++;x.value+=Number(o.grand_total||0);x.paid+=Number(o.amount_paid||0);x.balance+=Number(o.balance_due||0);om.set(o.customer_id,x);}
    const im=new Map<string,{value:number;paid:number;balance:number}>();
    for(const i of (invoices??[]) as Array<{customer_id:string;grand_total:number|string;amount_paid:number|string;balance_due:number|string}>){const x=im.get(i.customer_id)||{value:0,paid:0,balance:0};x.value+=Number(i.grand_total||0);x.paid+=Number(i.amount_paid||0);x.balance+=Number(i.balance_due||0);im.set(i.customer_id,x);}
    downloadCsv(`imersorder-pelanggan-backup-${new Date().toISOString().slice(0,10)}.csv`,[["Nama","WhatsApp","Email","Alamat","Catatan","Status","Tanggal Dibuat","Jumlah Order","Nilai Order","Dibayar Order","Sisa Order","Total Invoice","Dibayar Invoice","Sisa Piutang"],...rows.map(r=>{const o=om.get(r.id)||{orders:0,value:0,paid:0,balance:0};const i=im.get(r.id)||{value:0,paid:0,balance:0};return [r.name,r.whatsapp??"",r.email??"",r.address??"",r.notes??"",r.is_active?"Aktif":"Nonaktif",r.created_at,o.orders,o.value,o.paid,o.balance,i.value,i.paid,i.balance]})]);
    setMsg({kind:"success",text:`Backup CSV ${rows.length} pelanggan berhasil dibuat.`});
  }

  function startCreate(){setEditing(null);setForm(empty);setShowForm(true);setMsg(null)}
  function startEdit(r:Customer){setEditing(r);setForm({name:r.name,whatsapp:r.whatsapp??"",email:r.email??"",address:r.address??"",notes:r.notes??"",is_active:r.is_active});setShowForm(true);setMsg(null)}
  async function save(e:React.FormEvent){e.preventDefault(); if(!form.name.trim())return setMsg({kind:"error",text:"Nama pelanggan wajib diisi."}); setSaving(true); const payload={business_id:businessId,name:form.name.trim(),whatsapp:form.whatsapp.trim()||null,email:form.email.trim()||null,address:form.address.trim()||null,notes:form.notes.trim()||null,is_active:form.is_active}; const res=editing?await supabase.from("customers").update(payload).eq("id",editing.id):await supabase.from("customers").insert(payload); setSaving(false); if(res.error)return setMsg({kind:"error",text:res.error.message}); setMsg({kind:"success",text:editing?"Pelanggan berhasil diperbarui.":"Pelanggan berhasil ditambahkan."});setShowForm(false);setEditing(null);setForm(empty);await load();}
  async function remove(r:Customer){if(!canDelete||!confirm(`Hapus pelanggan ${r.name}?`))return; const {error}=await supabase.from("customers").update({deleted_at:new Date().toISOString(),is_active:false}).eq("id",r.id); if(error)return setMsg({kind:"error",text:error.message});setMsg({kind:"success",text:"Pelanggan dihapus."});await load();}
  return <>
    <ModuleHeader title="Pelanggan" subtitle={`${rows.length} pelanggan aktif`} actionLabel="Tambah" onAction={startCreate}/><div className="crudToolbar" style={{justifyContent:"flex-end"}}><button className="miniButton primary" onClick={()=>void exportCustomers()}><Download size={14}/> Export CSV Backup</button></div>
    {msg?<Notice kind={msg.kind}>{msg.text}</Notice>:null}
    {showForm?<form className="formPanel" onSubmit={save}><h2>{editing?"Edit Pelanggan":"Tambah Pelanggan"}</h2><div className="fieldGrid">
      <label className="formField full">Nama<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nama pelanggan"/></label>
      <label className="formField">WhatsApp<input value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} placeholder="08xxxxxxxxxx"/></label>
      <label className="formField">Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="opsional@email.com"/></label>
      <label className="formField full">Alamat<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      <label className="formField full">Catatan<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      <label className="checkboxField full"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Pelanggan aktif</label>
    </div><FormActions saving={saving} onCancel={()=>setShowForm(false)} submitLabel={editing?"Simpan Perubahan":"Tambah Pelanggan"}/></form>:null}
    <div className="crudToolbar"><SearchBar value={query} onChange={setQuery} placeholder="Cari nama, WA, email..."/><select className="pageSize" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option>10</option><option>20</option><option>50</option></select></div>
    {loading?<div className="emptyPanel">Memuat pelanggan...</div>:view.length===0?<EmptyState>Belum ada pelanggan. Tambahkan pelanggan pertama.</EmptyState>:<div className="crudList">{view.map(r=><article className="crudCard" key={r.id}><div className="crudCardTop"><div className="crudCardTitle"><strong>{r.name}</strong><small>{r.whatsapp||"WA belum diisi"}{r.email?` · ${r.email}`:""}</small><small>{r.address||"Alamat belum diisi"}</small></div><span className={`statusBadge ${r.is_active?"green":""}`}>{r.is_active?"Aktif":"Nonaktif"}</span></div><div className="crudCardActions"><button className="miniButton primary" onClick={()=>startEdit(r)}>Edit</button>{canDelete?<button className="miniButton danger" onClick={()=>void remove(r)}>Hapus</button>:null}</div></article>)}</div>}
    <Pagination page={page} pages={pages} onPage={setPage}/>
  </>;
}
