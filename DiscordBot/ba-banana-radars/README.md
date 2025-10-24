# 🍌🎯 Ba-ba-banana Radars 🍌🎯

Proyek bot Discord personal yang menyediakan radar informasi real-time berbasis **Google Apps Script (GAS)**. Menghubungkan berbagai sumber data (Crypto, Google Trends) langsung ke Discord dengan antarmuka yang playful penuh emoji ✨.

## 🌈 Fitur Utama

- 🛰️ **Radar Crypto**: Pantau harga Bitcoin, Ethereum, XRP, dan altcoin lainnya dari Binance API
- 📊 **Radar Google Trends**: Tangkap tren pencarian top di Indonesia dengan ringkasan AI (opsional)
- 🔥 **Radar Reddit**: Monitor trending posts dari subreddit pilihan (top/hot) dengan custom input support
- 🤖 **Slash Commands**: Setup, manage, test, discover radar via Discord slash commands
- ⏱️ **Scheduler Fleksibel**: Jalankan radar dengan interval 5 menit hingga harian
- 🧠 **AI Summary** (Opsional): Ringkasan cerdas via OpenRouter API
- 📁 **Spreadsheet Backend**: Semua config & log disimpan di Google Sheets untuk audit trail
- 🛡️ **Signature Verification**: Validasi Discord interaction endpoint dengan Ed25519

## 👥 Untuk Siapa?

- 👑 **Guild Owner**: Pantau pasar crypto dan tren tanpa keluar Discord
- 🧠 **Moderators**: Ringkasan tren untuk komunitas
- 💼 **Analis Santai**: Hidden gems + laporan emoji-friendly

---

## 📋 Prasyarat (Wajib)

1. **Google Account** dengan akses Google Apps Script & Google Sheets
2. **Discord Server** dengan role permission (minimal manage webhooks & messages)
3. **Discord Bot Token** dan **Public Key** (dari Discord Developer Portal)
4. **Binance API** (opsional, tapi untuk Crypto Radar wajib)
5. **OpenRouter API Key** (opsional, hanya untuk AI summary)
6. **Reddit Access** (opsional, untuk Reddit Radar - public API digunakan)

---

## 🚀 Setup Langkah Demi Langkah

### **Langkah 1: Persiapan Discord Bot**

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Klik **"New Application"**, beri nama (misal: `Ba-banana Radars`)
3. Pergi ke tab **"Bot"** → **"Add Bot"**
4. Copy **Token** (untuk `DISCORD_BOT_TOKEN`)
5. Pergi ke tab **"General Information"**
6. Copy **Public Key** (untuk `DISCORD_PUBLIC_KEY`)
7. Di tab **"OAuth2"** → **"Scopes"**: centang `bot` + `applications.commands`
8. Di tab **"Bot Permissions"**: centang `Send Messages`, `Embed Links`, `Manage Webhooks`
9. Copy generated URL, buka di browser, invite bot ke server test Anda

### **Langkah 2: Setup Google Apps Script**

