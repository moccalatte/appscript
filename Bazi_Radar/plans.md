## KEKURANGAN DARI PROYEK

- Monolit raksasa: satu file [Code.gs](Code.gs) berisi ribuan baris (≥7k) sehingga sulit dirawat, ditinjau, dan diuji. Terlihat dari banyaknya fungsi seperti [generateChartOnce()](Code.gs:6288), [scheduleDailyChart()](Code.gs:6312), [buildBaziChart()](Code.gs:6316), [calculateFourPillars()](Code.gs:6329) berkumpul tanpa modularisasi.
- Dataset inline besar untuk solar terms & lunar new year (cache seperti [getSolarTermDataset()](Code.gs:6444) dan [getLunarNewYearData()](Code.gs:6397)). Membebani ukuran proyek, memperlambat cold start, dan berisiko melampaui batas Apps Script.
- Validasi input terbatas: hanya pola string & percobaan TZ ([validateDateString()](Code.gs:7102), [validateTimeZone()](Code.gs:7107)), belum ada feedback terstruktur (contoh field bantuan) atau pelacakan kesalahan yang kaya.
- Penjadwalan kaku: [scheduleDailyChart()](Code.gs:6312) mengunci jam 06:00 UTC dan tidak parametrik dari Script Properties (kurang fleksibel untuk pengguna).
- Tidak ada mekanisme retry/backoff untuk Discord webhook: [postToDiscord()](Code.gs:7133) langsung fetch; bila rate limit atau error 5xx tidak ada retry, tidak ada exponential backoff, tidak ada dedup.
- Format tabel embed rentan pecah di mobile: fungsi padding seperti [formatPillarTable()](Code.gs:6973), [pad()](Code.gs:7017) bergantung pada monospasi; Discord sering memerlukan pembungkus code block agar stabil.
- I18N parsial: ada [formatDateByLocale()](Code.gs:6906) dan [translateMonth()](Code.gs:6914) namun label lainnya (mis. "Tahun/Bulan/Hari/Jam" di [formatPillarRow()](Code.gs:6996)) tampak hard-coded, belum ada kamus lengkap untuk ID/EN.
- Caching naif: cache seperti [getMilestone()](Code.gs:6384) dan [getSolarTermDataset()](Code.gs:6444) tidak punya TTL/invalidasi; siklus hidup memori Apps Script tidak panjang dan bisa menyebabkan re-parse berulang.
- Kurang pengujian otomatis: tidak ada harness Apps Script untuk snapshot parity terhadap repo Go `bazica`. Pengujian manual rawan regresi terutama di [getYearPillar()](Code.gs:6346), [getMonthPillar()](Code.gs:6404), [getDayPillar()](Code.gs:6639), [getHourPillar()](Code.gs:6660).
- Error embed minimal: [buildErrorEmbed()](Code.gs:7147) belum menyertakan field detail (contoh properti invalid, contoh perbaikan cepat).
- Kompleksitas Luck Pillars: implementasi [calculateLuckPillars()](Code.gs:6773) bergantung pada menit `passed/remaining` dari solar term — rawan off-by-one bila konversi waktu/zonanya tidak diisolasi dengan baik.

---

## RENCANA PERBAIKAN PENUH SEKALI JALAN

1) Modularisasi ringan (tetap Apps Script, multi-file .gs)
- Pisahkan domain menjadi berkas terpisah di editor GAS: `config.gs` (konfigurasi, [loadConfig()](Code.gs:7070), [validateDateString()](Code.gs:7102), [validateTimeZone()](Code.gs:7107)), `fourpillars.gs` ([calculateFourPillars()](Code.gs:6329), [getYearPillar()](Code.gs:6346), [getMonthPillar()](Code.gs:6404), [getDayPillar()](Code.gs:6639), [getHourPillar()](Code.gs:6660)), `luckpillars.gs` ([calculateLuckPillars()](Code.gs:6773), [addDate()](Code.gs:6832)), `embed.gs` ([buildDiscordEmbed()](Code.gs:6840), [formatPillarTable()](Code.gs:6973), [formatLuckPillarsList()](Code.gs:7059)), `data.gs` ([getSolarTermDataset()](Code.gs:6444), [getLunarNewYearData()](Code.gs:6397)).
- Tujuan: menurunkan coupling, memudahkan audit parity dengan `bazica`.

