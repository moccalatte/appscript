X_threader/check.md
# X_threader — Catatan Penemuan & Pemetaan Proyek

## Ringkasan Proyek
X_threader adalah sistem integrasi dua Google Apps Script (GAS) yang bekerja sama untuk melakukan scraping postingan dari platform X/Twitter (via Nitter) dan meneruskannya ke berbagai endpoint (Slack, Discord, Telegram, atau custom) secara otomatis. Sistem ini dirancang tanpa menggunakan API resmi X/Twitter, dengan fokus pada stabilitas, keamanan, dan observabilitas.

---

## Struktur Direktori & File

```
X_threader/
├── prd.md                # Product Requirements Document (PRD) — deskripsi lengkap arsitektur & kebutuhan
├── poster_app/
│   ├── README.md         # Dokumentasi setup, properti, testing, produksi Poster App
│   └── poster.gs         # Implementasi utama Poster App (webhook receiver & router)
├── scraper_app/
│   ├── README.md         # Dokumentasi setup, properti, testing, produksi Scraper App
│   └── utils.gs          # Implementasi utama Scraper App (scraping, posting, logging, config)
```

---

## Komponen Utama

### 1. Scraper App (`scraper_app/`)
- **Fungsi:** Melakukan scraping postingan dari Nitter (atau X API jika diaktifkan), deduplikasi berdasarkan `last_tweet_id`, dan mengirim payload ke Poster App.
- **File utama:** `utils.gs`
- **Konfigurasi:** Spreadsheet Google dengan sheet `Config`, `Targets`, dan `Logs`.
- **Fitur:**
  - Scraping HTML Nitter (atau X API v2 jika diaktifkan)
  - Dedup posting via `last_tweet_id`
  - Pengiriman payload ke Poster App via webhook (POST JSON)
  - Logging ke sheet `Logs`
  - Retry, exponential backoff, dan isolasi error per target
  - Mendukung header secret (`X-Poster-Secret`) untuk keamanan

### 2. Poster App (`poster_app/`)
- **Fungsi:** Menerima payload POST dari Scraper, memverifikasi sumber (secret/HMAC), dan meneruskan ke endpoint akhir (Slack, Discord, Telegram, custom).
- **File utama:** `poster.gs`
- **Konfigurasi:** Spreadsheet Google dengan sheet `Config` dan `Logs`.
- **Fitur:**
  - Webhook receiver (`doPost`)
  - Verifikasi header secret (`X-Poster-Secret`) dan opsional HMAC
  - Routing payload ke endpoint sesuai `destination_type`
  - Retry + exponential backoff untuk pengiriman
  - Logging ke sheet `Logs`
  - Masking/masking data sensitif di log

---

## Alur Data & Arsitektur

1. **Operator** menambah akun target ke sheet `Targets` pada Spreadsheet Scraper.
2. **Scraper App** (trigger terjadwal):
   - Membaca `Targets`, fetch postingan baru dari Nitter/X API.
   - Ekstrak tweet ID, filter berdasarkan `last_tweet_id`.
   - Kirim payload ke Poster App via POST JSON (sertakan secret jika ada).
   - Update `last_tweet_id` dan log hasil ke `Logs`.
3. **Poster App** menerima POST:
   - Verifikasi secret/HMAC.
   - Parse payload, baca config destinasi.
   - Kirim ke endpoint (Slack/Discord/Telegram/custom) dengan retry/backoff.
   - Log hasil ke `Logs`.
4. **Monitoring:** Operator memantau sheet `Logs` untuk error/warning.

---

## Konfigurasi Spreadsheet

- **Scraper App:**
  - `Config`: `poster_webhook`, `nitter_instance`, `poster_shared_secret`, dsb.
  - `Targets`: `username`, `last_tweet_id`, `enabled`, `notes`
  - `Logs`: timestamp, level, component, message, meta

- **Poster App:**
  - `Config`: `poster_shared_secret`, `destination_type`, credential endpoint
  - `Logs`: timestamp, level, component, message, meta

---

## Payload Standar Scraper → Poster

```json
{
  "source": "scraper",
  "platform": "x",
  "username": "elonmusk",
  "id": "1712345678901234567",
  "text": "Contoh pesan dari tweet...",
  "created_at": "2025-10-18T12:34:56Z",
  "notes": "priority"
}
```

---

## Fitur Keamanan

- **Shared Secret:** Header `X-Poster-Secret` wajib cocok antara Scraper & Poster.
- **Opsional HMAC:** Header `X-Poster-Signature` (HMAC-SHA256) untuk integritas payload.
- **Penyimpanan Secret:** Disarankan di `Config` sheet atau `PropertiesService`.
- **Masking di Log:** Data sensitif tidak dicatat utuh di log.

---

## Best Practices & Operasional

- **Retry & Backoff:** Semua HTTP request penting menggunakan retry & exponential backoff.
- **Isolasi Error:** Error pada satu target tidak menghentikan proses target lain.
- **Rate Limiting:** Parameter `rate_limit_ms` dan `post_interval_ms` untuk menghindari throttle.
- **Monitoring:** Cek sheet `Logs` secara rutin, setup alert jika error spike.
- **Backup:** Rutin backup sheet `Targets` dan `Logs`.

---

## Catatan Tambahan

- **PRD (`prd.md`)** sangat lengkap, berisi arsitektur, flow, contoh konfigurasi, payload, keamanan, troubleshooting, dan future work.
- **README masing-masing app** menjelaskan setup, properti wajib/opsional, langkah testing, dan troubleshooting spesifik.
- **File kode utama (`poster.gs`, `utils.gs`)** sudah mengimplementasikan semua fitur kunci sesuai PRD.

---

## Saran Pengembangan Selanjutnya

- Implementasi HMAC signature end-to-end (Scraper & Poster)
- Dukungan multi-destinasi (fan-out) di Poster
- Observability lebih lanjut (integrasi ke BigQuery/Stackdriver)
- Admin UI sederhana untuk monitoring & replay
- Unit test & mock untuk parser Nitter

---

**Disusun otomatis oleh AI berdasarkan hasil pembacaan seluruh struktur dan dokumentasi proyek.**