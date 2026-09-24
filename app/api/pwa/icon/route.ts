import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function publicSupabase(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
export async function GET(request:NextRequest){
 const fallback=new URL("/icon.png",request.url); const supabase=publicSupabase(); if(!supabase)return NextResponse.redirect(fallback,302);
 try{
  const slug=request.cookies.get("imerscloud_tenant")?.value||"";
  const {data}=slug?await supabase.rpc("get_public_branding_by_slug",{p_slug:slug}):{data:null};
  const branding=data&&typeof data==="object"?data as Record<string,unknown>:null;
  const logoUrl=String(branding?.logo_url??""); const faviconUrl=String(branding?.favicon_url??""); const useLogo=Boolean(branding?.use_logo_as_favicon??true); const source=(!useLogo&&faviconUrl)?faviconUrl:logoUrl;
  if(!source)return NextResponse.redirect(fallback,302); const image=await fetch(source,{cache:"no-store"}); if(!image.ok||!image.body)return NextResponse.redirect(fallback,302);
  const contentType=image.headers.get("content-type")||"image/png"; if(!contentType.startsWith("image/"))return NextResponse.redirect(fallback,302);
  return new NextResponse(image.body,{status:200,headers:{"Content-Type":contentType,"Cache-Control":"no-store,max-age=0,must-revalidate","CDN-Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return NextResponse.redirect(fallback,302);}
}
