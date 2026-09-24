# iMersOrders Cloud — r31

Multi-tenant iMersOrders Cloud. Public tenant registration can be enabled/disabled from Cloud Admin. When disabled, tenant access is distributed via invitation links. The first Supabase Auth user is automatically bootstrapped as global Super Admin and does not receive a tenant.

# iMersOrders Cloud — r30

## r29 Login Routing Fix

Login now resolves the global Cloud role before tenant routing. Super Admin users are routed to `/cloud-admin` and never require a tenant. Tenant users are routed to `/{tenant}/dashboard`; the old `/dashboard` fallback is not used.

# iMersOrders Cloud

Multi-tenant edition built from the iMersOrder r28 baseline.

## Core
- Multi-tenant URL: `/{tenant-slug}`
- Tenant app: `/{tenant-slug}/dashboard`, `/orders`, `/customers`, etc.
- PostgreSQL/Supabase RLS tenant isolation
- Super Admin metadata management
- Tenant plan, status, expiry, product/user limits
- Public Cloud directory
- Tenant public catalog
- Per-tenant branding/theme foundation
- WhatsApp BYOK from the existing module
- **Panduan** menu with text, YouTube URL, and external/reference URL

## Quick setup
1. Create a new Supabase project.
2. Run `supabase/iMersOrder_MASTER_FULL_v1.0.sql`.
3. Create the first Supabase Auth account.
4. Add its UUID to `public.cloud_admins`:
   `insert into public.cloud_admins(user_id) values ('YOUR-AUTH-UUID');`
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel.
6. Deploy the project.
7. Open `/cloud-admin` and create your first tenant.
8. Register the intended tenant owner account, then use **Assign Owner** from Super Admin with the registered email.
9. Open `/{tenant-slug}/login`.

For an existing r28 database, use `supabase/migrations/202609240100_cloud_multitenant.sql` instead of rerunning the full master.

## r31 registration
- Super Admin can enable/disable self-service tenant registration from Cloud Admin.
- When enabled, visitors can register and create their own tenant.
- When disabled, new tenants are provisioned by Super Admin and the owner receives a tenant invitation link.
- On a clean install, the first Supabase Auth user is automatically added to `cloud_admins`; no manual SQL is required.