2) Perkuat validasi + error UX
- Tambah pemeriksaan rinci yang mengembalikan embed error informatif: properti yang gagal, contoh nilai benar, dan tautan ke [README.md](README.md).
- Perluas [buildErrorEmbed()](Code.gs:7147) agar menyertakan `fields` seperti "Property", "Contoh Benar", "Langkah Perbaikan".

3) Penjadwalan fleksibel dari Script Properties
- Baca `SCHEDULE_HOUR` dan `SCHEDULE_MINUTE` dari [loadConfig()](Code.gs:7070); ubah [scheduleDailyChart()](Code.gs:6312) untuk memakai nilai tersebut. Jika kosong, fallback 06:00 UTC.

4) Hardening webhook: retry + backoff
- Bungkus [postToDiscord()](Code.gs:7133) dengan retry bertingkat: 3 percobaan, exponential backoff (misal 1s, 3s, 9s), hanya retry pada 429/5xx. Log ringkas pada kegagalan final.

5) Stabilkan tabel di Discord
- Pastikan output tabel dibungkus code block (```), lalu sesuaikan padding di [formatPillarTable()](Code.gs:6973) agar tetap rapi di mobile/desktop. Uji lebar kolom pada contoh multi-bahasa.

6) I18N label komprehensif
- Tambah kamus label (ID/EN) untuk "Tahun/Bulan/Hari/Jam", elemen, Life Cycle. Integrasikan ke [formatPillarRow()](Code.gs:6996) dan [formatDateByLocale()](Code.gs:6906).

7) Optimasi data & cache
- Parse dataset sekali, simpan ke variabel global dengan guard (sudah ada pola di [getSolarTermDataset()](Code.gs:6444)); tambah validasi rentang tahun dan error jelas bila tahun di luar cakupan.

8) Parity testing terhadap `bazica`
- Siapkan serangkaian input snapshot (1900, 1975, 2024), bandingkan hasil 4 Pilar/Life Cycle/Luck Pillars dengan referensi Go. Dokumentasikan di [prd.md](prd.md).

9) Dokumentasi langkah pemakaian/diagnostik
- Perbarui [README.md](README.md) dengan bagian "Troubleshooting cepat" untuk properti & webhook, dan "FAQ" konkrit hasil dari kesalahan umum.

Acceptance Criteria
- Input valid menghasilkan embed deterministik dan sesuai warna Day Master.
- Perubahan jam/minute/timezone tidak memecahkan parity 4 Pilar dibanding `bazica`.
- Trigger jam kustom bekerja; tidak ada error rate limit tanpa retry di log.
- Tabel tetap rapi pada Discord mobile & desktop (ID dan EN).

---

## FITUR MENDATANG (ADVANCED)

- Hidden Heavenly Stems & 10 Gods: perluasan model dan format tampilan di embed, selaras Roadmap [prd.md](prd.md).
- Mode debug: output JSON mentah dari kalkulasi ([buildBaziChart()](Code.gs:6316), [calculateFourPillars()](Code.gs:6329), [calculateLuckPillars()](Code.gs:6773)) ke log untuk audit parity lanjutan.
- Koreksi timezone historis berbasis koordinat geo (opsional): menambah akurasi kasus lama; tetap tanpa API eksternal jika memungkinkan (data lokal).
- Ekspor hasil sebagai lampiran teks/JSON (pastebin-like) untuk inspeksi manual panjang.
- Multi-locale tambahan (JP/ZH) untuk label dan bulan; memperluas [translateMonth()](Code.gs:6914) dan kamus label.
- Template multi-channel (opsional): kirim embed ke beberapa webhook dengan batching aman rate limit.
- Preview web lokal: bangun tampilan pratinjau menggunakan [versi web/index.html](versi web/index.html) agar pengguna melihat embed sebelum kirim.