1. Buka [Google Apps Script](https://script.google.com)
2. Buat project baru → beri nama `Ba-banana Radars`
3. **Otomatisasi Setup Spreadsheet**:
   - Tidak perlu membuat spreadsheet dan sheet secara manual!
   - Setelah deploy kode ke Apps Script, jalankan fungsi `setupSpreadsheet()` dari Apps Script Editor.
   - Fungsi ini akan otomatis membuat spreadsheet, sheet, dan header sesuai kebutuhan bot.
   - Spreadsheet ID akan otomatis disimpan ke Script Properties.
   - **Kolom RadarConfig**: `guild_id`, `service`, `channel_id`, `interval`, `mode`, `status`, `last_run`, `emoji_label`, `daily_hour`
   - **Kolom RadarLogs**: `timestamp`, `service`, `guild_id`, `status_emoji`, `message_id`, `elapsed_ms`
   - **Kolom ChannelCache**: `guild_id`, `channel_id`, `channel_name`, `emoji_category`, `last_sync`

4. Kembali ke Apps Script:
   - Hubungkan spreadsheet: Klik **"⊕"** (Projects Settings) → paste Spreadsheet ID
   - Atau manual di kode: lihat `config.gs` baris `SPREADSHEET_ID`

5. Copy semua file dari `/src/` ke Apps Script Editor (akan dijelaskan di Langkah 3)

### **Langkah 3: Copy File ke Apps Script**

Apps Script tidak punya folder. Setiap file `.gs` adalah tab terpisah di editor. Jadi:

1. Di Apps Script Editor, klik **"+"** untuk tab baru
2. Rename tab sesuai filename (misal `main.gs`, `config.gs`, dst)
3. Copy-paste isi setiap file ke tab masing-masing (lihat folder `/src/`)

**Urutan copy file** (supaya tidak error import):
1. `config.gs` (dependency paling dasar)
2. `radar_utils.gs` (utility functions)
3. `radar_registry.gs` (registry services)
4. `radar_crypto.gs`, `radar_gtrends.gs`, `ai_summary.gs` (implementasi)
5. `ui_builder.gs` (component builder)
6. `scheduler.gs` (trigger management)
7. `commands.gs` (command handlers)
8. `main.gs` (entry point)

### **Langkah 4: Set Script Properties** (WAJIB ❗)

1. Di Apps Script, buka **"Project Settings"** (⚙️ icon)
2. Scroll ke **"Script properties"**, klik **"Add property"**

| Key | Value | Contoh | Status |
|-----|-------|--------|--------|
| `DISCORD_PUBLIC_KEY` | Public Key dari Step 1 | `abc123def456...` | **WAJIB** |
| `DISCORD_BOT_TOKEN` | Bot Token dari Step 1 | `Bot MjgwNzQwODU3...` | **WAJIB** |
| `SPREADSHEET_ID` | Spreadsheet ID dari Step 2 | `1a2b3c4d5e6f...` | **WAJIB** |
| `BINANCE_API_KEY` | (Opsional, untuk crypto) | — | OPSIONAL |
| `BINANCE_API_SECRET` | (Opsional, untuk crypto) | — | OPSIONAL |
| `OPENROUTER_API_KEY` | (Opsional, untuk AI summary) | `sk-or-...` | OPSIONAL |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARN`, `ERROR` | `INFO` | OPSIONAL (default: INFO) |

### **Langkah 5: Deploy Web App**

1. Di Apps Script, klik **"Deploy"** → **"New Deployment"**
2. Pilih **"Type"** → **"Web app"**
3. Di **"Execute as"**, pilih account Anda
4. Di **"Who has access"**, pilih **"Anyone"** (Discord public endpoint)
5. Klik **"Deploy"**
6. Copy generated URL (misal: `https://script.google.com/macros/d/{scriptId}/userweb`)

### **Langkah 6: Setup Discord Interaction Endpoint**

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) → pilih aplikasi Anda
2. Pergi ke tab **"General Information"**
3. Scroll ke **"Interactions Endpoint URL"**
4. Paste URL dari Langkah 5
5. Discord akan auto-verify dengan mengirim challenge, Apps Script akan merespons di `main.gs`
6. Jika gagal, cek log Anda di **"Execution log"** (ada di Apps Script)

---

## 🧪 Testing & Validasi

### **Mode Sandbox (Testing)**

Sebelum production, test di environment terpisah:

```
1. Buat spreadsheet test: "Ba-banana Radars Config - TEST"
2. Set SPREADSHEET_ID di Script Properties ke spreadsheet test
3. Gunakan Discord Test Server (jangan guild production)
4. Deploy Web App dengan eksekusi test
5. Verifikasi di Execution Log
```

### **Jalankan E2E Test**

Di Apps Script Editor:

