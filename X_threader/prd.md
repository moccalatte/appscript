# X_threader — Product Requirements Document (PRD)

Versi: 1.0  
Tanggal: 2025-10-18  
Penulis: Tim Engineering / Saya (asisten)

Ringkasan singkat
-----------------
X_threader adalah sistem integrasi dua Google Apps Script yang bekerjasama untuk "men-scrape" posting dari platform X/Twitter melalui antarmuka Nitter (HTML scraping), dan meneruskan item-item baru ke destinasi akhir (Slack/Discord/Telegram/custom) melalui Poster App. Sistem ini dirancang untuk operasi yang stabil di produksi tanpa menggunakan API resmi X, dengan fokus pada pencegahan error, observability, dan keamanan dasar.

Komponen utama
--------------
- `scraper_app` (Apps Script bound ke Google Spreadsheet)
  - Tanggung jawab: scrape halaman Nitter (HTML-only), ekstrak tweet/ID, lakukan deduplikasi berdasarkan `last_tweet_id`, kirim payload ke Poster App, catat log.
  - Lokasi kode (lokal): `X_threader/scraper_app/` (mis. `utils.gs`, `README.md`).

- `poster_app` (Apps Script — Web App)
  - Tanggung jawab: menerima payload POST dari Scraper, verifikasi sumber, rute dan kirim ke destinasi akhir, catat log.
  - Lokasi kode (lokal): `X_threader/poster_app/` (mis. `poster.gs`, `README.md`).

- Google Spreadsheet (Config + Targets + Logs)
  - Digunakan oleh Scraper App (terikat ke spreadsheet) untuk menyimpan konfigurasi, target, dan log.
  - Poster App juga menggunakan spreadsheet bound-nya sendiri untuk konfigurasinya dan log.

Tujuan fungsional
-----------------
1. Ambil posting baru dari akun target X melalui Nitter (HTML scraping) secara periodik.
2. Hindari pengiriman duplikat dengan menyimpan `last_tweet_id` per target.
3. Kirim payload JSON ke Poster App (webhook), sertakan header secret jika dikonfigurasi.
4. Poster App meneruskan payload ke satu atau beberapa destinasi sesuai konfigurasi.
5. Catat semua event/err/warn/info di sheet `Logs` untuk audit dan troubleshooting.

Asumsi & batasan
----------------
- Sistem tidak menggunakan X/Twitter API resmi.
- Nitter instances bervariasi struktur HTML-nya; HTML scraping rawan perubahan. Direkomendasikan self-hosted Nitter untuk produksi.
- Scraper App dijalankan sebagai bound script pada Spreadsheet (menggunakan `SpreadsheetApp`).
- Poster App dideploy sebagai Web App dan mungkin diset untuk "Anyone" + secret header (lihat keamanan).

Arsitektur dan alur data
------------------------
1. Operator menambahkan akun target ke sheet `Targets` pada Spreadsheet (Scraper).
2. Scraper App (trigger terjadwal) membaca `Targets` -> untuk tiap akun:
   - Fetch halaman profil Nitter: `https://<nitter_instance>/<username>`.
   - Ekstrak tweet IDs (regex `/username/status/{id}` dan fallback `data-id`).
   - Ambil snippet teks dari HTML sekitar link; jika dikonfigurasi, mengambil halaman per-tweet untuk teks lengkap (opsional).
   - Filter semua item yang lebih baru dari `last_tweet_id`.
   - Untuk tiap item: kirim ke Poster App via POST JSON, header `X-Poster-Secret` bila ada.
   - Update `last_tweet_id` di `Targets`.
   - Log hasil ke `Logs`.
3. Poster App menerima POST:
   - Verifikasi header secret (atau optional HMAC).
   - Parse JSON, baca `Config` di Poster untuk destinasi.
   - Kirim ke destinasi (Slack/Discord/Telegram/custom) dengan retry/backoff.
   - Log hasil ke `Logs` (poster spreadsheet).
4. Monitoring: operator periksa `Logs` (Scraper & Poster) untuk error/warn.

Konfigurasi (sheet `Config`) — Scraper
-------------------------------------
Wajib:
- `poster_webhook` — URL Web App Poster (wajib).
- `nitter_instance` — base URL Nitter (mis. `https://nitter.net` atau private instance) (wajib).
- `poster_shared_secret` — secret string yang dikirim ke Poster via header `X-Poster-Secret` (sangat direkomendasikan).

