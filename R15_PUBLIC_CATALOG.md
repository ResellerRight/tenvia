# iMersOrder v1.0.0-r16 — Public Catalog

- Katalog Online can be switched ON/OFF from Pengaturan Usaha.
- ON: `/` becomes the public catalog without login.
- OFF: `/` returns to the protected dashboard/login flow.
- Public catalog supports search, categories, product cards, cart, customer order form, and customer-visible custom fields.
- Public order creates a normal order in the existing database. Invoice/payment processing remains inside the authenticated admin workflow.
- Added `catalog_items.category`.
- Added Supabase migration `202609240004_public_catalog.sql`.