1. Buka file tab `test_main.gs` (atau import dari `/tests/`)
2. Klik fungsi **`runAllE2ETests()`** di dropdown selector
3. Tekan **▶️ Run** (ikon play)
4. Monitor **"Execution log"** untuk hasil

**Test coverage**:
- ✅ Config read/write dari Spreadsheet
- ✅ Discord signature verification
- ✅ Crypto radar fetch dari Binance
- ✅ Google Trends fetch & parsing
- ✅ Embed builder dengan emoji
- ✅ Trigger creation & removal
- ✅ Logging to Spreadsheet

Lihat detail di `TESTING.md`.

### **Manual Testing Command di Discord**

Pastikan bot sudah di-invite ke server test:

```
/radar setup         → Tampil form setup radar
/radar manage        → List & manage radar aktif
/radar status        → Cek status semua radar
/radar discover      → Katalog radar available
/radar test          → Send test embed ke channel
```

---

## 📊 Production Deployment

### **Checklist Pre-Production** ✅

- [ ] Spreadsheet production sudah dibuat dan backupnya ada
- [ ] Script Properties semua key sudah diisi (lihat Langkah 4)
- [ ] Web App sudah di-deploy & Discord Interaction Endpoint verified
- [ ] E2E test semua passed (lihat Langkah 5)
- [ ] Bot sudah invited ke production guild dengan permission cukup
- [ ] Cek log di `RadarLogs` sheet kosong atau hanya test entries

### **Deploy Production**

1. Update `SPREADSHEET_ID` ke production spreadsheet (bukan test)
2. Di Apps Script, klik **"Deploy"** → **"Manage Deployments"**
3. Klik deployment terbaru → **"Edit"**
4. Ubah setting ke production values, save
5. Atau buat deployment baru khusus production dengan Web App URL baru
6. Update Discord Interaction Endpoint URL ke deployment production
7. Jalankan test sekali: `/radar test` di channel production
8. Monitor log di `RadarLogs` sheet

### **Monitoring Production**

Setiap hari, audit via:

```
Google Sheets → Tab "RadarLogs"
  - Cek status: ✅ OK, ⚠️ WARN, 🔴 ERROR
  - Cek elapsed_ms: idealnya < 5000ms per run
  - Cek timestamps: pastikan radar jalan on-schedule
```

Atau setup Discord webhook health check untuk alert jika error 🚨.

---

## 📁 Struktur Proyek

```
ba-banana-radars/
├── README.md                    # Ini! Panduan lengkap
├── SETUP.md                     # Detail setup mendalam
├── TESTING.md                   # Guide E2E test
├── DEPLOYMENT.md                # Production checklist
├── .gitignore                   # File ignorable (logs, .env, dll)
│
├── src/                         # Semua kode Apps Script
│   ├── main.gs                  # 🍌 Entry point: doPost handler
│   ├── config.gs                # 📑 Wrapper Spreadsheet & Properties
│   ├── commands.gs              # 📜 Slash command handlers
│   ├── ui_builder.gs            # 🎨 Discord component builders
│   ├── radar_registry.gs        # 🗃️ Registry radar services
│   ├── radar_crypto.gs          # 💰 Crypto radar (Binance)
│   ├── radar_gtrends.gs         # 📊 Google Trends radar
│   ├── scheduler.gs             # ⏰ Trigger management
│   ├── radar_utils.gs           # 🛠️ Utilities & helpers
│   └── ai_summary.gs            # 🧠 AI summary (opsional)
│
├── tests/                       # Test suite
│   ├── test_main.gs             # E2E test functions
│   └── test_helpers.gs          # Test utilities
│
└── logs/                        # Log folder (local, tidak di-commit)
    └── .gitkeep
```

**Note**: Saat deploy ke Apps Script, setiap file `.gs` menjadi **satu tab** di editor. Tidak ada folder hierarchy.

---

## 🎛️ Konfigurasi Dasar

### **Environment Variables (Script Properties)**