Opsional (disarankan untuk produksi):
- `rate_limit_ms` — ms delay antara target (default 500).
- `post_interval_ms` — ms delay antara posting ke Poster (default = `rate_limit_ms`).
- `max_retries` — jumlah retry HTTP (default 4).
- `max_items_per_user` — batasi item yang diproses per user per run (default 20).
- `fetch_per_tweet` — `true`/`false` (default false). Jika `true`, per-tweet page akan di-fetch untuk teks lebih lengkap.
- `per_tweet_fetch_delay_ms` — delay extra antar per-tweet fetch (default 500).
- `user_agent` — custom UA untuk requests.

Contoh isi (CSV / Reference):
```X_threader/prd.md#L401-440
Key,Value
nitter_instance,https://nitter.example.com
poster_webhook,https://script.google.com/macros/s/AKfy.../exec
poster_shared_secret,REDACTED_SECRET
rate_limit_ms,500
post_interval_ms,600
max_retries,4
max_items_per_user,20
fetch_per_tweet,false
per_tweet_fetch_delay_ms,500
user_agent,X_threader/1.0 (+https://example)
```

Format sheet `Targets`
----------------------
Header: `username | last_tweet_id | enabled | notes`

Contoh:
```X_threader/prd.md#L441-460
username,last_tweet_id,enabled,notes
elonmusk,1712345678901234567,true,priority
jack,,true,test-account
```

Payload Scraper → Poster (JSON)
-------------------------------
Standard payload fields:
- `source`: "scraper"
- `platform`: "x"
- `username`
- `id`
- `text`
- `created_at` (if available)
- `notes`
- `fetched_via`: "nitter_html"

Keamanan
--------
- Header secret: gunakan `poster_shared_secret`. Scraper menyertakan header `X-Poster-Secret` pada POST; Poster memverifikasi exact match.
- HMAC (future): untuk jarak lebih aman implementasikan HMAC-SHA256 signing pada body (`X-Poster-Signature: sha256=<hex>`). Poster memverifikasi signature.
- Secrets storage: hindari commit secrets ke repo. Simpan di `Config` sheet (terbatas) atau gunakan `PropertiesService` untuk lebih aman.
- Web App exposure: jika Poster dideploy "Anyone", wajib gunakan `poster_shared_secret` atau HMAC. Lebih aman deploy internal auth jika tersedia.
- Masking logs: kode mem-mask/trim panjang body/URLs agar tidak menyimpan secret atau large blobs.

Kestabilan dan pencegahan error
-------------------------------
- Retry & backoff: semua HTTP fetch menggunakan exponential backoff (configurable `max_retries`).
- Isolation: proses tiap target dijalankan terpisah—error pada 1 target tidak menghentikan run.
- Rate limiting: kontrol `rate_limit_ms` dan `post_interval_ms` untuk menghindari throttle pihak ketiga.
- Batas per-user: `max_items_per_user` mencegah spike traffic saat akun sangat aktif.
- Muted HTTP exceptions: `muteHttpExceptions=true` sehingga response dapat dianalisis sebelum menyatakan error.
- Logging: semua error/warn/info dicatat di `Logs` dengan meta JSON untuk debugging.
- Input validation: Scraper memastikan username valid dan Poster memvalidasi payload minimal.

Testing
-------
1. Unit/Manual testing:
   - `testRunSingle(username)` di Scraper: fetch contoh username, post single payload ke Poster, periksa `Logs`.
   - `testSendToDestination()` di Poster: kirim sample payload ke destinasi.
2. End-to-end (full run):
   - Deploy Poster, pastikan `poster_webhook` di Scraper `Config`.
   - Tambahkan 1-3 `Targets` test, set `fetch_per_tweet=false`.
   - Jalankan `runScrapeAndPost()` manual.
   - Verifikasi:
     - Scraper `Logs` mencatat proses & update `last_tweet_id`.
     - Poster `Logs` menerima payload & mengirim ke destinasi (cek Slack/Discord/Telegram).
   - Jalankan `runScrapeAndPost()` ulang untuk memeriksa idempotency (tidak ada duplicate).
3. Load/Integration testing:
   - Staging: simulasi puluhan user, pantau performance (set `max_items_per_user` rendah).
   - Periksa behavior saat Nitter instance down / rate-limited (should retry & continue).
4. Regression:
   - Setelah perubahan heuristik HTML, run manual untuk 5–10 sample accounts dari berbagai Nitter instances.

Deployment
----------
Scraper App:
- Bind script ke Spreadsheet yang dipakai (`Extensions -> Apps Script` pada spreadsheet).
- Deploy trigger time-driven:
  - Function: `runScrapeAndPost`
  - Interval: 5–15 menit (tergantung rate limits).
- Pastikan `Config` dan `Targets` diisi.

