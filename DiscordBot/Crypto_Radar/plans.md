## Perubahan v2 (Implemented)

- Konfigurasi via Script Properties: [function getScriptProps()](Code.gs:23), [function getConfig()](Code.gs:27). Keys: WEBHOOK_URL, BOT_USERNAME, BOT_AVATAR_URL, PAIRS_JSON, COLOR_THRESHOLD_GREEN, COLOR_THRESHOLD_RED, PACE_MS, RETRY_COUNT, RETRY_BASE_MS, SORT_BY_CHANGE.
- Validasi simbol PAIRS (format BASEUSDT): [function validatePairs(pairs)](Code.gs:70).
- Retry/backoff terbatas saat fetch: [function fetchTicker(symbol,retries,baseMs)](Code.gs:96).
- Pacing antar aset: menggunakan Utilities.sleep sesuai PACE_MS.
- Presentasi harga konsisten: [function formatUsd(n)](Code.gs:119) dengan minimumFractionDigits.
- Field dengan tren dan panah: [function buildField(symbol,emoji,name,priceUsd,changePct)](Code.gs:126).
- Auto-split embed (maks ±25 field per embed): [function buildEmbeds(fields,avgChange,idTime,now,cfg)](Code.gs:157).
- Warna embed adaptif: [function colorFromAvg(avg,greenThresh,redThresh)](Code.gs:145) berdasarkan threshold konfigurasi.
- Logging terstruktur JSON: [function logJSON(msg,obj)](Code.gs:61).
- Utilitas penjadwalan: [function createDailyTriggerAt6WIB()](Code.gs:253), [function updateSchedule(hour,minute)](Code.gs:257), [function listTriggers()](Code.gs:269), [function removeTriggersByHandler(handler)](Code.gs:280).
- Fungsi utama pengirim embed: [function sendDailyCryptoEmbed()](Code.gs:185).

## Masalah / Risiko Tersisa

- Rate limit/451/429 tetap mungkin walau ada pacing dan retry; belum ada fallback data source selain mirror [const BINANCE_24H_URL](Code.gs:93).
- Sorting optional (SORT_BY_CHANGE) bergantung parsing teks nilai persen dari field; bisa rapuh jika format berubah.
- nearMinute() pada penjadwalan dapat menyebabkan deviasi menit; toleransi ini masih ada pada Apps Script.
- Tidak ada cache hasil sebelumnya sebagai fallback bila semua fetch gagal.
- Validasi PAIRS tidak memeriksa keberadaan simbol di Binance, hanya format.

## Rencana Selanjutnya (perbaikan, penambahan fitur dan lainnya)

1) Reliabilitas & Fallback
- Tambah fallback endpoint (api.binance.com) dengan header User-Agent; switch otomatis bila mirror gagal.
- Opsi cache terakhir sukses (Script Properties/CacheService) sebagai fallback tampilan.

2) Observabilitas
- Pelaporan error ke channel khusus (webhook berbeda) saat semua aset gagal.
- Tambah metrik ringkas: jumlah sukses/gagal, waktu eksekusi, top movers.

3) UX & Konten
- Opsi sort filter: hanya tampilkan top-N movers; konfigurasi via Script Properties.
- Penyesuaian format angka untuk aset sangat kecil (min fraction lebih tinggi bila < 0.01).

4) Keamanan & Konfigurasi
- Validasi kuat PAIRS_JSON (schema) dan sanitasi input.
- Redact error message sensitif sebelum logging/pengiriman.

5) Manajemen Jadwal
- Tambah fungsi untuk batch-update jadwal multi-slot (misal 06:00 & 18:00).
- Persist UID triggers di Properties untuk audit.

6) Struktur Kode
- Modulasi lebih lanjut: fetch/build/post dipisah; injeksi konfigurasi eksplisit untuk memudahkan test.

## Roadmap Prioritas (3 Sprint)

Sprint 1 — Fallback & Observability
- Fallback sumber data alternatif + header UA.
- Pelaporan error ke channel khusus; metrik ringkas; top movers.

Sprint 2 — UX & Jadwal
- Filter top-N; penyesuaian format angka ultra-kecil.
- Multi-slot jadwal dan audit UID triggers.

Sprint 3 — Keamanan & Modularisasi
- Validasi & sanitasi PAIRS_JSON (schema).
- Refactor modular penuh untuk fetch/build/post, tambah testability.

## Acceptance Criteria Tambahan
- Bila salah satu aset gagal, embed tetap terkirim dengan field peringatan.
- Bila semua aset gagal, pelaporan sekunder di channel khusus aktif.
- Rata-rata perubahan dihitung dari aset yang valid saja.
- Warna embed sesuai threshold yang dapat dikonfigurasi.
- Format harga konsisten untuk berbagai rentang nilai.

## Catatan Implementasi
- Utilities.sleep(ms) digunakan untuk pacing dan backoff (eksponensial).
- PropertiesService.getScriptProperties() menampung rahasia dan konfigurasi.
- Gunakan referensi baris pada dokumentasi: [Code.gs](Code.gs) untuk mempercepat onboarding & review.