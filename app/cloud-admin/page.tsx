import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CloudAdminManager } from "@/components/cloud-admin-manager";
export const dynamic="force-dynamic";
export default async function CloudAdmin(){
 const supabase=await createClient(); const {data:user}=await supabase.auth.getUser(); if(!user.user) redirect('/auth/login');
 const {data:isAdmin}=await supabase.rpc('is_cloud_super_admin'); if(!isAdmin) redirect('/');
 const {data:tenants}=await supabase.from('businesses').select('id,name,slug,tenant_status,subscription_plan,subscription_ends_at,max_products,max_users,directory_visible').order('created_at',{ascending:false});
 const {data:guides}=await supabase.from('cloud_guides').select('id,title,description,content,youtube_url,external_url,sort_order,is_published').order('sort_order').order('created_at',{ascending:false});
 const {data:registrationEnabled}=await supabase.rpc('is_cloud_registration_enabled');
 return <main className="cloudAdmin"><header className="cloudAdminHeader"><div><span className="cloudEyebrow">SUPER ADMIN</span><h1>iMersOrders Cloud</h1><p>Kelola metadata tenant dan pusat Panduan.</p></div><Link href="/">Kembali ke Cloud</Link></header><CloudAdminManager initialTenants={(tenants||[]) as any} initialGuides={(guides||[]) as any} registrationEnabled={registrationEnabled === true}/></main>;
}
