# 🚀 Deployment & Verification — Suki Finance Tracker

This guide helps you deploy and verify the Apps Script fullstack finance tracker built in [Code.gs](Code.gs) and [index.html](index.html), following the PRD in [prd.md](prd.md). It includes UI, backend, colorful Sheet formatting, responsive mobile layout, and REST-style GET/POST endpoints.

## ✅ What You Get

- Flat, calming Google Sheet palette (soft header, light backgrounds, conditional formatting).
- Asia/Jakarta timestamps (display: `dd-MM-yyyy HH:mm`).
- Responsive frontend (mobile-friendly), buttons:
  - "💸 Catat Pengeluaran"
  - "💰 Catat Pemasukan"
  - Refresh, Clear, Theme Toggle (light/dark)
- Live summary cards:
  - Saldo Berjalan
  - Pemasukan Bulan Ini
  - Pengeluaran Bulan Ini
  - Total Hari Ini
- Filter transaksi by kategori, with emoji icons.
- REST-style endpoints:
  - GET summary: `?api=summary`
  - GET list: `?api=list&limit=...&category=...`
  - POST create: JSON payload `{ rawText, direction? }`

> Catatan: Sheet kolom sederhana tanpa kolom yang tidak perlu (tidak menampilkan user email/source). Kolom utama: `timestamp | direction | item | amount | category`, dengan baris ringkasan otomatis di bagian paling bawah (`total_pengeluaran`, `total_pemasukan`, `saldo`, dll).

---

## 📦 Prerequisites

- Google account with access to Google Sheets.
- A new or existing Google Sheet to bind the script.
- Optional: Gemini API key (for future AI fallback).

---

## 🛠️ Setup (Bound Script in Google Sheets)

1. Buka Google Sheet (buat baru, namakan bebas).
2. Menu: Extensions → Apps Script.
3. Buat file:
   - Paste backend ke [Code.gs](Code.gs).
   - Paste frontend ke [index.html](index.html).
4. Simpan.

> Wajib: Proyek ini adalah **bound script**. Backend memakai `SpreadsheetApp.getActiveSpreadsheet()`, sehingga script harus diikat (bound) ke sebuah Sheet.

---

## 🎨 Sheet Formatting (Auto)

Pada run pertama, backend akan:
- Membuat sheet bernama `transaksi` jika belum ada.
- Menyetel header dan format angka (Rp) serta timestamp dengan pola `dd-MM-yyyy hh:mm`.
- Menambahkan conditional formatting flat-tone untuk kolom `direction` (masuk/keluar).
- Mengaplikasikan palet warna lembut (header biru-abu, latar data putih, ringkasan vertikal).

Semua dihandle oleh [`function ensureSheet_()`](Code.gs:171) dan [`function formatSheetOnce_()`](Code.gs:205).

---

## 🌐 Web App Deployment

1. Di Apps Script editor:
   - Deploy → New Deployment → Type: Web App.
2. Settings:
   - Execute as: Me.
   - Access: Anyone with the link (atau Only myself jika ingin private).
3. Copy Web App URL (contoh: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`).

Frontend served oleh [`function doGet()`](Code.gs:30) yang mengembalikan [index.html](index.html).

---

## 🔑 Optional: Gemini API Key

Jika ingin mengaktifkan fallback AI nanti:
- Script Properties → Add:
  - Key: `GEMINI_API_KEY`
  - Value: `<your_api_key>`

Fungsi placeholder: [`function tryGeminiFallback_()`](Code.gs:545). Saat ini tidak diaktifkan dalam parsing default.

---

## 🔍 Verify Data Flows (Step-by-Step)

### A. UI Flow

1. Buka Web App URL di browser/HP.
2. Masukkan contoh input:
   - `keluar kopi 16rb, sabun 10rb`
   - `masuk gaji 10jt`
3. Klik:
   - "💸 Catat Pengeluaran" untuk transaksi keluar.
   - "💰 Catat Pemasukan" untuk transaksi masuk.
4. Lihat:
   - Toast sukses.
   - Ringkasan update (Saldo, Bulanan, Total Hari Ini).
   - Daftar Transaksi (5 terakhir) dengan emoji kategori.
5. Coba filter kategori pada dropdown, klik "Terapkan".

Tombol di frontend memanggil backend via `google.script.run`:
- Simpan: [`function recordTransactions()`](Code.gs:79)
- Ringkasan: [`function getSummary()`](Code.gs:162)
- List: [`function listTransactions()`](Code.gs:140)

UI handlers: [`function submit()`](index.html:258), [`function refreshSummary()`](index.html:196), [`function refreshList()`](index.html:214).

### B. REST Endpoints (External GET/POST)

Assume Web App URL = `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

- GET Summary:
  - `GET https://script.google.com/macros/s/DEPLOYMENT_ID/exec?api=summary`
- GET List (limit + category):
  - `GET https://script.google.com/macros/s/DEPLOYMENT_ID/exec?api=list&limit=5&category=Tagihan`
- POST Create (JSON):
  - `POST https://script.google.com/macros/s/DEPLOYMENT_ID/exec`
  - Headers: `Content-Type: application/json`
  - Body:
    ```json
    { "rawText": "keluar kopi 16rb, sabun 10rb", "direction": "keluar" }
    ```

Contoh cURL:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"rawText":"masuk gaji 10jt","direction":"masuk"}' \
  "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
