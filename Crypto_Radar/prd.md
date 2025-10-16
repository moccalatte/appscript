## Project Requirements Document — Rizz Bot Crypto Daily Overview (v2)

Rizz Bot mengirim embed Discord harian berisi harga USD dan perubahan 24 jam untuk sejumlah aset kripto (pasangan USDT di Binance) setiap pukul 06:00 WIB. Implementasi v2 menambahkan konfigurasi via Script Properties, retry/backoff, pacing, opsi sorting, logging terstruktur, dan auto-split embed saat jumlah field melebihi batas.

### Tujuan
- Menyediakan ringkasan harga spot dan persentase perubahan 24 jam secara singkat dalam satu atau beberapa embed (auto-split).
- Mengotomatiskan pengiriman laporan melalui Discord Webhook sesuai jadwal Asia/Jakarta.

### Ruang Lingkup
- Sumber data: Binance 24h ticker melalui mirror data-api.binance.vision.
- Aset: Dapat dikonfigurasi via Script Properties (default: BTC, ETH, XRP, XLM, TON).
- Output: Embed Discord berisi field per koin, warna embed berdasarkan rata-rata perubahan, auto-split maksimum ±25 field per embed.

### Stakeholders
- Pengguna Discord yang ingin memantau harga kripto harian.
- Administrator bot yang mengelola webhook, jadwal, dan konfigurasi Script Properties.

### Platform & Lingkungan
- Google Apps Script (Serverless).
- Dependensi layanan: UrlFetchApp, ScriptApp, JSON, Intl, PropertiesService, Utilities.
- Time zone: Asia/Jakarta (WIB).

### Konfigurasi (Script Properties)
- WEBHOOK_URL: URL webhook Discord tujuan (wajib).
- BOT_USERNAME: Nama tampilan pengirim embed (opsional; default "Rizz Bot").
- BOT_AVATAR_URL: URL avatar pengirim (opsional).
- PAIRS_JSON: JSON array [{ symbol, emoji, name }, ...] (opsional; default tersedia).
- COLOR_THRESHOLD_GREEN: number (default 0.3) untuk warna hijau.
- COLOR_THRESHOLD_RED: number (default -0.3) untuk warna merah.
- PACE_MS: jeda antar request (ms, default 100).
- RETRY_COUNT: jumlah retry fetch (default 2).
- RETRY_BASE_MS: base backoff (ms, default 300).
- SORT_BY_CHANGE: "true"/"false" untuk sort field berdasarkan persen perubahan 24h desc (default false).
- Time zone project harus di-set ke Asia/Jakarta.

### Pemetaan Sumber Kode
- Konfigurasi & properti: [function getConfig()](Code.gs:27) dan [function getScriptProps()](Code.gs:23).
- Data source & fetch: [const BINANCE_24H_URL](Code.gs:93), [function fetchTicker(symbol,retries,baseMs)](Code.gs:96).
- Presentasi: [function formatUsd(n)](Code.gs:119), [function buildEmbeds(fields,avgChange,idTime,now,cfg)](Code.gs:157), [function buildField(symbol,emoji,name,priceUsd,changePct)](Code.gs:126), [function colorFromAvg(avg,greenThresh,redThresh)](Code.gs:145).
- Utilitas: [function logJSON(msg,obj)](Code.gs:61), [function computeAvg(nums)](Code.gs:139), [function chunk(arr,size)](Code.gs:151).
- Fungsi utama: [function sendDailyCryptoEmbed()](Code.gs:185).
- Penjadwalan: [function createDailyTriggerAt6WIB()](Code.gs:253), [function updateSchedule(hour,minute)](Code.gs:257), [function listTriggers()](Code.gs:269), [function removeTriggersByHandler(handler)](Code.gs:280).

### Persyaratan Fungsional
1. Validasi daftar aset dari PAIRS_JSON; hanya simbol format BASEUSDT yang lolos [function validatePairs(pairs)](Code.gs:70).
2. Untuk setiap simbol:
   - Terapkan pacing sesuai PACE_MS (Utilities.sleep).
   - Ambil data 24h ticker dengan retry/backoff terbatas [function fetchTicker(symbol,retries,baseMs)](Code.gs:96).
   - Bila respon sukses (HTTP 200): parsir lastPrice dan priceChangePercent; buat field via [function buildField(...)](Code.gs:126) dengan emoji tren (🟢/🔴) dan panah (▲/▼).
   - Bila gagal: tambahkan field error dengan detail kode/status.
