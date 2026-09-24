import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: enabled, error } = await supabase.rpc("is_cloud_registration_enabled");
  if (error || enabled !== true) redirect("/auth/login");
  return <Suspense fallback={null}><AuthForm mode="register" /></Suspense>;
}
