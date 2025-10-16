# 🧠✨ Qdrant Feeder (Google Apps Script)

🚀 **[WAJIB] Gambaran Singkat** — Skrip Google Apps Script (GAS) yang otomatis memungut kode dari repo GitHub populer, memecahnya menjadi potongan kecil, lalu menyimpan metadata + placeholder vektor ke Qdrant. Semua aktivitas dicatat di spreadsheet `QdrantFeedLogs`.

📌 **[WAJIB] Inti Proyek**
- 🧩 **[WAJIB] Bahasa yang diproses**: `.py`, `.js`, `.go`
- 📦 **[WAJIB] Koleksi Qdrant default**: diatur lewat Script Properties
- 🧭 **[WAJIB] Nama vektor default**: `sentence-transformers/all-MiniLM-L6-v2` (ukuran menyesuaikan konfigurasi koleksi, minimal > 0)
- 🪪 **[WAJIB] Token yang dibutuhkan**: `GITHUB_PAT`, `QDRANT_API_KEY`
- 🛠️ **[OPSIONAL] Sesuaikan batas**: `MAX_REPOS_PER_RUN`, `MAX_FILES_PER_REPO`, `CHUNK_SIZE_CHARS`, dll via Script Properties

---

## 🏁 Mulai Dari Nol (Step-by-Step)

1. 📁 **[WAJIB] Buat proyek Google Apps Script**
   - Buka Google Drive → `New` → `More` → `Google Apps Script`
   - Atur `Project Settings` → `Time zone` menjadi `Asia/Jakarta`

2. 📄 **[WAJIB] Impor kode utama**
   - Buat file `Code.gs`
   - Salin isi terbaru dari [`Code.gs`](Code.gs)

3. 🔐 **[WAJIB] Simpan kredensial di Script Properties**
   - `GITHUB_PAT` → token GitHub (Fine-grained, baca repositori publik)
   - `QDRANT_API_KEY` → API key Qdrant
   - `QDRANT_URL` → target Qdrant Anda (mis. `https://contoh-qdrant.com`)
   - `QDRANT_COLLECTION` → nama koleksi tujuan (mis. `koleksi_anda`)
   - `TRIGGER_AUTO_INSTALL` → `true` / `false` (**[OPSIONAL]**, default `true`)
   - `TRIGGER_DAILY_HOUR` → jam 0–23 (**[OPSIONAL]**, default `1`)
   - `TRIGGER_INTERVAL_MINUTES` → salah satu: 1, 5, 10, 15, 30 (**[OPSIONAL]**, default `15`)
   - `TEST_LOOP_MAX_RUNTIME_MS` → durasi loop test per run (ms) (**[OPSIONAL]**, default ~4,6 menit)
   - `TEST_LOOP_SLEEP_MS` → jeda antar loop test (ms) (**[OPSIONAL]**, default `0`)
   - `MAX_REPOS_PER_RUN`, `MAX_FILES_PER_REPO`, `MAX_FILE_SIZE_BYTES`, `CHUNK_SIZE_CHARS`, `CHUNK_OVERLAP_CHARS` → isi bila ingin mengganti default (**[OPSIONAL]**)

4. 🪪 **[WAJIB] Cara membuat GITHUB_PAT (Fine-grained)**
   - GitHub → `Settings` → `Developer settings` → `Personal access tokens`
   - Pilih `Fine-grained token`
   - Tetapkan akses `Public repositories (read-only)`
   - Aktifkan izin `Code: Read`, `Metadata: Read`
   - Salin token dan simpan sebagai `GITHUB_PAT`

5. 📑 **[WAJIB] Biarkan skrip menyiapkan log sheet**
   - Jalankan `tick()` sekali (menu `Run`)
   - Spreadsheet `QdrantFeedLogs` + sheet `logs` akan dibuat otomatis

6. ⏰ **[WAJIB] Biarkan skrip mengelola trigger**
   - Pastikan `TRIGGER_AUTO_INSTALL` tetap `true`
   - Trigger bawaan dibuat otomatis: harian jam 01.00 WIB dan interval setiap 15 menit
   - Ubah `TRIGGER_DAILY_HOUR` atau `TRIGGER_INTERVAL_MINUTES` bila jadwal perlu disesuaikan

7. 🧪 **[OPSIONAL] Mode uji beruntun**
   - Jalankan fungsi `tickTest()`; pipeline akan loop terus hingga batas runtime GAS (±6 menit) atau Anda klik `Stop`
   - Sesuaikan `TEST_LOOP_MAX_RUNTIME_MS` / `TEST_LOOP_SLEEP_MS` jika perlu ritme berbeda
   - Pantau sheet/log/Qdrant selama loop berjalan

8. 🔍 **[OPSIONAL] Verifikasi ke Qdrant via cURL / client**
   - Contoh:
     ```bash
     curl -s "<QDRANT_URL>/collections/<QDRANT_COLLECTION>" \
       -H "api-key: <QDRANT_API_KEY>" | jq '.result.points_count'
     ```

9. 📈 **[OPSIONAL] Pantau setelah beberapa jam**
   - Lihat pertambahan `points_count`
   - Lakukan sampling payload untuk memastikan konten sesuai

---

## ▶️ Cara Menjalankan

