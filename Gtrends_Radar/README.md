# Gtrends Radar (Google Apps Script)

Proyek ini mengirimkan ringkasan harian Google Trends Indonesia ke Discord Webhook dengan format rapi, emoji kaya, dan baris Keywords polos. Implementasi lengkap ada di [Code.gs](Code.gs) dan spesifikasi di [prd.md](prd.md).

## Ringkasan Fitur
- SerpAPI Trending Now-only: ambil tren saat ini (geo=ID) via SerpAPI engine=google_trends_trending_now (opsional category_id=<numeric_id>; hl=id→en; opsional hours dan only_active). Kategori default: 11,17,4 (konfigurabel via SERPAPI_TN_CATEGORY_IDS).
- Pilih TOP_N kata kunci, susun baris "Keywords:" polos tanpa emoji.
- Ringkasan via OpenRouter (model openrouter/z-ai/glm-4.5-air:free). Jika API key kosong atau rate-limited, pakai fallback.
- Post ke Discord (embed hijau default atau plain). Retry 1s/2s/4s.
- Idempotent per hari, logging ke Google Sheet, multi-webhook, mode preview (DRY_RUN), dan debug logs (SERPAPI_*).

## Arsitektur Singkat
- Orkestrasi harian: cek idempotency → fetch Trends → ringkas (AI/fallback) → compose payload → post → log.
- Properti Script menyimpan secrets/config & status posting harian.
- Trigger time-based sekitar 06:00 WIB.

## Prasyarat
- Akun Google dengan akses Google Apps Script dan Google Sheets.
- SerpAPI API key (wajib) — set di Script Properties sebagai SERPAPI_KEY.
- Discord Webhook URL (wajib).
- OpenRouter API key (opsional).

## Setup Cepat
1) Buat proyek Apps Script baru (standalone).
2) Copy–paste seluruh isi [Code.gs](Code.gs).
3) Buka Project Settings → Script properties, set minimal: SERPAPI_KEY dan DISCORD_WEBHOOK_URL (opsional: DISCORD_WEBHOOK_URL_PREVIEW, DRY_RUN, TOP_N, SHEET_ID, AVATAR_USERNAME, AVATAR_URL).
4) Uji cepat dengan preview: jalankan [JavaScript.testOnce()](Code.gs:47) (DRY_RUN).
5) Konfirmasi produksi satu kali: jalankan [JavaScript.serpapiPostOnce()](Code.gs:122) untuk memastikan post ke Discord sukses.
6) Buat trigger time-based sesuai Script Properties POST_TIME_HOUR/POST_TIME_MINUTE (default ~06:00 WIB) via [JavaScript.ensureTrigger_()](Code.gs:985).

## Properti Script (Konfigurasi)
Berikut daftar properti beserta status wajib/opsional dan contoh nilainya.

- Wajib:
  - SERPAPI_KEY: API key SerpAPI untuk sumber data Trends.
    Contoh: 03a2...d613fa
  - DISCORD_WEBHOOK_URL: URL webhook Discord untuk produksi.
    Contoh: https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz-TokenContoh

- Opsional (direkomendasikan):
  - DISCORD_WEBHOOK_URL_PREVIEW: URL webhook Discord untuk preview (dipakai saat DRY_RUN=true).
    Contoh: https://discord.com/api/webhooks/987654321098765432/ZyXwVuTsRqPoNmLkJiHgFeDcBa-TokenPreview
  - DISCORD_WEBHOOK_URLS: JSON array multi-webhook produksi.
    Contoh: ["https://discord.com/api/webhooks/xxx/TokenA", "https://discord.com/api/webhooks/yyy/TokenB"]
  - SERPAPI_TN_CATEGORY_IDS: daftar kategori numerik untuk Trending Now; contoh: 11,17,4 atau ["11","17","4"]. Default: 11,17,4.
    Referensi kategori: lihat [example serpapi/google-trends-trending-now-categories.json.example](example serpapi/google-trends-trending-now-categories.json.example:1).
  - SERPAPI_TN_HOURS: jangka waktu Trending Now; salah satu 4, 24, 48, 168. Default kosong (24 jam).
  - SERPAPI_TN_ONLY_ACTIVE: true/false. Default true. Jika true, hanya sertakan tren yang masih aktif (only_active=true).
  - DRY_RUN: true/false. Default false.
    Jika true, kirim ke DISCORD_WEBHOOK_URL_PREVIEW (bila diisi). Jika kosong, mode DRY_RUN tidak mem-post apa pun (skip diam-diam).
  - TOP_N: angka. Default 10 (disarankan 5 untuk pesan ringkas).
  - ENABLE_EMBED: true/false. Default true (embed hijau; fallback pesan sederhana).
  - POST_TIME_HOUR: angka. Default 6.
  - POST_TIME_MINUTE: angka. Default 0.
  - SHEET_ID: string. Jika kosong, sistem auto‑buat Sheet bernama gtrends_logs dan menyimpan ID‑nya di properti.
  - HEALTH_WEBHOOK_URL: URL webhook Discord untuk health ping (error).
  - OPENROUTER_API_KEY: string. Opsional untuk ringkasan AI.
  - OPENROUTER_MODEL: string. Default "openrouter/z-ai/glm-4.5-air:free".
  - OPENROUTER_HTTP_REFERER: string. Opsional.
  - OPENROUTER_X_TITLE: string. Opsional.
  - AVATAR_USERNAME: string. Opsional untuk override nama webhook Discord (contoh: Rizz Bot).
  - AVATAR_URL: string (URL gambar). Opsional untuk override avatar webhook Discord.

