# X_threader — Scraper App (Setup, Properties, Testing & Production)

Ini adalah panduan lengkap langkah demi langkah untuk men-setup, mengetes (full run), dan menjalankan Scraper App pada lingkungan produksi. Dokumen ini berfokus pada hal-hal yang wajib Anda konfigurasi, opsi tambahan untuk stabilitas, serta langkah troubleshooting dan best practices operasional.

Ringkasan singkat
- Scraper App bertugas membaca daftar target dari `Targets` sheet, mengambil posting/threads baru (via X/Twitter API v2 jika dikonfigurasi), lalu mengirim payload ke Poster App (`poster_webhook`) yang berjalan terpisah.
- Semua event/log/error dicatat ke sheet `Logs` untuk observability.
- Kestabilan dijaga dengan: retries, exponential backoff, jeda antar request, isolated per-target processing, serta proteksi lewat `poster_shared_secret`.

Struktur file di folder `scraper_app`
- `utils.gs` — helper: baca config, logging, fetchWithRetries, X API helper, safePostToPoster, `runScrapeAndPost`.
- `scraper.gs` — (jika ada) entrypoint dan pemanggilan fungsi workflow utama (dalam implementasi saat ini fungsi utama berada di `utils.gs`).
- `README.md` — file ini (panduan lengkap).

Google Spreadsheet: layout yang wajib ada
Anda perlu membuat (atau menggunakan) Google Spreadsheet yang menjadi basis konfigurasi dan log. Pastikan sheet berikut ada (nama persis case-sensitive):

1. `Config` (columns: `Key` | `Value`) — menyimpan konfigurasi dan secret.
2. `Targets` (columns: `username` | `last_tweet_id` | `enabled` | `notes`) — list target yang akan diproses.
3. `Logs` (columns: `timestamp` | `level` | `component` | `message` | `meta`) — catatan operasional.

Contoh isi `Config` (contoh CSV/rows):
```X_threader/scraper_app/README.md#L1-20
Key,Value
poster_webhook,https://script.google.com/macros/s/AKfy.../exec
poster_shared_secret,my-shared-secret-123            # Wajib apabila Poster dikonfigurasi untuk verifikasi
x_bearer_token,AAAAAAAA...                           # Wajib jika Anda pakai X API v2
use_api_v2,true                                      # Optional (default true)
rate_limit_ms,500                                    # Optional, jeda antar request (ms)
max_retries,4                                        # Optional, jumlah retry untuk HTTP
post_interval_ms,500                                 # Optional, jeda antar post ke Poster (ms)
```

Contoh `Targets`:
```X_threader/scraper_app/README.md#L21-50
username,last_tweet_id,enabled,notes
jack,,true,priority
elonmusk,1623456789012345678,true,monitor
example_account,,false,disabled-for-now
```

Properti: mana wajib & mana opsional
- Wajib (harus diisi di `Config`):
  - `poster_webhook` — URL Web App Poster App. (Jika tidak ada, Scraper tidak akan mengirim data.)
  - `poster_shared_secret` — sangat direkomendasikan untuk keamanan (jika Poster memverifikasi header).
- Wajib bila memakai X API:
  - `x_bearer_token` — bearer token X/Twitter API v2 (jika `use_api_v2=true`).
- Opsional (disarankan untuk produksi):
  - `use_api_v2` — `true`/`false` (default `true`). Jika `false`, Scraper akan skip pemanggilan API.
  - `rate_limit_ms` — jeda antar target (ms). Default `500`.
  - `post_interval_ms` — jeda antar posting ke Poster (ms). Default samakan `rate_limit_ms`.
  - `max_retries` — retry count. Default `4`.
  - `poster_shared_secret` — jika dikonfigurasi di Poster, wajib diisi di Scraper juga.
  - `user_agent` — string untuk header User-Agent di request.
  - `log_sheet_id` — jika Anda ingin log ke spreadsheet berbeda.

Setup step-by-step (development/staging)
1. Buat Spreadsheet baru (atau gunakan yang ada). Tambahkan sheet `Config`, `Targets`, `Logs` bila belum ada.
2. Create Apps Script project:
   - Buka Spreadsheet → Extensions → Apps Script.
   - Paste file `utils.gs` (atau seluruh kode yang disediakan) ke project.
