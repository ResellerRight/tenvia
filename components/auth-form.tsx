"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Brand } from "@/components/brand";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "").trim();
    const supabase = createClient();

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Akun dibuat. Cek email konfirmasi, lalu login dan buka tenant yang Anda miliki.");
          return;
        }
        router.replace("/onboarding");
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Cloud login priority: Super Admin is a global Cloud role and does NOT
        // need a tenant. Always resolve this role before honoring a tenant `next`
        // URL so a Super Admin can never be redirected into a customer workspace.
        if (signInData.user) {
          const { data: cloudAdmin, error: cloudAdminError } = await supabase
            .from("cloud_admins")
            .select("user_id")
            .eq("user_id", signInData.user.id)
            .maybeSingle();

          if (cloudAdminError) throw cloudAdminError;

          if (cloudAdmin?.user_id) {
            router.replace("/cloud-admin");
          } else {
            const requestedNext = search.get("next");
            if (requestedNext && requestedNext.startsWith("/")) {
              router.replace(requestedNext);
            } else {
              const { data: membershipRows } = await supabase
                .from("business_members")
                .select("business_id,created_at")
                .eq("user_id", signInData.user.id)
                .eq("status", "active")
                .order("created_at", { ascending: true })
                .limit(1);

              const businessId = membershipRows?.[0]?.business_id as string | undefined;
              if (businessId) {
                const { data: business } = await supabase
                  .from("businesses")
                  .select("slug")
                  .eq("id", businessId)
                  .maybeSingle();
                if (business?.slug) {
                  router.replace(`/${business.slug}/dashboard`);
                } else {
                  router.replace("/onboarding");
                }
              } else {
                router.replace("/onboarding");
              }
            }
          }
        } else {
          router.replace("/onboarding");
        }
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authStage">
      <section className="authCard">
        <Brand showTagline />
        <div className="authIntro">
          <h1>{mode === "login" ? "Masuk ke iMersOrders Cloud" : "Buat Akun"}</h1>
          {mode === "register" ? <p>Gunakan akun ini untuk mengakses tenant yang diberikan kepada Anda.</p> : null}
        </div>
        <form onSubmit={submit} className="formStack">
          {mode === "register" && (
            <label>
              Nama Owner
              <input name="name" required placeholder="Contoh: Rina" autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input name="email" required type="email" placeholder="nama@email.com" autoComplete="email" />
          </label>
          <label>
            Password
            <input
              name="password"
              required
              minLength={6}
              type="password"
              placeholder="Minimal 6 karakter"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {message && <div className="formMessage">{message}</div>}
          <button className="primaryButton" disabled={loading}>
            {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Aktifkan Owner"}
          </button>
        </form>
        {mode === "login" ? (
          <p className="authSwitch" style={{ marginTop: 12 }}>
            <Link href="/auth/forgot">Lupa password?</Link>
          </p>
        ) : (
          <p className="authSwitch">
            <Link href="/auth/login">Kembali ke Login</Link>
          </p>
        )}
        {mode === "login" ? (
          <p className="authFootnote">Akun baru hanya dibuat melalui aktivasi Owner atau link undangan anggota tim.</p>
        ) : null}
      </section>
    </main>
  );
}