1. 🏭 **[WAJIB] Produksi (terjadwal)**
   - Jalankan `tick()` sekali dari editor untuk otorisasi & pengecekan awal.
   - Cek `QdrantFeedLogs` guna memastikan baris sukses muncul.
   - Setelah itu, biarkan trigger otomatis mengeksekusi sesuai `TRIGGER_DAILY_HOUR` + `TRIGGER_INTERVAL_MINUTES`.
2. 🧪 **[OPSIONAL] Pengujian nonstop**
   - Jalankan `tickTest()`; fungsi ini memanggil pipeline berulang tanpa jeda (kecuali `TEST_LOOP_SLEEP_MS`) hingga Anda menghentikan eksekusi atau mencapai durasi `TEST_LOOP_MAX_RUNTIME_MS`.
   - Gunakan tombol Stop di Apps Script saat ingin mengakhiri loop lebih cepat.
3. 🔍 **[OPSIONAL] Verifikasi ke Qdrant** menggunakan cURL/client favorit untuk melihat kenaikan `points_count`.
4. 🛠️ **[OPSIONAL] Ubah jadwal** dengan menyesuaikan `TRIGGER_DAILY_HOUR` atau `TRIGGER_INTERVAL_MINUTES`, lalu jalankan `tick()` sekali untuk menerapkan.

---

## 🧭 Cara Kerja Singkat

- 🕒 **[WAJIB] Scheduler**: Trigger dibuat & dijaga otomatis berdasar Script Properties
- 🔍 **[WAJIB] Seleksi repo**: Gunakan GitHub Search (rolling window, skip rate-limit)
- 📂 **[WAJIB] Seleksi file**: Filter ekstensi, ukuran ≤ 64KB, hindari folder `test/tests/examples/dist/node_modules/vendor`
- ✂️ **[WAJIB] Chunking**: Potong teks ±3000 karakter dengan overlap 200
- 📦 **[WAJIB] Upsert**: Kirim batch ≤ 50 poin per file ke Qdrant (PUT `?wait=true`)
- 📘 **[WAJIB] Logging**: Simpan detail chunk (HTTP status, error, durasi) ke sheet
- ♻️ **[WAJIB] Dedup**: Catat `repo@blob_sha:path` di Script Properties setelah upsert sukses

---

## 🧪 Checklist Pengujian

- ✅ **[WAJIB] Jalankan `tick()` tanpa trigger** dan pastikan tidak ada error merah di Apps Script
- ✅ **[WAJIB] Periksa sheet**: minimal satu baris sukses dengan `qdrant_http_status` 200
- ✅ **[WAJIB] Cek Qdrant**: hitung `points_count` atau cari payload terbaru
- 🔄 **[OPSIONAL] Ulangi pengujian** dengan mengubah `MAX_REPOS_PER_RUN` kecil (mis. 1) untuk simulasi throttling
- 🧪 **[OPSIONAL] Cek dedup**: jalankan `tick()` dua kali berturut-turut, pastikan baris kedua menampilkan `dedup-skip`

---

## 🛠️ Operasional & Pemeliharaan

- 📉 **[WAJIB] Jika kena rate limit GitHub (403)** → turunkan `MAX_REPOS_PER_RUN` atau tambah jendela waktu pencarian
- 📏 **[WAJIB] Jika ada `raw-too-large`** → kurangi `MAX_FILE_SIZE_BYTES` atau `CHUNK_SIZE_CHARS`
- ⏰ **[OPSIONAL] Ubah jadwal trigger**: set `TRIGGER_DAILY_HOUR` (0–23) & `TRIGGER_INTERVAL_MINUTES` (1/5/10/15/30), lalu jalankan `tick()` sekali untuk menerapkan
- 🔁 **[OPSIONAL] Atur pengujian**: gunakan `TEST_LOOP_MAX_RUNTIME_MS` & `TEST_LOOP_SLEEP_MS` untuk mengendalikan durasi/frekuensi `tickTest()`
- 🧹 **[OPSIONAL] Bersihkan dedup**: hapus properti `DEDUP_*` bila perlu memproses ulang repo lama
- 📊 **[OPSIONAL] Simpan cadangan log**: unduh sheet berkala untuk audit

---

## 💡 FAQ Ringkas

- ❓ **[WAJIB] Kenapa vektor nol?** Placeholder wajib karena skema Qdrant membutuhkan vektor; dapat diganti embedding asli di proses lanjutan
- ❓ **[WAJIB] Bisa tambah bahasa lain?** Bisa dengan mengubah fungsi `isEligiblePath`, tetapi bersiap terhadap kuota dan ukuran file
- ❓ **[WAJIB] Kenapa batch 50 poin?** Batas aman untuk Apps Script agar permintaan cepat dan stabil
- ❓ **[OPSIONAL] Bagaimana kalau ingin jadwal berbeda?** Atur `TRIGGER_DAILY_HOUR` dan `TRIGGER_INTERVAL_MINUTES`, lalu jalankan `tick()` untuk memperbarui trigger

---

## 📚 Referensi

- 📄 **[WAJIB] Detail implementasi kode**: [`Code.gs`](Code.gs)
- 🧭 **[WAJIB] Dokumen produk lengkap**: [`prd.md`](prd.md)
