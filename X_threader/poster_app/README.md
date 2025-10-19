# X_threader — Poster App (Setup, Properties, Testing & Production)

Ringkasan
--------
Poster App adalah Google Apps Script yang berfungsi sebagai Webhook receiver untuk menerima payload dari Scraper App lalu meneruskannya ke destinasi akhir (Slack, Discord, Telegram, atau endpoint custom). README ini menggantikan dokumentasi sebelumnya dan berisi petunjuk lengkap: properti wajib/opsional, langkah deploy, cara testing full run (E2E), langkah production, keamanan, monitoring, dan troubleshooting.

Tujuan utama
- Menerima POST dari Scraper App (`doPost(e)`).
- Memverifikasi sumber request (shared secret / optional HMAC).
- Merutekan payload ke destinasi akhir sesuai konfigurasi (`destination_type`).
- Mencatat semua event ke sheet `Logs`.
- Menjaga kestabilan dengan retry + exponential backoff, dan logging yang komprehensif.

Struktur file (di project lokal)
- `poster_app/poster.gs` — implementasi `doPost`, routing, pengiriman, retry.
- `poster_app/README.md` — file ini.
- (Opsional) `poster_app/utils.gs` — helper terpisah bila ingin modularisasi.

Google Spreadsheet layout (wajib)
- `Config` (Key | Value) — menyimpan konfigurasi & secret.
- `Logs` (timestamp | level | component | message | meta) — mencatat event & error.

Properti: Mana Wajib & Mana Opsional
- Wajib (harus ada di sheet `Config` untuk operasi standar)
  - `poster_shared_secret` — (string) shared secret yang digunakan Scraper untuk header `X-Poster-Secret`. Sangat direkomendasikan.
  - `destination_type` — (string) `slack` | `discord` | `telegram` | `custom`. Menentukan destinasi.
  - Jika `destination_type` adalah:
    - `slack`: `slack_webhook` (URL)
    - `discord`: `discord_webhook` (URL)
    - `telegram`: `telegram_bot_token` dan `telegram_chat_id`
    - `custom`: `custom_endpoint` (URL)
- Opsional (disarankan untuk produksi)
  - `max_retries` — integer (default: `3`) — jumlah percobaan ulang sebelum gagal.
  - `retry_backoff_ms` — integer (default: `1000`) — jeda awal backoff (ms), akan doubling tiap retry.
  - `log_sheet_id` — jika ingin menulis ke spreadsheet lain.
  - `mask_query_params` — `true`/`false` untuk menghilangkan query param sensitif saat log.
  - `verify_hmac` — `true`/`false` (opsional): jika `true`, server mengharuskan Scraper mengirim HMAC signature di header `X-Poster-Signature`.

Contoh isi sheet `Config`
```X_threader/poster_app/README.md#L1-40
Key,Value
poster_shared_secret,my-shared-secret-123            # Wajib (jika Scraper mengirim secret)
destination_type,slack                                # Wajib
slack_webhook,https://hooks.slack.com/services/AAA/BBB/CCC
max_retries,3
retry_backoff_ms,1000
verify_hmac,false
```

doPost(e) — apa yang dilakukan
- Validasi header:
  - Baca header `X-Poster-Secret` (case-insensitive). Jika `poster_shared_secret` di-config dan header tidak match → return 401 + log WARN.
  - Jika `verify_hmac=true`, validasikan HMAC (lihat bagian HMAC).
- Parse payload JSON dari `e.postData.contents`.
- Minimal validation: payload tidak kosong.
- Log event masuk (preview, yang tidak membocorkan secret).
- Panggil `handleIncomingPayload(payload, cfg)`.
- Return response JSON `{ ok: true, result: ... }` atau error.

Keamanan: Shared Secret & HMAC
- Shared Secret (header)
  - Scraper mengirim header `X-Poster-Secret: <secret>`. Poster membandingkan dengan `Config.poster_shared_secret`.
  - Kelebihan: sederhana. Kekurangan: header bisa terlihat di jaringan jika HTTP tidak TLS.
