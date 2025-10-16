# PRD — Radar **Event & Lonjakan Keramaian** (GMaps-only)

**Target:** DKI Jakarta (fokus) + Kota Bekasi
**Kategori:** cafe, restaurant, shopping_mall, night_club
**Output:** daily/hourly Discord embed (kotak hijau/ungu) + Google Sheets log + snapshot untuk deteksi lonjakan
**File akhir:** `Code.gs` (Google Apps Script) — semuanya terpusat dalam 1 file sesuai permintaan

---

## Ringkasan singkat

Buat bot yang jalan dari **Google Apps Script** (tidak butuh server), yang pada interval tertentu memeriksa Places di titik-titik (grid) di Jabodetabek, menghitung `active places` / metrik sederhana, membandingkan dengan snapshot sebelumnya, dan **mengirim embed** rapi ke Discord jika ada **lonjakan signifikan**. Hanya menggunakan **Google Maps Places API** (Nearby Search + Place Details). Tidak ada dependency eksternal lain.

> Catatan penting: **Google Places API tidak menyediakan data "popular times" (histogram waktu ramai) lewat API resmi.** Kita akan gunakan sinyal-sinyal proxy: `user_ratings_total` (untuk aktivitas review), `opening_hours.open_now`, dan jumlah hasil / foto sebagai indikator lonjakan. Script juga menyimpan snapshot historis untuk perbandingan.

---

## Goals

* Kirim notifikasi **otomatis** ke Discord saat ada **lonjakan aktivitas** (surge) per kategori & lokasi.
* Format pesan: **embed kotak (hijau untuk cafe/restaurant/mall, ungu untuk night club)**, rapi, penuh emoji, bold, dan ringkas.
* Simpan log eksekusi (error/success) + snapshot jumlah tempat ke Google Sheets.
* Mudah dipasang oleh non-dev (README langkah demi langkah ada di PRD ini).

---

## Scope & Batasan

* **Data sumber:** Google Maps Places API only.
* **Tidak ada** scraping, tidak ada sumber event eksternal.
* **Tidak realtime**, hanya polling interval terjadwal (Apps Script trigger).
* **Popular Times** tidak tersedia — gunakan heuristik (open_now, rating change, foto count, review count).
* Kuota API: per panggilan Places Nearby/Details dikenakan quota/biaya sesuai Google Cloud — atur frekuensi agar aman.

---

## Metrik & Threshold (default — bisa ubah di config)

* `SURGE_THRESHOLD = 0.30` → surge jika count sekarang > rata-rata N snapshot terakhir × (1 + 0.30).
* `AVG_WINDOW = 3` → menggunakan 3 snapshot terakhir untuk rata-rata.
* Nightclub window: **21:00 — 02:00 WIB** (cek khusus setiap jam di jam ini).
* Waktu pengecekan rekomendasi:

  * Cafe / Restaurant / Mall: 10:00 (pagi), 13:00 (siang), 17:00 (sore), 20:00 (early night)
  * Night club: setiap jam mulai 21:00 — 02:00 (disarankan trigger hourly malam)

---

## Titik (grid) — default (bisa diubah)

Script sudah berisi titik pusat untuk:

* Jakarta Pusat, Selatan, Barat, Timur, Utara
* Bekasi (kota)
  (Format: nama, lat,lng). Kamu bisa menambah/ubah sesuai kebutuhan.

---

## Format pesan Discord (embed)

* **Per item** (area + kategori) yang kena trigger surge, kirim satu embed. Jika banyak, gabungkan sampai 3 embed per post.
* **Warna:**

  * Cafe/Restaurant/Mall → **Hijau** `hex 0x2ECC71` → decimal `3066993`
  * Night Club → **Ungu** `hex 0x8E44AD` → decimal `9323693`
* Payload webhook berisi: `username` (dari config `AVATAR_USERNAME`) dan `avatar_url` (dari config `AVATAR_URL`) — kamu isi nanti.

**Contoh embed (tampil rapi):**

* Title: `📈 LONJAKAN: Bekasi Timur — Kuliner (Sore)` **(bold)**
* Description: `🔥 Ada lonjakan +42% dibanding rata-rata 3 cek terakhir.\n⏱ Waktu cek: *2025-10-17 17:00 WIB*`
* Fields: jumlah sekarang, rata-rata sebelumnya, delta %, contoh tempat trending (top 3), rekomendasi singkat.
* Footer: `Radar by PotionBot • snapshots saved`

---

## Google Sheets (otomatis dibuat)

Script akan otomatis membuat Spreadsheet baru pada run pertama (standalone). ID disimpan ke Script Properties (SPREADSHEET_ID) dan dipakai untuk semua log/snapshot. Sheet yang dibuat:

1. **radar_snapshots**

   * Columns: `timestamp | area | category | count | sample_ids_json`
   * Menyimpan snapshot tiap run untuk perbandingan.
2. **radar_logs**

   * Columns: `timestamp | action | area | category | count | avg_prev | delta_pct | notified | note`
   * Catat error/success dan notifikasi.

---

## Cara dapat API Key Google Maps (awam friendly)

