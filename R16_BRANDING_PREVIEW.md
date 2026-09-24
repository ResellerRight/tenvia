# iMersOrder v1.0.0-r16 — Branding Preview & Verification

Perubahan utama:
- Settings > Branding & Identitas sekarang menampilkan panel **Logo Aktif** yang selalu memperlihatkan logo yang sedang digunakan.
- Upload logo melakukan verifikasi ulang terhadap nilai `businesses.logo_url` setelah update database.
- Preview langsung berubah setelah upload berhasil.
- Jika URL logo rusak/tidak dapat dimuat, UI menampilkan status yang jelas dan tidak berpura-pura bahwa logo aktif.
- Header Brand ikut mereset state ketika branding berubah dan memiliki fallback aman jika asset gagal dimuat.

Release berikutnya wajib lanjut ke r17; tidak menggunakan suffix huruf.