3. Isi `Config` minimal:
   - `poster_webhook` = URL Poster Web App (jika belum deploy Poster, Anda bisa deploy dulu).
   - Jika Poster memerlukan secret, isi `poster_shared_secret`.
   - Jika Anda ingin menggunakan X API, tambahkan `x_bearer_token`.
4. Isi `Targets` dengan 1–3 akun untuk staging (jangan langsung banyak).
5. Run manual:
   - Dari Apps Script Editor, jalankan `runScrapeAndPost()` sekali.
   - Perhatikan: fungsi akan menulis ke `Logs` sheet; cek ada entri INFO/ERROR.
6. Periksa:
   - `Logs` sheet: apakah ada entri `Processed` atau `Posted to poster`?
   - Poster: apakah menerima payload (cek logs Poster App)?
   - `Targets.last_tweet_id`: apakah terupdate untuk target yang diproses?

Testing Full Run (end-to-end)
Langkah ini mensimulasikan kondisi produksi pada skala kecil.

A. Persiapan:
- Pastikan Poster App sudah dideploy sebagai Web App dan `poster_webhook` sudah diisi.
- Tambahkan 2–5 target pada `Targets` (pilih akun yang tidak menghasilkan banyak posting agar mudah verifikasi).
- Pastikan `x_bearer_token` valid jika menggunakan API.

B. Jalankan full test:
1. Clear `Logs` atau catat posisi awal.
2. Jalankan `runScrapeAndPost()` manual.
3. Periksa `Logs`:
   - Harus ada satu entri per target (INFO: Processed X tweets)
   - Jika ada error, entri ERROR harus berisi meta dengan stack/response.
4. Verifikasi Poster menerima payload dan destinasi akhir (Slack/Telegram/Discord/custom) menerima pesan.
5. Untuk tiap tweet yang sukses, `Targets.last_tweet_id` harus meningkat sesuai tweet terbaru.
6. Ulangi test untuk memastikan idempotency (menjalankan skrip ulang tidak mem-post ulang tweet yang sama).

Produksi (production full run) — langkah lengkap
1. Skala konfigurasi:
   - Tambahkan semua target yang akan Anda monitor ke `Targets`. Jika banyak target (>50), pertimbangkan throttle dan batch schedule.
   - Tweak `rate_limit_ms` dan `post_interval_ms` untuk menghindari rate limiting dari X API dan quota dari Poster/destinasi.
   - Pastikan `max_retries` dan `backoff` cukup untuk transient errors (typical: 3–5 retries).
2. Monitoring & alert:
   - Rutin periksa `Logs` untuk level `ERROR` > threshold.
   - Tambahkan notifikasi (opsional): Anda bisa membuat trigger Apps Script yang mengirim ringkasan harian `Logs` ke Slack/email.
3. Setup trigger:
   - Buat Time-driven trigger untuk `runScrapeAndPost` (mis. setiap 5–15 menit tergantung kebutuhan & rate limit).
   - Jangan set interval lebih cepat dari yang diperbolehkan API/destinasi.
4. Konfigurasi retensi log:
   - Jika `Logs` tumbuh besar, buat proses yang meng-archive atau export setiap minggu/bulan.
5. Failover & restart:
   - Pastikan workflow toleran kegagalan: error per-target tidak menghentikan seluruh run.
   - Jika deploy code baru, periksa last processed ids tetap utuh di `Targets` agar tidak duplikasi.

Stabilitas & Pencegahan error (apa yang sudah diterapkan)
- fetchWithRetries: semua HTTP request menggunakan retries dan exponential backoff.
- muteHttpExceptions: response diperiksa manual sehingga error HTTP tidak memaksa exception tak tertangani.
- Isolasi per-target: exception pada satu target dicatat dan diproses; loop melanjutkan ke target berikutnya.
- Deduplikasi: `last_tweet_id` digunakan untuk mencegah posting ulang.
- Rate-limiting controls: `rate_limit_ms` & `post_interval_ms`.
- Shared secret: Header `X-Poster-Secret` dikirim ke Poster untuk verifikasi.
- Logging ke `Logs` sheet dengan meta JSON untuk debugging.

