# Rizz Bot — Crypto Daily Overview (v2)

Ringkasan: Bot Google Apps Script yang mengirim embed Discord berisi harga USD dan perubahan 24 jam untuk beberapa aset kripto setiap hari pukul 06:00 WIB. Versi v2 menambahkan konfigurasi via Script Properties, retry/backoff, pacing, opsi sorting, logging JSON, dan auto-split embed saat jumlah field melebihi batas.

## Fitur
- Embed dengan field per aset (default: BTC, ETH, XRP, XLM, TON — dapat dikonfigurasi via Script Properties).
- Warna embed adaptif berdasarkan rata-rata perubahan seluruh aset (threshold dapat diatur).
- Tautan cepat ke chart Binance per aset.
- Tahan-error per aset (embed tetap terkirim walau sebagian aset gagal).
- Auto-split embed jika field melebihi batas ±25 per embed.
- Opsi sort berdasarkan persen perubahan 24 jam.

## Arsitektur Singkat
- Sumber kode utama: [Code.gs](Code.gs)
- Properti & konfigurasi: [function getScriptProps()](Code.gs:23), [function getConfig()](Code.gs:27)
- Data source & fetch: [const BINANCE_24H_URL](Code.gs:93), [function fetchTicker(symbol,retries,baseMs)](Code.gs:96)
- Presentasi: [function formatUsd(n)](Code.gs:119), [function buildField(symbol,emoji,name,priceUsd,changePct)](Code.gs:126), [function buildEmbeds(fields,avgChange,idTime,now,cfg)](Code.gs:157)
- Logging: [function logJSON(msg,obj)](Code.gs:61)
- Fungsi utama pengirim embed: [function sendDailyCryptoEmbed()](Code.gs:185)
- Penjadwalan & util: [function createDailyTriggerAt6WIB()](Code.gs:253), [function updateSchedule(hour,minute)](Code.gs:257), [function listTriggers()](Code.gs:269), [function removeTriggersByHandler(handler)](Code.gs:280)

## Prasyarat
- Akun Google dengan akses Google Apps Script.
- Akses webhook Discord:
  - Script Properties: WEBHOOK_URLS (JSON array of URLs) untuk multi-target.
  - Script Properties: WEBHOOK_URL (single URL).
  - Keduanya dapat diisi; sistem akan menggabungkan keduanya (deduplikasi) dan mengirim ke semua target.

## Cara Setup (Google Apps Script)
1) Buat proyek Apps Script baru.
2) Set time zone proyek ke Asia/Jakarta:
   - Menu: Project Settings → Time zone → Asia/Jakarta.
3) Salin isi file [Code.gs](Code.gs) ke editor Apps Script (ganti seluruh konten).
4) Buka Project Settings → Script Properties, tambahkan key berikut:
   - WEBHOOK_URLS: JSON array ["https://discord.com/api/webhooks/...", "..."] (opsional; digabung dengan WEBHOOK_URL dan dikirim ke semua URL unik).
   - WEBHOOK_URL: URL webhook Discord Anda (opsional; dapat dipakai sendiri atau bersama WEBHOOK_URLS).
   - BOT_USERNAME: nama tampilan bot (opsional; default "Rizz Bot").
   - BOT_AVATAR_URL: URL avatar bot (opsional).
   - PAIRS_JSON: JSON array [{ "symbol": "BTCUSDT", "emoji": "🟠", "name": "Bitcoin" }, ...] (opsional; default tersedia).
   - COLOR_THRESHOLD_GREEN: ambang hijau (default 0.3).
   - COLOR_THRESHOLD_RED: ambang merah (default -0.3).
   - PACE_MS: jeda antar request (ms, default 100).
   - RETRY_COUNT: jumlah retry (default 2).
   - RETRY_BASE_MS: base backoff (ms, default 300).
   - SORT_BY_CHANGE: "true"/"false" untuk mengaktifkan sorting field desc berdasar persen perubahan.
5) Simpan proyek.

## Menjalankan Sekali (Uji Manual)
- Di editor Apps Script, pilih fungsi [function sendDailyCryptoEmbed()](Code.gs:185), lalu klik Run.
- Beri otorisasi bila diminta. Pastikan pesan embed masuk ke channel Discord Anda.

