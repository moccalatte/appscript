jobseer_gas/README.md
# JobSeer GAS - Beginner Friendly Guide & Complete Documentation

---

## 📢 Apa Itu JobSeer GAS?

JobSeer GAS adalah asisten otomatis berbasis Google Apps Script untuk melamar pekerjaan. Kamu cukup upload screenshot atau teks lowongan, sistem akan mengekstrak detail, generate cover letter, dan mengirim email beserta CV secara otomatis ke HR. Semua proses tercatat di Google Sheets untuk audit dan tracking.

---

## 🚀 Fitur Utama

- **Upload Screenshot/Teks Lowongan**: JPG/PNG (max 2MB) atau paste teks.
- **AI Extraction**: Gemini untuk OCR, OpenRouter untuk parsing detail.
- **Auto Cover Letter**: Personalized berdasarkan profil dan job requirements.
- **Dual Mode**: Nabung Lamaran (save for batch) & Kirim Sekarang (langsung email).
- **Profile Management**: Nama, email, CV URL, skills, pengalaman, custom AI prompt.
- **Bulk Preview & Send**: Kirim banyak lamaran sekaligus.
- **Status & Tracking**: Statistik real-time, audit trail di Google Sheets.
- **Smart Email Validation**: Regex + MX record check, manual override jika gagal.
- **UI Luminous Dashboard**: Tailwind + shadcn vibe, gradient blur, toast notification, dark mode toggle.
- **Security & Privacy**: Data hanya di akun Google user, API keys aman.
- **Queue Insight**: Widget status untuk Waiting OCR, Parsing Ready, Nabung, Sent, Duplicate, Need Email.

---

## 📝 Prasyarat & Persiapan

