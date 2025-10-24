# daily-gtrends-id-discord/prd.md

## Ringkasan

Buat **daily Google Trends Indonesia** (gratis, hanya Google Apps Script) yang:

* Mengambil *top daily trending searches* untuk `geo=ID`.
* Merapikan & memperkaya ringkasan dengan **AI parser** via **OpenRouter** model `openrouter/z-ai/glm-4.5-air:free`.
* Mem‐post satu pesan harian ke **Discord Webhook** dengan **kalimat yang enak dibaca & full emoji** *(kecuali pada bagian `Keywords:` yang wajib polos tanpa emoji)*.
* Tahan banting: retry, idempotent per hari, logging ke Google Sheet, dan monitoring ringan.

---

## Tujuan

1. Otomatis kirim 1 post harian (sekitar **06:00 Asia/Jakarta**) berisi daftar kata kunci paling dicari di Indonesia.
2. Format Discord yang rapi: judul, tanggal, highlight 5–10 teratas, ringkasan singkat hasil AI, **emoji ramai**, dan **blok `Keywords:` polos**.
3. Hemat kuota: gunakan endpoint Trends yang dapat di-*fetch* langsung tanpa server sendiri; AI parser dipakai minimal.
4. Observability: ada **log** (timestamp, jumlah keyword, status kirim, error) di Google Sheet.
5. Aman: simpan secrets sebagai **Script Properties**.

**Non-Goals**

* Tidak membuat dashboard web.
* Tidak menyimpan data historis secara lengkap (opsional ringkas harian di sheet).
* Tidak mengelola banyak webhook multi-guild (cukup 1–N webhook via konfigurasi).

---

## Sumber Data

- **SerpAPI Google Trends (ID)**: gunakan SerpAPI engine `google_trends_trending_now`.
  - Primary: `engine=google_trends_trending_now` untuk `geo=ID`, opsi `category_id=<numeric_id>`, `hl=id` (fallback `hl=en`).
  - Kategori numerik: contoh umum `11` (Other), `17` (Sports), `4` (Entertainment). Dapat dikonfigurasi via Script Property `SERPAPI_TN_CATEGORY_IDS` sebagai JSON array atau comma-separated (default: `11,17,4`). Lihat referensi kategori: [example serpapi/google-trends-trending-now-categories.json.example](example serpapi/google-trends-trending-now-categories.json.example:1).
  - Catatan: `type=daily_trends` dan `type=realtime_trends` sudah discontinued oleh Google dan tidak didukung SerpAPI.
  - Param wajib: `api_key=<SERPAPI_KEY>`.
  - Param opsional: `hours` (4, 24, 48, 168) untuk jangka waktu Trending Now; `only_active=true` untuk filter tren aktif.
  - Bentuk respons (umum): `trending_searches` → `query/title`, `search_volume/increase_percentage/formatted_traffic`, `categories[]`, `news_results`.
  - Kuota: batasi percobaan (≤ 6 panggilan maksimum: kombinasi beberapa `category_id` × 2 bahasa), dan berhenti dini saat salah satu percobaan berhasil untuk hemat kuota.

---

## Alur Tingkat Tinggi

1. **Trigger harian** sesuai Script Properties `POST_TIME_HOUR`/`POST_TIME_MINUTE` (default ~06:00 WIB) → `main()`.
2. `fetchDailyTrends()` → ambil JSON Trending Now, parse, pilih top N (konfigurabel, default 10).
3. `summarizeWithAI()` → kirim konteks ringkas ke OpenRouter (`openrouter/z-ai/glm-4.5-air:free`) untuk membuat:
   - Lead 1 paragraf (emoji kaya, ≤ ~60 kata)
   - Bullets informatif: SATU baris per keyword dengan format “• <emoji> <keyword>: <info ringkas>”
   - Gunakan traffic dan 1–2 artikel teratas bila bermanfaat; hindari URL mentah/hashtag.
4. `composeDiscordMessage()` → gabungkan:
   - **Title** (tanggal lokal, 🇮🇩)
   - **Lead** (hasil AI, full emoji)
   - **Bullets** (satu baris per keyword: “• <emoji> <keyword>: <info>”)
   - **Footer** kecil (waktu kirim, sumber)