- HMAC (lebih aman)
  - Jika `verify_hmac=true`, Scraper harus mengirim header `X-Poster-Signature: sha256=...` yang merupakan HMAC-SHA256 dari body dengan key `poster_shared_secret`.
  - Poster menghitung HMAC dari body dan membandingkan menggunakan perbandingan waktu-unit (constant-time) jika memungkinkan.
  - Rekomendasi: gunakan HMAC bila memungkinkan.

Contoh: signature HMAC header (Scraper harus kirim):
```X_threader/poster_app/README.md#L41-80
X-Poster-Signature: sha256=2c26b46b68ffc68ff99b453c1d304134134...
```

Routing & Destinasi
- `destination_type=slack`
  - Gunakan `slack_webhook` (Incoming Webhook). Payload diubah menjadi `{"text": "...", "attachments":[...]}`
- `destination_type=discord`
  - Gunakan `discord_webhook`. Payload diubah menjadi `{"content": "..."}`
- `destination_type=telegram`
  - Gunakan `telegram_bot_token` dan `telegram_chat_id`. Panggil `https://api.telegram.org/bot<TOKEN>/sendMessage`.
- `destination_type=custom`
  - Forward seluruh payload JSON ke `custom_endpoint`.
- Semua pengiriman menggunakan `postJsonWithRetries(url, body, headers, maxRetries, backoffMs, component)`:
  - retry up to `max_retries`, backoff exponential, muteHttpExceptions true, log setiap percobaan & hasil.

Contoh payload Scraper → Poster (json)
```X_threader/poster_app/README.md#L81-140
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

Contoh curl untuk test lokal / manual (setelah deploy)
```X_threader/poster_app/README.md#L141-200
curl -X POST "https://script.google.com/macros/s/AKfy.../exec" \
  -H "Content-Type: application/json" \
  -H "X-Poster-Secret: my-shared-secret-123" \
  -d '{"source":"scraper","username":"test_user","id":"test-1","text":"Hello from test"}'
