# 🐉✨ PRD — BaZi Calculator (Google Apps Script + Discord Webhook)

Dokumentasi produk versi reset total. Kalkulator BaZi berjalan murni di Google Apps Script, input via Script Properties, output embed Discord penuh emoji, warna-warni, dan bold rapi. Targetnya adalah port satu-ke-satu dari struktur logika dan data proyek Go [`bazica`](bazica/README.md) dengan adaptasi minimal (hanya penggantian runtime & output webhook).

---

## 🎯 Tujuan Utama
- 🧮 Menghasilkan 4 Pilar (Tahun • Bulan • Hari • Jam) lengkap dengan stem, branch, 汉字, pinyin, dan elemen utama dari input "HH:mm, dd-MM-yyyy".
- 🌱 Menurunkan 12 tahap Life Cycle (Chi flow) tiap pilar, mengikuti aturan `GetLifeCycleFromFourPillar`.
- 🪜 Menyusun Luck Pillars (Dayun) 0 + 10 tahunan sesuai algoritme bazica (gender, yin/yang, menit solar term).
- 🌐 Menghitung berbasis UTC (Etc/UTC) dengan penentuan Month Pillar oleh 24 solar terms dan penyesuaian Lunar New Year.
- 📨 Mengirim hasil sebagai Discord embed: warna mengikuti Day Master, tabel teks multiline, emoji, symbolic stars, dan daftar Luck Pillars.
- 🤖 Menghasilkan overview harian via AI (prompt singkat tanpa emoji) memakai hanya jam/tanggal lahir dan empat pilar hanzi (tanpa Life Cycle); dukung Gemini 2.5 Flash dan OpenRouter model `deepseek/deepseek-chat-v3-0324:free`.
- ⏰ Menjadwalkan posting harian pada jam/menit yang dapat diatur lewat Script Properties.
---

## 📂 Paritas Modul bazica (Go)
- `bazica/get_bazi_chart.go:8` → entry point: hitung 4 Pilar, Life Cycle, Luck Pillars. Di Apps Script menjadi fungsi `buildBaziChart`.
- `bazica/internal/fourpillars/` (`get_four_pillars.go`, `get_pillar_year.go`, `get_pillar_month.go`, `get_pillar_day.go`, `get_pillar_hour.go`) → logika konversi kalender & kalkulasi pilar.
- `bazica/internal/ultis/` → helper wajib: `GetSolarTerm`, `ConvertTermToBranch`, `CalculateHeavenlyStem/EarthlyBranch`, `GetStemRuleByFiveTigers`, `GetStemRuleByFiveRats`, `GetGanzhi`, `GetLifeCycleFromFourPillar`.
- `bazica/internal/luckpillars/get_luck_pillars.go:12` → algoritme Dayun (pilar 0 + 11 siklus, increment/decrement berdasar gender & yin/yang year stem).
- `bazica/model/*.go` → definisi struktur (`BaziChart`, `FourPillars`, `LuckPillars`), enumerasi stem/branch (nama, hanzi, pinyin, nilai), konstanta Life Cycle 12 tahap.
- `bazica/data/solar-term.json` & `bazica/data/lunar-new-year.json` → dataset wajib di-inline ke Apps Script (mis. `const SOLAR_TERM_DATA = JSON.parse('...')`).

---

## 🔑 Script Properties (Input)
- `DISCORD_WEBHOOK_URL` → URL webhook Discord (wajib).
- `BIRTH_DATE` → `"HH:mm, dd-MM-yyyy"` (wajib). Contoh: `"07:05, 03-03-2000"`.
- `TIME_REGION` → IANA TZ, contoh `"Asia/Jakarta"` (wajib). Dipakai untuk parsing awal sebelum rebase ke UTC.
- `GENDER` → `"0"` (female) atau `"1"` (male); wajib untuk penentuan Luck Pillars.
- `NAME` → nama singkat untuk footer/personal info (opsional, map ke `model.PersonalInfo`).
- `LOCALE` → `"id-ID"` atau `"en-US"` (opsional, default `"id-ID"`) untuk label tanggal di embed.
- `AI_PROVIDER` → `"gemini"` (default) atau `"openrouter"`.
- `GEMINI_API_KEY` → diperlukan jika `AI_PROVIDER="gemini"`.
- `OPENROUTER_API_KEY` → diperlukan jika `AI_PROVIDER="openrouter"`.
- `OPENROUTER_MODEL` → opsional, default `"deepseek/deepseek-chat-v3-0324:free"` (jangan typo).
- `POST_SCHEDULE_HOUR` → opsional, default `"6"` (mengikuti timezone Project).
- `POST_SCHEDULE_MINUTE` → opsional, default `"0"`.

