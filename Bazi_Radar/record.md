# Rekaman Desain: Post Discord, Mode Uji, dan Tone Narasi (Casual Humanized)

Tujuan dokumen:
- Merekam desain pengiriman ke Discord (embed), struktur Mode Uji (Overview + Debug + Prompt), serta pedoman gaya bahasa (casual, humanized).
- Agar dapat diporting ke proyek lain meski kode diriset ulang.

## Filosofi Pesan & Tone

- Gaya percakapan, manusiawi, ringkas, mudah dicerna.
- Fokus pada relasi energi (Five Elements + 10 Gods) ketimbang ramalan peristiwa.
- Hindari jargon berlebihan; tetap sebut 10 Gods seperlunya: Friend, Output, Wealth, Resource, Power.
- Gunakan emoji seperlunya; jangan mengganggu keterbacaan.
- Struktur keluaran tetap konsisten (pembuka, interaksi elemen, kemungkinan, nasihat).

## Struktur Embed Discord

1) Overview (utama)
- Judul: “BaZi Daily Overview” (atau “[TEST] BaZi Daily Overview” pada mode uji).
- Deskripsi: header tanggal, baris energi hari (bold), lalu analisis narasi.
- Warna embed mengikuti elemen dari stem hari menggunakan pemetaan warna deterministik.
- Rujukan implementasi:
  - Pemetaan warna: [`function getStemElementAndColor_()`](Code.gs:315)
  - Bangun embed: [`function buildDiscordEmbeds_(todayLabel, ganzhi, analysis, prefer, isTest)`](Code.gs:336)
  - Bangun prompt: [`function buildPrompt_(context, todayLabel, ganzhi)`](Code.gs:196)

2) Debug (transparansi proses)
- Judul: “[TEST] BaZi Overview — Debug”.
- Fields:
  - Timezone kalkulasi/label,
  - Boundary Hour,
  - OffsetDays/BaseDate (bila konsep kalibrasi dipakai; untuk default baku tuliskan CST + boundary 23:00 + epoch 1900-01-01 + offset +31),
  - Tanggal lokal & indikator “Rolled Next Day?”,
  - DeltaDays, Order, dan Alias.
- Rujukan implementasi: [`function buildDiscordTestDebugEmbeds_(todayLabel, dateObj, prefer, contextId, ganzhiAlias, fullPromptSent)`](Code.gs:359)

3) Prompt (inspeksi isi)
- Judul: “[TEST] BaZi Overview — Prompt”.
- Deskripsi: potongan prompt dibagi menjadi beberapa bagian agar tidak menabrak batas panjang embed.
- Rujukan implementasi: [`function buildDiscordPromptEmbeds_(todayLabel, prefer, fullPromptSent)`](Code.gs:477)

## Alur Kerja Harian

- Muat Context:
  - Sumber: registry static di context.gs.
  - Pemilih chart: Script Property “CURRENT_CHART” atau fallback ke konstanta `BAZI_CONTEXT_ID`.
  - Rujukan: [`function getStaticContext_()`](Code.gs:196)

- Hitung Energi Hari (GanZhi alias):
  - Kalkulasi deterministik (CST, boundary 23:00, epoch 1900-01-01, offset +31).
  - Rujukan: [`function getDayGanzhiAliasAccurate(dateOpt)`](ganzhi.gs:86)

- Bangun Prompt:
  - Struktur narasi disisipkan bersama hasil energi hari dan konteks chart.
  - Rujukan: [`function buildPrompt_(context, todayLabel, ganzhi)`](Code.gs:196)

- Panggil Model Gemini:
  - Endpoint 2.5 Flash.
  - Rujukan: [`const MODEL_URL`](Code.gs:15), [`function callGemini_(prompt, prefer, apiKey)`](Code.gs:214)

- Kirim ke Discord:
  - Single atau multi-webhook dengan payload embed.
  - Rujukan: [`function sendToDiscordMultiple_(urls, payload)`](Code.gs:276)

