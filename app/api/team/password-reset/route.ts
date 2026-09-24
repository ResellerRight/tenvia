import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function requireAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diatur di Vercel Environment Variables.");
  return createSupabaseAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sendWhatsApp(provider: string, token: string, destination: string, message: string) {
  if (provider === "fonnte") {
    const form = new FormData();
    form.set("target", destination);
    form.set("message", message);
    form.set("countryCode", "62");
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: form,
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    const parsed = body as Record<string, unknown>;
    if (!response.ok || parsed.status === false) throw new Error(String(parsed.reason ?? parsed.message ?? `Fonnte HTTP ${response.status}`));
    return;
  }

  if (provider === "starsender") {
    const response = await fetch("https://api.starsender.online/api/send", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: "text", to: destination, body: message }),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    const parsed = body as Record<string, unknown>;
    if (!response.ok || parsed.success === false) throw new Error(String(parsed.message ?? `Starsender HTTP ${response.status}`));
    return;
  }

  throw new Error("WhatsApp gateway belum dikonfigurasi.");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { businessId?: unknown; userId?: unknown };
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!businessId || !userId) return NextResponse.json({ error: "businessId dan userId wajib diisi." }, { status: 400 });

    const { data: ownerMembership } = await supabase
      .from("business_members")
      .select("role,status")
      .eq("business_id", businessId)
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (ownerMembership?.role !== "owner") return NextResponse.json({ error: "Hanya Owner yang dapat mereset password anggota." }, { status: 403 });

    const { data: target } = await supabase
      .from("business_members")
      .select("user_id,role,status")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "Anggota tidak ditemukan di usaha ini." }, { status: 404 });
    if (target.role === "owner") return NextResponse.json({ error: "Password Owner diubah dari Akun Saya atau Lupa Password." }, { status: 400 });

    const admin = requireAdminClient();
    const [{ data: authUser, error: authError }, { data: profile, error: profileError }, { data: integration, error: integrationError }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("full_name,phone").eq("id", userId).maybeSingle(),
      admin.from("whatsapp_integrations").select("provider,api_token").eq("business_id", businessId).maybeSingle(),
    ]);
    if (authError || !authUser.user?.email) return NextResponse.json({ error: authError?.message || "Email anggota tidak ditemukan." }, { status: 404 });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    if (integrationError) return NextResponse.json({ error: integrationError.message }, { status: 500 });

    const origin = new URL(request.url).origin;
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: authUser.user.email,
      options: { redirectTo: `${origin}/auth/update-password` },
    });
    if (linkError || !linkData.properties?.action_link) {
      return NextResponse.json({ error: linkError?.message || "Gagal membuat link reset password." }, { status: 500 });
    }

    const resetUrl = linkData.properties.action_link;
    const destination = normalizePhone(profile?.phone);
    const provider = String(integration?.provider ?? "manual");
    const token = String(integration?.api_token ?? "").trim();
    const name = String(profile?.full_name ?? "Anggota iMersOrder").trim() || "Anggota iMersOrder";

    if (provider !== "manual" && token && destination) {
      const message = [
        "🔐 Reset Password iMersOrder",
        `Halo ${name},`,
        "Owner meminta Anda mengatur ulang password akun iMersOrder.",
        "",
        `Buka link ini untuk membuat password baru:\n${resetUrl}`,
        "",
        "Link reset hanya untuk akun Anda. Jangan bagikan ke orang lain.",
      ].join("\n");
      try {
        await sendWhatsApp(provider, token, destination, message);
        return NextResponse.json({ ok: true, message: `Link reset password sudah dikirim ke WhatsApp ${destination}.` });
      } catch (error) {
        return NextResponse.json({
          ok: false,
          resetUrl,
          error: `WhatsApp gagal dikirim: ${error instanceof Error ? error.message : "gateway error"}. Link reset tetap dibuat dan sudah disalin ke layar.`,
        }, { status: 502 });
      }
    }

    return NextResponse.json({
      ok: true,
      resetUrl,
      message: destination ? "Gateway WhatsApp belum aktif. Link reset dibuat; kirim link ini ke anggota secara aman." : "Nomor WhatsApp anggota belum diisi. Link reset dibuat; kirim link ini ke anggota secara aman.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat link reset password." }, { status: 500 });
  }
}