Validasi:
- Jam dan menit harus 2 digit.
- Tanggal harus `dd-MM-yyyy`.
- `TIME_REGION` harus time zone valid (IANA).
- `GENDER` hanya menerima `0` atau `1`; error bila kosong.
- Bila `AI_PROVIDER="gemini"`, `GEMINI_API_KEY` wajib ada; bila `AI_PROVIDER="openrouter"`, `OPENROUTER_API_KEY` wajib ada.
- `OPENROUTER_MODEL` default ke `deepseek/deepseek-chat-v3-0324:free` bila tidak diisi.
- `POST_SCHEDULE_HOUR` dan `POST_SCHEDULE_MINUTE` harus angka (string berisi digit).
---

## 🧮 Paritas Logika Bazica
- **Year Pillar**: menyesuaikan pergantian Tahun Lunar memakai `lunar-new-year.json`, menambahkan 1 jam (Rat hour) sebelum evaluasi; port dari `bazica/internal/fourpillars/get_pillar_year.go:12`.
- **Month Pillar**: pakai 24 solar terms via `GetSolarTerm` (`bazica/internal/ultis/get_solar-term.go:32`); branch ditentukan `ConvertTermToBranch`, stem mengikuti aturan Five Tigers (`ultis.GetStemRuleByFiveTigers`).
- **Day Pillar**: 60-day cycle dari epoch 1900-01-01, geser +1 jam, sesuai `bazica/internal/fourpillars/get_pillar_day.go:8`.
- **Hour Pillar**: blok 2 jam + aturan Five Rats (`bazica/internal/fourpillars/get_pillar_hour.go:9`, `ultis.GetStemRuleByFiveRats`).
- **GanZhi & Elemen**: mapping `ultis.GetGanzhi` memberikan nama kombinasi, elemen utama, dan nilai elemen (1–5) untuk pewarnaan embed.
- **Enumerasi Stem/Branch**: nama Inggris, hanzi, pinyin, nilai numerik diambil apa adanya dari `bazica/model/model_pillar.go`.
- **Zona waktu**: seluruh kalkulasi terjadi di UTC; `TIME_REGION` hanya memengaruhi parsing input dan label tampilan.

---

## 🌱 Siklus Kehidupan (12 Tahap Chi)
- Terapkan `GetLifeCycleFromFourPillar` (`bazica/internal/ultis/get_life_cycle.go:4`) setelah Day Master diketahui.
- Mapping Life Cycle mengikuti konstanta `bazica/model/model_life-cycle.go`: Birth, Bath, Youth, Thriving, Prosperous, Weakening, Sick, Death, Grave, Extinction, Conceived, Nourishing.
- Cantumkan label Life Cycle pada tabel pilar (kolom keempat) serta highlight status Day Master.

---

## 🪜 Luck Pillars (Dayun 10 Tahunan)
- Port langsung `GetLuckPillars` (`bazica/internal/luckpillars/get_luck_pillars.go:12`).
- Pilar 0 menggunakan Month Pillar dengan tanggal lahir sebagai `Time` dan tahun lahir sebagai `YearStart`.
- `passed` & `remaining` menit datang dari `GetSolarTerm`; aturan increment/decrement: `(YearStem.Value + gender) % 2 == 0` → increment (Yang male / Yin female), else decrement.
- Hitung pilar 1 sebagai offset berdasarkan age menit (`age = remaining` atau `passed`), konversi menit ke tahun/bulan/hari seperti di bazica; pilar selanjutnya tinggal `AddDate(10,0,0)`.
- Stem & branch new cycle dihitung sirkular (wrap ke 1–10 / 1–12) sebelum di-konversi dengan `CalculateHeavenlyStem/EarthlyBranch`.
- Simpan `YearStart`, `YearEnd` (rentang 10 tahun), `Time`, serta `GanZhi` + elemen untuk tiap pilar; tampilkan di embed sebagai daftar bernomor.

---

