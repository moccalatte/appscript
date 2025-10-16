# qdrant_feeder_appscript — Product Requirements (rev. 2025-10-16)

## 1. Ringkasan Produk
- **Tujuan**: Google Apps Script (GAS) yang memanen potongan kode dari repositori GitHub populer lalu menyimpannya ke Qdrant untuk dipakai sebagai knowledge base.
- **Scope**: Proses otomatis tiap 15 menit, menangani repo publik saja, dan mencatat semua aktivitas ke spreadsheet.
- **Output utama**: Points di koleksi Qdrant (nama dikonfigurasi via Script Properties) dengan payload kaya konteks + placeholder vector; log rinci di spreadsheet `QdrantFeedLogs`.

## 2. Sasaran
1. Mengirim konten file `.py`, `.js`, `.go` dari repo populer secara bertahap dan stabil.
2. Menghindari duplikasi menggunakan dedup key `repo_fullname@blob_sha:path`.
3. Menyediakan log granular (per chunk) untuk memudahkan audit dan troubleshooting.
4. Menjaga penggunaan kuota Apps Script dan GitHub API tetap aman.

## 3. Non-Sasaran
- Tidak membuat embedding aktual di GAS (placeholder vector saja).
- Tidak memproses repositori privat atau membutuhkan scope write.
- Tidak melakukan crawling mendalam seluruh repo dalam satu run.

## 4. Lingkungan & Asumsi
- **Qdrant**: URL dan nama koleksi dikonfigurasi lewat Script Properties (mis. `https://contoh-qdrant.com`, `koleksi_anda`).
- **Konfigurasi vektor**: Mendukung single vector atau named vectors; skrip mengandalkan ukuran vektor positif yang dilaporkan oleh koleksi dan default nama `sentence-transformers/all-MiniLM-L6-v2` bila tersedia.
- **GitHub API**: Menggunakan Personal Access Token (PAT) dengan hak baca repo publik.
- **Zona waktu**: Proyek GAS diset ke `Asia/Jakarta`.

## 5. Siklus Eksekusi
1. Mode produksi (`tick()`) dijadwalkan otomatis berdasarkan Script Properties (`TRIGGER_DAILY_HOUR` default 01:00 WIB dan `TRIGGER_INTERVAL_MINUTES` default 15).
2. Mode uji kontinu (`tickTest()`) menjalankan pipeline berulang hingga batas waktu `TEST_LOOP_MAX_RUNTIME_MS` atau eksekusi dihentikan manual.
3. Masing-masing eksekusi memperoleh lock untuk mencegah overlap.
4. Dilakukan preflight ke Qdrant untuk memastikan koleksi dan konfigurasi vektor siap.
5. Repositori dipilih via GitHub Search API dengan fallback agar selalu ada kandidat.
6. File dipilih dan diproses, log dicatat, cursor pencarian GitHub diperbarui.

## 6. Integrasi Eksternal
- **GitHub REST API**:
  - `/search/repositories` untuk menemukan repo populer dengan filter bahasa dan rentang waktu.
  - `/repos/{owner}/{repo}` dan `/branches/{branch}` untuk metadata cabang.
  - `/git/trees/{sha}?recursive=1` untuk daftar file.
  - Raw content diambil dari `https://raw.githubusercontent.com/...`.
- **Qdrant HTTP API**:
  - `GET /collections/{collection}` pada preflight.
  - `PUT /collections/{collection}/points?wait=true` untuk upsert.

## 7. Kebijakan Seleksi Repositori
- Maksimum repositori per run: default `2` (konfigurabel melalui Script Properties).
- Query utama: bahasa `python/javascript/go`, filter stars > 1000 dan pushed dalam 7 hari, dengan fallback semakin longgar.
- Jika GitHub tidak mengembalikan hasil, gunakan daftar kurasi repo populer sebagai cadangan.
- Cursor pencarian disimpan di `LAST_SEARCH_CURSOR`; jika run kosong, cursor di-reset agar tidak macet.

## 8. Kebijakan Seleksi File
- Ekstensi yang diproses: `.py`, `.js`, `.go`.
- Folder yang dihindari (termasuk nested): `test`, `tests`, `examples`, `dist`, `node_modules`, `vendor`.
- Ukuran file mentah maksimum: `MAX_FILE_SIZE_BYTES` (default 65.536 byte).
- Maksimum file per repo per run: `MAX_FILES_PER_REPO` (default 6).
- Skor prioritas: README, folder `src/`, `lib/`, `core/`, dan nama file yang mengandung `main`, `index`, `utils`, `config`, `router`, `service`.

