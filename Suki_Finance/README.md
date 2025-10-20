## Suki Finance Tracker

Aplikasi Apps Script ini memudahkan pencatatan pemasukan/pengeluaran lewat teks natural **dan** foto struk. Frontend kini mengikuti desain **Luminous Dashboard** (lihat `design-prompt.md`), dengan DNA visual modern, premium, dan responsif. Backend tetap di `Code.gs`, data disimpan di sheet `transaksi`.

### Pembaruan Desain Frontend
- UI mendapat sentuhan **Luminous Flow**: kartu berlapis gradien, highlight blur, chip interaktif, dan shadow floating yang terasa premium.
- **Light & Dark mode** kini berpindah mulus berkat animasi transisi global, preferensi tetap tersimpan di `localStorage`.
- Palet utama memadukan indigo #6366f1, cyan #0ea5e9, dan aksen magenta lembut; gradien harian diacak untuk menjaga tampilan segar.
- Layout card-driven yang responsif (mobile–desktop), hero dengan badge status, toast kaca buram, dan daftar transaksi yang hidup dengan hover micro-interaction.
- Semua kontrol memiliki state fokus/hover jelas, microcopy emoji tetap hadir, dan komponen baru menjaga keterbacaan di kedua tema.

### Yang baru
- Tombol **Upload Struk** untuk pemasukan & pengeluaran.
- Gambar otomatis dikompresi (maks 1200px, < 8 MB) sebelum dikirim.
- Gemini 2.5 melakukan OCR -> OpenRouter (model gratis) mem-parsing item dan memasukkannya ke Google Sheet per baris.
- UI responsif mobile → desktop, toast helper, dan statistik kilat dalam kartu warna.

### Setup cepat (awam friendly)
1. **Duplikasi sheet & Apps Script** ini ke akun Google kamu seperti biasa.
2. Buka menu **Project Settings → Script properties** lalu tambahkan:
   - `GEMINI_API_KEY` : API key dari [Google AI Studio](https://aistudio.google.com/). Paket Maker gratis cukup untuk uji coba.
   - `OPENROUTER_API_KEY` : API key dari [OpenRouter](https://openrouter.ai/). Pilih model gratis.
   - Opsional: `GEMINI_MODEL` (default `gemini-2.5-flash`) dan `OPENROUTER_MODEL` (default `z-ai/glm-4.5-air:free`) jika ingin ganti model.
3. Deploy ulang web app (Publish -> Deploy as web app) agar frontend terbaru aktif.
4. Uji tombol teks biasa. Jika sudah masuk sheet, coba unggah struk kecil (foto jelas, tegak, maksimal 8 MB).

### Cara kerja upload struk
1. Browser mengecilkan foto jadi JPEG +/- 1200px supaya hemat kuota & batas Apps Script.
2. Gambar + prompt dikirim ke Gemini -> menghasilkan teks baris-per-baris.
3. Teks ditransformasikan OpenRouter menjadi JSON `{ item, amount, category }`.
4. Backend menebalkan data, melengkapi kategori jika kosong, lalu menulis banyak baris ke sheet dan refresh ringkasan.

### Tips penggunaan
- Foto tegak lurus, tanpa blur, latar kontras.
- Gunakan cahaya terang; hindari lipatan/terpotong.
- Jika parser gagal, baca `rawText` yang dilampirkan di tanggapan web (toast error) untuk koreksi manual.
- Besarkan kuota atau ganti model di Script Properties bila sering mentok limit.

### Troubleshooting cepat
- **Error key**: pastikan properti `GEMINI_API_KEY` & `OPENROUTER_API_KEY` sudah di-set dan tidak ada spasi.
- **Quota**: cek dashboard AI Studio / OpenRouter; gunakan foto lebih kecil atau jadwalkan ulang.
- **Item tidak lengkap**: biasanya karena struk buram. Foto ulang atau periksa `warnings` di Apps Script logger.
- **Masih ingin input manual?** Tombol teks lama tetap jalan, tinggal ketik `keluar kopi 16rb, sabun 10rb`.

### Pengujian lokal
Jika ingin memastikan normalisasi nominal & builder struk tetap aman tanpa memanggil API eksternal, jalankan perintah Node berikut:

```bash
node <<'NODE'
const fs = require('fs');
const vm = require('vm');
const sandbox = {
  console,
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => null })
  },
  UrlFetchApp: { fetch: () => { throw new Error('fetch should not be called during tests'); } },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (str) => ({ setMimeType: () => ({}) }) },
  HtmlService: {
    createHtmlOutputFromFile: () => ({
      setTitle: () => ({ setXFrameOptionsMode: () => ({}) }),
      setXFrameOptionsMode: () => ({})
    }),
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({ getSheetByName: () => null, insertSheet: () => ({}) })
  },
  Utilities: {
    formatDate: () => '01-01-2024 00:00'
  }
};
vm.createContext(sandbox);
try {
  const code = fs.readFileSync('Code.gs', 'utf8');
  vm.runInContext(code, sandbox);
} catch (err) {
  console.error('Failed to evaluate Code.gs', err);
  process.exit(1);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error('Assertion failed:', message, 'expected', expected, 'got', actual);
    process.exit(1);
  }
}
function assert(condition, message) {
  if (!condition) {
    console.error('Assertion failed:', message);
    process.exit(1);
  }
}
const normalize = sandbox.normalizeAmountValue_;
assertEqual(normalize('Rp 16.000'), 16000, 'normalize should parse rupiah string');
assertEqual(normalize('12rb'), 12000, 'normalize should parse rb');
assertEqual(normalize(5000.4), 5000, 'normalize should round numbers');
const rowsInfo = sandbox.buildRowsFromParsed_('keluar', [
  { item: 'kopi susu', amount: 15000 },
  { item: 'sabun cair', amount: 'Rp 12.000' },
  { item: '', amount: 1000 }
]);
assert(Array.isArray(rowsInfo.rows), 'rowsInfo.rows should be array');
assertEqual(rowsInfo.rows.length, 2, 'should skip invalid item');
assert(rowsInfo.skipped.length >= 1, 'should record skipped items');
console.log('Tests passed');
NODE
```
Perintah tersebut memuat `Code.gs` di dalam sandbox dan menguji `normalizeAmountValue_` serta `buildRowsFromParsed_`.

---

### Catatan Desain
- Frontend mengikuti brief di `design-prompt.md` agar konsisten dengan estetika Luminous Flow (gradien berlapis, blur glow, dan kartu floating).
- Struktur panel / kartu boleh diganti sesuai domain, asalkan mempertahankan DNA: highlight gradien, shadow lembut, tipografi rapih, dan microcopy emoji.
- Detail referensi visual (palet, elevation, tone) tersedia di `design-prompt.md`.

Selamat mencoba! Jika ada kebutuhan tambahan (misal simpan gambar ke Drive), tinggal tambahkan di `processReceiptUpload` sebelum baris `appendTransactions_`.