## 📚 Data Bawaan & Konversi
- `data/solar-term.json`: map tahun → 24 timestamp (format `2006-01-02 15:04:05.999999999-07:00`). Inline sebagai string besar dan parse sekali di global scope; gunakan cache (mis. `let solarTermsCache = null`).
- `data/lunar-new-year.json`: map tahun → tanggal `MM-DD`; inline & parse sama seperti di atas.
- Pertahankan presisi offset; gunakan `Utilities.parseDate` / `new Date()` dengan zona UTC untuk membaca timestamp.
- Bila data tidak ditemukan, log error dan kembalikan embed error (mirror perilaku `slog` di bazica).

---

## 🎨 Desain Embed Discord (Full Emoji • Bold • Tabel Teks)
Struktur payload:
- `title`: `"🐉 BaZi Natal Chart"`
- `color`: ditentukan oleh elemen Day Master:
  - Wood 🌿 → `0x2ecc71`
  - Fire 🔥 → `0xe67e22`
  - Earth 🌍 → `0xf1c40f`
  - Metal ⚙️ → `0xbdc3c7`
  - Water 💧 → `0x3498db`
- `description`: blok teks multiline (lihat contoh).
- `fields`: harus menyertakan field `🧭 Daily Overview` berisi teks dari AI (tanpa emoji). Field lain opsional untuk ringkas Day Master, TZ, atau catatan debugging.
- `footer`: `"BaZi Calculator — UTC•lon0"` + `NAME` (jika ada).
- `timestamp`: ISO `new Date().toISOString()`.
Contoh deskripsi:
```
📅 Tanggal (UTC): <DD MMM YYYY> — <HH:MM>
🌍 Lokasi TZ: Asia/Bangkok (UTC+07:00)
🌟 Day Master: 【庚】 Geng (Metal) ⚙️ — Life Cycle: Thriving

漢字 Empat Pilar: 【庚辰】｜【戊寅】｜【庚辰】｜【庚辰】

🧭 Empat Pilar
┌────────┬───────────────┬───────────────┬───────────────┐
│ Pilar  │ Stem (天干)    │ Branch (地支)  │ Life Cycle     │
├────────┼───────────────┼───────────────┼───────────────┤
│ Tahun  │ 庚 — Geng ⚙️   │ 辰 — Chen 🐉    │ Prosperous     │
│ Bulan  │ 戊 — Wu 🌍      │ 寅 — Yin 🐅     │ Thriving       │
│ Hari   │ 庚 — Geng ⚙️   │ 辰 — Shen 🐒    │ Day Master ⭐   │
│ Jam    │ 庚 — Geng ⚙️   │ 辰 — Chen 🐉    │ Weakening      │
└────────┴───────────────┴───────────────┴───────────────┘

🌠 Symbolic Stars
• Peach Blossom: 酉 | Travelling Horse: 寅 | Nobleman: 子, 申

🪜 Luck Pillars (10 tahun)
0) YYYY–YYYY 【戊寅】 Wu Yin 🌍
1) YYYY–YYYY 【己卯】 Ji Mao 🌍
2) YYYY–YYYY 【庚辰】 Geng Chen ⚙️
...
```

Field tambahan (opsional, inline):
- `Day Master` → nama + emoji.
- `Element Strength` → nilai elemen (1–5) dari `GanZhi`.
- `Timezone` → `TIME_REGION`.

---

## 🛠️ Alur Eksekusi (Apps Script)
1. Load Script Properties, lakukan validasi (throw Error + embed ⚠️ jika gagal).
2. Parse `BIRTH_DATE` ke Date pada `TIME_REGION`, lalu konversi ke UTC (`Utilities.formatDate`).
3. Lazy-load `solar-term.json` & `lunar-new-year.json` ke cache global.
4. Hitung 4 Pilar menggunakan port fungsi bazica → isi stem/branch/hanzi/pinyin.
5. Jalankan `GetLifeCycleFromFourPillar` untuk mengisi `LifeCycle`.
6. Hitung Luck Pillars (0–11) memakai gender + hasil `passed/remaining`.
7. Bangun prompt AI (tanpa emoji) memakai hanya `today_date`, `gender`, `birth_time`, `birth_date`, dan empat pilar hanzi (tanpa Life Cycle); panggil provider sesuai `AI_PROVIDER` (Gemini 2.5 Flash / OpenRouter `deepseek/deepseek-chat-v3-0324:free`) untuk mendapatkan teks overview harian.
8. Tentukan Day Master, elemen, warna embed; hitung symbolic stars & mapping emoji.
9. Sisipkan teks overview AI ke embed sebagai field `🧭 Daily Overview`.
10. POST ke `DISCORD_WEBHOOK_URL` via `UrlFetchApp.fetch` dan catat response (log detail; retry manual bila perlu).
---

