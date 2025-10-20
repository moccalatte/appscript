# Qdrant Feeder — Panduan Praktis & Terstruktur

Qdrant Feeder adalah Google Apps Script untuk men-scrape daftar README "awesome-*", memilih file kode, memecahnya menjadi chunk, dan mengunggahnya sebagai "points" ke koleksi Qdrant. Dokumentasi ini dirancang agar mudah diikuti oleh operator pemula maupun praktisi.

## Ringkasan Fitur
- **Fungsi utama:** Temukan repo dari README "awesome", pilih file (default: `.py`, `.js`, `.ts`, `.go`), pecah jadi chunk, buat "points", upsert ke Qdrant.
- **Filter pintar:** Discovery otomatis menyaring kandidat yang tidak relevan (repo archived/private, bukan bahasa utama yang diizinkan, atau README ekstra `awesome-*`).
- **Logging & State:**  
  - Spreadsheet `QdrantFeedLogs` → sheet `logs` (event log & observability)  
  - Spreadsheet `QdrantFeedLogs` → sheet `awesome_dedup` (dedup utama)
- **Riwayat repo:** Sheet `awesome_repo_history` menjaga daftar repo yang sudah diproses (beserta status & commit) agar discovery lompat ke kandidat baru.
- **Entry points:**  
  - `testAwesomeRun()` — uji coba end-to-end  
  - `prodAwesomeRun()` — run produksi (jadwalkan via trigger)

## Daftar Isi
1. Konfigurasi Script Properties (Wajib & Opsional)
2. Langkah Cepat Uji Coba (`testAwesomeRun`)
3. Struktur Log & Dedup
4. Troubleshooting Praktis
5. Best Practice & Next Steps


---

## 1. Konfigurasi Script Properties

**Wajib:**
- `GITHUB_PAT` — Hindari rate-limit GitHub (token tanpa prefix `Bearer`)
- `QDRANT_URL` — URL Qdrant, contoh: `https://qdrant.example.com`
- `QDRANT_API_KEY` — API key Qdrant (jika diperlukan)
- `QDRANT_COLLECTION` — Nama koleksi tujuan (boleh memakai placeholder seperti `{{COL_NAME}}` atau `${COL_NAME}` selama variabel yang dirujuk tersedia di Script Properties)

**Opsional (disarankan):**
- `USE_AWESOME_DISCOVERY` (true/false) — Aktifkan discovery dari daftar awesome
- `AWESOME_DEFAULT_LISTS_JSON` — Override daftar sumber README, format:  
  `[{"owner":"vinta","repo":"awesome-python"}, ...]`
- `AWESOME_MAX_REPOS_PER_RUN` (default: 5)
- `AWESOME_MAX_FILES_PER_REPO` (default: 4)
- `AWESOME_MAX_VALIDATION_REQUESTS` (default: 30)
- `AWESOME_DEDUP_SHEET_NAME` (default: `awesome_dedup`)
- `VERBOSE_LOGGING` (true/false) — Jika `true`, log kandidat hasil ekstraksi README (maks 50) ke `logs`
- `AWESOME_ALLOWED_LANGS_JSON` — Batasi bahasa utama repo (default: `["python","javascript","typescript","go"]`)
- `AWESOME_SKIP_AWESOME_NAMED` (true/false) — Skip repo yang namanya mengandung `awesome` (default: `true`)
- `AWESOME_HISTORY_SHEET_NAME` — Nama sheet penanda riwayat repo (default: `awesome_repo_history`)
- `AWESOME_HISTORY_EXPIRY_DAYS` — TTL riwayat sebelum repo boleh diproses ulang (default: `30`, set `0` untuk selalu re-evaluasi)


---

## 2. Dedup & Trigger

**Deduplication:**
- Sheet `awesome_dedup` adalah sumber utama dedup (anti duplikasi) dengan kunci berbentuk `[collection=<nama_koleksi>]::repo@sha:path` sehingga tiap koleksi Qdrant terisolasi.
- Kunci dedup hanya ditulis setelah upsert ke Qdrant sukses (kode 2xx).
- Jika masih ada DEDUP_ lawas di Script Properties, jalankan fungsi `runMigrateDedupSilent()` sekali untuk memindahkannya ke sheet.

**Trigger:**
- Otomatis:  
  - Set `TRIGGER_AUTO_INSTALL=true`, `TRIGGER_INTERVAL_MINUTES=15`, `TRIGGER_DAILY_HOUR=1`
  - Fungsi `ensureScheduledTriggers()` akan membuat trigger berkala & harian
- Manual:  
  - Tambahkan trigger via Apps Script UI → pilih function (`prodAwesomeRun`/`tick`), event source: Time-driven

**Tips:**
- Mulai dengan `AWESOME_MAX_REPOS_PER_RUN=2–5` untuk pipeline stabil
- Pastikan `GITHUB_PAT` tersedia agar tidak terkena rate limit
- Atur chunking & file limit: `CHUNK_SIZE_CHARS`, `CHUNK_OVERLAP_CHARS`, `MAX_FILE_SIZE_BYTES`


---

## 3. Langkah Cepat Uji Coba

