import { CloudOwnerInvite } from "@/components/cloud-owner-invite";
export const dynamic="force-dynamic";
export default async function CloudInvitePage({searchParams}:{searchParams:Promise<{token?:string}>}){const p=await searchParams;return <CloudOwnerInvite token={p.token??""}/>;}