## 9. Proses Chunking & Payload
- Setiap file dipotong menjadi chunk berukuran `CHUNK_SIZE_CHARS` (default 3000) dengan overlap `CHUNK_OVERLAP_CHARS` (default 200).
- Payload setiap point mencakup metadata repo, path file, bahasa, indeks chunk, URL sumber/raw, dan timestamp ISO.
- Placeholder vector dihasilkan dengan panjang sesuai dimensi koleksi (fallback 384 bila metadata tidak tersedia).
- Point ID berupa UUID deterministik berdasar hash `repo_fullname|commit_sha|file_path|chunk_idx`.

## 10. Upsert ke Qdrant
- Points dikirim per file dalam irisan maksimal 50 item untuk menjaga ukuran payload.
- HTTP status 2xx dianggap berhasil; 408/5xx di-retry sekali setelah `Utilities.sleep(2000)`.
- Dedup key disimpan hanya jika seluruh irisan untuk file tersebut sukses.

## 11. Logging
- Spreadsheet `QdrantFeedLogs`, sheet `logs` dengan kolom:
  1. timestamp (ISO + timezone)
  2. repo
  3. file_path
  4. size_bytes
  5. chunk_idx/total
  6. point_id
  7. qdrant_http_status
  8. qdrant_result_points_upserted
  9. error_message
  10. elapsed_ms
- Satu baris per chunk; run summary ditambahkan di akhir untuk total poin dan repo.

## 12. Error Handling
- Preflight gagal: run dihentikan, log run-level ditambahkan, cursor tidak maju.
- `pickRepos()` error: log run-level lalu keluar.
- `fetchRaw()` gagal atau ukuran melewati batas: baris log dengan pesan error, file dilewati.
- GitHub rate limit (403): run berhenti, log berisi pesan `GitHub 403 rate limit`.
- Dedup: jika key sudah ada, baris log dengan `dedup-skip`.

## 13. Konfigurasi via Script Properties
| Key                    | Default / Catatan                                               |
|------------------------|-----------------------------------------------------------------|
| `GITHUB_PAT`           | **Wajib**; PAT read-only repos publik                           |
| `QDRANT_API_KEY`       | **Wajib**                                                       |
| `QDRANT_URL`           | Isi dengan URL Qdrant milik Anda                                |
| `QDRANT_COLLECTION`    | Isi dengan nama koleksi Qdrant target                          |
| `MAX_REPOS_PER_RUN`    | Default `2`                                                     |
| `MAX_FILES_PER_REPO`   | Default `6`                                                     |
| `MAX_FILE_SIZE_BYTES`  | Default `65536`                                                 |
| `CHUNK_SIZE_CHARS`     | Default `3000`                                                  |
| `CHUNK_OVERLAP_CHARS`  | Default `200`                                                   |
| `TRIGGER_AUTO_INSTALL` | Default `true`; set `false` bila ingin kelola trigger manual    |
| `TRIGGER_DAILY_HOUR`   | Default `1`; jam 0–23 untuk trigger harian                      |
| `TRIGGER_INTERVAL_MINUTES` | Default `15`; pilih 1/5/10/15/30 menit                      |
| `TEST_LOOP_MAX_RUNTIME_MS` | Default `280000`; batas durasi `tickTest()` per eksekusi    |
| `TEST_LOOP_SLEEP_MS`       | Default `0`; jeda antar iterasi `tickTest()`                |
| `LAST_SEARCH_CURSOR`   | Diset otomatis                                                  |

## 14. Acceptance Criteria
1. Mode produksi: trigger aktif sesuai kombinasi `TRIGGER_DAILY_HOUR` dan `TRIGGER_INTERVAL_MINUTES`, tanpa konflik lock.
2. Mode uji: `tickTest()` mampu menjalankan beberapa siklus berturut sesuai `TEST_LOOP_MAX_RUNTIME_MS`.
3. Setiap run menghasilkan minimal satu baris sukses dengan `qdrant_http_status` 2xx (jika repo/file tersedia).
4. Dedup mencegah pengiriman ulang chunk yang sama pada run berikutnya.
5. Qdrant menerima data (konfirmasi via `points_count` bertambah).
6. Log ringkas run summary tersedia guna memantau total poin yang dikirim.

## 15. Rencana Peningkatan (Opsional)
- Menambahkan dukungan bahasa lain dengan scoring tambahan.
- Menjalankan job terpisah untuk mengganti placeholder vector dengan embedding aktual.
- Menyediakan dashboard monitoring sheet atau Data Studio.

## 16. Referensi
- Implementasi terkini: [`Code.gs`](Code.gs)
- Panduan pengguna awam: [`README.md`](README.md)