1. Buka [https://console.cloud.google.com/](https://console.cloud.google.com/) (Login Google).
2. Buat project baru (kanan atas → New Project).
3. Di Navigation menu → APIs & Services → Library → Cari `Places API` → Enable.
4. Di APIs & Services → Credentials → Create Credentials → API key.
5. Batasi API key (recommended): klik API key → Application restrictions (HTTP referrers / IPs) & API restrictions → pilih `Places API`.
6. Salin API key, masukkan ke konfigurasi `GOOGLE_MAPS_API_KEY` di `Code.gs`.

---

## Cara dapat Discord Webhook

1. Buka server Discord → channel target → Edit Channel → Integrations → Create Webhook.
2. Copy Webhook URL.
3. Di Script Properties, isi `DISCORD_WEBHOOK_URL` (single) atau `DISCORD_WEBHOOK_URLS` (multi).
4. Isi juga `AVATAR_USERNAME` dan `AVATAR_URL` (opsional) untuk tampil di message.

---

## Setup & Run (awam friendly)

1. Buka Google Drive → New → More → Google Apps Script.
2. Ganti nama project sesuai. Hapus isi default, paste seluruh isi `Code.gs` dari bagian bawah PRD ini.
3. Set Script Properties: `GOOGLE_MAPS_API_KEY` (wajib), `DISCORD_WEBHOOK_URL` atau `DISCORD_WEBHOOK_URLS` (wajib), `AVATAR_USERNAME`/`AVATAR_URL` (opsional), `SURGE_THRESHOLD`/`AVG_WINDOW`/`SEARCH_RADIUS_METERS` (opsional; default radius 3000 m), `LOCATIONS_JSON` (opsional), dsb.
4. Save. Jalankan `runTest()` sekali (menu Run) agar Spreadsheet otomatis dibuat dan untuk memberi otorisasi (Spreadsheet & UrlFetch).
5. Jalankan `runProductionSetup()` sekali (menu Run) untuk memasang triggers produksi (atau buat manual via Triggers UI).
6. Cek sheet: `radar_snapshots` dan `radar_logs` dibuat otomatis.
7. Untuk tes cepat: jalankan `runTest()` sekali, lalu periksa channel Discord.

---

## Rekomendasi penggunaan & kuota

* **Jaga frekuensi**: rekomendasi 4x hari untuk cafe/restaurant/mall + hourly 21–02 untuk nightclub. Jika kuota ketat, turunkan ke 2x/hari.
* **Batasi radius** untuk tiap titik (default 3000 m; turunkan jika hasil terlalu besar) supaya jumlah hasil wajar.
* **Caching**: snapshot disimpan, gunakan rata-rata untuk smoothing.
* **Pakai billing** di Google Cloud jika produksi (ada free tier terbatas).
* **Tambahan saran:** jika butuh lebih presisi, nanti bisa tambahkan backend kecil di Server Potion untuk polling real-time dan panggil Apps Script webhook hanya saat perlu.

---

## Rekomendasi notifikasi & channel

* Buat channel Discord terpisah: `#radar-keramaian` (publik) dan `#radar-ops` (admin logs).
* Atur bot/webhook avatar & nama agar mudah dikenali (config `AVATAR_USERNAME` & `AVATAR_URL`).

---

## Rekomendasi teknis kecil (opsional)

* Atur `SURGE_THRESHOLD` lebih kecil (20%) untuk sensitivity tinggi atau lebih besar (50%) untuk false positive rendah.
* Tambahkan blacklist tempat (mis. supermarket besar) jika selalu ada traffic dan memicu noise.
* Simpan sample place IDs supaya kamu bisa tampilkan top 3 tempat yang "naik".

---

## Testing & Troubleshooting singkat

1. Jika tidak ada message: periksa `radar_logs` sheet untuk catatan error.
2. Jika Discord menolak: cek webhook URL dan hak akses channel.
3. Jika API gagal: cek API key, billing, dan apakah Places API di-enable.
4. Quota error: kurangi frekuensi trigger atau kecilkan radius.

---

## Rekomendasi tambahan (opsional)

* Tambahkan blacklist place IDs atau kata kunci (mis. chain besar) untuk kurangi noise.
* Tambahkan fungsi `fetchPlaceDetails(place_id)` bila mau ambil foto_count atau ulasan (ingat biaya + quota).
* Buat channel Discord khusus “iseng” untuk versi ringan (meme), dan channel “ops” untuk logs.

---

## Penutup singkat (saran implementasi)

* Mulai dengan **4x cek harian** untuk cafe/restaurant/mall + **hourly** malam untuk nightclub.
* Jalankan `ensureSheets()` lalu `createTriggers()` sekali.
* Isi `GOOGLE_MAPS_API_KEY` & `DISCORD_WEBHOOK_URL` lalu test `runOnceForTest()`.

Kalau mau, aku bisa:

* Generate `Code.gs` versi yang menyertakan `fetchPlaceDetails()` dan analisa review keyword (tapi akan tambah quota).
* Bantu set trigger yang lebih presisi (menghitung WIB vs timezone project).
* Modifikasi output embed supaya gabungkan banyak area sekali post.