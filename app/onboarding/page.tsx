import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/login");

  // Super Admin is a global Cloud role and intentionally has no tenant.
  const { data: isCloudAdmin } = await supabase.rpc("is_cloud_super_admin");
  if (isCloudAdmin) redirect("/cloud-admin");

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.business_id) {
    const { data: business } = await supabase
      .from("businesses")
      .select("slug")
      .eq("id", membership.business_id)
      .maybeSingle();
    if (business?.slug) redirect(`/${business.slug}/dashboard`);
  }

  return <OnboardingForm />;
}
