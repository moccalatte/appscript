DiscordBot/ba-banana-radars/src/setup.gs
/**
 * 🛠️ setup.gs - Otomatisasi pembuatan Spreadsheet, Sheet, dan Header
 * Fungsi: setupSpreadsheet() untuk inisialisasi Google Spreadsheet sesuai kebutuhan bot
 * Aman dipanggil manual dari Apps Script Editor (tidak mengganggu logika utama)
 *
 * Cara pakai:
 * 1. Buka Apps Script Editor
 * 2. Pilih fungsi setupSpreadsheet, klik Run
 * 3. Ikuti instruksi di log (Spreadsheet ID akan dicetak)
 */

function setupSpreadsheet() {
  // Nama spreadsheet dan sheet sesuai dokumentasi
  var spreadsheetName = 'Ba-banana Radars Config';
  var sheetConfigs = [
    {
      name: 'RadarConfig',
      headers: [
        'guild_id', 'service', 'channel_id', 'interval',
        'mode', 'status', 'last_run', 'emoji_label', 'daily_hour'
      ]
    },
    {
      name: 'RadarLogs',
      headers: [
        'timestamp', 'service', 'guild_id', 'status_emoji',
        'message_id', 'elapsed_ms', 'error_msg'
      ]
    },
    {
      name: 'ChannelCache',
      headers: [
        'guild_id', 'channel_id', 'channel_name', 'emoji_category', 'last_sync'
      ]
    }
  ];

  // Cek apakah sudah ada Spreadsheet ID di Script Properties
  var ssId = getScriptProperty(CONFIG.SPREADSHEET_ID);
  var ss;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
      Logger.log('📄 Spreadsheet ditemukan: ' + ss.getName());
    } catch (e) {
      Logger.log('⚠️ Spreadsheet ID di Script Properties tidak valid. Membuat baru...');
      ss = SpreadsheetApp.create(spreadsheetName);
      setScriptProperty(CONFIG.SPREADSHEET_ID, ss.getId());
      Logger.log('✅ Spreadsheet baru dibuat: ' + ss.getUrl());
    }
  } else {
    ss = SpreadsheetApp.create(spreadsheetName);
    setScriptProperty(CONFIG.SPREADSHEET_ID, ss.getId());
    Logger.log('✅ Spreadsheet baru dibuat: ' + ss.getUrl());
  }

  // Pastikan setiap sheet ada dan header sesuai
  sheetConfigs.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
      Logger.log('➕ Sheet baru dibuat: ' + cfg.name);
    } else {
      Logger.log('✔️ Sheet ditemukan: ' + cfg.name);
    }
    // Set header di baris 1
    var currentHeaders = sheet.getRange(1, 1, 1, cfg.headers.length).getValues()[0];
    var needsUpdate = false;
    for (var i = 0; i < cfg.headers.length; i++) {
      if (currentHeaders[i] !== cfg.headers[i]) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
      Logger.log('🔄 Header diupdate untuk sheet: ' + cfg.name);
    } else {
      Logger.log('✅ Header sudah sesuai untuk sheet: ' + cfg.name);
    }
  });

  // Hapus sheet default "Sheet1" jika masih ada dan bukan salah satu sheet utama
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && !sheetConfigs.some(function(cfg) { return cfg.name === 'Sheet1'; })) {
    ss.deleteSheet(defaultSheet);
    Logger.log('🗑️ Sheet default "Sheet1" dihapus');
  }

  Logger.log('🎉 Setup selesai! Spreadsheet siap digunakan.');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Spreadsheet ID: ' + ss.getId());
}

/**
 * Helper: Get Script Property
 */
function getScriptProperty(key, defaultValue) {
  var props = PropertiesService.getScriptProperties();
  var val = props.getProperty(key);
  return (val !== null && val !== undefined) ? val : defaultValue;
}

/**
 * Helper: Set Script Property
 */
function setScriptProperty(key, value) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(key, value);
}