- Mode Uji (Once):
  - Kirim Overview + Debug + Prompt.
  - Rujukan: [`function generateDailyOverviewOnce(yyyy_mm_dd)`](Code.gs:597)

- Trigger Harian & Setup:
  - Membuat trigger harian tanpa menulis preferensi ke properti.
  - Rujukan: [`function setup()`](Code.gs:572), [`function createOrUpdateTrigger_()`](Code.gs:582)

## Pedoman Penulisan Narasi (Casual Humanized)

- Pembuka (1–2 kalimat):
  - Ringkas; sapa ringan; set ekspektasi tone hari.
  - Contoh: “Energi hari ini stabil dan membumi—pas untuk menyusun rencana realistis.”

- Interaksi Elemen (tegas namun ringan):
  - Hubungkan Five Elements dengan Day Master.
  - Hindari klaim fatalistik; jelaskan arah energi dan dampak psikologis/operasional.
  - Contoh: “Earth memantapkan Metal Day Master; bagus untuk disiplin, konsistensi, struktur.”

- Kemungkinan (3–5 butir; probabilistik, realistis):
  - Rumuskan sebagai kecenderungan perilaku/tema.
  - Hindari spesifikasi peristiwa mutlak; gunakan bahasa soft.
  - Contoh:
    - “Menyelesaikan pekerjaan yang butuh ketekunan.”
    - “Merapikan sistem personal (habit, finance, workflow).”
    - “Mengambil keputusan pragmatis alih-alih impulsif.”

- Nasihat:
  - Sederhana, praktikal, langsung pakai.
  - Contoh: “Jaga ritme, pilih langkah kecil yang konsisten, dan tetap objektif.”

## Desain Teknis untuk Keterbacaan

- Emoji: opsional; tidak berlebihan.
- Chunking Prompt: pembagian prompt dalam embed Prompt untuk menghindari batas panjang (Discord).
- Warna embed: tetap (color palette per elemen).
- Locale label tanggal: bisa mengikut UI (misal id-ID) tanpa memengaruhi kalkulasi energi hari.

## Kualitas & Validasi

- Debug embed wajib di Mode Uji:
  - Menyertakan komponen: timezone/epoch/boundary/offset/deltaDays/order/alias.
  - Memudahkan audit bila terjadi mismatch.

- Uji sekuens:
  - Jalankan fungsi uji sekuens untuk memastikan urutan 60 hari stabil dan selaras sumber tepercaya.
  - Rujukan: [`function testGanzhiSequence(start_yyyy_mm_dd, days)`](Code.gs:635)

## Ringkasan Prinsip

- Konsistensi narasi > ramalan peristiwa.
- Transparansi kalkulasi (Debug).
- Embed bersih, informatif, mudah dipindahkan ke proyek lain.
- Model: Gemini 2.5 Flash; prompt sistem terstruktur; tone diarahkan.

## Artefak Rujukan

- Kode inti: [`Code.gs`](Code.gs), [`ganzhi.gs`](ganzhi.gs), [`context.gs`](context.gs)
- Fungsi penting:
  - [`function buildPrompt_(...)`](Code.gs:196)
  - [`function callGemini_(...)`](Code.gs:214)
  - [`function buildDiscordEmbeds_(...)`](Code.gs:336)
  - [`function buildDiscordTestDebugEmbeds_(...)`](Code.gs:359)
  - [`function buildDiscordPromptEmbeds_(...)`](Code.gs:477)
  - [`function generateDailyOverviewOnce(...)`](Code.gs:597)
  - [`function setup()`](Code.gs:572)

Catatan: dokumen ini bersifat blueprint; implementasi dapat diadaptasi sesuai kebutuhan proyek baru sambil mempertahankan pengalaman pengguna (tone) dan transparansi teknis (Debug/Prompt) yang sudah teruji.