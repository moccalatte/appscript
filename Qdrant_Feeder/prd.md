# Qdrant Feeder Apps Script — Product Requirements Document (PRD)

## 1. Ringkasan Produk
- **Tujuan:** Otomatisasi pengambilan dan pengiriman potongan kode dari repo GitHub populer ke Qdrant sebagai knowledge base.
- **Lingkungan:** Google Apps Script, Qdrant, Spreadsheet Google untuk log dan dedup.
- **Output:** Points di koleksi Qdrant, log granular di spreadsheet.

## 2. Sasaran Utama
1. Mengirim file `.py`, `.js`, `.ts`, `.go` dari repo populer secara bertahap dan stabil.
2. Dedup berbasis key `repo_fullname@blob_sha:path` (sheet utama: `awesome_dedup`).
3. Logging detail per chunk dan event dedup ke sheet `logs`.
4. Menjaga penggunaan kuota Apps Script dan GitHub API tetap aman.

## 3. Scope & Non-Scope
- **Scope:** Repo publik, chunking file, logging, dedup, trigger otomatis/manual.
- **Non-Scope:** Embedding aktual (hanya placeholder vector), crawling seluruh repo, repo privat.

## 4. Konfigurasi & Lingkungan
- **Qdrant:** URL, API key, dan nama koleksi dikonfigurasi via Script Properties.
- **GitHub:** Personal Access Token (PAT) read-only untuk repo publik.
- **Spreadsheet:** `QdrantFeedLogs` untuk log (`logs`) dan dedup (`awesome_dedup`).
- **Zona waktu:** Default `Asia/Jakarta`.

## 5. Siklus Eksekusi
1. **Produksi:** Fungsi `prodAwesomeRun()` dijalankan otomatis via trigger (`TRIGGER_DAILY_HOUR`, `TRIGGER_INTERVAL_MINUTES`).
2. **Uji Coba:** Fungsi `testAwesomeRun()` untuk pengujian end-to-end.
3. **Lock:** Setiap run memperoleh lock untuk mencegah overlap.
4. **Preflight:** Validasi koleksi Qdrant dan vector config.
5. **Discovery:** Pilih repo via GitHub Search API atau daftar awesome (opsional), dengan riwayat repo untuk menghindari kandidat berulang dalam jangka pendek.
6. **File Selection:** Pilih file eligible, chunking, dedup, upsert ke Qdrant, logging.

## 6. Integrasi Eksternal
- **GitHub REST API:** Search repo, metadata, tree, raw content.
- **Qdrant HTTP API:** Preflight koleksi, upsert points.

## 7. Seleksi Repo & File
- **Repo:** Maksimum per run (`AWESOME_MAX_REPOS_PER_RUN`), filter bahasa utama (via `AWESOME_ALLOWED_LANGS_JSON`), bintang, waktu push, dan status riwayat (`awesome_repo_history`) agar repo yang sudah diproses (atau tidak punya chunk) dilewati sampai TTL berakhir.
- **File:** Ekstensi `.py`, `.js`, `.ts`, `.go`, folder yang dihindari, ukuran maksimum (`MAX_FILE_SIZE_BYTES`), prioritas file utama.

## 8. Chunking & Payload
- Chunk size (`CHUNK_SIZE_CHARS`), overlap (`CHUNK_OVERLAP_CHARS`).
- Payload: metadata repo, path, bahasa, chunk index, URL sumber/raw, timestamp ISO, placeholder vector.
- Point ID: UUID deterministik dari hash.

## 9. Upsert & Dedup
- Upsert per file dalam irisan ≤ 50 points.
- Dedup key hanya ditulis ke sheet setelah upsert sukses.
- Sheet `awesome_dedup` sebagai sumber utama dedup.

## 10. Logging & Observability
- Sheet `logs`: granular per chunk, event dedup, error, summary run.
- Sheet `awesome_dedup`: kunci dedup dan timestamp.
- Sheet `awesome_repo_history`: status terakhir setiap repo (processed, no-eligible-files, dedup-only, errors, skip-history) beserta commit SHA & timestamp.

## 11. Error Handling
- Preflight gagal: run dihentikan, log run-level.
- Discovery/file fetch gagal: log error, file dilewati.
- Rate limit GitHub: run berhenti, log error.
- Dedup: jika key sudah ada, log `dedup-skip`.

## 12. Konfigurasi via Script Properties
| Key                        | Default / Catatan                                 |
|----------------------------|---------------------------------------------------|
| `GITHUB_PAT`               | Wajib, PAT read-only repo publik                  |
| `QDRANT_API_KEY`           | Wajib                                             |
| `QDRANT_URL`               | Wajib, URL Qdrant                                 |
| `QDRANT_COLLECTION`        | Wajib, nama koleksi Qdrant                        |
| `AWESOME_MAX_REPOS_PER_RUN`| Default 5                                         |
| `AWESOME_MAX_FILES_PER_REPO`| Default 4                                        |
| `MAX_FILE_SIZE_BYTES`      | Default 65536                                     |
| `CHUNK_SIZE_CHARS`         | Default 3000                                      |
| `CHUNK_OVERLAP_CHARS`      | Default 200                                       |
| `TRIGGER_AUTO_INSTALL`     | Default true                                      |
| `TRIGGER_DAILY_HOUR`       | Default 1                                         |
| `TRIGGER_INTERVAL_MINUTES` | Default 15                                        |
| `VERBOSE_LOGGING`          | Default false                                     |
| `AWESOME_DEFAULT_LISTS_JSON`| Opsional, override daftar awesome                |
| `AWESOME_ALLOWED_LANGS_JSON`| Default `["python","javascript","typescript","go"]` |
| `AWESOME_SKIP_AWESOME_NAMED`| Default true, skip repo bernama `awesome-*`      |
| `AWESOME_HISTORY_SHEET_NAME`| Default `awesome_repo_history`                   |
| `AWESOME_HISTORY_EXPIRY_DAYS`| Default 30, TTL riwayat sebelum repo di-scan ulang |

## 13. Acceptance Criteria
1. Trigger berjalan otomatis/manual sesuai konfigurasi, tanpa konflik lock.
2. Setiap run menghasilkan minimal satu baris sukses di sheet `logs`.
3. Dedup mencegah pengiriman ulang chunk yang sama, dan riwayat repo memastikan kandidat yang sudah diproses tidak dipilih lagi sebelum TTL/commit berubah.
4. Qdrant menerima data (points_count bertambah).
5. Log summary tersedia untuk audit.

## 14. Best Practice & Next Steps
- Mulai dengan run kecil (`AWESOME_MAX_REPOS_PER_RUN=2`, `AWESOME_MAX_FILES_PER_REPO=2`).
- Aktifkan `VERBOSE_LOGGING` untuk debugging discovery.
- Simpan dedup di sheet, gunakan logs untuk observability.
- Untuk pengembangan: integrasi embedding nyata, monitoring sheet, migrasi cache dedup.

## 15. Referensi
- Implementasi: [`Code.gs`](Code.gs), [`awesome_integration.gs`](awesome_integration.gs)
- Dokumentasi pengguna: [`README.md`](README.md)
- Laporan pengecekan: [`check.md`](check.md)
