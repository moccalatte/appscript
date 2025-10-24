Buatkan file `prd.md` (Product Requirement Document) untuk proyek bernama **Ba-ba-banana Radars**.

🎯 Tujuan:
Membangun bot Discord pribadi berbasis Google Apps Script tanpa Node.js, yang dapat mengelola berbagai radar service (crypto, reddit, gtrends, dll) dan mengirim pembaruan berkala ke channel Discord pilihan. Semua interaksi pengguna dilakukan langsung di Discord melalui slash command, tombol, dan dropdown.

🧠 Gambaran Umum:
- Hanya menggunakan Google Apps Script (GAS) sebagai backend utama.
- Deploy Apps Script sebagai Web App dan hubungkan ke Discord lewat **Interaction Endpoint URL**.
- Semua logika bot, radar, dan jadwal berjalan di Apps Script.
- Config disimpan di Google Spreadsheet.
- Radar dapat diatur (aktif/nonaktif, interval, channel tujuan) lewat tombol dan dropdown Discord.

🧩 Struktur Folder:
```

/discord-radar-hub-appscript
│
├─ main.gs              # Entry point: doPost(e) untuk Discord interactions
├─ commands.gs          # Definisi & registrasi slash command
├─ ui_builder.gs        # Bangun tampilan tombol & dropdown interaktif
├─ radar_registry.gs    # Daftar radar service (crypto, reddit, gtrends, dst.)
├─ radar_crypto.gs      # Ambil harga crypto dari Binance API
├─ radar_reddit.gs      # Ambil hot post Reddit
├─ radar_gtrends.gs     # Ambil Google Trends
├─ radar_utils.gs       # Format pesan embed & kirim ke Discord
├─ scheduler.gs         # Cron trigger untuk kirim radar rutin
├─ config.gs            # Simpan & ambil konfigurasi dari Spreadsheet
└─ ai_summary.gs        # (opsional) ringkasan “Hidden Gems” via OpenRouter

````

⚙️ Fungsi Utama:
1. `/radar setup`
   - Pilih service (crypto, reddit, gtrends)
   - Pilih channel tujuan (dropdown list semua channel guild)
   - Pilih interval (5m, 10m, 30m, 1h, 3h, daily)
   - Mode output: embed / ringkasan AI / teks
   - Tombol [✅ Simpan & Aktifkan]
2. `/radar manage`
   - Dropdown radar aktif → ubah jadwal, channel, atau nonaktifkan
   - Tombol [⏸ Pause] [🗑 Hapus]
3. `/radar status`
   - Embed berisi daftar radar aktif dan statusnya
4. `/radar discover`
   - List semua radar service yang tersedia + tombol ➕ Aktifkan
5. `/radar test`
   - Kirim contoh pesan radar ke channel aktif

📅 Scheduler:
- Apps Script pakai `Triggers` (Time-driven) untuk menjalankan fungsi `runActiveRadars()` setiap X menit.
- Fungsi ini membaca konfigurasi dari Sheet, memanggil `RADAR_SERVICES[service].fetch()`, lalu kirim hasil ke channel Discord.

💬 Format Pesan:
Gunakan Discord Embed JSON. Contoh:
```json
{
  "embeds": [{
    "title": "BTC/USDT",
    "description": "Price: 67,300 USD",
    "color": 15158332,
    "timestamp": "2025-10-24T08:00:00Z"
  }]
}
````

🔐 Token & Konfigurasi:

* Simpan `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, dan `OPENROUTER_KEY` (opsional) di Script Properties.
* Semua radar & jadwal disimpan di Spreadsheet:

  | guild_id | service | channel_id | interval | mode | status |
  | -------- | ------- | ---------- | -------- | ---- | ------ |

🧠 AI Integrasi (opsional):

* Fungsi `generateSummary(posts)` memanggil OpenRouter API untuk memilih hidden gems.
* Dipanggil otomatis setiap 20 post baru atau tiap jam.

📈 Alur Data:

```
Discord user
   ↓ (HTTP POST)
Google Apps Script (doPost)
   ↓
Google Spreadsheet (config & cache)
   ↓
Discord API (send message / edit / followup)
```

🪄 Fitur Tambahan:

* Bot bisa auto-update daftar channel (via `guild_id` & Discord API).
* Semua tombol & dropdown muncul jelas di Discord (pakai `components` array).
* Mode manual test: `/radar test` untuk cek hasil langsung.
* Logging ringan ke sheet “Radar Logs”.

📜 Output:
Dokumen `prd.md` yang rapi, menjelaskan setiap file `.gs`, struktur data, interaksi Discord, format JSON, serta jadwal trigger cron. Pastikan tidak menyertakan kode implementasi — hanya spesifikasi detail dan arsitektur.
