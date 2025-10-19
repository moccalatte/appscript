# Auto-Formula Daily BaZi Overview Bot

Panduan ini menjelaskan langkah demi langkah menyiapkan dan menjalankan bot Google Apps Script yang otomatis meminta ringkasan harian BaZi dari Gemini, memperbaiki prompt via OpenRouter bila perlu, dan mencatat semuanya ke Google Sheet.

---

## 1. Persiapan Akun & Kunci
- **Google Account** dengan akses ke [Google Apps Script](https://script.google.com).
- **Gemini API Key** dari [Google AI Studio](https://aistudio.google.com/apikey).
- **OpenRouter API Key** dari [OpenRouter](https://openrouter.ai/keys).
- **Discord Webhook URL** (buat via Discord → Server Settings → Integrations → Webhooks).

Simpan semua data ini—akan dipakai pada langkah Script Properties.

---

## 2. Membuat Proyek Apps Script
1. Buka [Google Apps Script](https://script.google.com) dan klik **New project**.
2. Ubah nama proyek (misal `BaZi Auto Formula`).
3. Pada editor, hapus isi file `Code.gs` default.
4. Salin isi file `Code.gs` dari repo ini ke proyek (pastikan seluruh kode tersalin).

---

## 3. Mengisi Script Properties
1. Di Apps Script, klik **Project settings** (ikon gear di kiri bawah).
2. Pada bagian **Script properties**, klik **Add row** dan masukkan nilai berikut:
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`
   - `DISCORD_WEBHOOK_URL`
   - Opsional: `SHEET_NAME`, `SPREADSHEET_NAME`, `TARGET_DATE`, dll. (lihat daftar di `Code.gs` bila ingin menyesuaikan).
3. Klik **Save** setelah semua properti terisi.

Tips:
- `TARGET_DATE` gunakan format `YYYY-MM-DD`.
- Biarkan nilai default bila tidak yakin (bot sudah punya fallback).

---

## 4. Hak Akses Spreadsheet
Saat pertama kali bot dijalankan, dia akan membuat spreadsheet bernama `bazi_daily_logs`. Pastikan akun yang sama memiliki izin membuat file di Google Drive (biasanya otomatis jika menggunakan akun pribadi).

---

## 5. Uji Cepat (Test Once)
1. Di editor Apps Script, pilih fungsi `testOnce` dari dropdown di toolbar (dekat tombol ▶️).
2. Klik ▶️ untuk menjalankan.
3. Saat diminta izin, ikuti proses OAuth hingga selesai (hanya pertama kali).
4. Setelah selesai, buka Google Drive → cari `bazi_daily_logs`.
5. Buka sheet `logs` dan pastikan ada minimal satu baris berisi status pemanggilan Gemini (walau gagal, tetap tercatat).

Jika gagal:
- Periksa kembali API key.
- Lihat kolom `errorMessage` pada sheet untuk petunjuk.

Catatan: setiap kali kolom `responseOpenRouter` terisi, siklus berikutnya otomatis memakai teks tersebut sebagai prompt awal ke Gemini.

---

## 6. Menjalankan Produksi Manual
1. Di dropdown fungsi, pilih `runProduction`.
2. Klik ▶️.
3. Satu siklus kerja:
   - Kirim prompt awal (default atau hasil improve terakhir) ke Gemini dan log jawaban.
   - Kirim prompt tersebut + jawaban Gemini ke OpenRouter untuk diperbaiki, catat hasilnya di `responseOpenRouter`.
   - Kirim prompt versi improve ke Gemini lagi dan log jawaban kedua.
4. Setelah siklus selesai, fungsi langsung keluar lalu menjadwalkan pemanggilan berikutnya via trigger internal:
   - normal: jeda `PAUSE_MS_NORMAL` (default 1 menit),
   - rate limit: jeda `PAUSE_MS_RATELIMIT` (default 5 menit),
   - error/kuota habis: tidak menjadwalkan ulang.
5. Semua aktivitas terekam di sheet `logs`. Untuk menghentikan auto-run, buka menu **Triggers** dan hapus entri `runProduction` yang dibuat otomatis.

Catatan:
- Karena tidak ada `sleep` panjang, Apps Script run selesai cepat seperti trigger biasa.
- Saat rate limit, siklus dicatat lalu auto-reschedule 5 menit kemudian.
- Bila kuota benar-benar habis, bot kirim peringatan ke Discord lalu berhenti menjadwalkan ulang.

---

## 7. Menjadwalkan via Trigger (Opsional)
1. Di Apps Script, klik ikon jam **Triggers**.
2. Klik **Add Trigger**:
   - Choose function: `runProduction`
   - Event source: **Time-driven**
   - Pilih jadwal (misal tiap 2 jam; sesuaikan kuota API).
3. Simpan.

Bot kini berjalan otomatis sesuai jadwal.

---

## 8. Pemantauan & Tips
- **Sheet `logs`**: Pantau kolom `status`.
  - `ok`: keyword ditemukan.
  - `no_keyword`: keyword belum ada → perbaikan prompt dilakukan.
  - `improved`: hasil OpenRouter berhasil.
  - `rate_limited`: bot menjadwalkan ulang 5 menit kemudian.
  - `quota_exhausted` / `error`: perlu perhatian.
- **Discord**: Pesan berhenti akan muncul jika bot tidak bisa melanjutkan (kuota habis atau error fatal).
- **Ubah TARGET_DATE** di Script Properties jika ingin tanggal harian berbeda.
- Jika ingin mengatur frekuensi berbeda, ubah nilai `PAUSE_MS_NORMAL`/`PAUSE_MS_RATELIMIT` atau tambahkan trigger Anda sendiri (hapus auto-trigger bawaan bila perlu agar tidak ganda).

---

## 9. Troubleshooting Umum
- **Sheet tidak muncul**: Pastikan bot sudah dijalankan minimal sekali dan izin Drive diberikan.
- **Error API Key**: Double-check pengetikan key. Gemini/OpenRouter kadang sensitif terhadap spasi ekstra.
- **Prompt terlalu panjang**: Bot otomatis memotong ke 700 karakter, jadi cukup ikuti format dasar.
- **Webhook Discord gagal**: Cek URL webhook atau buat ulang.

---

## 10. Reset & Update
- Untuk mengganti kode, cukup salin ulang `Code.gs` lalu simpan.
- Jika ingin mengubah properti, perbarui Script Properties dan jalankan `testOnce` lagi untuk memastikan.

Bot siap digunakan—selamat mencoba dan pantau hasilnya di Google Sheet!
