# iMersOrder v1.0.0-r14 — Branding Header Fix

Perbaikan:
- Header/dashboard sekarang membaca `businesses.logo_url` secara langsung.
- Setelah upload logo, header langsung menerima event branding dan memperbarui gambar.
- Favicon mengikuti logo/fav icon yang tersimpan.
- Tetap fallback ke `/icon.png` hanya jika memang belum ada logo tersimpan.

Catatan: ini adalah patch frontend untuk instalasi yang sudah memiliki fitur branding r13. Tidak menghapus data bisnis/order/invoice.
