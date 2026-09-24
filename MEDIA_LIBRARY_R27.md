# iMersOrder r27 — Media Library

## Perubahan
- Tombol gambar/logo/favicon sekarang membuka **Media Tersedia** terlebih dahulu.
- Media yang sudah tersimpan di Supabase Storage dapat dipakai kembali tanpa upload ulang.
- Jika media belum tersedia, upload baru dilakukan dari jendela Media.
- Media library tersedia untuk Branding (logo, favicon, popup) dan Gambar Produk.
- Media yang sedang digunakan oleh bisnis/produk tidak dapat dihapus.
- Media yang sudah tidak digunakan dapat dihapus langsung dari Media sehingga Supabase Storage tidak dipenuhi file orphan.
- Menghapus/lepas gambar dari setting hanya melepas referensi; file tetap dapat dibersihkan melalui Media jika sudah tidak digunakan.
- Bukti pembayaran/invoice yang bersifat private tidak dimasukkan ke media library publik agar tetap terpisah.

## Tidak ada migration database tambahan
Media library menggunakan Supabase Storage yang sudah tersedia. Tidak diperlukan tabel baru.