Poster App:
- Paste `poster.gs` ke Apps Script project, bound ke spreadsheet (atau standalone).
- Isi `Config` untuk Poster (keys: `poster_shared_secret`, `destination_type`, credentials untuk Slack/Discord/Telegram/custom).
- Deploy → New deployment → Web app:
  - Execute as: Me (script owner)
  - Who has access: sesuai kebijakan (dev: Anyone, prod: internal or restricted)
- Salin URL ke `scraper.Config.poster_webhook`.

Operations & runbook
--------------------
Daily:
- Review `Logs` for ERRORs and WARNs.
- Check number of processed items; verify no unusual spikes.

On alert (ERROR spike or Poster failures):
1. Inspect Scraper `Logs` for the failing target(s).
2. Check Poster `Logs` for delivery status (4xx/5xx codes).
3. If Nitter instance returns 5xx or HTML changes, consider switching `nitter_instance` to another stable instance or self-host.
4. If Poster receiving 401/invalid_secret: confirm `poster_shared_secret` matches on both sides.
5. If duplicate postings observed: check `Targets.last_tweet_id` and restore from backup if needed.

Logging & Retention
-------------------
- Logs written to `Logs` sheet. Each row: timestamp | level | component | message | meta(json).
- Retention: recommended export/rotate logs weekly (e.g., copy last 30 days to archive sheet and clear).
- For high volume: configure `log_sheet_id` to write to separate spreadsheet to reduce noise.

Monitoring & Metrics (future)
-----------------------------
- Export summaries to BigQuery (or Google Sheets dashboards): counts of processed items, errors per hour, delivery success rate.
- Alerting: send alerts to Slack/email if ERRORs exceed threshold (e.g., >5 in 1 hour).
- Track latency metrics: scrape time, post time, retries.

Troubleshooting notes
---------------------
- "No new items" but there are new tweets: check `last_tweet_id` format, ensure username mapping and HTML selectors still valid.
- "Profile fetch non-200": Nitter instance might be down or blocking. Try another instance or self-host.
- "Poster responded with error": check Poster config (destination credentials) & logs for response body.
- Parsing failures: HTML structure changed — adjust heuristics in `getTweetsFromNitter()`.

Future work & enhancements
--------------------------
1. HMAC signatures for webhook authenticity (Scraper signs, Poster verifies).
2. Thread assembly: group tweets by `conversation_id` and post as consolidated thread.
3. Media support: detect images/videos in Nitter HTML and attach URLs to payload.
4. Fan-out: Poster supports multiple destinations per payload and configurable routing per-target.
5. Observability: integrate with Stackdriver / Cloud Logging and BigQuery for analytics/alerts.
6. Self-hosted Nitter installer helper & health-checker to ensure stable source.
7. CI and unit tests: create mocks for Nitter HTML and unit tests for parsers.
8. Rate-limiter & backpressure control: adaptive backoff based on instance response headers.
9. Multi-instance scraping: rotate across multiple Nitter instances for resilience.
10. Admin UI for Poster: simple `index.html` to view logs & replay messages.

Security & legal note
---------------------
- Scraping public content is subject to legal and ToS implications — evaluate compliance in your jurisdiction.
- Respect robots and instance owner's policies. Prefer self-hosting Nitter for production.
- Protect secrets (do not commit to repo). Rotate secrets on suspected exposure.

Appendix: Quick start checklist
-------------------------------
1. Create Spreadsheet for Scraper: ensure `Config`, `Targets`, `Logs` sheets exist (code auto-creates).
2. Paste `scraper_app` code into Apps Script bound to the spreadsheet.
3. Fill `Config` keys: `nitter_instance`, `poster_webhook`, `poster_shared_secret`, tuning params.
4. Add 1-3 `Targets` for staging.
5. Deploy Poster App: paste `poster_app` code to Apps Script, configure `Config` with `destination_type` and credentials, set `poster_shared_secret`.
6. Deploy Poster as Web App; copy URL to Scraper `poster_webhook`.
7. Run `testSendToDestination()` (Poster) and `testRunSingle(username)` (Scraper).
8. Run `runScrapeAndPost()` manually; verify logs and destinasi.
9. Create time-driven trigger for `runScrapeAndPost()`.

Kontak teknis
------------
Jika Anda memerlukan bantuan lebih lanjut, beri tahu saya fungsi atau target yang harus saya sesuaikan (mis. heuristik HTML untuk instance Nitter tertentu, atau implementasi HMAC). Saya akan bantu tune parser, menambah test mocks, dan menyiapkan template import untuk `Config`/`Targets`.