### Contoh Konfigurasi Minimal (Produksi)
- DISCORD_WEBHOOK_URL= https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz-TokenContoh
- DRY_RUN= false
- TOP_N= 5
- ENABLE_EMBED= false

### Contoh Konfigurasi Preview (Uji DRY_RUN)
- DISCORD_WEBHOOK_URL_PREVIEW= https://discord.com/api/webhooks/987654321098765432/ZyXwVuTsRqPoNmLkJiHgFeDcBa-TokenPreview
- DRY_RUN= true
- TOP_N= 5
- ENABLE_EMBED= false

Catatan:
- Cara mendapatkan Discord webhook: buka channel Discord → Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL.
- Jika DRY_RUN=true dan DISCORD_WEBHOOK_URL_PREVIEW kosong, sistem tidak mem‑post (skip diam‑diam) sesuai desain.

## Cara Deploy
- Tempel [Code.gs](Code.gs) ke proyek Apps Script.
- Set Script Properties sesuai kebutuhan (pastikan SERPAPI_KEY dan DISCORD_WEBHOOK_URL terisi).
- Uji preview: jalankan [JavaScript.testOnce()](Code.gs:47) (DRY_RUN) → cek Discord preview dan Sheet.
- Konfirmasi produksi: jalankan [JavaScript.serpapiPostOnce()](Code.gs:122) → cek Discord produksi dan Sheet.
- Buat trigger time-based (Project Triggers) untuk 06:00 WIB setiap hari via [JavaScript.ensureTrigger_()](Code.gs:991).

## Pengujian (Checklist)
- SerpAPI aktif: set SERPAPI_KEY. Jalankan [JavaScript.testOnce()](Code.gs:47) → cek log DEBUG_FETCH dengan SERPAPI_TN_ATTEMPT/SERPAPI_TN_OK (menampilkan category_id dan hl) dan status TEST.
- Preview Discord: DRY_RUN=true dan DISCORD_WEBHOOK_URL_PREVIEW di-set → pesan preview berisi "Keywords:" muncul.
- Produksi sekali: jalankan [JavaScript.serpapiPostOnce()](Code.gs:122) → status OK dan pesan tiba di webhook produksi.
- TOP_N: ubah ke 5 dan cek panjang daftar di baris Keywords.
- AI OFF/ON: jika OPENROUTER_API_KEY kosong, gunakan fallback; jika diisi, pastikan lead/bullets patuh aturan (emoji kaya, Keywords polos).
- Idempotent: jalankan [JavaScript.main()](Code.gs:9) dua kali di hari sama → eksekusi kedua SKIPPED.
- Error path: salah‑kan DISCORD_WEBHOOK_URL → retry dan log ERROR; jika HEALTH_WEBHOOK_URL terisi, ping terkirim.

## Observability & Logging
- Sheet auto-buat (gtrends_logs) jika SHEET_ID kosong.
- Kolom: timestamp, date_local, count, status, err_msg, elapsed_ms, posted_hash, keywords_joined.
- Debug fetch path memakai status: SERPAPI_TN_ATTEMPT, SERPAPI_TN_OK, SERPAPI_TN_FAIL, SERPAPI_TN_ERROR, SKIPPED, SKIPPED_NO_DATA, TEST, TEST_ERROR, OK, ERROR.
- HEALTH_WEBHOOK_URL (opsional) akan menerima ping singkat saat gagal post atau exception besar.

## Jadwal & Idempotency
- Trigger time-based harian sesuai Script Properties POST_TIME_HOUR/POST_TIME_MINUTE (default ~06:00 WIB). Setelah mengubah properti jam/menit, jalankan [JavaScript.ensureTrigger_()](Code.gs:985) untuk menyelaraskan ulang trigger.
- Idempotency via Script Properties: simpan POSTED_DATE dan POSTED_HASH (SHA-1 dari dateKey|firstKeyword).