3. Opsi SORT_BY_CHANGE: urutkan field berdasarkan persen perubahan 24h descending.
4. Hitung warna embed dari rata-rata perubahan seluruh aset (hanya aset valid) via threshold konfig:
   - Hijau (0x2ecc71) bila rata-rata > COLOR_THRESHOLD_GREEN.
   - Merah (0xe74c3c) bila rata-rata < COLOR_THRESHOLD_RED.
   - Netral (0x95a5a6) selain itu.
5. Auto-split embed: bagi field ke beberapa embed, maksimal ±25 field per embed [function buildEmbeds(...)](Code.gs:157).
6. Bangun payload dengan username, avatar_url, dan embeds; kirim via POST ke WEBHOOK_URL.

### Persyaratan Non-Fungsional
- Keandalan: Toleransi gagal pada aset tertentu tanpa menggagalkan keseluruhan embed; retry/backoff terbatas untuk meningkatkan keberhasilan.
- Kinerja: Satu panggilan API per aset dengan pacing untuk mengurangi rate limit.
- Keterbacaan: Format harga konsisten dengan minimumFractionDigits (2–6) dan grouping.
- Lokalisasi: Tanggal ditampilkan dalam format id-ID, time zone Asia/Jakarta.
- Keamanan: Webhook dan konfigurasi disimpan di Script Properties; jangan commit rahasia ke repo publik.
- Observabilitas: Logging terstruktur JSON melalui [function logJSON(msg,obj)](Code.gs:61).

### Kendala & Asumsi
- Menggunakan pasangan USDT; tidak ada konversi ke fiat lain.
- Batas Discord embed: maksimal ±25 field per embed; auto-split mengatasi keterbatasan ini.
- Mengandalkan mirror data-api.binance.vision untuk menghindari HTTP 451; fallback tidak disediakan secara default.
- Pacing dan retry bersifat terbatas untuk menjaga kuota Apps Script.

### Desain API & Data
- Endpoint: https://data-api.binance.vision/api/v3/ticker/24hr?symbol={SYMBOL}
- Metode: GET untuk pengambilan; POST ke webhook Discord.
- Bidang data utama:
  - lastPrice (string angka) → harga USD.
  - priceChangePercent (string angka) → persen perubahan 24h.

### Penjadwalan
- Trigger harian pukul 06:00 WIB melalui ScriptApp:
  - [function createDailyTriggerAt6WIB()](Code.gs:253) memanggil [function updateSchedule(hour,minute)](Code.gs:257).
  - Hapus trigger lama untuk handler yang sama via [function removeTriggersByHandler(handler)](Code.gs:280).
  - [function listTriggers()](Code.gs:269) untuk inspeksi.

### Penanganan Error
- HTTP != 200 atau exception: field menampilkan detail “⚠️ Error {code}: {message}”.
- Logging ringkas: jumlah embed terkirim, avgChange, dan peringatan validasi.
- Fallback warna embed: Netral jika tidak ada data perubahan valid.

### Keamanan
- Simpan WEBHOOK_URL dan konfigurasi lain di PropertiesService (Script Properties).
- Hindari mengekspos rahasia melalui screenshot atau commit.

### Pengujian & Validasi
- Uji manual: Jalankan [function sendDailyCryptoEmbed()](Code.gs:185) untuk melihat embed di Discord.
- Verifikasi field: Nama aset, harga terformat, persen, tautan chart.
- Verifikasi warna embed: Sesuai threshold rata-rata perubahan dari aset valid.
- Verifikasi footer & timestamp: Format id-ID, label “WIB”.
- Jadwal: Jalankan [function createDailyTriggerAt6WIB()](Code.gs:253) atau [function updateSchedule(hour,minute)](Code.gs:257); gunakan [function listTriggers()](Code.gs:269) untuk verifikasi.

### Kriteria Keberhasilan
- Embed berhasil muncul di channel Discord pada pukul 06:00 WIB setiap hari.
- Semua aset yang berhasil diambil menampilkan harga dan persen yang benar.
- Tidak ada gangguan kuota Apps Script dalam penggunaan normal.

### Roadmap Ringkas
- Penambahan aset & konfigurasi dinamis.
- Pelaporan error lebih kaya (channel khusus/email).
- Fallback sumber data alternatif; mode demo/mock.
- Modularisasi tambahan fungsi (fetch/build/post) sesuai kebutuhan.