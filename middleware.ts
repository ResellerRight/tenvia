import { NextResponse, type NextRequest } from "next/server";

const RESERVED = new Set(["api","_next","auth","setup","onboarding","join","cloud-admin","tenant-catalog","panduan","favicon.ico"]);

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (path !== "/setup" && !path.startsWith("/api/health")) {
      const setupUrl = request.nextUrl.clone(); setupUrl.pathname = "/setup"; setupUrl.search = "";
      return NextResponse.redirect(setupUrl);
    }
  }

  const segments = path.split("/").filter(Boolean);
  const first = segments[0] || "";
  const tenantCookie = request.cookies.get("imerscloud_tenant")?.value || "";

  // Cloud tenant URL: /{tenant}, /{tenant}/dashboard, /{tenant}/orders, etc.
  if (first && !RESERVED.has(first) && !first.startsWith(".")) {
    const rest = segments.slice(1);
    const target = rest.length ? `/${rest.join("/")}` : "/tenant-catalog";
    const headers = new Headers(request.headers);
    headers.set("x-imerscloud-tenant-slug", first);
    headers.set("x-imerscloud-public-path", path);
    const rewriteUrl = request.nextUrl.clone(); rewriteUrl.pathname = target;
    if (rest[0] === "login") {
      rewriteUrl.pathname = "/auth/login";
      rewriteUrl.searchParams.set("next", `/${first}/dashboard`);
    }
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers } });
    response.cookies.set("imerscloud_tenant", first, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  }

  // Keep internal links such as /dashboard working while preserving tenant URLs.
  if (tenantCookie && ["dashboard","orders","customers","catalog","invoices","receivables","debts","more","settings","team","reports","activity","whatsapp","account","appearance","custom-fields","payment-methods","message-templates"].some(x => first === x || first.startsWith(`${x}/`))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${tenantCookie}${path}`;
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
