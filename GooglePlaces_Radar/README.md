📡 Radar Lonjakan Keramaian (GMaps Places-only) — Google Apps Script

Ringkasan
Bot Apps Script yang memeriksa Google Maps Places pada lokasi grid di Jabodetabek, menyimpan snapshot ke Google Sheets, mendeteksi lonjakan (surge) berdasarkan rata-rata snapshot sebelumnya, dan mengirim embed rapi ke Discord. Tidak perlu server.

Apa yang baru ✨
- 🗂️ Spreadsheet otomatis dibuat pada run pertama (nama default: "Radar Keramaian Logs ..."). ID disimpan ke Script Properties dan dipakai terus.
- 🔗 Multi-webhook Discord: set DISCORD_WEBHOOK_URLS (array JSON atau daftar dipisah koma/newline/semicolon) dan/atau DISCORD_WEBHOOK_URL (single). Semua akan dikirimi pesan.
- 📏 Radius default diperbesar: SEARCH_RADIUS_METERS = 3000 (opsional untuk diubah).
- 🧪 Fungsi tes sekali jalan dan 🏭 fungsi produksi untuk trigger jelas terpisah.

File utama
- [Code.gs](Code.gs) — semua logic dalam satu file.
- Fungsi penting: [main()](Code.gs:139), [ensureSheets()](Code.gs:223), [createTriggers()](Code.gs:344), [runTest()](Code.gs:378), [runProductionSetup()](Code.gs:384).

Cara kerja singkat 🧠
- [main()](Code.gs:139) melakukan Nearby Search per area/kategori, simpan snapshot, hitung rata-rata N snapshot sebelumnya, bandingkan terhadap SURGE_THRESHOLD, dan mengirim embed ke semua webhook yang terkonfigurasi.
- Embed warna hijau untuk cafe/restaurant/mall dan ungu untuk night club, berisi jumlah saat ini, rata-rata sebelumnya, delta %, dan contoh top 3 tempat.

Prasyarat ✅
- Akun Google (Apps Script + Sheets).
- Google Maps Places API Key (Wajib).
- Discord Webhook URL atau daftar URL (Wajib).

Konfigurasi (Script Properties) ⚙️
Wajib:
- GOOGLE_MAPS_API_KEY
- DISCORD_WEBHOOK_URL atau DISCORD_WEBHOOK_URLS

Opsional:
- AVATAR_USERNAME (default "PotionRadar")
- AVATAR_URL (URL gambar avatar)
- SURGE_THRESHOLD (default 0.30)
- AVG_WINDOW (default 3)
- SEARCH_RADIUS_METERS (default 3000)
- MAX_PLACES_PER_FETCH (default 60)
- SLEEP_BETWEEN_REQUESTS_MS (default 800)
- SHEET_SNAPSHOTS (default "radar_snapshots")
- SHEET_LOGS (default "radar_logs")
- LOCATIONS_JSON (override titik lokasi dalam array JSON)
- SPREADSHEET_NAME (opsional; jika kosong, dibuat otomatis dengan nama default saat run pertama)

Catatan multi-webhook 🔔
- DISCORD_WEBHOOK_URLS boleh:
  - Array JSON: ["https://discord.com/api/webhooks/xxx","https://discord.com/api/webhooks/yyy"]
  - Atau string dipisah koma/newline/semicolon: https://.../xxx, https://.../yyy
- Jika DISCORD_WEBHOOK_URL juga diisi, semuanya akan dikirimi notifikasi (duplikasi otomatis dihindari).

Setup (awam friendly) 🚀
1) Buat Project Apps Script (Wajib)
- Buka https://script.google.com/ atau Google Drive → New → More → Google Apps Script.
- Buat project baru (standalone, tidak wajib terikat Spreadsheet).

2) Salin kode (Wajib)
- Hapus isi default di editor Apps Script.
- Salin seluruh isi [Code.gs](Code.gs) dari repo ini, dan tempel ke editor (nama file Code.gs).

3) Set Timezone (Sangat Disarankan)
- Apps Script editor → Project Settings → Time zone: Asia/Jakarta.

4) Tambahkan Script Properties (Wajib/Opsional)
- Apps Script editor → Project Settings → Script properties → Add script property.
- Isi yang Wajib dan Opsional sesuai daftar di atas.