## ✅ Pengujian
- Format input valid/invalid (jam, tanggal, gender, TZ).
- Snapshot parity 4 Pilar vs output Go (`bazica`) untuk beberapa kasus (1900, 1975, 2024).
- Verifikasi Life Cycle tiap pilar sesuai hasil Go.
- Verifikasi Luck Pillars: urutan, rentang tahun, perubahan gender (0 ↔ 1).
- Uji berbagai `TIME_REGION` (Asia/Jakarta, Asia/Tokyo, Etc/UTC) memastikan konversi sesuai.
- Uji embed di Discord mobile & desktop (kolom tabel tidak pecah).
- Uji AI overview:
  - Provider `"gemini"` dan `"openrouter"` berfungsi (API key valid).
  - Model default OpenRouter `deepseek/deepseek-chat-v3-0324:free` digunakan bila `OPENROUTER_MODEL` kosong.
  - Teks AI tanpa emoji; relevansi terhadap Day Master & pilar.
  - Provider error (429, 5xx, API key hilang) memunculkan pesan fallback ramah di field "🧭 Daily Overview" — tidak boleh ada JSON mentah, string `OpenRouter HTTP ...`, atau log internal lain.
- Error handling: dataset hilang, webhook gagal, properti kosong, atau AI gagal → embed ⚠️ dengan instruksi; log HTTP provider AI.
---

## 🧭 Narasi (Casual • Humanized)
- Ringkas, fokus pada informasi pilar dan Life Cycle, tanpa ramalan fatalistik.
- Emoji sebagai aksen makna (mis. ⚙️ untuk Metal, 🌿 untuk Wood).
- Contoh: "Day Master Metal lagi Thriving — waktunya struktur & disiplin."

---

## 🧰 Error Handling
- Validasi properti sebelum kalkulasi; lempar error + embed ⚠️.
- Gagal load JSON data → log dan balas embed error ("Data solar term tidak ditemukan").
- Webhook error (status ≥ 400) → tulis ke Logger dengan payload ringkas.
- Kalkulasi gagal (mis. tanggal di luar 1900–2100) → embed error singkat.
- Sanitasi teks AI sebelum diposting: hapus pembungkus `_..._` yang berasal dari Discord Markdown dan ganti pesan teknis (`OpenRouter HTTP 429`, `Gemini HTTP 5xx`, `API_KEY is missing`, dst.) dengan kalimat bantuan berbahasa Indonesia.

---

## 🧩 Integrasi & Referensi
- Port logika dari:
  - `bazica/internal/fourpillars/get_four_pillars.go:12`
  - `bazica/internal/fourpillars/get_pillar_year.go:12`
  - `bazica/internal/fourpillars/get_pillar_month.go:8`
  - `bazica/internal/fourpillars/get_pillar_day.go:8`
  - `bazica/internal/fourpillars/get_pillar_hour.go:10`
  - `bazica/internal/luckpillars/get_luck_pillars.go:12`
  - `bazica/internal/ultis/get_solar-term.go:32`
  - `bazica/internal/ultis/get_life_cycle.go:4`
  - `bazica/internal/ultis/ultis.go:5`
  - `bazica/internal/ultis/get_ganzhi.go:5`
- Data acuan: `bazica/data/solar-term.json`, `bazica/data/lunar-new-year.json`.

---

## 🧱 Non-goals
- Tidak mengirim gambar chart (teks saja).
- Tidak melakukan interpretasi mendalam/ramalan 10 Gods (cukup highlight Day Master + symbolic stars).
- Tidak menambahkan database eksternal.
- Tidak mengirim Life Cycle ke AI (hanya empat pilar hanzi + jam/tanggal lahir).
- Teks AI overview wajib tanpa emoji (emoji hanya digunakan di embed).
---