### Wajib
- **Google Account** (Gmail, Drive, Apps Script, Sheets)
- **Gemini API Key** ([AI Studio](https://aistudio.google.com/app/apikey))
- **OpenRouter API Key** ([openrouter.ai/keys](https://openrouter.ai/keys))
- **CV.pdf di Google Drive** (shared, bisa di-download)

### Opsional
- **Multiple API Keys** (untuk fallback jika quota habis)
- **Custom Prompt** (untuk gaya cover letter unik)
- **Custom Domain Gmail** (advanced, untuk email dari domain sendiri)
- **Backup Automation** (untuk backup data otomatis)

---

## 🛠️ Setup Step-by-Step (Beginner Friendly)

### 1. Dapatkan API Keys (Wajib)
- **Gemini**: Daftar di [AI Studio](https://aistudio.google.com/app/apikey), buat API key, simpan.
- **OpenRouter**: Daftar di [openrouter.ai/keys](https://openrouter.ai/keys), buat API key, simpan.

### 2. Upload CV ke Google Drive (Wajib)
- Upload file CV.pdf ke Google Drive.
- Klik kanan → Share → Anyone with the link can view.
- Copy link, ambil FILE_ID, buat direct download:
  ```
  https://drive.google.com/uc?export=download&id=FILE_ID
  ```

### 3. Buat Project di Google Apps Script (Wajib)
- Buka [Google Apps Script](https://script.google.com/)
- Klik "New Project", beri nama "JobSeer GAS".

### 4. Tambahkan File Kode (Wajib)
- Buat 4 file:
  - `code.gs` (main backend logic)
  - `helper.gs` (helper functions)
  - `config.gs` (konfigurasi & constants)
  - `index.html` (frontend UI)
- Copy-paste isi file dari repo/folder ke masing-masing file di GAS.

### 5. Konfigurasi Script Properties (Wajib)
- Klik "Project Settings" (ikon gear).
- Tambahkan:
  ```
  GEMINI_KEYS=your_gemini_key_here
  OPENROUTER_KEYS=your_openrouter_key_here
  ```
- Jika punya lebih dari satu key, pisahkan dengan koma:
  ```
  GEMINI_KEYS=key1,key2
  OPENROUTER_KEYS=key1,key2
  ```

### 6. Enable API (Opsional, biasanya sudah aktif)
- Gmail API (untuk kirim email)
- Google Sheets API (untuk data storage)
- Google Drive API (untuk akses CV)

#### Jika muncul pesan “permission error”
1. Di Apps Script klik menu **Services** (ikon “+” di samping Files).
2. Tambah service yang dibutuhkan (Gmail / Sheets / Drive) lalu klik **Add**.
3. Deploy ulang web app kemudian jalankan kembali aksinya.

### 7. Deploy Sebagai Web App (Wajib)
- Klik "Deploy" → "New deployment" → pilih "Web app".
- Execute as: Email kamu.
- Who has access: Anyone.
- Klik "Deploy", copy Web App URL.
- Setelah pertama kali memproses antrean (OCR/parsing), script akan membuat trigger time-based otomatis. Pastikan memberi izin saat diminta.

### 8. Setup Profil di Web App (Wajib)
- Buka Web App URL di browser.
- Tab "👤 Profil & CV":
  - Nama lengkap
  - Email pribadi
  - CV URL (direct download dari langkah 2)
  - Skills (opsional)
  - Pengalaman kerja (opsional)
  - Custom prompt (opsional)
- Klik "💾 Simpan Profil".

---

## 📂 Penjelasan File & Konfigurasi

| File         | Wajib/Opsional | Fungsi Utama                                      |
|--------------|----------------|---------------------------------------------------|
| code.gs      | Wajib          | Backend utama, proses gambar/teks, kirim email    |
| helper.gs    | Wajib          | Fungsi bantu: parsing, validasi, utilitas         |
| config.gs    | Wajib          | Konfigurasi, constants, pengaturan API            |
| index.html   | Wajib          | Frontend Tailwind UI, form upload, tab navigasi   |
| README.md    | Wajib          | Dokumentasi utama                                 |
| summary.md   | Opsional       | Rangkuman fitur & bugfix (boleh dihapus)          |
| design-prompt.md | Opsional   | Brief UI jika ingin menerapkan gaya dashboard sama di proyek lain |

---

## ▶️ Cara Menjalankan & Test End-to-End

### 1. Test Setup (Beginner)
- Buka Web App URL.
- Isi profil, simpan.
- Tab "📤 Submit Lowongan":
  - Upload screenshot lowongan (JPG/PNG, max 2MB) atau paste teks.
  - Untuk batch screenshot gunakan card “🗂️ Upload Batch Screenshot” (file <=5MB, upload ke Drive otomatis).
  - Pilih mode: "📦 Nabung Lamaran" (save) atau "📧 Kirim Sekarang" (langsung email).
  - Klik "Proses".
- Cek Google Sheets "JobSeer Data":
  - Sheet `lowongan_raw` → teks hasil ekstraksi.
  - Sheet `lowongan_parsed` → detail job.
  - Sheet `sent_emails` → audit trail email.
  - Sheet `cv_profiles` → profil user.

### 2. Test Kirim Email (e2e)
- Pilih mode "Kirim Sekarang".
- Upload screenshot atau paste teks.
- Jika email parsing gagal, akan muncul modal untuk input manual (status kolom jadi `need_email` sampai kamu isi).
- Setelah sukses, cek email HR (atau email dummy) untuk verifikasi.
- Cek sheet `sent_emails` untuk status pengiriman.
- Widget pada dashboard akan otomatis memperbarui angka `Need Email`, `Waiting OCR`, dan `Parsing Ready`.

### 3. Test Produksi (Batch)
- Kumpulkan beberapa lowongan (mode Nabung).
- Tab "📊 Status & Track" → Preview semua lamaran.
- Klik "Kirim Semua" untuk batch send.
- Cek ringkasan: jumlah berhasil, gagal, duplikat.
- Cek audit trail di sheet.

### 4. Test Responsif & Dark Mode
- Buka di smartphone/tablet.
- Klik tombol 🌙 untuk dark mode.
- Pastikan semua fitur tetap berjalan.

> **Catatan Queue:** Tombol “Proses Gambar Antrean” dan “Parsing Lowongan Pending” bisa men-trigger manual. Sistem juga memasang trigger 3 menit otomatis setelah tombol dijalankan pertama kali.

---

## 🧑‍💻 Troubleshooting Umum

| Masalah                        | Solusi                                                      |
|---------------------------------|-------------------------------------------------------------|
| "API keys not configured"       | Tambah keys di Script Properties, refresh web app           |
| "CV URL belum diatur"           | Isi CV URL di profil, pastikan link bisa download           |
| "Gagal download CV dari URL"    | Test link di browser, pastikan file shared                  |
| Email tidak terkirim            | Cek sheet `sent_emails` untuk error message                 |
| Screenshot tidak ter-ekstrak    | Gunakan gambar lebih jelas atau mode teks                   |
| UI tidak loading                | Cek index.html, clear cache, coba browser lain              |
| Error quota API                 | Tambah API key cadangan, tunggu 1 jam, atau upgrade quota   |
| Email parsing gagal             | Input manual email saat diminta modal, status akan update   |
| Sheet tidak dibuat otomatis     | Deploy ulang, atau run fungsi createSpreadsheet() manual     |

---

## ❓ FAQ (Beginner Friendly)

**Q: Berapa biaya pakai JobSeer GAS?**  
A: Gratis! Gemini dan OpenRouter punya free tier cukup untuk ratusan aplikasi.

**Q: Apakah data saya aman?**  
A: Ya, semua data hanya di akun Google kamu (Sheets, Drive, Gmail). Tidak ada server eksternal.

**Q: Bisa batch apply banyak sekaligus?**  
A: Bisa! Mode Nabung + Kirim Semua mendukung batch send unlimited (dengan throttle).

**Q: Bagaimana dapat CV URL direct download?**  
A: Upload ke Google Drive, share, ambil FILE_ID, buat link:  
`https://drive.google.com/uc?export=download&id=FILE_ID`

**Q: Email parsing gagal, apa yang harus dilakukan?**  
A: Akan muncul modal untuk input manual email HR. Isi, lalu lanjutkan proses.

**Q: Bisa pakai custom prompt untuk cover letter?**  
A: Bisa! Isi di profil, AI akan generate cover letter sesuai instruksi kamu.

**Q: Bagaimana cara rollback jika ada error?**  
A: Restore file backup, deploy ulang, atau pilih versi deployment sebelumnya di GAS.

---

## 💡 Tips Penggunaan

- **Screenshot harus jelas**: Semakin jelas, semakin akurat ekstraksi.
- **Batch mode efisien**: Nabung dulu, kirim semua sekaligus.
- **Custom prompt**: Tambahkan instruksi unik untuk cover letter.
- **Monitor status tab**: Untuk tracking aplikasi dan audit trail.
- **Dark mode**: Nyaman untuk mata, klik 🌙 di pojok kanan atas.
- **Pantau widget**: Angka `Waiting OCR`, `Parsing Ready`, `Need Email` membantu memutuskan aksi berikutnya.
- **Backup data**: Download spreadsheet secara berkala.

---

## 🗺️ Roadmap & Next Steps

- [ ] Multiple profile support (Junior/Senior)
- [ ] Email template customization
- [ ] Interview tracker
- [ ] Analytics dashboard
- [ ] Export aplikasi ke PDF/CSV
- [ ] LinkedIn/Indeed integration

---

## 🏁 Penutup

JobSeer GAS dirancang agar pemula sekalipun bisa langsung setup dan melamar pekerjaan secara otomatis. Semua instruksi di atas sudah diurutkan agar mudah diikuti, dengan penjelasan mana yang wajib dan mana yang opsional. Jika ada kendala, cek troubleshooting dan FAQ, atau baca komentar di setiap file kode.

**Selamat mencoba dan semoga sukses dalam job hunt! 🚀**

---