| Key | Type | Default | Penjelasan |
|-----|------|---------|-----------|
| `DISCORD_PUBLIC_KEY` | string | — | Ed25519 public key untuk verify request Discord |
| `DISCORD_BOT_TOKEN` | string | — | Bot token untuk mengirim pesan ke Discord |
| `SPREADSHEET_ID` | string | — | Google Sheets ID untuk config & logs |
| `BINANCE_API_KEY` | string | — | (Opsional) Binance API key |
| `BINANCE_API_SECRET` | string | — | (Opsional) Binance API secret |
| `OPENROUTER_API_KEY` | string | — | (Opsional) OpenRouter key untuk AI |
| `LOG_LEVEL` | string | `INFO` | Verbosity: `DEBUG`, `INFO`, `WARN`, `ERROR` |

### **Spreadsheet Columns**

**RadarConfig Sheet** (untuk track radar aktif):
```
A: guild_id          (Discord server ID)
B: service           (crypto, gtrends)
C: channel_id        (Discord channel ID)
D: interval          (5m, 10m, 30m, 1h, 3h, daily)
E: mode              (embed, ai_summary, plain)
F: status            (🟢 active, 🟡 paused, 🔴 inactive)
G: last_run          (timestamp last execution)
H: emoji_label       (untuk display di UI)
```

**RadarLogs Sheet** (untuk audit):
```
A: timestamp         (ISO 8601)
B: service           (crypto, gtrends)
C: guild_id          (Discord server)
D: status_emoji      (✅ OK, ⚠️ WARN, 🔴 ERROR)
E: message_id        (Discord message ID, jika ada)
F: elapsed_ms        (berapa lama run)
```

---

## 🔐 Security Best Practices

1. ✅ **Jangan share Script Properties** → keep token private!
2. ✅ **Gunakan Project Editor Role** → minimal untuk team collaborators
3. ✅ **Regular backup Spreadsheet** → sebelum update besar
4. ✅ **Monitor RadarLogs** → detect anomali atau unauthorized access
5. ✅ **Rotate token** → jika suspected leak (kemudian update Script Properties)
6. ✅ **Verify Discord signature** → semua request diverifikasi sebelum process

---

## 🐛 Debugging Tips

### **Masalah 1: Discord tidak bisa verify Interaction Endpoint**

**Symptoms**: 401/403 error saat setup.

**Solusi**:
1. Cek `DISCORD_PUBLIC_KEY` di Script Properties → pastikan tepat (copy-paste tanpa spasi)
2. Cek `main.gs` → function `verifyDiscordSignature()` eksekusi dengan benar
3. Monitor **Execution Log** di Apps Script
4. Pastikan Web App di-deploy dengan akses **"Anyone"**

### **Masalah 2: Spreadsheet tidak bisa dibaca**

**Symptoms**: "ERROR: Cannot read spreadsheet" di log.

**Solusi**:
1. Cek `SPREADSHEET_ID` di Script Properties → tepat tidak?
2. Pastikan spreadsheet sheet names ada: `RadarConfig`, `RadarLogs`, `ChannelCache`
3. Pastikan kolom headers sudah ada (lihat di atas)
4. Cek authorization: Apps Script harus punya akses ke spreadsheet (biasanya auto)

### **Masalah 3: Radar tidak jalan on-schedule**

**Symptoms**: Trigger created tapi radar tidak run.

**Solusi**:
1. Cek timezone di Apps Script Project Settings → pastikan `Asia/Jakarta` (atau timezone Anda)
2. Pastikan `status` di `RadarConfig` sheet adalah `🟢` (active)
3. Monitor **Triggers** di Apps Script (ada di menu samping)
4. Jalankan manual test: `/radar test` → pastikan webhook working

### **Masalah 4: AI Summary tidak muncul**

**Symptoms**: Summary kosong atau error di Gtrends radar.

