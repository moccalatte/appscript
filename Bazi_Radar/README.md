# 🐉✨ BaZi Radar — Apps Script + Discord Webhook

Selamat datang di proyek porting resmi dari repositori Go [`bazica`](bazica/README.md) ke Google Apps Script. Alur terbaru: hasilkan chart ➜ kirim ke AI (prompt singkat, hanya jam + tanggal lahir + empat pilar dengan hanzi GanZhi, tanpa Life Cycle) ➜ kirim embed Discord warna rapi full emoji. Dukung pilihan model AI: Gemini 2.5 Flash dan OpenRouter model `deepseek/deepseek-chat-v3-0324:free`. Bisa atur jadwal post harian.

Panduan ini dibuat ramah pemula — ikuti langkah demi langkah dan kamu sudah bisa menjalankan kalkulator nasib sendiri. 💪

---

## 🌟 Kenapa Projek Ini Keren?
- 🔁 Porting 1:1 logika `bazica` (4 Pilar, Life Cycle, Luck Pillars).
- 🤖 Overview harian dari AI dengan prompt minimalis (tanpa emoji).
- 🗂️ Semua data (solar term + lunar new year) sudah dipaketkan — tanpa API eksternal.
- 🎨 Output embed Discord rapi: tabel teks, emoji, warna mengikuti Day Master.
- 🛠️ Hanya pakai Google Apps Script, jadi tidak perlu server atau runtime tambahan.
- 📣 Support multi-locale (ID & EN) untuk tampilan tanggal.
- ⏰ Trigger harian terjadwal (jam menit bisa diatur lewat Script Properties).

---

## 🧱 Struktur Repo Singkat
- `Code.gs` → seluruh kode Apps Script utama (porting lengkap dari `bazica`).
- `helper.gs` → routing AI, posting Discord, scheduling harian.
- `prompt.gs` → builder prompt sistem dan user (tanpa emoji).
- `prd.md` → Product Requirement Document. Semua spesifikasi & checklist ada di sini.
- `bazica/` → salinan repo Go sumber (referensi modul logika & data).

---

## 🚀 Quick Start (Alur Baru)
1️⃣ **Buat Proyek Apps Script**
- Buka https://script.google.com → klik **New project**.
- Rename project, misal: `BaZi Radar`.

2️⃣ **Tempel Kode**
- Buat file `Code.gs` (hapus isi default).
- Salin seluruh isi `Code.gs` dari repo ini → tempel ke editor Apps Script.
- Buat file `helper.gs` dan `prompt.gs` → tempel isi dari repo ini.

3️⃣ **Isi Script Properties**
- Menu kiri: **Project Settings → Script properties → Add script property**.
- Tambahkan wajib:
  - `DISCORD_WEBHOOK_URL` → URL webhook Discord kamu.
  - `BIRTH_DATE` → format `"HH:mm, dd-MM-yyyy"` (contoh `"08:05, 30-11-2000"`).
  - `TIME_REGION` → IANA timezone (mis. `"Asia/Jakarta"`).
  - `GENDER` → `"0"` (female) atau `"1"` (male).
- Tambahkan opsional:
  - `NAME` → muncul di footer embed.
  - `LOCALE` → `"id-ID"` atau `"en-US"` (default: `"id-ID"`).
  - `AI_PROVIDER` → `"gemini"` (default) atau `"openrouter"`.
  - `GEMINI_API_KEY` → diperlukan jika `AI_PROVIDER="gemini"`.
  - `OPENROUTER_API_KEY` → diperlukan jika `AI_PROVIDER="openrouter"`.
  - `OPENROUTER_MODEL` → default `"deepseek/deepseek-chat-v3-0324:free"` (jangan typo).
  - `POST_SCHEDULE_HOUR` → default `"6"` (jam lokal project).
  - `POST_SCHEDULE_MINUTE` → default `"0"`.