5) Simpan dan Authorize (Wajib)
- Klik Save, lalu saat pertama kali run akan muncul prompt otorisasi (Spreadsheet & UrlFetch).

Tes cepat (sekali jalan) 🧪
- Jalankan [runTest()](Code.gs:378) dari menu Run.
- Pertama kali jalan, script akan otomatis membuat Spreadsheet (nama berdasar waktu WIB) dan menyimpan SPREADSHEET_ID ke properties.
- Cek:
  - Sheets: tab "radar_snapshots" dan "radar_logs" terbentuk dan terisi.
  - Discord: embed terkirim ke semua webhook yang diatur.

Produksi (aktif selamanya) 🏭
- Jalankan [runProductionSetup()](Code.gs:384) sekali untuk memasang trigger.
- Trigger:
  - Harian: sekitar 10:05, 13:05, 17:05, 20:05 (WIB).
  - Hourly: setiap jam (internal filter hanya night_club pada 21:00–02:00).
- Kelola trigger via ikon jam (Triggers) di Apps Script editor.

Konfigurasi lokasi 📍
- Default: Jakarta Pusat/Selatan/Barat/Timur/Utara + Bekasi.
- Override via LOCATIONS_JSON. Contoh:
  [{"name":"Jakarta Pusat","lat":-6.19,"lng":106.8228},{"name":"Bekasi","lat":-6.234,"lng":106.9922}]

Spreadsheet yang digunakan 📊
- Dibuat otomatis pada run pertama: nama default "Radar Keramaian Logs YYYY-MM-DD HH:MM WIB".
- Sheet:
  - radar_snapshots: timestamp | area | category | count | sample_ids_json
  - radar_logs: timestamp | action | area | category | count | avg_prev | delta_pct | notified | note

Tips kuota & akurasi 🧩
- Jaga frekuensi pemanggilan (perhatikan biaya Places API).
- Sesuaikan SEARCH_RADIUS_METERS (default 3000) agar hasil tidak terlalu besar.
- Atur SURGE_THRESHOLD (mis. 0.2 lebih sensitif, 0.5 lebih ketat).

Troubleshooting 🛠️
- Tidak ada pesan di Discord: cek sheet radar_logs (action "discord_error"/"discord_exception").
- API error/kuota: pastikan API key aktif, enable Places API, billing on.
- Spreadsheet tidak terbentuk: pastikan sudah jalankan [runTest()](Code.gs:378) minimal sekali untuk membuatnya otomatis.
- Waktu jadwal tidak sesuai: set timezone project ke Asia/Jakarta.

Fungsi yang tersedia 🧰
- [runTest()](Code.gs:378): tes sekali jalan (membuat spreadsheet jika belum ada).
- [runProductionSetup()](Code.gs:384): memasang trigger untuk produksi.
- [createTriggers()](Code.gs:344): membuat ulang semua trigger rekomendasi.
- [main()](Code.gs:139): logic utama yang dipanggil oleh trigger.

Keamanan 🔐
- Simpan API key dan webhook di Script Properties, bukan di kode.
- Batasi API key ke Places API dan atur restrictions sesuai best practice.

Lisensi 📄
- Internal use. Sesuaikan sesuai kebutuhan organisasi Anda.
Realtime Crowd Index (opsional) — strategi mendekati realtime

Masalah
- Data rating/ulasan tidak realtime dan dapat dimanipulasi. Google Places API tidak menyediakan “popular times”/“live busyness” secara resmi.
- Target: indeks keramaian 0–100 mendekati realtime atau setidaknya near-real-time.

Pendekatan bertingkat (pilih sesuai batasan dan anggaran)

A) Maps API-only (tanpa scraping) — pendekatan heuristik near-real-time
- Tingkatkan frekuensi polling:
  - Untuk jam ramai: 5–15 menit sekali (terutama malam untuk night_club).
  - Gunakan trigger yang lebih sering dan filter di [main()](Code.gs:139).
- Granular grid:
  - Perbanyak titik (grid) di area hotspot. Radius 1000–3000 m, sesuaikan agar hasil tidak terlalu besar.
- Crowd Index proxy (gabungan beberapa sinyal):
  - Sinyal 1: jumlah tempat “open_now” di sekitar (diset oleh Nearby Search).
  - Sinyal 2: perubahan jumlah hasil (Δ count vs rata-rata N snapshot terakhir) dari [getAveragePreviousCount()](Code.gs:247).
  - Sinyal 3: bobot waktu (day-part) — siang/sore/malam (contoh bobot: siang=0.8, sore=1.0, malam=1.2).
  - Sinyal 4: hotspot weight — jarak ke titik pusat populer (semakin dekat, bobot lebih tinggi).
