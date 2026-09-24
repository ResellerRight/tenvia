# iMersOrder v1.0.0-r12 — Installer Structure

This is the clean client installer baseline.

- `app/` — Next.js frontend and server routes
- `components/` — UI/modules
- `lib/` — Supabase/browser/server helpers
- `public/` — PWA assets (logo artwork intentionally unchanged in this stage)
- `supabase/migrations/` — canonical incremental migrations
- `supabase/functions/process-reminders/` — scheduled reminder Edge Function
- `supabase/iMersOrder_MASTER_FULL_v1.0.sql` — consolidated fresh-install Master SQL

## WhatsApp architecture

Normal WhatsApp sending is handled by `app/api/whatsapp/send/route.ts` and uses the signed-in member session plus the protected Supabase RPC. It does not require the Vercel service-role key for normal sends.

`process-reminders` is the server/background Edge Function and may require service-role/background secrets according to its deployment configuration.

No provider tokens are hardcoded in this installer.

The separate legacy `wagateway` Edge Function source was not present in the previous installer package, so this release does not fabricate or replace that source.
