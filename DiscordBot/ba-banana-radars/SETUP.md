# 📋 SETUP Detail - Ba-ba-banana Radars

Panduan lengkap setup untuk advanced configuration & troubleshooting.

## 📖 Table of Contents

1. [Discord Developer Setup](#discord-developer-setup)
2. [Google Apps Script Setup](#google-apps-script-setup)
3. [Spreadsheet Configuration](#spreadsheet-configuration)
4. [Script Properties Deep Dive](#script-properties-deep-dive)
5. [Web App Deployment](#web-app-deployment)
6. [Interaction Endpoint Verification](#interaction-endpoint-verification)
7. [Troubleshooting Setup](#troubleshooting-setup)

---

## Discord Developer Setup

### Create Discord Application

**Langkah Detil**:

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Klik **"New Application"** (tombol biru di kanan atas)
3. Masuk nama aplikasi (misal: `Ba-banana Radars`)
4. Centang **"I have read and agree to the Developer Terms of Service and Developer Policy"**
5. Klik **"Create"**
6. Buka tab **"General Information"**
   - Catat **Application ID** (untuk nanti)
   - Catat **Public Key** (ini untuk `DISCORD_PUBLIC_KEY` di Script Properties)

### Create Bot User

1. Klik tab **"Bot"** di sidebar
2. Klik **"Add Bot"** (jika belum ada)
3. Di section "TOKEN", klik **"Copy"** atau **"Reveal"**
   - Ini adalah `DISCORD_BOT_TOKEN` (format: `Bot MjgwNzQwODU3...`)
   - **⚠️ JANGAN SHARE TOKEN INI!**
4. Di section "Privileged Gateway Intents":
   - Centang: `Message Content Intent` (untuk membaca isi pesan jika perlu)
   - Yang lain opsional
5. Klik **"Save Changes"**

### Set OAuth2 Scopes & Permissions

1. Klik tab **"OAuth2"** → **"URL Generator"** (di sidebar)
2. Di section **"Scopes"**, centang:
   - `bot`
   - `applications.commands`
3. Di section **"Permissions"**, centang:
   - **Text Permissions**:
     - `Send Messages`
     - `Send Messages in Threads`
     - `Embed Links`
     - `Read Message History`
   - **Channel Management**:
     - `Manage Webhooks`
   - **General Permissions**:
     - `Read Messages/View Channels`

4. Copy generated URL di bawah (format: `https://discord.com/api/oauth2/authorize?...`)
5. Buka URL di browser → follow prompt invite bot ke server test Anda

### Test Server Requirements

Gunakan server yang dedicated untuk test:

1. Buat Discord Server baru (atau gunakan existing test server)
2. Pastikan bot sudah invited (via OAuth2 URL di atas)
3. Buat channel untuk test (misal: `#radar-test`)
4. Pastikan bot punya akses ke channel (Check Permissions)
5. **Jangan invite ke production server dulu!**

---

## Google Apps Script Setup

### Create Google Apps Script Project

1. Buka [Google Apps Script](https://script.google.com)
2. Klik **"New project"** (jika tidak ada project open)
3. Beri nama: `Ba-banana Radars` (atau custom nama Anda)
4. Rename file default dari `Code.gs` ke `main.gs` (optional, untuk organisasi)
5. **Jangan copy code dulu**, lanjut ke langkah Spreadsheet dulu

### Otomatisasi Setup Google Spreadsheet

Sekarang Anda **tidak perlu membuat spreadsheet dan sheet secara manual**. Cukup jalankan fungsi `setupSpreadsheet()` yang sudah disediakan:

1. Buka Apps Script Editor pada project Anda.
2. Pilih fungsi `setupSpreadsheet` dari dropdown di toolbar.
3. Klik tombol **Run** (▶️).
4. Fungsi ini akan:
   - Membuat spreadsheet baru bernama `Ba-banana Radars Config` jika belum ada.
   - Membuat sheet `RadarConfig`, `RadarLogs`, dan `ChannelCache` jika belum ada.
   - Mengisi header kolom di baris pertama setiap sheet sesuai kebutuhan bot.
   - Menyimpan Spreadsheet ID ke Script Properties (`SPREADSHEET_ID`) secara otomatis.
5. Cek log (View → Logs) untuk mendapatkan URL dan ID spreadsheet.

**Catatan:** Jika Anda sudah punya spreadsheet, pastikan Spreadsheet ID sudah di-set di Script Properties (`SPREADSHEET_ID`). Fungsi ini tetap akan memastikan sheet dan header sudah benar.

#### Struktur Sheet & Header (Referensi)

- **RadarConfig**: `guild_id`, `service`, `channel_id`, `interval`, `mode`, `status`, `last_run`, `emoji_label`, `daily_hour`  
  > Kolom `daily_hour` digunakan untuk radar harian (daily) agar user bisa memilih jam eksekusi (misal: `07:00`).  
- **RadarLogs**: `timestamp`, `service`, `guild_id`, `status_emoji`, `message_id`, `elapsed_ms`, `error_msg`
- **ChannelCache**: `guild_id`, `channel_id`, `channel_name`, `emoji_category`, `last_sync`

Anda tidak perlu mengisi header ini secara manual—fungsi `setupSpreadsheet()` akan mengatur semuanya.

##### Setup Radar Harian (Daily)
Jika Anda memilih interval "daily" saat setup radar di Discord, Anda akan diminta memilih jam eksekusi (misal: 07:00 WIB). Radar harian hanya akan berjalan pada jam yang Anda pilih.

### Link Spreadsheet to Apps Script (Optional)

Cara otomatis (Google Apps Script akan auto-detect):

1. Buka Apps Script project Anda
2. Klik **"Project Settings"** (⚙️ icon)
3. Cari **"Google Cloud Platform (GCP) Project"**
4. Klik link untuk terbuka di GCP Console
5. Pastikan permissions sudah include `spreadsheets` scope

Atau manual inject di `config.gs` (lihat bagian Script Properties).

---

## Spreadsheet Configuration

### Sample Data untuk Test

**RadarConfig Sheet** (baris 2 ke bawah untuk data):

```
A2: 123456789012345678        (contoh guild_id Discord)
B2: crypto                    (service: crypto / gtrends)
C2:987654321098765432        (contoh channel_id Discord)
D2: 1h                        (interval: 5m / 10m / 30m / 1h / 3h / daily)
E2: embed                     (mode: embed / ai_summary / plain)
F2: 🟢                         (status: 🟢 active / 🟡 paused / 🔴 inactive)
G2: 2025-01-24T08:00:00Z      (last_run timestamp)
H2: 💰 Crypto Hourly         (emoji_label untuk display)
```

Baris 3 ke bawah: tambah entry radar lain yang ingin di-test.

**RadarLogs Sheet** (auto-populated by code):

Jangan perlu manual entry. Code akan auto-append log setiap run.

---

## Script Properties Deep Dive

### Access Script Properties

1. Di Apps Script Editor, klik **"Project Settings"** (⚙️ icon di atas editor)
2. Scroll ke section **"Script properties"**
3. Ada tombol **"Add property"** untuk add key-value pair

### Required Properties

| Key | Value | Contoh | Catatan |
|-----|-------|--------|---------|
| `DISCORD_PUBLIC_KEY` | Dari Discord Dev Portal → General Info → Public Key | `abc123def456ghi789...` | Ed25519 key, penting untuk verify request |
| `DISCORD_BOT_TOKEN` | Dari Discord Dev Portal → Bot → Token | `Bot MjgwNzQwODU3Mzk0Nzc4...` | **JANGAN SHARE!** |
| `SPREADSHEET_ID` | Google Sheets ID | `1a2b3c4d5e6f7g8h9i0j` | Copas dari URL spreadsheet |

### Optional Properties

| Key | Value | Default | Catatan |
|-----|-------|---------|---------|
| `BINANCE_API_KEY` | Dari [Binance API Management](https://www.binance.com/en/account/api-management) | — | Untuk Crypto Radar |
| `BINANCE_API_SECRET` | Binance API Secret | — | Keep secret! |
| `OPENROUTER_API_KEY` | Dari [OpenRouter](https://openrouter.ai) | — | Untuk AI summary di Gtrends |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARN` / `ERROR` | `INFO` | Verbosity logging |
| `GOOGLE_TRENDS_KEYWORD_PREFIX` | String prefix | `trending di` | Untuk AI prompt (Gtrends) |
| `AI_MODEL_GTRENDS` | Model name | `gpt-3.5-turbo` | OpenRouter model |

### How to Get Binance API Keys (Optional)

1. Login ke [Binance Account](https://www.binance.com)
2. Pergi ke [Account Settings → API Management](https://www.binance.com/en/account/api-management)
3. Klik **"Create API Key"**
4. Beri label (misal: `Apps-Script-Ba-banana`)
5. Generate key → copy **API Key** dan **Secret Key**
6. Enable permissions:
   - Enable Reading
   - ✅ **Jangan** aktifkan "Enable Spot & Margin Trading Requests"
7. Set IP whitelist jika diperlukan (optional, tapi recommended untuk security)

### How to Get OpenRouter API Key (Optional)

1. Buka [OpenRouter.ai](https://openrouter.ai)
2. Login / Sign up
3. Pergi ke [Keys Management](https://openrouter.ai/account/api-keys)
4. Klik **"Create Key"**
5. Copy key (format: `sk-or-...`)
6. Test dengan menjalankan `/radar test` command di Discord

---

## Web App Deployment

### Initial Deployment

1. Di Apps Script Editor, klik **"Deploy"** (tombol biru di atas)
2. Klik **"New Deployment"** (jika ini pertama kali)
3. Di dropdown **"Select type"**, pilih **"Web app"**
4. Di **"Description"**, input: `Ba-banana Radars v1.0 - Interaction Endpoint`
5. Di **"Execute as"**, pilih account Anda (atau service account jika ada)
6. Di **"Who has access"**, pilih:
   - ⚠️ **"Anyone"** (Discord WAJIB akses endpoint public!)
7. Klik **"Deploy"**
8. Copy generated URL (format: `https://script.google.com/macros/d/{scriptId}/userweb`)

### Update Existing Deployment

Setelah update code:

1. Klik **"Deploy"** → **"Manage Deployments"**
2. Klik deployment yang sedang aktif → klik 🔄 (refresh icon)
3. Atau create **New Deployment** jika ingin versi terpisah

---

## Interaction Endpoint Verification

### Setup Discord Interaction Endpoint

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) → pilih app
2. Klik tab **"General Information"**
3. Scroll ke **"Interactions Endpoint URL"**
4. Paste URL dari Web App Deployment (format: `https://script.google.com/macros/d/.../userweb`)
5. Klik **"Save Changes"**
6. Discord akan send verification request → Apps Script akan auto-handle di `main.gs` function `doPost()`

### Verify Deployment Success

Jika verifikasi berhasil:
- ✅ Discord akan show checkmark di "Interactions Endpoint URL"
- ✅ You can now use slash commands

Jika gagal:
- ❌ Akan error di Discord Developer Portal
- Cek `main.gs` → `verifyDiscordSignature()` function
- Monitor **Execution Log** di Apps Script untuk error detail

---

## Copy Code to Apps Script

**Order penting** (supaya dependency terinvokasi):

1. **config.gs** → Import Spreadsheet & Properties utilities
2. **radar_utils.gs** → Import utility functions (logging, embed builder)
3. **radar_registry.gs** → Import radar service registry
4. **radar_crypto.gs** → Import Crypto Radar implementation
5. **radar_gtrends.gs** → Import Google Trends Radar implementation
6. **ai_summary.gs** → Import AI summary (opsional)
7. **ui_builder.gs** → Import Discord component builders
8. **scheduler.gs** → Import trigger management
9. **commands.gs** → Import command handlers
10. **main.gs** → Import main entry point (LAST!)

### Copy Step-by-Step

Untuk setiap file di folder `/src/`:

1. Buka file di text editor / GitHub
2. Copy semua content (Ctrl+A, Ctrl+C)
3. Di Apps Script Editor, klik **"+"** untuk add tab baru
4. Rename tab ke filename (contoh: `config.gs`)
5. Paste content ke tab
6. **JANGAN** save dulu (auto-save di Apps Script)

Setelah semua file dicopy, baru save project dengan Ctrl+S.

---

## Troubleshooting Setup

### Error: "Cannot verify signature"

**Penyebab**: `DISCORD_PUBLIC_KEY` salah atau tidak ada di Script Properties.

**Solusi**:
1. Buka Discord Developer Portal → General Information
2. Copy Public Key (pastikan copy keseluruhan)
3. Di Apps Script, buka Project Settings → Script Properties
4. Cek key `DISCORD_PUBLIC_KEY` → paste ulang dari Discord
5. **Jangan ada spasi** di depan/belakang!
6. Deploy Web App ulang (Deploy → Manage Deployments → Edit)
7. Re-test interaction endpoint di Discord

### Error: "Spreadsheet not found"

**Penyebab**: `SPREADSHEET_ID` salah atau script tidak punya akses.

**Solusi**:
1. Buka Google Sheets → buka spreadsheet `Ba-banana Radars Config`
2. URL: `https://docs.google.com/spreadsheets/d/{ID}/edit`
3. Copy ID dari URL (jangan termasuk `/edit` atau path lainnya)
4. Di Apps Script, update Script Property `SPREADSHEET_ID` dengan ID baru
5. Cek authorization:
   - Apps Script project harus punya edit access ke spreadsheet
   - Biasanya auto (same Google account)
   - Jika berlainan account: share spreadsheet ke email account Apps Script

### Error: "Sheet 'RadarConfig' not found"

**Penyebab**: Sheet belum dicreate atau nama typo.

**Solusi**:
1. Buka spreadsheet
2. Cek sheet names (tab di bawah):
   - Harus exact: `RadarConfig`, `RadarLogs`, `ChannelCache`
   - Case-sensitive!
3. Jika belum ada: klik **"+"** untuk add sheet, rename ke nama yang tepat
4. Cek kolom headers sudah ada (lihat bagian Spreadsheet Configuration)

### Error: "Invalid Discord token"

**Penyebab**: `DISCORD_BOT_TOKEN` salah format atau expired.

**Solusi**:
1. Buka Discord Developer Portal → Bot
2. Klik **"Regenerate"** untuk generate token baru
3. Copy token (format harus: `Bot MjgwNzQwODU3...`)
4. Update Script Property `DISCORD_BOT_TOKEN` dengan token baru
5. Deploy ulang Web App

### Error: "Web App deployment failed"

**Penyebab**: Syntax error di code atau permission issue.

**Solusi**:
1. Cek **Execution Log** (Apps Script → ⌛ icon)
   - Lihat error message
2. Cek code syntax:
   - Buka setiap `.gs` file di editor
   - Cek ada error merah di pinggir baris
3. Fix error, save (Ctrl+S)
4. Coba deploy ulang

### Error: Bot tidak bisa send messages ke channel

**Penyebab**: Bot tidak punya permission di channel.

**Solusi**:
1. Buka Discord server → settings → Roles
2. Cari role bot Anda → klik edit
3. Di tab "Permissions":
   - Enable: `Send Messages`
   - Enable: `Embed Links`
   - Enable: `Manage Webhooks`
4. Atau di channel specific: right-click channel → Edit Channel → Permissions
5. Add bot role → set permissions di atas
6. Re-test command di channel

---

## Next Steps

Setelah setup selesai:

1. ✅ Cek semua Script Properties sudah ada
2. ✅ Cek Spreadsheet sheets & headers
3. ✅ Cek Web App deployed & URL benar
4. ✅ Cek Discord Interaction Endpoint verified
5. ✅ Jalankan E2E test (lihat `TESTING.md`)
6. ✅ Manual test command `/radar discover` di Discord

---

**Versi**: 1.0  
**Last Updated**: 2025-01-24

Goodluck! 🍌