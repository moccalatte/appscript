# prd.md — Apps Script Bot: Auto-Formula Daily BaZi Overview (Gemini ⇄ OpenRouter GLM)

## 1) Ringkasannya

Bot Google Apps Script yang:

* Mengirim **prompt BaZi harian** ke **Gemini** (≤700 chars).
* **Mendeteksi keyword persis `"Xin You"`** pada jawaban Gemini.
* **Selalu mencatat log** ke Google Sheet (berhasil/gagal, prompt, respons).
* Jika **tidak ada keyword**, bot **meminta OpenRouter (GLM ZAI / `z-ai/glm-4.5-air:free`) untuk “improve prompt”** → kirim prompt hasil perbaikan itu ke Gemini lagi.
* **Loop** sampai kuota habis / rate-limit.
* **Backoff**: delay 1 menit antar request normal; **5 menit** saat rate-limit.
* Jika kuota benar-benar habis, **berhenti** dan **kirim pesan** ke Discord Webhook.

> Catatan: Walau keyword ditemukan, bot **tetap mencatat** (sampai kuota habis), sesuai permintaan.

---

## 2) Tujuan & Non-Tujuan

**Tujuan**

* Mendapat **daily BaZi overview akurat** dari Gemini dengan bantuan **prompt refinement** via OpenRouter bila perlu.
* Menjaga **jejak audit** lengkap: setiap prompt & respons tercatat, termasuk status dan penyebab retry.

**Non-Tujuan**

* Tidak menghitung chart BaZi secara matematis (input chart manual).
* Tidak melakukan interpretasi Feng Shui lokasi fisik (hanya teks overview).

---

## 3) Input Tetap (Default Prompt)

Prompt dasar ke **Gemini** (≤700 chars; bot akan **truncate aman** bila melebihi):

```
You’re an expert BaZi practitioner. Compare this natal chart with the target date and give a concise daily overview (<500 chars).

Birth Time: 07:05 (Asia/Jakarta)
Birth Date: 03-03-2000. Gender: Male

Hour: Yang Earth [戊, wu], Dragon [辰, chen]
Day:  Yang Metal [庚, geng], Monkey [申, shen]
Month:Yang Earth [戊, wu], Tiger [寅, yin]
Year: Yang Metal [庚, geng], Dragon [辰, chen]

Only discuss the day pillar for 19 Oct 2025: possibilities, energy flow, and self-state.
```

**Target keyword** yang wajib dicari di jawaban Gemini: **`Xin You`** (harus **persis**).

---

## 4) Output yang Diharapkan

* **Respons teks** dari Gemini (≤500 chars sesuai permintaan prompt), kemudian **flag `foundXinYou`** = true/false.
* Jika false → minta **improved prompt** dari OpenRouter GLM (≤700 chars) → kirim ulang ke Gemini.
* **Google Sheet Log**: setiap langkah (Gemini / OpenRouter) terekam.
* **Discord Webhook**: kirim notifikasi **berhenti** saat kuota habis atau error fatal.

---

## 5) Arsitektur Alur

1. **runProduction()** (loop hingga kuota/rate limit stop)

   * **buildPrompt()** (versi awal atau versi improve)
   * **callGemini()** → **checkKeyword("Xin You")**
   * **logRow()** ke Sheet
   * Jika **tidak ditemukan**:

     * **callOpenRouterImprove(originalPrompt, lastGemini)** → dapat **improvedPrompt (≤700)**
     * **sleep(60s)**
     * Ulangi callGemini(improvedPrompt)
   * **sleep(60s)** antar respons biasa
   * Jika **rate limit** (429, resourceExhausted, “quota”, “rate limit”) → **sleep(5m)**, lanjut
   * Jika **exhausted/kuota habis** (pola error tertentu) → **kirim Discord** & **stop**
2. **testOnce()** menjalankan satu siklus pendek untuk verifikasi koneksi & logging.

---

## 6) Tabel Google Sheet (auto-create)

**Spreadsheet Name**: `bazi_daily_logs` (jika belum ada → buat)
**Sheet Name**: `logs`
**Header (kolom A→N)**:

