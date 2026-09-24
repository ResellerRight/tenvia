# iMersOrders Cloud — Setup & Operating Notes

## Tenant flow
Super Admin (no tenant required) → Create Tenant → user registers → Super Admin Assign Owner → owner opens `/{slug}/login` → tenant dashboard.

## URL structure
- `/` = Cloud directory
- `/{slug}` = public catalog tenant
- `/{slug}/login` = tenant login
- `/{slug}/dashboard` = tenant workspace
- `/panduan` = public Cloud Panduan
- `/cloud-admin` = Super Admin

## Panduan content
From `/cloud-admin`, Super Admin can publish:
- Judul
- Deskripsi
- Isi panduan
- URL YouTube — automatically embedded when it is a standard YouTube/YouTube short link
- URL Referensi / Alamat Web — rendered as an external link
- Urutan
- Published/Draft

## Isolation
Tenant operational tables continue to use `business_id` and existing RLS. The Cloud layer resolves the tenant by slug and requires active membership for authenticated tenant pages. Super Admin is intentionally limited to tenant metadata in the Cloud Admin UI.

## Subscription states
`active`, `expiring`, `expired`, `suspended`. Expired/suspended tenants are blocked from the public catalog and tenant workspace. Data is not deleted by status changes.