5. `postToDiscord()` → kirim ke Webhook. **Retry** eksponensial (max 3).
6. `logToSheet()` → catat hasil (OK/ERROR, count, elapsed).
8. **Idempotency**: gunakan **CacheService**/**PropertiesService** simpan hash tanggal terakhir; jika sudah kirim hari ini → **skip**.

---

## Desain Pesan Discord

**Format (satu embed atau konten biasa):**

* **Judul**: `🇮🇩 Google Trends Indonesia — <DD MMM YYYY>`
* **Lead** *(dari AI, full emoji)*: 1 paragraf ≤ ~60 kata.
* **Bullets** (5–10 item, SATU baris per keyword):
  `• <emoji> <keyword>: <informasi singkat> — <traffic_K/M> · +<increase_%> · sejak <HH:mm>`
  - Info singkat ±8–12 kata, menyorot inti tren/konteks (boleh gunakan ringkasan artikel).
  - Traffic diformat K/M (contoh: 20K, 200K, 1.2M); persentase dibulatkan; start_timestamp ditampilkan lokal Asia/Jakarta.
  - Emoji relevan per baris (🔥📈🛍️🎮🎬⚽💰📱🎓❤️ dll).
* **Footer kecil**: `Source: Google Trends · ⏰ 06:00 WIB`

**Aturan Penting**

* Hindari URL mentah dan hashtag.
* Jaga ringkas dan informatif; tidak bertele-tele.

---

## Konfigurasi

Gunakan **Script Properties**:

- `SERPAPI_KEY` *(wajib)* — API key SerpAPI untuk sumber data Trends.
- `DISCORD_WEBHOOK_URL` *(wajib)* — webhook produksi.
- `DISCORD_WEBHOOK_URL_PREVIEW` *(opsional)* — webhook preview saat `DRY_RUN=true`.
- `DISCORD_WEBHOOK_URLS` *(opsional)* — JSON array multi-webhook produksi.
- `SERPAPI_TN_CATEGORY_IDS` *(opsional)* — daftar kategori numerik untuk Trending Now; contoh: `11,17,4` atau `["11","17","4"]` (default akan memakai `11,17,4`).
- `SERPAPI_TN_HOURS` *(opsional)* — salah satu `4, 24, 48, 168` (default `24`).
- `SERPAPI_TN_ONLY_ACTIVE` *(opsional)* — `true/false` (default `true`).
- `TOP_N` = `10`
- `POST_TIME_HOUR` = `6` (WIB)
- `POST_TIME_MINUTE` = `0`
- `ENABLE_EMBED` = `true` (atau `false` untuk konten biasa)
- `DRY_RUN` = `false` (true = tidak kirim ke Discord, hanya log)
- `SHEET_ID` *(opsional; jika tidak ada, auto-buat sheet baru bernama `gtrends_logs`)*
- `HEALTH_WEBHOOK_URL` *(opsional)* — ping singkat bila gagal total.
- `OPENROUTER_API_KEY` *(opsional; jika kosong, nonaktifkan AI parser)*
- `OPENROUTER_MODEL` = `openrouter/z-ai/glm-4.5-air:free`
- `OPENROUTER_HTTP_REFERER` *(opsional)*
- `OPENROUTER_X_TITLE` *(opsional)*

---

## Prompt AI Parser (OpenRouter)

**Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
**Model**: `openrouter/z-ai/glm-4.5-air:free`
**Header**:

* `Authorization: Bearer <OPENROUTER_API_KEY>`
* `Content-Type: application/json`
* (opsional) `HTTP-Referer` dan `X-Title` sesuai kebijakan OpenRouter.

**System prompt (ringkas & kaku aturan)**:

```
Anda mengubah Google Trends Indonesia (ID) menjadi satu paragraf lead dan daftar bullets informatif per keyword.
Format:
- Bahasa Indonesia santai.
- Lead: 1 paragraf ramah, kaya emoji, ≤ ~60 kata.
- Bullets: SATU baris per keyword, format: "• <emoji> <keyword>: <informasi singkat>"
- Informasi singkat ±8–12 kata, menyorot inti tren/konteks. Hindari hashtag dan URL mentah.
- Gunakan traffic dan 1–2 artikel teratas dari input bila bermanfaat.
```

**User content (contoh struktur)**:

```json
{
  "date": "2025-10-16",
  "top_n": 10,
  "items": [
    {
      "query": "contoh keyword",
      "traffic": "200K+",
      "articles": ["Judul artikel 1 - Media X"]
    }
  ]
}
```

**Output yang diharapkan**:

* `lead`: satu paragraf ≤ ~60 kata, banyak emoji.
* `bullets`: 5–10 baris, setiap baris format “• <emoji> <keyword>: <informasi singkat>”.

**Fallback**: jika AI gagal / rate-limited → gunakan **template lead default**:

> `Ringkasan tren hari ini hadir! Dari hiburan hingga sepak bola, inilah yang paling dicari warganet Indonesia. Siap cek hype-nya? 🚀✨`

---

## Struktur Kode (Apps Script)

**File**: `Code.gs`

Fungsi utama:

* `main()` — Orkestrator harian: idempotency → fetch (SerpAPI) → summarize (AI/fallback) → compose → post → log.
* `fetchDailyTrends_()` — SerpAPI Trending Now only; berhenti dini setelah berhasil (hemat kuota).
* `fetchDailyTrendsSerpApi2_()` — Implementasi engine=`google_trends_trending_now` (geo=ID, `category_id=<numeric_id>`; `hl=id→en`) dengan percobaan minimal pada beberapa kategori.
* `fetchDailyTrendsSerpApi_()` — Legacy helper (daily_trends) — disimpan untuk arsip, tidak digunakan di alur utama.
* `serpapiPostOnce()` — Uji sekali kirim produksi (force send), konfirmasi posting Discord.
* `summarizeWithAI_(items, date)` — OpenRouter: hasilkan lead dan bullets informatif (satu baris per keyword) dengan emoji relevan.
* `composeDiscordPayload_(lead, bullets, date)` — Payload akhir (judul + lead + bullets + footer).
* `postToDiscord_(payload)` — Fetch + retry (3x; 1s/2s/4s).
* `logToSheet_(entry)` — Tulis log: tanggal, jumlah, status, durasi, error.
* `isAlreadyPostedToday_(dateKey)` & `markPostedToday_(dateKey)` — Idempotency via `PropertiesService`.
* `ensureTrigger_()` — Pastikan trigger harian 06:00 WIB aktif.
* `postToDiscord(payload)`
  `UrlFetchApp.fetch` + retry (3x, backoff 1s/2s/4s).
* `logToSheet(result)`
  Tulis baris log: tanggal, jumlah, status, durasi, error.
* `isAlreadyPostedToday_(dateKey)` & `markPostedToday_(dateKey)`
  Idempotency via `PropertiesService`/`CacheService`.
* `ensureTrigger_()`
  Pastikan *time-driven trigger* 06:00 WIB ada; buat jika belum.

**Skema Log (Sheet)**
Kolom: `timestamp, date_local, count, status, err_msg, elapsed_ms, posted_hash`

---

## Idempotency

* `dateKey = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd")`
* Simpan `posted_hash` (misal SHA1 dari `dateKey + firstKeyword`) di `PropertiesService`.
* Jika sama → **skip**.

---

## Error Handling & Retry

* `UrlFetchApp` → retry linear/exponential (1s, 2s, 4s).
* Kegagalan AI tidak menggagalkan post; pakai fallback lead.
* Kegagalan post Discord → 3x retry; jika tetap gagal, tulis log `ERROR`.

---

## Batasan Kuota & Praktik Baik

* Google Apps Script gratis punya kuota harian (*bisa berubah*). Desain ini:

  * **1 fetch** kecil (Trends) + **1 post** Discord + (opsional) **1 call AI** → sangat ringan.
  * Gunakan `muteHttpExceptions: true` dan cek status code.
  * Hindari loop/cron sering; **1x/hari** saja.
* OpenRouter *free* bisa *rate-limit*; tangani fallback.

---

## Keamanan

* Simpan `DISCORD_WEBHOOK_URL` & `OPENROUTER_API_KEY` di **Script Properties**.
* Jangan log token.
* Jangan expose Secrets di pesan Discord.

---

## Pengujian

Checklist:

1. **SerpAPI**: Set `SERPAPI_KEY` di Script Properties. Jalankan [JavaScript.testOnce()](Code.gs:47) — periksa log `SERPAPI_TN_ATTEMPT/SERPAPI_TN_OK` (termasuk `cat=<id>` dan `hl=<lang>`) dan status `TEST`.
2. **Preview Discord**: Pastikan `DRY_RUN=true` dan `DISCORD_WEBHOOK_URL_PREVIEW` diset; cek pesan preview berisi baris `Keywords:`.
3. **Production sekali**: Jalankan [JavaScript.serpapiPostOnce()](Code.gs:122) — pastikan status `OK` dan pesan masuk ke webhook produksi.
4. **TopN**: Ubah `TOP_N` ke 5 dan cek panjang daftar di `Keywords:`.
5. **AI OFF/ON**: AI opsional; jika `OPENROUTER_API_KEY` kosong, sistem pakai fallback lead/bullets.
6. **Idempotent**: Jalankan [JavaScript.main()](Code.gs:9) dua kali di hari sama — eksekusi kedua `SKIPPED`.
7. **Error path**: Salah-kan `DISCORD_WEBHOOK_URL` — lihat retry dan log `ERROR`; jika `HEALTH_WEBHOOK_URL` diset, ping error terkirim.

---

## Deployment

1. Buat Google Apps Script kosong (standalone).
2. Copy–paste [Code.gs](Code.gs:1).
3. Set **Script Properties** (menu Project Settings → Script properties), minimal:
   - `SERPAPI_KEY` (wajib)
   - `DISCORD_WEBHOOK_URL` (wajib)
   - opsional: `DISCORD_WEBHOOK_URL_PREVIEW`, `TOP_N`, `DRY_RUN`, `SHEET_ID`, `HEALTH_WEBHOOK_URL`
4. Jalankan [JavaScript.ensureTrigger_()](Code.gs:985) sekali untuk membuat trigger sesuai Script Properties `POST_TIME_HOUR`/`POST_TIME_MINUTE` (default ~06:00 WIB).
5. Uji [JavaScript.testOnce()](Code.gs:47) (preview) atau [JavaScript.serpapiPostOnce()](Code.gs:122) (produksi sekali).
6. Done.

---

## Rekomendasi Tambahan (langsung terapkan)

* **Multi-webhook support**: properti `DISCORD_WEBHOOK_URLS` (JSON array). Kirim berantai, tahan rate-limit.
* **Mode Preview**: jika `DRY_RUN=true`, kirim ke `DISCORD_WEBHOOK_URL_PREVIEW` bila tersedia.
* **Minify output**: batasi bullets ke `TOP_N` agar tidak panjang.
* **Time drift guard**: jika `POST_TIME_HOUR` diubah, `ensureTrigger_()` sinkronisasi ulang.
* **Ringkasan per kategori** (opsional): mapping kasar dengan heuristik emoji (⚽ olahraga, 🎬 hiburan, 💼 ekonomi, 📱 tech).
* **Sheet Archive** (opsional): simpan kolom `keywords_joined` untuk jejak harian ringan.
* **Health Ping** (opsional): kirim pesan singkat jika gagal total (gunakan webhook kedua atau email Apps Script).

---

## Acceptance Criteria

* Pada hari `D`, pukul ~06:00 WIB, Discord menerima satu pesan dengan:

  * Judul: `🇮🇩 Google Trends Indonesia — DD MMM YYYY`
  * Lead dari AI (jika tersedia) atau fallback (≤ ~60 kata, **emoji kaya**)
  * 5–10 bullets informatif: SATU baris per keyword dengan format “• <emoji> <keyword>: <informasi singkat> — <traffic_K/M>”
  * Footer sumber + waktu
* Idempotent di hari yang sama.
* Ada baris log di Google Sheet.
* Jika AI gagal, kiriman tetap sukses dengan fallback.

---

## Contoh Payload Discord (Embed)

```json
{
  "embeds": [
    {
      "title": "🇮🇩 Google Trends Indonesia — 16 Okt 2025",
      "description": "Gelombang pencarian hari ini rame! Dari laga panas sampai gosip layar kaca, warganet lagi heboh ngulik detailnya 🎯🔥\n• 🔥 Keyword A: info singkat — 200K · +45% · sejak 02:00\n• 📈 Keyword B: info singkat — 120K · +20% · sejak 01:30\n• 🎬 Keyword C: info singkat — 90K · +12% · sejak 08:15\n• ⚽ Keyword D: info singkat — 80K · +8% · sejak 06:40\n• 💰 Keyword E: info singkat — 70K · +5% · sejak 07:05",
      "color": 3066993,
      "footer": { "text": "Source: Google Trends · ⏰ 06:00 WIB" }
    }
  ]
}
```

---

## Pseudocode Apps Script (ringkas)

```js
function main() {
  const props = PropertiesService.getScriptProperties();
  const cfg = loadConfig_(props);
  if (isAlreadyPostedToday_(todayKey_())) return logToSheet({status:'SKIPPED'});

  const t0 = Date.now();
  const trends = fetchDailyTrends_();
  const items = trends.items.slice(0, cfg.TOP_N);

  const keywordsLine = buildKeywordsSection_(items);
  const ai = cfg.OPENROUTER_API_KEY ? summarizeWithAI_(items, trends.date, cfg) : defaultLead_();

  const payload = composeDiscordPayload_(ai.lead, ai.bullets, keywordsLine, trends.date, cfg);
  if (!cfg.DRY_RUN) postToDiscord_(payload, cfg);

  markPostedToday_(todayKey_());
  logToSheet({status:'OK', count: items.length, elapsed_ms: Date.now()-t0});
}

function fetchDailyTrends_() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('SERPAPI_KEY');
  const geo = 'ID';
  const hours = props.getProperty('SERPAPI_TN_HOURS') || '';
  const onlyActive = props.getProperty('SERPAPI_TN_ONLY_ACTIVE') || '';
  const cats = (props.getProperty('SERPAPI_TN_CATEGORY_IDS') || '11,17,4')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const langs = ['id', 'en'];
  const base = 'https://serpapi.com/search.json';

  const makeUrl = (params) =>
    base + '?' + Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

  for (const hl of langs) {
    const baseParams = { engine: 'google_trends_trending_now', geo, hl, api_key: apiKey };
    if (hours) baseParams.hours = hours;
    if (String(onlyActive).toLowerCase() === 'true') baseParams.only_active = 'true';

    // Attempt without category_id (global feed for geo=ID)
    let json = fetchJson_(makeUrl(baseParams));
    let items = pickItemsFromTrendingNow_(json);
    if (items.length) return { date: todayIso_(), items };

    // Try with category_id list (e.g., 11,17,4)
    for (const cat of cats) {
      json = fetchJson_(makeUrl({ ...baseParams, category_id: cat }));
      items = pickItemsFromTrendingNow_(json);
      if (items.length) return { date: todayIso_(), items };
    }
  }

  return { date: todayIso_(), items: [] };
}

function fetchJson_(url) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const text = res.getContentText();
  try { return JSON.parse(text); } catch (e) { return {}; }
}

function pickItemsFromTrendingNow_(json) {
  const arr = (json && json.trending_searches) || [];
  return arr.map(x => ({
    query: x.query || x.title || (x.entity_names && x.entity_names[0]) || '',
    traffic: x.formatted_traffic || x.formattedTraffic || x.search_volume || x.search_interest || '',
    articles: ((x.news_results || x.articles || []).slice(0, 2)).map(a => (a.title || '').trim())
  })).filter(it => it.query);
}

function todayIso_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}
```

---

## Deliverables

* `Code.gs` (implementasi penuh sesuai PRD ini).
* README singkat: cara set properties, test, dan troubleshooting umum.