```
- Jika menggunakan HMAC:
  - hitung HMAC-SHA256 dari body menggunakan `poster_shared_secret`, kirim header `X-Poster-Signature: sha256=<hex>`.

Deploy Web App (step-by-step)
1. Buka Apps Script project untuk Poster App (paste `poster.gs`).
2. Pastikan `Config` dan `Logs` sheet ada di Spreadsheet yang terhubung.
3. Isi `Config` sesuai properti wajib (lihat bagian Properti).
4. Deploy → New deployment → pilih Web app
   - Execute as: Me (script owner)
   - Who has access: Pilih berdasarkan kebijakan:
     - Development quick test: `Anyone` atau `Anyone, even anonymous` + gunakan `poster_shared_secret`.
     - Untuk produksi: hindari `Anyone` jika memungkinkan; gunakan auth internal / service account. Bila harus menggunakan `Anyone`, pastikan secret & HMAC aktif.
5. Salin URL Web App → masukkan ke `poster_webhook` di Scraper App `Config`.

Testing Full Run (End-to-End)
A. Persiapan
- Deploy Poster Web App, dapatkan URL.
- Pada Scraper spreadsheet: set `poster_webhook` ke URL tersebut dan `poster_shared_secret` sama dengan Poster config.
- Tambahkan 1–3 target di Scraper `Targets` untuk staging, isi `x_bearer_token` jika perlu.

B. Jalankan test full run
1. From Poster App: jalankan `testSendToDestination()` (opsional) untuk memeriksa konektivitas destinasi.
2. From Scraper App: jalankan `runScrapeAndPost()` manual.
3. Periksa:
   - Poster `Logs`: ada entri "Received payload" + "Handled payload".
   - Destinasi (Slack/Discord/Telegram/custom): pesan muncul.
   - Scraper `Logs`: ada entri "Posted to poster successfully".
   - `Targets.last_tweet_id` ter-update.

C. Validasi idempotency
- Jalankan `runScrapeAndPost()` dua kali berturut-turut. Pastikan tidak ada duplicate posting (karena `last_tweet_id` mencegah repost).

Production Full Run (skenario lengkap)
1. Scale targets:
   - Jika banyak target, pertimbangkan batching (mis: memproses N target per run) agar tidak terkena rate limit.
2. Tweak konfigurasi:
   - `max_retries`: 3–5
   - `retry_backoff_ms`: 1000 (1s) atau lebih
3. Trigger scheduling:
   - Buat time-driven trigger pada Scraper `runScrapeAndPost()` sesuai kapasitas (mis. 5–15 menit).
4. Monitoring & Alerts:
   - Pantau `Logs` sheet; jika banyak `ERROR`, setup notifikasi email/Slack.
   - Simpan salinan `Logs` periodik (export or archive) bila traffic log besar.
5. Backup & Recovery:
   - Backup `Targets` sheet (last_tweet_id) sebelum perubahan besar agar menghindari duplikasi saat recovery.
6. Security:
   - Rotasi `poster_shared_secret` secara berkala jika dicurigai kebocoran.
   - Pertimbangkan HMAC bila extra security diperlukan.

Observability & Log Practices
- Semua event (INFO/WARN/ERROR) dicatat ke sheet `Logs` dengan meta JSON.
- Jangan menulis nilai secret langsung ke logs (kebijakan: mask secret values sebelum append).
- Truncate panjang response bodies saat mencatat (mis. 2000 chars).
- Jika `log_sheet_id` di-set, gunakan sheet tujuan lain untuk mengurangi noise di spreadsheet utama.

Troubleshooting umum
- Response 401/invalid_secret:
  - Pastikan header `X-Poster-Secret` cocok dengan `Config.poster_shared_secret`.
  - Jika HMAC diaktifkan, periksa signature.
- Invalid JSON parse:
  - Scraper harus mengirim body JSON valid; cek `e.postData.contents` di logs.
- Destination errors (4xx/5xx):
  - Periksa konfigurasi webhook/token destinasi.
  - Untuk 5xx, Poster akan retry sesuai `max_retries` + backoff.
- No message shown at destination:
  - Periksa `postJsonWithRetries` logs: apakah HTTP response sukses?
  - Cek format payload untuk destinasi (Slack expects `{text: ...}`).

FAQ singkat
- Q: Bolehkah saya deploy Poster App sebagai `Anyone`?
  - A: Bisa untuk kemudahan, namun wajib menggunakan `poster_shared_secret`. Lebih aman gunakan mekanisme autentikasi internal bila tersedia.
- Q: Dimana lebih baik menyimpan secrets?
  - A: Preferable: Apps Script Properties (`PropertiesService`) atau Secret Manager. `Config` sheet digunakan untuk kemudahan, tapi berhati-hatilah dengan akses spreadsheet.
- Q: Jika saya ingin fan-out ke beberapa destinasi?
  - A: Modifikasi `handleIncomingPayload` untuk memanggil beberapa fungsi `sendToX` berdasarkan array destinasi di `Config` atau field payload.

Checklist cepat sebelum go-live
- [ ] `Config` berisi `poster_shared_secret`, `destination_type`, dan credential destinasi.
- [ ] Poster sudah dideploy sebagai Web App, URL terisi sebagai `poster_webhook` di Scraper.
- [ ] Scraper `Config` berisi `poster_shared_secret` yang sama.
- [ ] `Logs` sheet tersedia pada Poster spreadsheet.
- [ ] Test E2E via manual run; verifikasi logs & destinasi.
- [ ] Set time-driven triggers pada Scraper dan monitoring aktif.

Contoh singkat: men-deploy + test (recap)
```X_threader/poster_app/README.md#L201-320
1) Deploy Poster App → dapatkan URL.
2) Masukkan URL ke Scraper Config (poster_webhook).
3) Isi poster_shared_secret di kedua Config.
4) Dari Poster Editor -> jalankan testSendToDestination().
5) Dari Scraper Editor -> jalankan runScrapeAndPost(). Verifikasi Logs & destinasi.
```

Jika Anda mau, saya bisa menambahkan:
- Template CSV `config_template.csv` dan `targets_template.csv` untuk import cepat.
- Skrip helper untuk rotate secret and update both Scraper & Poster configs.
- Implementasi HMAC signing di Scraper dan verifikasi lengkap di Poster.

Catatan terakhir
- README ini merinci properti wajib/opsional dan langkah lengkap untuk testing & produksi. Setelah Anda men-deploy Poster App, beri tahu saya konfigurasi destinasi yang akan Anda gunakan (Slack/Discord/Telegram/custom), dan saya bisa bantu menyesuaikan payload formatting atau menambahkan fitur fan-out / filtering.