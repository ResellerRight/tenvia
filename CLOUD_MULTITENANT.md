# iMersOrders Cloud — Multi-Tenant Foundation

Baseline: iMersOrder r28.

## URL model
- Cloud directory: `/`
- Tenant public catalog: `/{tenant-slug}`
- Tenant app: `/{tenant-slug}/dashboard`, `/{tenant-slug}/orders`, etc.
- Panduan: `/panduan`
- Super Admin: `/cloud-admin`

## Tenant isolation
Each tenant is represented by a business record with a unique slug. Existing business-scoped tables keep `business_id` as the isolation key. Middleware resolves the tenant slug into `x-imerscloud-tenant-slug`; authenticated pages verify active membership before exposing tenant modules. PostgreSQL RLS remains the authorization boundary.

## Super Admin
Add the Super Admin user's auth UUID to `public.cloud_admins` after running the SQL. Super Admin manages tenant metadata only; operational tenant data is not exposed by the Cloud Admin page.

## Panduan
`cloud_guides` supports title, description, content, YouTube URL, and external/reference URL. YouTube links are embedded automatically on the public Panduan page.

## SQL
For a fresh install, use the updated `supabase/iMersOrder_MASTER_FULL_v1.0.sql`. For an existing r28 database, run `supabase/migrations/202609240100_cloud_multitenant.sql`.
