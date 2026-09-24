# iMersOrder r27 — Popup Image + PWA Branding

## Popup Promo
Popup Promo sekarang mendukung upload gambar/banner langsung dari Pengaturan → Katalog Online → Promosi Katalog.

- PNG/JPG/WEBP
- Maksimum 2 MB
- Disimpan di Supabase Storage bucket `branding`
- URL tersimpan di `business_settings.promo_popup.image_url`
- Gambar tampil responsif di bagian atas popup publik

## PWA / Favicon
- Manifest memakai versi URL berdasarkan URL logo/favicon aktif.
- Metadata icon diberi cache-busting query.
- Service worker cache version dinaikkan ke r27.
- Jika PWA lama sudah terpasang di HP, uninstall PWA lama lalu install ulang agar icon baru menjadi icon aplikasi yang tersimpan di OS.
