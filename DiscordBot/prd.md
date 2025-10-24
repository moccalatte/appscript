# 🍌🎯 PRD Ba-ba-banana Radars 🍌🎯

Proyek ini WAJIB mempertahankan nuansa full emoji di setiap interaksi, konten Discord, log, dan dokumentasi lanjutan. Tidak ada elemen interface atau pesan bot yang boleh tampil polos tanpa emoji pendukung.

## 🪄 Visi Produk
- 🛰️ Menyediakan radar informasi real-time berbasis Google Apps Script (GAS) yang menghubungkan berbagai sumber data ke Discord.
- 🤖 Menghadirkan bot personal yang bisa dikendalikan sepenuhnya lewat slash command, tombol, dan dropdown emoji.
- 💛 Menjaga pengalaman playful lewat penggunaan emoji di setiap output, komponen UI, dan status laporan.

## 👥 Target Pengguna & Persona Emoji
- 👑 **Guild Owner Enerjik**: Ingin memantau pasar crypto dan tren web tanpa keluar dari Discord.
- 🧠 **Moderators Curiosity**: Membutuhkan ringkasan cepat dari Reddit dan Google Trends untuk komunitasnya.
- 💼 **Analis Santai**: Menggunakan hidden gems (AI summary) untuk laporan emoji-friendly.

## 🌈 Sasaran Produk
- ⚡ Deploy Apps Script sebagai Web App dan hubungkan ke Discord Interaction Endpoint.
- 🧩 Menyediakan konfigurasi radar via Discord saja; spreadsheet hanya backend data.
- ⏱️ Memungkinkan interval fleksibel (5 menit hingga harian) dengan emoji status di UI.
- 📣 Mengirim laporan radar via Discord embeds dengan warna dan emoji status.
- 🤖 Memastikan seluruh respon slash command dan tombol memakai emoji (mis. ✅, 🔄, 🛠️).

## 🗂️ Struktur File GAS Penuh Emoji
- `main.gs` 🍌: Entry `doPost(e)` memverifikasi signature Discord (public key) dan meneruskan request ke handler command/table komponen. Semua log `🧾`.
- `commands.gs` 📜: Registrasi dan definisi handler `/radar setup`, `/radar manage`, `/radar status`, `/radar discover`, `/radar test`. Setiap response berisi embed + komponen emoji.
- `ui_builder.gs` 🎨: Utilitas pembuatan komponen Discord (buttons, select menus) dengan label emoji, custom_id unik, dan state.
- `radar_registry.gs` 🗃️: Map `RADAR_SERVICES` dengan metadata emoji (nama, ikon, fungsi fetch, mode output support).
- `radar_crypto.gs` 💰: Fetch harga dari Binance API, format data + emoji tren (📈/📉) sebelum dikirim.
- `radar_reddit.gs` 🔥: Ambil top/hot post, pilih judul + emoji flair (🔥, 💎).
- `radar_gtrends.gs` 📊: Tarik top queries Google Trends, konversi ke embed dengan indikator emoji popularitas.
- `radar_utils.gs` 🛠️: Utility untuk membuat embeds (warna, timestamp), kirim pesan ke Discord (`/webhooks`), validasi signature, logging emoji.
- `scheduler.gs` ⏰: Mengatur cron trigger, fungsi `runActiveRadars()` dan `queueRadarRun()` lengkap dengan emoji status.
- `config.gs` 📑: Wrapper baca/tulis Google Spreadsheet (sheet radar + sheet logs, sheet channel cache) dengan penandaan emoji status (`🟢`, `🟡`, `🔴`).
- `ai_summary.gs` 🧠: Opsional, memanggil OpenRouter untuk membuat ringkasan hidden gems ber-emoji (✨) saat mode AI aktif.

## 🧭 Alur Slash Command & Komponen
- `/radar setup` ➡️ Menyajikan modal/tampilan emoji:
  - Dropdown Service: setiap opsi menampilkan ikon (💰 Crypto, 🔥 Reddit, 📊 Trends).
  - Dropdown Channel: label channel + emoji kategori (💬, 📣).
  - Dropdown Interval: `5m ⚡`, `10m 🚀`, `30m 🔄`, `1h 🕐`, `3h 🕒`, `Daily 🌞`.
  - Dropdown Mode Output: `Embed 🌈`, `AI Summary 🤖`, `Plain Text 📜`.
  - Tombol `✅ Simpan & Aktifkan`, `❌ Batal`.
  - Hasil simpan menulis ke sheet dan mendaftarkan trigger (jika belum).
- `/radar manage` ➡️ Dropdown radar aktif (emoji status) + tombol `⏸ Pause`, `🗑 Delete`, `🔁 Ubah Jadwal`. Perubahan update sheet dan mengatur ulang trigger.
- `/radar status` ➡️ Embed dengan daftar radar (service emoji, channel mention, interval emoji, status `🟢/🟡/🔴`).
- `/radar discover` ➡️ Embed katalog radar (judul + deskripsi emoji) + tombol `➕ Aktifkan`.
- `/radar test` ➡️ Kirim contoh embed radar ke channel terpilih, konfirmasi emoji `📨`.

