# iMersOrder r26 — Hutang & Piutang Pribadi

Update single-client untuk memperjelas modul transaksi pribadi yang tidak terkait Order atau Invoice.

## Yang berubah
- Modul diberi label **Hutang & Piutang Pribadi**.
- Filter menjadi **Semua Pribadi / Piutang Pribadi / Hutang Pribadi**.
- KPI memperjelas bahwa saldo berasal dari transaksi pribadi.
- Detail piutang/hutang tetap memiliki pembayaran/cicilan dan riwayat pembayaran.
- Label pembayaran menyesuaikan jenis transaksi: menerima pembayaran untuk piutang dan pembayaran hutang untuk payable.
- Tidak ada perubahan schema database; fitur menggunakan `debt_records` dan `debt_payments` yang sudah tersedia.
- Piutang dari Order/Invoice tetap berada di modul **Piutang** dan tidak dicampur dengan Piutang Pribadi.