## Menjadwalkan Otomatis Harian 06:00 WIB
- Jalankan fungsi [function createDailyTriggerAt6WIB()](Code.gs:253) sekali dari editor Apps Script.
- Alternatif: set jam custom melalui [function updateSchedule(hour,minute)](Code.gs:257).
- Maintenance: inspeksi dengan [function listTriggers()](Code.gs:269) dan bersihkan via [function removeTriggersByHandler(handler)](Code.gs:280).

## Mengubah Daftar Aset
- Set Script Property PAIRS_JSON dengan JSON array. Contoh:
  [
    { "symbol": "BTCUSDT", "emoji": "🟠", "name": "Bitcoin" },
    { "symbol": "ETHUSDT", "emoji": "💎", "name": "Ethereum" }
  ]
- Syarat symbol: pasangan USDT di Binance (format BASEUSDT), mis. ETHUSDT, XRPUSDT, dll.

## Bagaimana Data Diambil
- Endpoint mirror Binance (hindari 451): [const BINANCE_24H_URL(symbol)](Code.gs:93)
- Field yang digunakan:
  - lastPrice → harga USD saat ini.
  - priceChangePercent → perubahan 24 jam (%).
- Fetch dengan retry/backoff terbatas: [function fetchTicker(symbol,retries,baseMs)](Code.gs:96)

## Perhitungan dan Tampilan
- Harga ditampilkan sebagai string USD terformat oleh [function formatUsd(n)](Code.gs:119) (minimumFractionDigits konsisten).
- Emoji tren + panah:
  - 🟢 ▲ jika priceChangePercent ≥ 0
  - 🔴 ▼ jika priceChangePercent < 0
- Warna embed:
  - Hijau (0x2ecc71) jika rata-rata perubahan > COLOR_THRESHOLD_GREEN
  - Merah (0xe74c3c) jika rata-rata perubahan < COLOR_THRESHOLD_RED
  - Netral (0x95a5a6) selain itu
- Auto-split embed: maksimal ±25 field per embed via [function buildEmbeds(...)](Code.gs:157)

## Penanganan Error & Logging
- HTTP code != 200 atau exception → field menampilkan "⚠️ Error {code}: {message}".
- Proses aset lain tetap berjalan agar embed tetap terkirim.
- Logging JSON ringkas: jumlah embed terkirim, avgChange, dan peringatan validasi via [function logJSON(msg,obj)](Code.gs:61).

## Keamanan
- Jangan commit rahasia; gunakan Script Properties (WEBHOOK_URL, dsb).
- Hindari mengekspos rahasia melalui screenshot atau commit.

## Kuota & Batasan
- Apps Script memiliki kuota harian untuk UrlFetchApp dan eksekusi skrip.
- Discord membatasi ukuran embed dan jumlah field; gunakan auto-split bila daftar aset besar.
- Pacing (PACE_MS) membantu mengurangi risiko rate limit.

## Troubleshooting
- Tidak ada pesan di Discord:
  - Cek log eksekusi di Apps Script Editor.
  - Verifikasi Script Property WEBHOOK_URLS (format JSON array) atau WEBHOOK_URL, dan format PAIRS_JSON.
  - Uji manual dengan menjalankan [function sendDailyCryptoEmbed()](Code.gs:185).
- Error HTTP 451/429:
  - Pastikan menggunakan mirror data-api.binance.vision seperti pada [const BINANCE_24H_URL](Code.gs:93).
  - Tinjau RETRY_COUNT/RETRY_BASE_MS dan PACE_MS di Script Properties.
- Zona waktu salah:
  - Pastikan Project Settings → Time zone = Asia/Jakarta.

## Roadmap Ringkas
- Tambah pelaporan error ke channel khusus/email.
- Fallback sumber data alternatif; mode demo/mock.
- Modularisasi lebih lanjut (fetch/build/post) bila diperlukan.
- Opsi sort dan filter lanjutan (top movers).

## Lisensi
- Tidak ditentukan; gunakan sesuai kebutuhan internal proyek.