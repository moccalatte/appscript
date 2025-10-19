Qdrant_Feeder/oot_prd.md
# 🦾 PRD: Qdrant Feeder Self-Hosted + Telegram Bot Control (OOT Edition)

## 🎯 Visi & Tujuan
Membangun sistem feeder kode ke Qdrant yang **self-hosted** di laptop/server low-spec (i5-4210, RAM 8GB), dengan kontrol penuh via **bot Telegram** (menu ReplyKeyboardMarkup, conversational, full emoji).  
Fokus utama: **chunking optimal, anti duplikat, monitoring/logs ringan via Telegram**, dan penghematan token cost 100x lipat untuk user awam (vibe coder, vibe debugger, vibe engineer).

---

## 🏗️ Arsitektur & Stack

- **Bahasa:** Python (lebih banyak library NLP, Telegram, dan parsing kode, lebih ramah resource low-spec)
- **Database vektor:** Qdrant (self-hosted, di server yang sama, akses via `127.0.0.1:6333`)
- **Model embedding:** `sentence-transformers/all-MiniLM-L6-v2` (default, bisa upgrade ke model kode jika perlu)
- **Kontrol & monitoring:** Bot Telegram (ReplyKeyboardMarkup, conversational, full emoji)
- **Sumber kode:** 
  - Scrape dari GitHub API (otomatis)
  - Import manual dari folder lokal (offline, user bisa download repo sendiri)
- **Log & monitoring:** Semua via Telegram bot (menu, logs, metrics, error, status)

---

## 🧩 Fitur Utama

### 1. **Feeding Kode ke Qdrant**
- **Dua metode input:**
  - **Scrape dari GitHub API:** User masukkan URL repo atau username, bot tanya opsi (branch, file type, dsb).
  - **Import manual:** User pilih folder lokal berisi banyak repo, sistem scan & pilah file kode.
- **Chunking optimal:**
  - **Per fungsi/class** (pakai AST parser, bukan sekadar karakter)
  - **Smart overlap** antar chunk (context tidak terputus)
  - **Tagging otomatis:** Nama fungsi/class, parameter, docstring, dsb.
  - **Adaptif:** Chunk kecil untuk fungsi kecil, chunk besar untuk fungsi besar.
- **Anti duplikat:**
  - **Hash per chunk** (berbasis isi, bukan hanya nama file)
  - **Cek ke Qdrant sebelum insert** (jika hash sudah ada, skip)
  - **Opsional:** Semantic deduplication (cek kemiripan embedding)
- **Pencegahan error:**
  - Validasi file sebelum proses (cek encoding, size, dsb)
  - Retry & fallback jika gagal insert
  - Logging error detail ke Telegram

### 2. **Bot Telegram (Kontrol & Monitoring)**
- **Conversational, full emoji, humanized tone**
- **Menu utama:**
  - 🚀 Start Feeding
  - 📂 Import Lokal
  - 🔍 Lihat Logs
  - 📊 Monitoring
  - ⚙️ Pengaturan
  - ❓ Bantuan
- **Fitur bot:**
  - **Set nama collection** (bisa default, bisa ganti via menu)
  - **Pilih metode feeding** (GitHub/API/manual)
  - **Progress bar feeding** (emoji, status, jumlah chunk, error)
  - **Show logs:** 
    - Daftar repo/file terakhir
    - Jumlah chunk, duplikat, error
    - Token cost estimator (estimasi penghematan token)
    - Status Qdrant (jumlah point, storage, dsb)
  - **Monitoring ringan:** 
    - Notifikasi feeding selesai/gagal
    - Ringkasan harian/mingguan (opsional)
  - **Error handling:** 
    - Semua error user-friendly, ada emoji & solusi
    - Menu bantuan & FAQ

### 3. **Best Practice & Pencegahan Masalah**
- **Resource aware:** 
  - Batasi proses paralel, batch kecil (hemat RAM/CPU)
  - Progress & cancel feeding via bot
- **File watcher (opsional):** 
  - Jika folder lokal berubah, otomatis feeding ulang
- **Backup ringan:** 
  - Export/import log & config via Telegram
- **Security:** 
  - Bot Telegram hanya bisa diakses user tertentu (whitelist ID)
  - Tidak expose Qdrant ke publik

---

## 🧠 Metode Chunking & Deduplication

### **A. Chunking**
- **Parser AST** untuk Python, JS, dsb (gunakan library seperti `ast`/`parso`/`tree-sitter`)
- **Boundary detection:** Pecah per fungsi/class, bukan per karakter
- **Smart overlap:** Tambahkan beberapa baris sebelum/sesudah antar chunk
- **Tagging:** Simpan metadata nama fungsi/class, parameter, docstring, dsb

### **B. Anti Duplikat**
- **Hash isi chunk** (misal SHA-1/SHA-256)
- **Cek hash di Qdrant sebelum insert**
- **Opsional:** Cek kemiripan embedding (threshold cosine similarity)
- **Log duplikat ke Telegram**

### **C. Pencegahan & Peningkatan Lain**
- **Validasi encoding & size file**
- **Retry insert jika gagal**
- **Log error detail**
- **Token estimator:** Hitung estimasi token cost sebelum dan sesudah feeding

---

## 📝 Monitoring & Logs via Telegram

- **Menu logs:** 
  - Show 10 aktivitas terakhir (repo, file, chunk, error)
  - Show statistik (total chunk, duplikat, error, storage)
  - Show status Qdrant (jumlah point, storage, status server)
  - Show estimasi token cost (sebelum & sesudah feeding)
- **Notifikasi feeding selesai/gagal**
- **Semua pesan bot conversational, full emoji, jelas, dan mudah dipahami user awam**

---

## 🛠️ Pengaturan & Customisasi via Bot
- Set nama collection (default & custom)
- Pilih metode feeding (GitHub/manual)
- Set batch size feeding (hemat resource)
- Set notifikasi (on/off)
- Export/import config/log

---

## 📚 Dokumentasi & README
- **WAJIB:** README beginner-friendly, full emoji, step-by-step, jelas, dan mudah dipahami user awam
- **Menu bot Telegram & pesan bot juga harus conversational, full emoji, dan humanized**
- **Sertakan FAQ, troubleshooting, dan tips hemat token**

---

## 🚦 Best Practice & Pencegahan Error
- Validasi input user di bot (URL, path, dsb)
- Cek koneksi Qdrant sebelum feeding
- Batasi feeding paralel (hemat resource)
- Logging error detail, retry otomatis
- Security: whitelist user Telegram, tidak expose port ke publik

---

## 🏁 Penutup
Sistem ini didesain untuk **longterm use**, mudah dioperasikan user awam, dan benar-benar menghemat token cost AI coder.  
Fokus pada chunking optimal, anti duplikat, monitoring/logs ringan via Telegram, dan pengalaman user yang fun, aman, serta bebas error.

---