Troubleshooting umum
- “No user id” atau “Failed to resolve user id”:
  - Periksa `x_bearer_token` valid, dan `use_api_v2=true`.
  - Cek apakah username valid atau tersedia (suspended/private).
- “Poster responded with error status”:
  - Periksa `poster_webhook` URL benar dan Poster App aktif.
  - Jika Poster membalas 401/403, periksa `poster_shared_secret` kesesuaian.
- “Rate limited / 429”:
  - Tingkatkan `rate_limit_ms`, kurangi frekuensi trigger, atau gunakan fewer targets per run.
- “Max fetch retries exceeded”:
  - Cek network, token validity, endpoint availability. Perbesar `max_retries` jika diperlukan.
- Duplicate postings after redeploy:
  - Periksa `Targets.last_tweet_id`. Jika ter-reset, Anda mungkin perlu mengisi manual id terakhir untuk mencegah repost.

Security checklist
- Jangan masukkan `x_bearer_token` atau `poster_shared_secret` ke repo publik.
- Gunakan `poster_shared_secret` dan verifikasi di Poster.
- Jika Poster Web App di-deploy dengan akses "Anyone", maka shared secret wajib dipakai.
- Rotasi token jika ada kebocoran; update `Config` sesuai.

Operational tips
- Uji perubahan kode di staging spreadsheet, bukan langsung produksi.
- Mulai dengan sedikit target untuk memonitor load dan behavior.
- Tambahkan alerting sederhana (mis. if N ERRORs in 1 hour → send email).
- Backup `Targets` sheet secara rutin (agar recovery ID mudah dilakukan).

Contoh run checklist (saat go-live)
1. Semua `Config` wajib terisi: `poster_webhook`, `poster_shared_secret` (jika Poster butuh), `x_bearer_token` (jika pakai API).
2. Isi `Targets` minimal 5 akun untuk staging; enable `true`.
3. Jalankan manual `runScrapeAndPost()` — tunggu hingga selesai.
4. Verifikasi `Logs` tidak ada ERROR kritikal.
5. Verifikasi `Targets.last_tweet_id` ter-update untuk tiap akun.
6. Deploy trigger time-driven (mis. tiap 5–15 menit).
7. Monitor `Logs` setiap hari selama 48 jam pertama.

FAQ singkat
- Q: Bolehkah saya menyimpan token di Apps Script Properties (PropertiesService) daripada `Config` sheet?
  - A: Ya, itu lebih aman. Jika Anda gunakan standalone/managed script, simpan secret di `PropertiesService.getScriptProperties()`. Dokumen ini mengasumsikan `Config` sheet untuk kemudahan pemakaian.
- Q: Bagaimana menangani thread assembly (multi-tweet thread)?
  - A: Saat ini Scraper mengirim tiap tweet sebagai unit. Jika Anda membutuhkan penggabungan berdasarkan `conversation_id`, modifikasi pipeline untuk mengelompokkan tweet berdasar `conversation_id` sebelum mengirim.
- Q: Bagaimana menguji Poster jika saya tidak ingin deploy sebagai "Anyone"?
  - A: Anda bisa deploy sementara sebagai "Anyone", uji E2E, lalu ubah akses & gunakan metode autentikasi berbeda (mis. OAuth service account) bila diperlukan.

Jika Anda mau, saya bisa:
- Tambahkan template CSV untuk import `Config` dan `Targets`.
- Tambahkan script kecil untuk archive `Logs` atau rotasi otomatis.
- Implementasikan HMAC signing pada body (lebih aman daripada header secret).

Selanjutnya Anda ingin saya lakukan apa?
- Menyusun template CSV untuk import sheet?  
- Menambahkan mekanisme HMAC signing antara Scraper & Poster?  
- Menyediakan script rotasi/arsip log?

Sekali lagi: silakan pilih langkah berikutnya — saya akan lanjutkan implementasi sesuai prioritas Anda.