## 📘 README Deliverable
- Siapkan README baru yang super ramah pemula: jelaskan setup Apps Script, cara input Script Properties, cara menjalankan, dan trik debugging dasar.
- Gunakan gaya penuh emoji dan langkah bertahap (`Langkah 1️⃣`, dst.) agar mudah diikuti pengguna non-teknis.
- Sertakan bagian FAQ singkat (format Q&A) dan troubleshooting umum webhook.
- Tautkan kembali ke PRD ini serta sebutkan bahwa logika mem-port proyek [`bazica`](bazica/README.md).

---

## 🚀 Setup Ringkas
1. Buat project di https://script.google.com dan file `Code.gs`, `helper.gs`, dan `prompt.gs`.
2. Tempel kode kalkulator + dataset JSON inline pada `Code.gs`; tempel isi `helper.gs` (routing AI, Discord, scheduler) dan `prompt.gs` (builder prompt).
3. Isi Script Properties sesuai bagian "Input" termasuk `AI_PROVIDER` dan API key yang relevan.
4. Jalankan manual fungsi `runDailyOverview`; cek Discord untuk embed berisi field `🧭 Daily Overview`.
5. Pasang trigger harian via `scheduleDailyOverview`; atur waktu dengan `POST_SCHEDULE_HOUR` dan `POST_SCHEDULE_MINUTE` (timezone mengikuti Project).
---

## 🛡️ Batas & Keamanan
- Jangan menaruh webhook di publik; simpan di Script Properties.
- Hormati rate limit Discord (payload tunggal).
- Batas tanggal aman: 1900–2100 (menurut dokumentasi bazica).

---

## 🌍 I18N
- `LOCALE` menentukan format tanggal teks (ID/EN).
- Emoji universal; sebutan elemen tersedia EN/ID (mis. "Metal ⚙️ / Logam").
- Siapkan dictionary label untuk ID & EN (mis. "Tahun" ↔ "Year").

---

## 🗺️ Roadmap
- Tambah Hidden Heavenly Stems & 10 Gods mapping.
- Mode debug (log JSON penuh) untuk cross-check dengan bazica.
- Dukungan koordinat geografis (longitude/latitude) untuk koreksi timezone masa lalu.

---

## 📜 Lisensi
- Pemakaian internal; sesuaikan kebutuhan.

---

## 🧾 Changelog
- 2025-10-18: Sinkronisasi PRD dengan bazica — tambah Life Cycle, Luck Pillars, dataset JSON.
- 2025-10-17: Integrasi AI overview harian (Gemini 2.5 Flash / OpenRouter `deepseek/deepseek-chat-v3-0324:free`), prompt tanpa emoji, opsi jadwal posting harian.
- 2025-10-17: Reset PRD, desain emoji penuh, tabel teks, warna mengikuti Day Master.

---

## 🧪 Test Sekali Jalan (Double Post)

Tujuan: memvalidasi alur end-to-end dengan dua kiriman embed ke Discord dalam satu eksekusi:
1) Post asli — embed harian lengkap dengan field "🧭 Daily Overview" dari AI.  
2) Post - debug — embed diagnostik berisi konfigurasi, prompt, dan ringkasan pilar (hanzi saja).

Konten embed debug:
- Settings: `today_date`, `AI_PROVIDER`, `MODEL`, `TIME_REGION`, `LOCALE`, `BIRTH_DATE`, `GENDER`, `NAME`, `POST_SCHEDULE_HOUR`, `POST_SCHEDULE_MINUTE`
- System Prompt: teks sistem (tanpa emoji)
- User Prompt: teks user (memuat `today_date`, gender, jam & tanggal lahir, empat pilar hanzi; tanpa Life Cycle)
- 漢字 Empat Pilar: ringkas Year/Month/Day/Hour (hanzi saja; tanpa Life Cycle)
- AI Error (opsional): ditampilkan jika panggilan AI gagal

Cara menjalankan:
- Di editor Apps Script, jalankan fungsi uji dari file `helper.gs` melalui tombol Run.
- Perhatikan bahwa fungsi ini melakukan **2 kali POST** ke webhook yang sama; pastikan rate limit Discord tidak terlampaui.

Catatan:
- Post debug ditujukan untuk verifikasi konfigurasi dan pembuatan prompt; teks AI wajib tanpa emoji.
- Post asli menggunakan alur sama seperti harian dan menyisipkan field "🧭 Daily Overview" ke embed.
