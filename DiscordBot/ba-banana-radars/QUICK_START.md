# ⚡ QUICK START - Ba-ba-banana Radars

Panduan cepat untuk setup & jalankan dalam 15 menit! 🚀

## 🎯 5-Langkah Singkat

### Langkah 1: Siapkan Discord Bot (3 menit)

1. Buka https://discord.com/developers/applications
2. Klik **"New Application"** → beri nama → Create
3. Tab **"Bot"** → **"Add Bot"**
4. Copy & save:
   - **Bot Token** (format: `Bot MTk4NjIyNDgzNzEwODQ0ODA`)
   - Dari tab **"General Information"** → copy **Public Key**

5. Tab **"OAuth2" → "URL Generator"**:
   - Scopes: `bot` + `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Manage Webhooks`
   - Copy URL yang di-generate
   - Buka URL di browser → invite ke test server

### Langkah 2: Otomatisasi Setup Spreadsheet (1 menit)

1. Buka [Google Apps Script Editor](https://script.google.com) pada project Anda.
2. Pastikan file `setup.gs` sudah ada (atau update ke versi terbaru repo ini).
3. Pilih fungsi `setupSpreadsheet` di menu dropdown, lalu klik **Run**.
4. Spreadsheet baru akan otomatis dibuat (atau diperbaiki jika sudah ada), lengkap dengan 3 sheet:
   - `RadarConfig`
   - `RadarLogs`
   - `ChannelCache`
   dan header kolom sesuai kebutuhan bot.
   - Sheet `RadarConfig` sekarang juga memiliki kolom `daily_hour` untuk jam eksekusi radar harian.
5. Cek log di Apps Script Editor untuk mendapatkan Spreadsheet URL dan ID.
6. Masukkan Spreadsheet ID ke Script Properties (`SPREADSHEET_ID`) jika belum otomatis terisi.

> **Catatan:** Anda tidak perlu membuat sheet atau header secara manual. Semua akan diatur otomatis oleh fungsi `setupSpreadsheet()`. Struktur header tetap sama seperti dokumentasi sebelumnya untuk referensi. Untuk radar harian, Anda juga dapat memilih jam eksekusi (misal: setiap hari jam 07:00 WIB) langsung dari menu setup di Discord.

7. Copy Spreadsheet ID dari URL (`/d/{ID}/edit`)

### Langkah 3: Setup Google Apps Script (5 menit)

1. Buka https://script.google.com
2. **"New project"** → beri nama → Create
3. Delete default "Code.gs" (optional)
4. Untuk setiap file di `/src/` folder:
   - Klik **"+"** → new file
   - Rename ke filename (misal: `config.gs`)
   - Copy-paste content dari file
   - **Ulangi** untuk semua 10 files (config, utils, registry, crypto, gtrends, ui_builder, scheduler, commands, ai_summary, main)

**Order penting**:
1. config.gs
2. radar_utils.gs
3. radar_registry.gs
4. radar_crypto.gs
5. radar_gtrends.gs
6. ai_summary.gs
7. ui_builder.gs
8. scheduler.gs
9. commands.gs
10. main.gs

### Langkah 4: Set Script Properties (2 menit)

1. Di Apps Script, klik **"Project Settings"** (⚙️)
2. Scroll → **"Script properties"**
3. Add properties:

| Key | Value | Source |
|-----|-------|--------|
| `DISCORD_PUBLIC_KEY` | Public Key | Discord Dev Portal → General Info |
| `DISCORD_BOT_TOKEN` | Bot Token | Discord Dev Portal → Bot |
| `SPREADSHEET_ID` | Spreadsheet ID | Google Sheets URL |

Contoh:
- Key: `DISCORD_PUBLIC_KEY` → Value: `abc123def456...` (long string)
- Key: `DISCORD_BOT_TOKEN` → Value: `Bot MTk4NjIyNDgzNzEwODQ0ODA`
- Key: `SPREADSHEET_ID` → Value: `1a2b3c4d5e6f7g8h9i0j`

### Langkah 5: Deploy & Connect (3 menit)

1. Di Apps Script, klik **"Deploy"** → **"New Deployment"**
2. Type: **"Web app"**
3. Execute as: Your account
4. Who has access: **"Anyone"** ← IMPORTANT!
5. Click **"Deploy"**
6. Copy deployment URL (format: `https://script.google.com/macros/d/{id}/userweb`)

7. Buka Discord Dev Portal → aplikasi Anda
8. Tab **"General Information"** → scroll ke **"Interactions Endpoint URL"**
9. Paste URL → **Save Changes**
10. Discord auto-verify → should see ✅

---

## 🧪 Test Sekarang (2 menit)

Di Discord test server, ketik:

```
/radar discover
```

**Expected**: Embed muncul dengan katalog radar (💰 Crypto, 📊 Google Trends)

Jika error:
- Cek Execution Log di Apps Script (⌛ icon)
- Verify PUBLIC_KEY copied correctly (tanpa extra spaces)

---

## 📡 Setup Radar Pertama (3 menit)

1. Di Discord, ketik:
```
/radar setup
```

2. Pilih:
   - Service: **"💰 Crypto"**
   - Interval: **"1h 🕐"** (update setiap jam)
   - Mode: **"Embed 🌈"**
   - Channel: Select test channel

3. Klik **"✅ Simpan & Aktifkan"**

4. Wait ~1 menit, maka cryptoradar akan automatic jalan setiap 1 jam

5. Verify:
   - `/radar status` → should show radar aktif 🟢
   - Check channel → embed posted setiap 1 jam

---

## 🎯 Next Steps

1. **Troubleshooting**: Lihat FAQ di README.md
2. **Production Setup**: Ikuti DEPLOYMENT.md (checklist lengkap)
3. **Testing**: Run E2E tests
   ```javascript
   runAllE2ETests()
   ```
4. **Customization**: 
   - Add crypto symbols di `radar_crypto.gs`
   - Enable AI summary (setup OpenRouter key)
   - Add new radar service

---

## 📞 Quick Reference

| Command | Fungsi |
|---------|--------|
| `/radar setup` | Setup radar baru |
| `/radar manage` | Pause/delete radar |
| `/radar status` | Lihat radar aktif |
| `/radar discover` | Katalog radar |
| `/radar test` | Send test message |

| Script Function | Fungsi |
|-----------------|--------|
| `runAllE2ETests()` | Jalankan E2E tests |
| `runActiveRadars()` | Run radars (dipanggil auto) |
| `startup()` | Initialize system |
| `healthCheck()` | Check health status |

---

## ⚠️ Common Issues

### ❌ Discord tidak verify Interaction Endpoint

**Solusi**:
1. Cek PUBLIC_KEY di Script Properties → exact copy (no spaces)
2. Cek URL di Discord Interaction Endpoint → exact match dari Web App URL
3. Re-deploy Web App
4. Try save lagi di Discord

### ❌ `/radar setup` tidak work

**Solusi**:
1. Check Execution Log (⌛ icon di Apps Script)
2. Lihat error message
3. Verify SPREADSHEET_ID valid
4. Verify all script properties set

### ❌ Radar tidak jalan scheduled

**Solusi**:
1. Check triggers di Apps Script (⏰ icon)
2. Should ada trigger untuk `runActiveRadars`
3. Jika tidak ada: run `startup()` di console
4. Check RadarConfig sheet → status column = 🟢

### ❌ "Cannot open spreadsheet" error

**Solusi**:
1. Verify SPREADSHEET_ID di Script Properties (copy exact)
2. Open spreadsheet manually → pastikan accessible
3. Share spreadsheet dengan email Apps Script account (jika different)

---

## 🎉 Sukses!

Jika semua langkah selesai:
- ✅ `/radar discover` works
- ✅ `/radar setup` berhasil
- ✅ Radar embedded posted ke Discord on-schedule
- ✅ RadarLogs sheet ter-populate dengan logs

**Congratulations! System is running! 🚀**

Untuk advanced setup, lihat README.md & DEPLOYMENT.md.

---

## 📖 Dokumentasi Lengkap

| File | Untuk |
|------|-------|
| **README.md** | Overview & comprehensive guide |
| **SETUP.md** | Advanced setup & troubleshooting |
| **TESTING.md** | E2E testing guide |
| **DEPLOYMENT.md** | Production deployment |
| **ARCHITECTURE.md** | System design & architecture |
| **QUICK_START.md** | Ini! 15-minute setup |

---

**Version**: 1.0  
**Estimated Time**: 15 minutes  
**Difficulty**: Beginner-friendly ✨

Tetap jaga energi 🍌!