## Aturan Format Discord
- Judul: “🇮🇩 Google Trends Indonesia — DD MMM YYYY”.
- Lead: 1–2 kalimat, emoji kaya, ≤ ~60 kata.
- Bullets: 5–10 baris, tiap baris beremoji + deskripsi singkat, dengan suffix “ — <traffic_K/M> · +<increase_%> · sejak <HH:mm>”.
- Keywords: baris polos tanpa emoji/tanda dekoratif.
- Footer: “Source: Google Trends · ⏰ 06:00 WIB”.

## Keamanan
- Simpan secrets di Script Properties; jangan hardcode token.
- Jangan log token atau kirim ke Discord.

## Troubleshooting
- Tidak ada post? Periksa DISCORD_WEBHOOK_URL, ENABLE_EMBED, dan status trigger.
- Rate-limit AI? Sistem pakai fallback otomatis.
- Error post Discord? Sistem retry 3 kali; cek log dan HEALTH webhook (jika di-set).
- Sheet tidak muncul? Kosongkan SHEET_ID agar auto-buat.
- Embed tidak tampil sebagai kotak hijau? Pastikan ENABLE_EMBED=true di Script Properties (atau hapus property agar default true) dan gunakan payload embeds dengan description (sudah diimplementasi).

## Verifikasi Penyimpanan Qdrant
Project ini juga disimpan di Qdrant (collection code_docs, vector fast-all-minilm-l6-v2, dim 384).
- List collections:
  curl -s http://localhost:6333/collections
- Lihat konfigurasi collection:
  curl -s http://localhost:6333/collections/code_docs
- Hitung record untuk berkas:
  curl -s -X POST http://localhost:6333/collections/code_docs/points/count \
    -H "Content-Type: application/json" \
    -d '{ "filter": { "must": [ { "key": "filename", "match": { "value": "Code.gs" } } ] }, "exact": true }'
- Ambil payload:
  curl -s -X POST http://localhost:6333/collections/code_docs/points/scroll \
    -H "Content-Type: "application/json" \
    -d '{ "filter": { "must": [ { "key": "filename", "match": { "value": "Code.gs" } } ] }, "limit": 3 }'

## FAQ Singkat
- Bisa tanpa AI? Ya, cukup kosongkan OPENROUTER_API_KEY.
- Embed vs plain? Atur ENABLE_EMBED=true/false sesuai preferensi tampilan di Discord.
- Multi‑webhook? Isi DISCORD_WEBHOOK_URLS (JSON array), sistem akan kirim berantai dengan retry.

## Sumber
- Implementasi: [Code.gs](Code.gs)
- PRD: [prd.md](prd.md)

## Entry Points (Nama Fungsi untuk Eksekusi)
- Test sekali (preview/aman): [JavaScript.testOnce()](Code.gs:47) — DRY_RUN, tidak menandai idempotency, kirim ke `DISCORD_WEBHOOK_URL_PREVIEW` jika diset, tulis log TEST/TEST_ERROR.
- Konfirmasi produksi sekali: [JavaScript.serpapiPostOnce()](Code.gs:122) — force produksi 1x untuk verifikasi posting Discord.
- Jalankan penuh sekali (production): [JavaScript.runOnceNow()](Code.gs:98) — memanggil [JavaScript.main()](Code.gs:9), idempotent per hari.
- Orkestrator harian (untuk trigger waktu): [JavaScript.main()](Code.gs:9) — hubungkan ke trigger 06:00 WIB.
- Sinkronisasi trigger (jika jam/menit diubah): [JavaScript.ensureTrigger_()](Code.gs:985) — pastikan trigger harian aktif sesuai konfigurasi.

### Cara Menjalankan di Apps Script UI
1) Buka proyek Apps Script dan pastikan seluruh isi file [Code.gs](Code.gs) sudah ditempel.
2) Di dropdown fungsi (pojok atas editor), pilih salah satu:
   - Untuk uji coba aman: pilih [testOnce()](Code.gs:47) lalu klik Run.
   - Untuk sekali jalan penuh: pilih [runOnceNow()](Code.gs:98) atau langsung [main()](Code.gs:9) lalu klik Run.
   - Untuk bikin/refresh trigger harian: pilih [ensureTrigger_()](Code.gs:985) lalu klik Run.
3) Periksa hasil:
   - Discord: pesan masuk (preview jika DRY_RUN/test, produksi jika full run).
   - Google Sheet: baris log baru (status TEST/TEST_ERROR atau OK/ERROR/SKIPPED).
4) Setelah verifikasi, set trigger time-based harian (atau jalankan [ensureTrigger_()](Code.gs:375)).