```

REST handler: [`function doPost()`](Code.gs:54), JSON response via [`function jsonOut_()`](Code.gs:572).

---

## 🧮 Data Schema

Sheet: `transaksi`

Kolom (header otomatis):
- `timestamp` (Date)
- `direction` ("masuk" | "keluar")
- `item` (string)
- `amount` (number, Rp format)
- `category` (string)

Ringkasan permanen (selalu ada satu baris kosong memisahkan dari data, ditulis vertikal `label : nilai` di kolom A-B):
- `total_pengeluaran`
- `total_pemasukan`
- `saldo`
- `pemasukan_bulan_ini`
- `pengeluaran_bulan_ini`
- `pemasukan_hari_ini`
- `pengeluaran_hari_ini`
- `total_hari_ini`

Header kolom otomatis memiliki filter bawaan (range data saja) untuk memudahkan sortir.

Parsing angka: [`function parseAmount_()`](Code.gs:494) mendukung format `16k`, `16rb`, `16 ribu`, `5.2jt`, `16000`, `16.000`.

Kategori heuristik: [`function guessCategory_()`](Code.gs:532), emoji di UI sesuai kategori.

---

## 📱 Responsive & Neobrutalism

- Grid collapse di layar kecil.
- Border tebal (4px), shadow offset.
- Randomized accent colors per hari.
- Tema toggle (light/dark) disimpan di `localStorage`.

Semua styling ada di [index.html](index.html).

---

## 🧪 Quick Test Script (Apps Script Console)

Gunakan editor Apps Script → Run (bound script) untuk uji cepat:

```js
// Catat transaksi keluar
recordTransactions('keluar kopi 16rb, sabun 10rb', 'keluar');

// Catat transaksi masuk
recordTransactions('masuk bonus 1jt', 'masuk');

// Cek ringkasan
getSummary();

// Cek list
listTransactions(10, 'Makanan & Minuman');
```

> Pastikan sheet `transaksi` sudah terbentuk otomatis oleh [`ensureSheet_()`](Code.gs:171).

---

## 🧰 Troubleshooting

- Error "No active spreadsheet":
  - Pastikan script **bound** ke sebuah Google Sheet (Extensions → Apps Script dari dalam Sheet).
- Timestamp tidak sesuai:
  - Spreadsheet timezone akan di-set ke `Asia/Jakarta` otomatis; pastikan format kolom A adalah `dd-MM-yyyy hh:mm`.
- Tidak ada data di UI:
  - Coba input contoh dan klik tombol sesuai (keluar/masuk).
  - Gunakan tombol Refresh untuk menarik ulang ringkasan + list.
- POST tidak masuk:
  - Pastikan header `Content-Type: application/json`.
  - Pastikan field `rawText` ada, dan `direction` optional (`masuk`|`keluar`).

---

## 🔒 Security

- Untuk akses terbatas, saat deploy pilih:
  - Execute as: Me
  - Access: Only myself
- Untuk integrasi perangkat lain, gunakan "Anyone with link" dan batasi URL.

---

## 📚 References

- Frontend UI: [index.html](index.html)
- Backend Entrypoints: [`function doGet()`](Code.gs:30), [`function doPost()`](Code.gs:54)
- Core Logic: [`function recordTransactions()`](Code.gs:79), [`function listTransactions()`](Code.gs:140), [`function getSummary()`](Code.gs:162)
- Sheet Setup: [`function ensureSheet_()`](Code.gs:171), [`function formatSheetOnce_()`](Code.gs:205)
- Parsing: [`function parseAmount_()`](Code.gs:494), [`function guessCategory_()`](Code.gs:532)

---

## ✅ Done

Setelah mengikuti langkah-langkah di atas, proyek web app akan:
- Menyediakan UI colorful, responsif, dengan tombol berfungsi.
- Terkoneksi ke Sheet + backend secara real-time.
- Menyediakan endpoint GET & POST untuk integrasi tambahan.

Siap digunakan di browser dan mobile web.