1. Pastikan file `Code.gs` dan `awesome_integration.gs` tersedia
2. Isi Script Properties wajib (`GITHUB_PAT`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`)
3. (Opsional) Set `VERBOSE_LOGGING=true` untuk log detail hasil scraping
4. Jalankan fungsi `testAwesomeRun()` dari dropdown Apps Script, klik Run
5. Cek spreadsheet `QdrantFeedLogs`:
   - Sheet `logs` untuk event run
   - Sheet `awesome_dedup` untuk kunci dedup

**Hasil yang diharapkan:**
- Baris `awesome-repos-found ...` menunjukkan repo yang dipilih
- Per-file: status upsert Qdrant (`qdrant_http_status`)
- Jika gagal upsert, cek `error_message` (misal: `no-eligible-files`, `no-chunks`, `raw-too-large`, `dedup-skip (sheet)`)
- Jika `VERBOSE_LOGGING=true`, akan ada row `verbose-extracted` per README


---

## 4. Struktur Log & Dedup

**Sheet `logs`:**
- Kolom: `timestamp`, `repo`, `file_path`, `size_bytes`, `chunk_idx/total`, `point_id`, `qdrant_http_status`, `qdrant_result_points_upserted`, `error_message`, `elapsed_ms`, `dedup_key`, `dedup_ts`, `collection_name`, `qdrant_url`, `vector_name`, `vector_size`, `run_mode`

**Sheet `awesome_dedup`:**
- Kolom: `dedup_key` (`[collection=...]::owner/repo@blobSha:path`), `ts` (ISO UTC)

**Sheet `awesome_repo_history`:**
- Kolom: `repo_full_name`, `last_status`, `commit_sha`, `ts`
- Dipakai untuk mem-flag repo yang sudah diproses agar discovery tidak mengulang kandidat yang sama dalam jangka pendek.

**Catatan:**
- Dedup hanya ditulis setelah upsert sukses
- Observability event juga dicatat ke `logs` (baris `dedup-key-added`)


---

## 5. Troubleshooting Praktis

- **No upserts; logs show `no-eligible-files`:**  
  Repo tidak punya file yang diizinkan atau terlalu besar.  
  *Solusi:* Tambah ekstensi di `isEligiblePath()`, atau naikkan `MAX_FILE_SIZE_BYTES`.

- **Discovered repos fewer than expected:**  
  Banyak kandidat di README di-skip (archived/private/disabled) atau limit terlalu kecil.  
  *Solusi:* Naikkan `AWESOME_MAX_VALIDATION_REQUESTS`, aktifkan `VERBOSE_LOGGING`.
- **Log berulang hanya menampilkan repo `awesome-*`:**  
  Filter bahasa atau nama belum dikonfigurasi.  
  *Solusi:* Pastikan `AWESOME_ALLOWED_LANGS_JSON` berisi bahasa target, dan biarkan `AWESOME_SKIP_AWESOME_NAMED=true` agar hanya repo kode yang diproses.
- **Masih menarget repo yang sama berkali-kali:**  
  Riwayat repo belum terhapus atau commit belum berubah.  
  *Solusi:* Periksa sheet `awesome_repo_history`; hapus baris repositori tersebut atau set `AWESOME_HISTORY_EXPIRY_DAYS` ke nilai lebih kecil (bahkan `0`) jika ingin langsung re-run.

- **GitHub 403 / rate-limit:**  
  *Solusi:* Set `GITHUB_PAT` (token minimal read-only).

- **Qdrant upsert errors (non-2xx):**  
  *Solusi:* Cek `qdrant_http_status`, `error_message`, pastikan konfigurasi Qdrant benar.

- **Script timeout:**  
  *Solusi:* Kurangi `AWESOME_MAX_REPOS_PER_RUN` / `AWESOME_MAX_FILES_PER_REPO`, gunakan trigger berkala.


---

## 6. Best Practice & Next Steps

- Mulai dengan `AWESOME_MAX_REPOS_PER_RUN=1` dan `AWESOME_MAX_FILES_PER_REPO=1` untuk pengujian awal
- Aktifkan `VERBOSE_LOGGING` untuk debugging discovery
- Simpan dedup di sheet `awesome_dedup`, gunakan logs untuk observability
- Manfaatkan `awesome_repo_history` untuk memonitor status terakhir tiap repo dan reset barisnya jika ingin memaksa re-run cepat
- Di produksi, gunakan trigger dan batasi per-run agar tidak melebihi quota API/GAS
- Untuk pengembangan, integrasikan embedding nyata (OpenAI/dll), pastikan ukuran vektor cocok dengan koleksi Qdrant
- Tambahkan monitoring sederhana: hitung baris `no-eligible-files`, `no-chunks`, dan error status di logs


---

## 7. FAQ Singkat

- **Bagaimana mengubah daftar README sumber?**  
  Set Script Property `AWESOME_DEFAULT_LISTS_JSON` (format JSON array)

- **Ingin melihat semua kandidat dari README?**  
  Aktifkan `VERBOSE_LOGGING=true` — log sample kandidat ke `logs`

- **Reset dedup untuk testing?**  
  Hapus entri di sheet `awesome_dedup` (atau hapus sheet untuk reset total)
- **Ingin memproses ulang repo tertentu?**  
  Hapus baris repo itu dari sheet `awesome_repo_history` atau set `AWESOME_HISTORY_EXPIRY_DAYS=0` agar tidak ada TTL.

- **Efek `USE_AWESOME_DISCOVERY=false`?**  
  `pickRepos()` akan skip discovery saat dipanggil dari `tick()`, tapi tetap aktif di `runAwesomeFeed()` kecuali kode diubah

---

## 8. Bantuan & Next Steps

- Jika butuh contoh Script Properties, migrasi dedup, atau integrasi embedding, silakan hubungi
- Untuk debugging, kirimkan 20 baris awal dari sheet `logs` agar bisa dibantu interpretasi hasil run

---

**Proyek Qdrant Feeder siap digunakan, mudah dioperasikan, dan dapat dikembangkan sesuai kebutuhan.**
