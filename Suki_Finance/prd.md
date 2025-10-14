# 📒 PRD — Suki Finance Tracker (Apps Script Only, Gemini-powered)

## 🧩 Overview
Sistem pencatat keuangan otomatis berbasis **Google Apps Script** dengan UI bergaya **neobrutalism** (colorful, playful, tegas, penuh emoji).  
Frontend dan backend berada dalam satu proyek Apps Script:
- **Frontend (HtmlService)**: form input + daftar transaksi + ringkasan total.
- **Backend (Code.gs)**: koneksi ke Google Sheet, parser angka & kategori, integrasi AI (Gemini 2.5 Flash) untuk memahami konteks transaksi secara cerdas.

Menggunakan Gemini API untuk OCR struk dan OpenRouter untuk parsing AI.
Gemini digunakan via **Gemini API key** untuk:
- OCR gambar struk menjadi teks baris-per-baris,
- memprediksi kategori transaksi,
- memahami konteks teks yang ambigu (“gojek 25rb” → kategori Transport).

OpenRouter digunakan untuk parsing teks OCR menjadi JSON terstruktur.

---

## 🧱 Arsitektur
```

User (browser)
↓
Apps Script Web App (HTMLService)
↓
Google Sheet (database transaksi)
↓
Gemini API (OCR struk) + OpenRouter API (parsing JSON)

```
📒 Catat Keuangan
────────────────────────────
[ Textarea input ]
[ Tombol Simpan 💾 ]
────────────────────────────
💰 Total Hari Ini: Rp xx.xxx
💸 Total Bulan Ini: Rp yy.yyy
────────────────────────────
🔍 Filter Kategori: [dropdown]
📋 Daftar Transaksi (5 terakhir)
────────────────────────────
© Suki Finance · v1
```

---

## 🧩 File Struktur

```
/appscript-project
├── Code.gs         → Backend logic (Sheet + Gemini + API)
└── index.html      → Frontend UI (HTMLService)
```

---

## 🧮 Pseudocode Backend (Code.gs)

```js
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('💸 Suki Finance Tracker');
}

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('transaksi');
  if (!sh) {
    sh = ss.insertSheet('transaksi');
    sh.appendRow(['timestamp','direction','item','amount','category']);
    // ringkasan akan ditulis di baris terbawah oleh helper terpisah
  }
  return sh;
}

function parseAmount_(s) {
  // 16k, 16rb, 16 ribu, 5.2jt → angka
  s = (''+s).toLowerCase().replace(/[.,]/g,'').trim();
  if (/jt|juta/.test(s)) return Math.round(parseFloat(s)*1_000_000);
  if (/rb|ribu|k/.test(s)) return Math.round(parseFloat(s)*1_000);
  if (!isNaN(Number(s))) return Number(s);
  return null;
}

function guessCategory_(text) {
  const t = text.toLowerCase();
  if (/(kopi|teh|minum|makan|nasi|roti)/.test(t)) return 'Makanan & Minuman';
  if (/(sabun|sampo|odol|tissue)/.test(t)) return 'Kebersihan';
  if (/(gojek|grab|bensin|tol)/.test(t)) return 'Transport';
  if (/(baju|celana|sepatu)/.test(t)) return 'Pakaian';
  if (/(listrik|wifi|air|pulsa)/.test(t)) return 'Tagihan';
  if (/(netflix|spotify|game)/.test(t)) return 'Hiburan';
  return 'Lainnya';
}

function recordExpense(rawText, userEmail) {
  const sh = ensureSheet_();
  const direction = rawText.startsWith('masuk') ? 'masuk' : 'keluar';
  const parts = rawText.replace(/^(masuk|keluar)\s*/i,'').split(',');
  const rows = [];
  const now = new Date();

  for (const p of parts) {
    const tokens = p.trim().split(' ');
    const amountStr = tokens.pop();
    const item = tokens.join(' ');
    const amt = parseAmount_(amountStr);
    if (!amt) continue;
    const cat = guessCategory_(item);
    rows.push([now, direction, item, amt, cat]);
  }

  if (rows.length) {
    sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
    refreshSummarySection_(sh); // baris total_pengeluaran / total_pemasukan update otomatis
  }
  return {ok:true,count:rows.length};
}

function classifyWithGemini_(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not set.');
  const prompt = `Analisis teks transaksi berikut, keluarkan JSON dengan field "direction", dan "items":[{"item","amount","category"}]. Teks: ${text}`;
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+apiKey, {
    method:'post',
    contentType:'application/json',
    payload: JSON.stringify({contents:[{parts:[{text:prompt}]}]}),
    muteHttpExceptions:true
  });
  return JSON.parse(res.getContentText());
}
```

---

## 🎯 User Flow

1. User buka URL Web App → tampil form neobrutalism.
2. Ketik input: `"keluar kopi 16rb, sabun 10rb"`.
3. Klik **💾 Simpan**:

   * Script parsing angka.
   * Jika input ambigu → kirim ke Gemini untuk interpretasi.
   * Hasil disimpan ke GSheet (amount numerik).
4. UI update daftar transaksi + total.
5. (Opsional) Filter kategori → update tampilan daftar.

---

## 🧭 Advanced Ideas (opsional untuk nanti)

* 🔔 Reminder harian via EmailApp: “Hari ini kamu keluar Rp...”
* 📈 Grafik bulanan langsung di frontend (pakai Chart.js CDN)
* 🧾 Export CSV tombol (download laporan)
* 💬 AI Insight: “Bulan ini pengeluaranmu naik 15% di kategori 🍔”
* 🌙 Dark Mode toggle persistent via localStorage
* 🔍 Search transaksi dengan keyword lokal

---

## 🪄 Deployment

1. Buka **Extensions → Apps Script**.
2. Paste `Code.gs` dan `index.html`.
3. Tambahkan Script Properties:

   * `GEMINI_API_KEY` → isi API key kamu.
4. Deploy:

   * **Deploy as Web App**
   * Execute as: *Me*
   * Access: *Anyone with link*
5. Selesai — buka link Web App di browser atau HP.

---

## 🧾 Kesimpulan

Proyek ini menjadikan Google Apps Script sebagai **fullstack lightweight finance tracker**, dengan:

* Visual penuh karakter (neobrutalism colorful),
* AI reasoning bawaan Gemini untuk interpretasi input manusiawi,
* Penyimpanan aman di Google Sheet pribadi,
* Performa ringan dan cocok dijalankan di browser atau ponsel.