**Solusi**:
1. Check: `OPENROUTER_API_KEY` di Script Properties → ada tidak?
2. Cek API key validity di [OpenRouter Dashboard](https://openrouter.ai)
3. Cek rate limit OpenRouter (mungkin quota habis)
4. Set `mode` di RadarConfig ke `ai_summary` saat setup

---

## 📚 File-by-File Reference

| File | Fungsi | Baris Kode |
|------|--------|-----------|
| `main.gs` | Entry point Discord interactions | ~100 |
| `config.gs` | Read/write Spreadsheet & Properties | ~150 |
| `commands.gs` | Slash command handlers | ~200 |
| `ui_builder.gs` | Discord embed & component builder | ~250 |
| `radar_registry.gs` | Registry radar services | ~80 |
| `radar_crypto.gs` | Crypto Binance fetcher | ~180 |
| `radar_gtrends.gs` | Google Trends fetcher | ~220 |
| `radar_utils.gs` | Utilities (logging, embeds, etc) | ~300 |
| `scheduler.gs` | Trigger management | ~150 |
| `ai_summary.gs` | OpenRouter AI integration | ~120 |
| `test_main.gs` | E2E test suite | ~400 |

---

## 🚨 Troubleshooting Execution

Jika ada error saat run `/radar` command:

1. **Check Execution Log**: Apps Script → Execution log (lihat recent runs)
2. **Enable Debug Logging**: Set `LOG_LEVEL = DEBUG` di Script Properties, re-run test
3. **Check Spreadsheet**: Buka `RadarLogs` sheet → lihat error message terbaru
4. **Read TESTING.md**: Untuk panduan debug terstruktur

---

## 🎯 Next Steps

1. ✅ Ikuti **Langkah 1-6** di section "Setup"
2. ✅ Jalankan **E2E test** (lihat Testing & Validasi)
3. ✅ Coba command `/radar discover` di Discord
4. ✅ Setup radar pertama: `/radar setup` → pilih Crypto + interval 1h
5. ✅ Monitor log di Spreadsheet
6. ✅ Deploy production saat yakin semua stabil

---

## 📖 Dokumentasi Lainnya

- **`SETUP.md`**: Detailed setup untuk advanced config
- **`TESTING.md`**: E2E test guide dengan contoh
- **`DEPLOYMENT.md`**: Production checklist & monitoring

---

## 💬 Support & FAQ

**Q: Bisakah saya jalankan di server production langsung?**  
A: **Tidak disarankan 🚫**. Selalu test di server test dulu. Lihat `TESTING.md`.

**Q: Apa itu "interval"? Bisa kurangi jadi per menit?**  
A: Interval adalah frekuensi radar jalan (5m, 10m, 30m, 1h, 3h, daily). Limit: Apps Script trigger terbatas 20/user. Lihat `scheduler.gs` untuk advanced config.

**Q: Apakah Reddit Radar sudah tersedia?**  
A: Ya! Reddit Radar sudah built-in. Support custom subreddit (nama/link), top/hot posts. Lihat `REDDIT_RADAR_GUIDE.md` untuk panduan lengkap.

**Q: Gimana caranya custom radar baru (misal: GitHub)?**  
A: Buat file `radar_newservice.gs` sesuai struktur `radar_crypto.gs`, daftarkan di `radar_registry.gs`. Reddit Radar adalah contoh implementasi lengkap. Lihat dokumentasi di folder referensi.

**Q: Bisa pakai di bot terpisah dari bot production saya?**  
A: Ya, buat Discord bot baru (langkah 1) dan web app baru (langkah 5). Share spreadsheet atau buat terpisah tergang kebutuhan.

---

## 📄 License

Bebas pakai untuk keperluan pribadi. 🍌

---

**Versi**: 1.0  
**Last Updated**: 2025-01-24  
**Maintained by**: Ba-ba-banana Team 🎉

Tetap jaga energi 🍌 dan semoga berhasil! 🚀