1. `timestamp` (ISO)
2. `runId` (UUID pendek per eksekusi runProduction)
3. `provider` (`gemini` | `openrouter`)
4. `model` (`gemini-1.5-flash` default | `z-ai/glm-4.5-air:free`)
5. `attempt` (int, mulai 1)
6. `promptUsed` (string; disingkat ≤1500 untuk log)
7. `responseRaw` (string; disingkat ≤2500)
8. `foundXinYou` (true/false/null)
9. `status` (`ok` | `no_keyword` | `improved` | `rate_limited` | `quota_exhausted` | `error`)
10. `httpStatus` (int/null)
11. `errorCode` (string/null)
12. `errorMessage` (string/null)
13. `tokensOrUsage` (opsional dari header)
14. `note` (catatan kecil — misalnya “retry after 5m”)

---

## 7) Script Properties (Apps Script → Project Properties)

* `GEMINI_API_KEY`
* `OPENROUTER_API_KEY`
* `DISCORD_WEBHOOK_URL`
* `SHEET_NAME` = `logs` (opsional override)
* `SPREADSHEET_NAME` = `bazi_daily_logs` (opsional override)
* `OPENROUTER_MODEL` = `z-ai/glm-4.5-air:free`
* `GEMINI_MODEL` = `gemini-1.5-flash`
* `TARGET_DATE` = `2025-10-19` (ISO; dapat diubah harian)
* `MAX_LOOPS` = `999` (batas pengulangan per run)
* `PAUSE_MS_NORMAL` = `60000` (1 menit)
* `PAUSE_MS_RATELIMIT` = `300000` (5 menit)
* `KEYWORD` = `Xin You`

---

## 8) Deteksi Rate-Limit & Kuota Habis

**Rate-limit** (tangani dengan **sleep 5 menit**, lalu lanjut):

* HTTP **429**
* Pesan berisi: `rate limit`, `Too Many Requests`, `resourceExhausted`, `exceeded your current quota`, `Quota exceeded`

**Kuota habis (stop total + Discord)**:

* Gemini/OpenRouter mengembalikan error spesifik kuota yang **persisten** setelah minimal **3 kali retry** berjarak 5 menit
* Pesan error eksplisit: `"quota exhausted"`, `"billing hard limit"`, `"insufficient tokens/credit"`

> Implementasi: counter `hardStopStrikes`. Jika ≥3 pada jenis error kuota → **stop**.

---

## 9) Spec Fungsi Utama

* `testOnce()`
  Menjalankan 1 siklus: build prompt → callGemini → cek keyword → log → bila gagal, panggil openrouter improve sekali → kirim ke Gemini → log.

* `runProduction()`
  Loop: hingga **MAX_LOOPS** atau **stop condition** (kuota habis). Delay 1 menit antar call normal, 5 menit saat rate-limit.

* `ensureSheet()`
  Membuat spreadsheet & sheet + header bila belum ada.

* `buildBasePrompt(targetDateISO)`
  Menghasilkan prompt awal (≤700 chars; melakukan **sanitize & shrink**).

* `buildImprovePrompt(basePrompt, lastGeminiResp)`
  Prompt untuk OpenRouter (≤700 chars), meminta model mengembalikan **versi prompt yang lebih tajam** untuk menghasilkan jawaban Gemini yang memuat konteks day pillar dan akurasi BaZi.
  **Contoh isi ringkas**:

  ```
  Improve this BaZi prompt for accuracy and clarity (<=700 chars). Target: daily day-pillar overview (possibilities, energy flow, self-state) under 500 chars. Ensure classical BaZi terminology and avoid generic platitudes.
  Base:
  "<basePrompt>"
  Last Gemini output:
  "<lastRespSnippet>"
  Return only the improved prompt.
  ```

* `callGemini(prompt)`
  URLFetchApp → `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  Body: `{ contents:[{ role:"user", parts:[{text: prompt}]}] }`
  Parse text dari candidates. Tangani 429 / error.

* `callOpenRouterImprove(basePrompt, lastGeminiResp)`
  POST `https://openrouter.ai/api/v1/chat/completions`
  Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `HTTP-Referer`, `X-Title` (isi nama bot)
  Body minimal:

  ```
  {
    "model": "z-ai/glm-4.5-air:free",
    "messages": [
      {"role":"system","content":"You are a precise prompt editor for BaZi tasks."},
      {"role":"user","content":"<improve prompt instruction + base + lastResp>"}
    ],
    "temperature": 0.3
  }
  ```

  Return string improved prompt (≤700; dipotong aman).