## 🛠️ Integrasi & Konfigurasi
- 🔐 Script Properties: `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `OPENROUTER_KEY` (opsional) disimpan dengan emoji-labeled keys dalam dokumentasi internal.
- 📊 Spreadsheet:
  - Sheet `RadarConfig` dengan kolom `guild_id`, `service`, `channel_id`, `interval`, `mode`, `status`, `emoji_label`.
  - Sheet `RadarLogs` menyimpan hasil run (`timestamp`, `service`, `status_emoji`, `message_id`).
  - Sheet `ChannelCache` menyimpan mapping channel (id, nama, emoji kategori, last_sync).
- 🔁 Sinkronisasi channel dilakukan lewat Discord API `GET /guilds/{guild.id}/channels` saat `/radar setup` atau `/radar discover` dipanggil (disimpan dengan tanggal emoji `📅`).

## 🧮 Scheduler & Cron Emoji
- Trigger time-driven dibuat via `ScriptApp.newTrigger('runActiveRadars')...` per interval unik.
- `runActiveRadars()`:
  1. Membaca sheet `RadarConfig`.
  2. Menyaring radar dengan `status = active` (`🟢`).
  3. Menjalankan `RADAR_SERVICES[service].fetch(config)` untuk setiap radar jatuh tempo.
  4. Mengemas payload embed + emoji status ke Discord webhook `POST https://discord.com/api/v10/webhooks/{application.id}/{interaction.token}` atau follow-up endpoint.
  5. Menyimpan hasil ke `RadarLogs` (emoji status `✅` atau `⚠️`).
- Error handling:
  - Menangkap kegagalan HTTP, menandai status `🔴`, menulis stack trace, dan memberi notifikasi embed error (opsional) dengan emoji `🚨`.

## 🔄 Alur Data Emoji
```
Discord User 🤝 Slash Command
       ↓ (HTTP POST ⚡)
Google Apps Script 🌐 (doPost ➕ validators)
       ↓
Google Spreadsheet 📗 (config + logs + channel cache)
       ↓
Discord API 📬 (Response Embed 🌟 + Components 🧩)
```

## 🧱 Kontrak API & Payload
- Semua response ke Discord harus dalam format JSON:
```json
{
  "type": 4,
  "data": {
    "content": "📡 Radar disiapkan!",
    "embeds": [
      {
        "title": "💰 BTC/USDT",
        "description": "📈 Price: 67,300 USD",
        "color": 15158332,
        "timestamp": "2025-10-24T08:00:00Z"
      }
    ],
    "components": [
      {
        "type": 1,
        "components": [
          {
            "type": 2,
            "style": 1,
            "label": "✅ Simpan & Aktifkan",
            "custom_id": "save_activate",
            "emoji": { "name": "✅" }
          }
        ]
      }
    ]
  }
}
```
- Request ke Binance, Reddit, Google Trends dilakukan via `UrlFetchApp.fetch` dengan headers emoji dalam log (`📤`, `📥`).
- AI Summary (opsional) memanggil OpenRouter `POST /v1/chat/completions` dengan prompt memaksa emoji output.

## 🧪 Pengujian & Validasi Emoji
- Unit test (Apps Script QUnit) memverifikasi handler command mengembalikan content dengan emoji.
- Test manual Slack command di Testing Server: pastikan embed + components mengandung emoji minimal 1 per baris.
- Scheduler test: `runActiveRadars()` pada mode sandbox (sheet duplikat) memastikan log emoji `✅/⚠️`.

## 📛 Batasan & Risiko
- ⛔ Tidak ada Node.js; seluruh logika harus hidup di GAS.
- ⚠️ Rate limit Discord/Binance/Reddit perlu monitoring; fallback emoji `⏳` saat delay.
- 💤 Trigger Apps Script terbatas (maks 20 per user); butuh agregasi per interval (group radar) dengan emoji penanda.
- 🧩 Ketergantungan pada Spreadsheet availability; siapkan emoji alert `🚧` jika service down.

## ☑️ Checklist Peluncuran Emoji
- 📦 Deploy Web App versi terbaru dengan URL memenuhi syarat Interaction Endpoint.
- 🔐 Verifikasi signature Discord (Ed25519) sebelum memproses body; log `🛡️`.
- 🧪 Validasi semua command via Discord Test Guild.
- 📘 Dokumentasi tim internal menegaskan aturan full emoji, termasuk pedoman konten baru.

## 🔮 Roadmap Emoji
- 📦 Tambah radar RSS (`radar_rss.gs`), GitHub trending (`radar_github.gs`) dengan badges emoji.
- 🧠 Perluas AI summary untuk cross-service insights, lengkap dengan emoji korelasi.
- 📊 Dashboard Google Data Studio menampilkan statistik radar per emoji status.

## 🧾 Lampiran Emoji
- **Script Properties**: `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `OPENROUTER_KEY` (opsional).
- **Environment**: Apps Script Web App Execution dengan OAuth scopes `https://www.googleapis.com/auth/script.external_request`, `.../spreadsheets`.
- **Dokumentasi internal**: Template embed emoji untuk konsistensi brand.

Tetap jaga energi 🍌 dan pastikan setiap update, commit message, dan changelog mengikuti tema full emoji agar spirit Ba-ba-banana Radars selalu terasa! 🎉