4️⃣ **Uji Sekali Jalan**
- Di editor Apps Script, pilih fungsi `runDailyOverview`.
- Klik ▶️ Run → berikan izin jika diminta (Apps Script + Discord webhook).
- Cek channel Discord ➜ embed baru bertajuk **🐉 BaZi Daily** dengan field **Daily Overview** dari AI.

5️⃣ **Jadwal Otomatis**
- Jalankan fungsi `scheduleDailyOverview` → Apps Script bakal kirim chart harian sesuai `POST_SCHEDULE_HOUR` dan `POST_SCHEDULE_MINUTE` (timezone mengikuti pengaturan Project).
- Mau ganti jadwal? Cukup ubah Script Properties `POST_SCHEDULE_HOUR`/`POST_SCHEDULE_MINUTE`.

---

## 🧾 Detail Input & Validasi

| Properti | Contoh | Wajib? | Keterangan |
|----------|--------|--------|------------|
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` | ✅ | Tujuan embed |
| `BIRTH_DATE` | `"08:05, 30-11-2000"` | ✅ | Format ketat `"HH:mm, dd-MM-yyyy"` |
| `TIME_REGION` | `"Asia/Jakarta"` | ✅ | IANA timezone valid |
| `GENDER` | `"0"` atau `"1"` | ✅ | Dipakai menghitung Luck Pillars |
| `NAME` | `"Nara"` | ❌ | Personal footer |
| `LOCALE` | `"en-US"` | ❌ | Format tanggal di embed (default `"id-ID"`) |
| `AI_PROVIDER` | `"gemini"`/`"openrouter"` | ❌ | Default `"gemini"` |
| `GEMINI_API_KEY` | `ya29...` | ⚠️ | Wajib jika pakai `"gemini"` |
| `OPENROUTER_API_KEY` | `sk-or-...` | ⚠️ | Wajib jika pakai `"openrouter"` |
| `OPENROUTER_MODEL` | `deepseek/deepseek-chat-v3-0324:free` | ❌ | Default seperti tertera |
| `POST_SCHEDULE_HOUR` | `"6"` | ❌ | Jam trigger harian |
| `POST_SCHEDULE_MINUTE` | `"0"` | ❌ | Menit trigger harian |

Format salah akan memunculkan embed error ⚠️ di Discord + log di Apps Script.

---

## 🔍 Apa yang Dihitung?

- 🧭 **Empat Pilar** → Year, Month, Day, Hour lengkap dengan stem/branch/漢字/pinyin.
- ♻️ **Life Cycle** → tahap Chi untuk masing-masing pilar (Birth → Nourishing).
- 🪜 **Luck Pillars** → 0 + 11 siklus 10 tahunan (Dayun) berdasarkan gender & yin/yang.
- 🌠 **Symbolic Stars** → Peach Blossom, Travelling Horse, Nobleman.
- 🎨 **Embed** → warna auto mengikuti elemen Day Master (Wood/Fire/Earth/Metal/Water).
- 🤖 **Daily Overview (AI)** → ringkasan harian berbasis `today_date`, `gender`, `birth_time`, `birth_date`, dan empat pilar hanzi (tanpa Life Cycle; tanpa emoji).

Semua logika diambil langsung dari Go `bazica` (`internal/fourpillars`, `internal/luckpillars`, `internal/ultis`, dan dataset `data/*.json`). Paritas dijaga ketat sesuai `prd.md`.

---

## 🤖 Integrasi AI

- Provider:
  - Default: **Gemini 2.5 Flash** (set `AI_PROVIDER="gemini"` + isi `GEMINI_API_KEY`).
  - Alternatif: **OpenRouter** dengan model default **`deepseek/deepseek-chat-v3-0324:free`** (set `AI_PROVIDER="openrouter"` + isi `OPENROUTER_API_KEY`; opsi override via `OPENROUTER_MODEL`).
- Prompt:
  - System: "Kamu adalah BaZi master." (tanpa emoji).
  - User: memuat `today_date`, `gender`, `birth_time`, `birth_date`, dan empat pilar hanzi (tanpa Life Cycle).
- Output:
  - Teks ringkas, informatif, bahasa Indonesia natural, tanpa emoji.
  - Disisipkan ke embed Discord di field bernama "🧭 Daily Overview".

---

## 🧪 Checklist Pengujian Cepat

- ✅ Input valid menghasilkan embed deterministik.
- ✅ Ganti `TIME_REGION` (Jakarta, Tokyo, UTC) → hasil pilar tetap konsisten.
- ✅ Gender 0 ↔ 1 mengubah urutan Luck Pillars.
- ✅ Embed tampil cakep di Discord desktop & mobile (tabel tidak pecah).
- ✅ AI overview hadir tanpa emoji, relevan terhadap Day Master & pilar.
- ⚠️ Error property → embed `⚠️ BaZi Calculator Error` + pesan detail.

Untuk verifikasi ekstra, jalankan contoh tanggal yang sama di repo Go `bazica` dan bandingkan JSON outputnya.

---

## 🛠️ Troubleshooting

- ⚠️ **`TIME_REGION is invalid`** → cek ulang penulisan (harus ada `/` dan huruf kapital).
- ⚠️ **Embed tidak muncul** → lihat `Executions` di Apps Script & log response webhook.
- ⚠️ **Angka Luck Pillars “aneh”** → pastikan gender benar (`"0"` atau `"1"`).
- ⚠️ **漢字 Empat Pilar tertulis `(Four pillars unavailable)`** → pastikan `helper.gs` dan `Code.gs` versi terbaru dan kompatibel. Fungsi `runDailyOverview` kini memanggil `buildBaziChart(date, timeZone, gender, name)` dengan tanggal lahir yang diparse dari `BIRTH_DATE` memakai `parseBirthDate` (jika tersedia) atau fallback `Utilities.parseDate("HH:mm, dd-MM-yyyy")`. Periksa juga format `BIRTH_DATE`.
- ⚠️ **AI error** → untuk OpenRouter model gratis `deepseek/deepseek-chat-v3-0324:free` kadang terjadi rate limit `HTTP 429`. Opsi mitigasi:
  - Tambahkan `OPENROUTER_API_KEY` milikmu sendiri atau ganti `OPENROUTER_MODEL`.
  - Alihkan ke `AI_PROVIDER="gemini"` dan isi `GEMINI_API_KEY`.
  - Bila keduanya diisi, sistem otomatis fallback ke provider lain saat ada 429/5xx. Pesan di field "Daily Overview" otomatis dibersihkan (contoh: `AI OpenRouter lagi kelebihan beban...`), jadi tidak ada lagi JSON 429 yang bocor; detail teknis tetap bisa diintip lewat embed debug.
- ⚠️ **Schedule tidak jalan** → cek timezone Project dan nilai `POST_SCHEDULE_HOUR/MINUTE`.

---

## 🤝 Kontribusi

1. Baca `prd.md` → pahami scope & standar paritas.
2. Bikin branch baru → kerjakan fitur/bug fix.
3. Tambahkan catatan di README/PRD jika ada perubahan perilaku.
4. Pastikan output embed sesuai panduan emoji & format, dan prompt AI tetap tanpa emoji.

---

## ❓ FAQ Mini

**Q: Bisa masukin tanggal sebelum 1900 atau setelah 2100?**  
A: Belum. Dataset solar term & lunar new year hanya valid 1900–2100 (ikut `bazica`).

**Q: Kenapa timezone saya error?**  
A: Apps Script memakai IANA timezone. Pastikan penulisan tepat (contoh: `Asia/Jakarta`, bukan `WIB`).

**Q: Bisa kirim ke beberapa channel?**  
A: Paling mudah bikin beberapa Apps Script project dengan webhook berbeda.

**Q: Bagaimana kalau webhook Discord rate-limited?**  
A: Script akan lempar error. Cek log Apps Script dan coba ulang setelah jeda.

**Q: Bagaimana memilih model AI?**  
A: Pakai `AI_PROVIDER="gemini"` untuk Gemini 2.5 Flash, atau `AI_PROVIDER="openrouter"` untuk OpenRouter dengan default model `deepseek/deepseek-chat-v3-0324:free`.

---

## 🧭 Narasi (Casual • Humanized)

- Ringkas, fokus pada informasi pilar dan Life Cycle di embed, serta pengaruh harian dari AI overview.
- Tanpa ramalan fatalistik; gunakan bahasa positif.
- Tidak ada emoji dalam teks AI; emoji hanya untuk embed.

---

## 🧱 Referensi

- Port logika dari Go [`bazica`](bazica/README.md).
- Detail fitur dan pengujian: lihat `prd.md`.

---

## 🚀 Setup Ringkas
1. Buat project di https://script.google.com dan file `Code.gs`, `helper.gs`, `prompt.gs`.
2. Tempel kode kalkulator + dataset JSON inline pada `Code.gs`, lalu tempel isi `helper.gs` dan `prompt.gs`.
3. Isi Script Properties sesuai bagian "Input".
4. Jalankan `runDailyOverview`; cek Discord untuk embed berisi "Daily Overview".
5. Pasang trigger via `scheduleDailyOverview` dan atur waktu lewat Script Properties.

---

## 🛡️ Batas & Keamanan
- Jangan menaruh webhook atau API key di publik; simpan di Script Properties.
- Hormati rate limit Discord (payload tunggal).
- Batas tanggal aman: 1900–2100 (menurut dokumentasi bazica).

---

## 🌍 I18N
- `LOCALE` menentukan format tanggal teks (ID/EN).
- Emoji universal; sebutan elemen tersedia EN/ID (mis. "Metal ⚙️ / Logam").
- Dictionary label untuk ID & EN (mis. "Tahun" ↔ "Year").

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
- 2025-10-17: Update alur — tambah integrasi AI (Gemini/OpenRouter), prompt tanpa emoji, scheduling harian yang bisa diatur.
- 2025-10-17: Sinkronisasi PRD dengan bazica — tambah Life Cycle, Luck Pillars, dataset JSON.

---

## 🧪 Test Sekali Jalan (Double Post)

Fitur uji kirim sekali jalan yang mem-post ke Discord **dua kali**:
1) Post asli — embed harian lengkap dengan field "Daily Overview" dari AI.  
2) Post - debug — embed diagnostik berisi konfigurasi, prompt, dan ringkasan pilar untuk inspeksi.

Lokasi fungsi uji: [helper.gs](helper.gs)

Konten embed debug:
- Settings: `today_date`, `AI_PROVIDER`, `MODEL`, `TIME_REGION`, `LOCALE`, `BIRTH_DATE`, `GENDER`, `NAME`, `POST_SCHEDULE_HOUR`, `POST_SCHEDULE_MINUTE`
- System Prompt: teks sistem (tanpa emoji)
- User Prompt: teks user (menyertakan `today_date`, gender, jam & tanggal lahir, empat pilar hanzi)
- 汉字 Empat Pilar: ringkas Year/Month/Day/Hour (hanzi saja; tanpa Life Cycle)
- AI Error (opsional): menampilkan error bila panggilan AI gagal

Cara menjalankan:
- Di editor Apps Script pilih fungsi `runDoublePostTest` lalu tekan Run.
- Perhatikan bahwa fungsi ini melakukan **2 kali POST** ke webhook yang sama; pastikan rate limit Discord tidak terlampaui.

Catatan:
- Post debug ditujukan untuk verifikasi konfigurasi dan pembuatan prompt; teks AI tetap tanpa emoji.
- Post asli menggunakan alur sama seperti harian dan menyisipkan field "Daily Overview" ke embed.