* `containsKeyword(text, keyword)`
  Match **persis** `"Xin You"` (case sensitive).
  **Tidak** menggunakan regex longgar.

* `logRow(obj)`
  Menulis satu baris log sesuai header.

* `notifyDiscordStop(reason)`
  POST JSON ke `DISCORD_WEBHOOK_URL`. Misal:

  ```
  {
    "username": "BaZi Bot",
    "content": "🛑 Bot stopped: " + reason
  }
  ```

* `sleep(ms)`
  Pembungkus `Utilities.sleep(ms)`.

---

## 10) Keamanan & Kualitas

* Simpan **API keys** di **Script Properties**, bukan hard-coded.
* **Sanitize logging**: batasi panjang prompt/response saat log; jangan log API keys.
* **Timeout & Retry**: set `muteHttpExceptions:true`, tangani timeout → retry linear (max 3).
* **Determinisme**: `temperature` rendah untuk **OpenRouter improve**; Gemini biarkan default/0.2 agar konsisten.

---

## 11) README — Setup & Jalankan

### A. Prasyarat

* Akun Google & akses Google Apps Script.
* **API Key Gemini** (Google AI Studio).
* **API Key OpenRouter**.
* **Discord Webhook URL** (untuk notifikasi stop).

### B. Langkah Setup

1. Buat proyek baru di **script.google.com**.
2. Tempelkan file kode utama (nanti pada implementasi; PRD ini mendahului kode).
3. **Project Settings → Script properties**: isi semua properti pada Bagian 7.
4. **Deploy →** tidak perlu web app (bot jalan via trigger).
5. **Buat Trigger** (optional untuk produksi):

   * `runProduction` → Time-driven → **minutely** (set frekuensi sesuai kuota).
   * Atau jalankan manual.

### C. Uji Jalan

1. Jalankan `testOnce()` dari editor.
2. Buka spreadsheet `bazi_daily_logs` → periksa sheet `logs`.
3. Pastikan ada 1–2 baris log (Gemini + mungkin OpenRouter improve).
4. Jika sukses, jalankan `runProduction()` manual atau aktifkan trigger.

### D. Produksi

* Pastikan `TARGET_DATE` benar (ISO).
* Pantau `logs` untuk status `no_keyword` atau `improved`.
* Jika bot berhenti, cek Discord untuk alasan stop.

---

## 12) Acceptance Criteria

* [ ] Sheet `bazi_daily_logs` + `logs` tercipta otomatis dengan header benar.
* [ ] `testOnce()` menghasilkan minimal 1 baris log Gemini.
* [ ] Saat `Xin You` **tidak** ditemukan, terjadi panggilan OpenRouter → prompt improve → kirim ulang ke Gemini → kedua respons tercatat.
* [ ] Delay 60s antar request normal; 5m saat rate-limit.
* [ ] Pada error kuota persisten (≥3 kali), bot **stop** dan **kirim Discord**.
* [ ] Prompt ke Gemini **≤700 chars**; improved prompt OpenRouter juga **≤700 chars**.
* [ ] `runProduction()` menghormati `MAX_LOOPS`.

---

## 13) Edge Cases & Penanganan

* **Gemini balas kosong / struktur tak terduga** → log `error`, retry 1x; jika gagal lagi, lanjut ke improve flow.
* **OpenRouter balas terlalu panjang** → **truncate** ke ≤700 sebelum kirim ke Gemini.
* **Keyword muncul sebagai bagian kata** (misal “Xin You’re…”) → **tidak valid**; harus persis `"Xin You"` dengan spasi tepat (case sensitive).
* **Network intermittent** → retry hingga 3x, lalu teruskan alur.
* **Discord webhook gagal** → log error, tapi tetap stop.

---

## 14) Roadmap (Opsional)

* Multi-keyword support (mis. `Xin You`, `Xin Chou`, dsb).
* Otomasi penentuan **day pillar** by tanggal (lokal Asia/Jakarta).
* Model fallback lain (Qwen3-30B-A3B:free, DeepSeek Chat free) bila GLM tidak tersedia.
* Export ringkasan harian ke Discord dengan embed.

---