- Normalisasi ke 0–100:
  - Contoh rumus sederhana (opsional, di compute sebelum kirim Discord):
    - index = clamp( (w1*openNow + w2*delta + w3*dayPart + w4*hotspotWeight), 0, 100 )
  - openNow = jumlah tempat dengan opening_hours.open_now === true (atau estimasi jika field tidak tersedia).
  - delta = persentase kenaikan vs rata-rata N snapshot terakhir.
  - dayPart, hotspotWeight = bobot 0–1.
- Smoothing:
  - Gunakan EMA (Exponential Moving Average) dari indeks agar tidak terlalu fluktuatif.
- Kelebihan:
  - Patuh batasan API resmi, tidak butuh backend tambahan.
- Kekurangan:
  - Tidak benar-benar realtime; tetap polling dan sinyal terbatas.

B) Semi-realtime via backend kecil (opsional, meningkatkan akurasi)
- Backend Node.js headless (Puppeteer) untuk mengambil “live busyness/current popularity” dari halaman detail Google Maps. Lalu push ke Apps Script.
- Mekanisme:
  - Backend tarik nilai “current popularity” (0–100) beberapa lokasi terpilih (whitelist).
  - Backend kirim ke Apps Script via webhook (POST JSON ke endpoint Web Apps).
  - Apps Script menyimpan ke sheet dan kirim notifikasi jika melewati threshold.
- Integrasi:
  - Tambahkan endpoint Web Apps di Apps Script.
  - Mapping data ke embed: tampilkan “Crowd Index” bersama field lain di [postSurgeToDiscord()](Code.gs:266).
- Catatan:
  - Perhatikan ToS, rate limit, dan reliability. Jadikan fitur opsional “mode akurasi tinggi”.

C) Sinyal non-Maps (opsional premium — akurasi tertinggi)
- Sensor on-site: kamera (computer vision people counting), Wi‑Fi probe requests counting, atau footfall counter.
- Third-party footfall APIs: integrasi data jumlah pengunjung dari partner.
- Integrasi ke Apps Script:
  - Push ke Google Sheets atau Web Apps → diproses oleh [main()](Code.gs:139) dan dikirim via [postSurgeToDiscord()](Code.gs:266).
- Kelebihan:
  - Akurat dan realtime sesungguhnya.
- Kekurangan:
  - Butuh hardware/kemitraan dan biaya.

Rekomendasi implementasi cepat (tanpa backend)
- Naikkan frekuensi trigger dan gunakan bobot waktu (day-part).
- Tambahkan perhitungan indeks di tahap sebelum kirim Discord.
- Sesuaikan threshold berdasarkan jam (lebih sensitif untuk slot ramai).
- Gunakan [createTriggers()](Code.gs:344) untuk memasang jadwal lebih padat (opsional).
- Simpan hasil indeks ke sheet melalui [getOrCreateSpreadsheet()](Code.gs:100) dan tampilkan di embed agar tim bisa memantau tren.

Properti yang bisa ditambahkan (opsional)
- DAY_PART_WEIGHTS: JSON seperti {"morning":0.8,"afternoon":1.0,"evening":1.1,"night":1.2}
- HOTSPOT_WEIGHT: angka 0–1 untuk membesarkan bobot area inti.
- REALTIME_INDEX_ENABLED: "true"/"false" untuk menampilkan indeks di Discord.
- REALTIME_INDEX_EMA_ALPHA: 0.3 (contoh) untuk smoothing.

Output ke Discord (opsional update)
- Embed menampilkan “Crowd Index: 0–100” bersama delta %, jumlah sekarang, dan contoh top 3.
- Warna tetap mengikuti kategori (hijau/ungu).

Langkah berikutnya (pilih jalur)
- Jalur A (tanpa backend): tambahkan kalkulasi indeks ke [main()](Code.gs:139) dan kirim via [postSurgeToDiscord()](Code.gs:266).
- Jalur B (backend opsional): siapkan service kecil untuk “live busyness”, tambah endpoint Web Apps di Apps Script, dan gabungkan nilainya dengan indeks lokal.