// 📑 config.gs - Wrapper untuk Spreadsheet & Script Properties
// Fungsi: Read/write config dari Google Sheets & Script Properties
// Dependency: None (core utilities)

/**
 * Konfigurasi global aplikasi
 * Semua setting disimpan di Script Properties atau Spreadsheet
 */

const CONFIG = {
  // ===== SCRIPT PROPERTIES =====
  // Wajib set via Apps Script Project Settings
  DISCORD_PUBLIC_KEY: 'DISCORD_PUBLIC_KEY',
  DISCORD_BOT_TOKEN: 'DISCORD_BOT_TOKEN',
  SPREADSHEET_ID: 'SPREADSHEET_ID',

  // Opsional
  BINANCE_API_KEY: 'BINANCE_API_KEY',
  BINANCE_API_SECRET: 'BINANCE_API_SECRET',
  OPENROUTER_API_KEY: 'OPENROUTER_API_KEY',
  LOG_LEVEL: 'LOG_LEVEL',

  // ===== SPREADSHEET SHEETS =====
  SHEET_RADAR_CONFIG: 'RadarConfig',
  SHEET_RADAR_LOGS: 'RadarLogs',
  SHEET_CHANNEL_CACHE: 'ChannelCache',

  // ===== SHEET COLUMN INDICES (0-based) =====
  // RadarConfig columns
  RADAR_CONFIG_GUILD_ID: 0,
  RADAR_CONFIG_SERVICE: 1,
  RADAR_CONFIG_CHANNEL_ID: 2,
  RADAR_CONFIG_INTERVAL: 3,
  RADAR_CONFIG_MODE: 4,
  RADAR_CONFIG_STATUS: 5,
  RADAR_CONFIG_LAST_RUN: 6,
  RADAR_CONFIG_EMOJI_LABEL: 7,
  RADAR_CONFIG_DAILY_HOUR: 8, // Kolom baru untuk jam eksekusi harian (opsional)

  // RadarLogs columns
  RADAR_LOGS_TIMESTAMP: 0,
  RADAR_LOGS_SERVICE: 1,
  RADAR_LOGS_GUILD_ID: 2,
  RADAR_LOGS_STATUS_EMOJI: 3,
  RADAR_LOGS_MESSAGE_ID: 4,
  RADAR_LOGS_ELAPSED_MS: 5,
  RADAR_LOGS_ERROR_MSG: 6,

  // ChannelCache columns
  CHANNEL_CACHE_GUILD_ID: 0,
  CHANNEL_CACHE_CHANNEL_ID: 1,
  CHANNEL_CACHE_CHANNEL_NAME: 2,
  CHANNEL_CACHE_EMOJI_CATEGORY: 3,
  CHANNEL_CACHE_LAST_SYNC: 4,
};

/**
 * Baca Script Property
 * @param {string} key - Property key
 * @param {*} defaultValue - Nilai default jika tidak ada
 * @returns {*} Property value
 */
function getScriptProperty(key, defaultValue = null) {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty(key);
  return value !== null ? value : defaultValue;
}

/**
 * Set Script Property
 * @param {string} key - Property key
 * @param {string} value - Property value
 */
function setScriptProperty(key, value) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(key, String(value));
  logDebug('🔧 Set property: ' + key + ' = ' + String(value).substring(0, 20) + '...');
}

/**
 * Baca semua Script Properties sebagai object
 * @returns {Object} Semua properties
 */
function getAllScriptProperties() {
  return PropertiesService.getScriptProperties().getProperties();
}

/**
 * Buka Google Spreadsheet
 * @returns {SpreadsheetApp.Spreadsheet} Spreadsheet object
 * @throws {Error} Jika spreadsheet tidak ditemukan
 */
function getSpreadsheet() {
  var spreadsheetId = getScriptProperty(CONFIG.SPREADSHEET_ID);
  if (!spreadsheetId) {
    throw new Error('❌ SPREADSHEET_ID tidak set di Script Properties');
  }
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    throw new Error('❌ Tidak bisa buka spreadsheet ID: ' + spreadsheetId + ' - ' + e.message);
  }
}

/**
 * Buka sheet tertentu dari spreadsheet
 * @param {string} sheetName - Nama sheet (misal: 'RadarConfig')
 * @returns {SpreadsheetApp.Sheet} Sheet object
 * @throws {Error} Jika sheet tidak ditemukan
 */
function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('❌ Sheet "' + sheetName + '" tidak ditemukan di spreadsheet');
  }
  return sheet;
}

/**
 * Baca semua data dari sheet (dengan header)
 * @param {string} sheetName - Nama sheet
 * @returns {Object[]} Array of objects (key = header, value = cell data)
 */
function readSheetAsObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();

  if (data.length === 0) return [];

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }

  return result;
}

/**
 * Baca raw 2D array dari sheet
 * @param {string} sheetName - Nama sheet
 * @returns {Array[]} 2D array
 */
function readSheetRaw(sheetName) {
  var sheet = getSheet(sheetName);
  var range = sheet.getDataRange();
  return range.getValues();
}

/**
 * Append baris ke sheet
 * @param {string} sheetName - Nama sheet
 * @param {Array} rowData - Data baris (array)
 * @returns {number} Row index yang baru ditambah
 */
function appendRowToSheet(sheetName, rowData) {
  var sheet = getSheet(sheetName);
  sheet.appendRow(rowData);
  var newRowIndex = sheet.getLastRow();
  logDebug('📝 Append row to ' + sheetName + ': row ' + newRowIndex);
  return newRowIndex;
}

/**
 * Update cell di sheet
 * @param {string} sheetName - Nama sheet
 * @param {number} row - Row index (1-based)
 * @param {number} col - Column index (1-based)
 * @param {*} value - Value untuk di-set
 */
function setCellValue(sheetName, row, col, value) {
  var sheet = getSheet(sheetName);
  sheet.getRange(row, col).setValue(value);
  logDebug('🔨 Update cell ' + sheetName + ':' + row + ':' + col);
}

/**
 * Update range di sheet
 * @param {string} sheetName - Nama sheet
 * @param {string} rangeNotation - A1 notation (misal: 'A2:C10')
 * @param {Array[]} values - 2D array values
 */
function setRangeValues(sheetName, rangeNotation, values) {
  var sheet = getSheet(sheetName);
  var range = sheet.getRange(rangeNotation);
  range.setValues(values);
  logDebug('📊 Update range ' + sheetName + ':' + rangeNotation);
}

/**
 * Cari row di sheet berdasarkan kolom tertentu
 * @param {string} sheetName - Nama sheet
 * @param {string} columnName - Nama kolom header
 * @param {*} value - Value yang dicari
 * @returns {Array|null} Row object jika ditemukan, null jika tidak
 */
function findRowByColumn(sheetName, columnName, value) {
  var rows = readSheetAsObjects(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][columnName] === value) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Hapus row dari sheet
 * @param {string} sheetName - Nama sheet
 * @param {number} rowIndex - Row index (1-based, termasuk header)
 */
function deleteRowFromSheet(sheetName, rowIndex) {
  if (rowIndex <= 1) {
    throw new Error('❌ Tidak bisa hapus header row (index 1)');
  }
  var sheet = getSheet(sheetName);
  sheet.deleteRow(rowIndex);
  logDebug('🗑️ Delete row from ' + sheetName + ': row ' + rowIndex);
}

/**
 * Hapus semua data di sheet (keep header)
 * @param {string} sheetName - Nama sheet
 */
function clearSheetData(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  logDebug('🧹 Clear data from ' + sheetName);
}

/**
 * Baca RadarConfig aktif (filter by status)
 * @param {string} status - Status filter (misal: '🟢', 'active', null untuk semua)
 * @returns {Object[]} Filtered radar configs
 */
function getActiveRadarConfigs(status = '🟢') {
  var configs = readSheetAsObjects(CONFIG.SHEET_RADAR_CONFIG);
  if (!status) return configs; // return semua
  return configs.filter(function(cfg) {
    return cfg.status === status;
  });
}

/**
 * Buat entry log di RadarLogs
 * @param {Object} logEntry - Log entry object
 */
function logRadarRun(logEntry) {
  // Ensure required fields
  var entry = {
    timestamp: logEntry.timestamp || new Date().toISOString(),
    service: logEntry.service || 'unknown',
    guild_id: logEntry.guild_id || '',
    status_emoji: logEntry.status_emoji || '⚠️',
    message_id: logEntry.message_id || '',
    elapsed_ms: logEntry.elapsed_ms || 0,
    error_msg: logEntry.error_msg || ''
  };

  appendRowToSheet(CONFIG.SHEET_RADAR_LOGS, [
    entry.timestamp,
    entry.service,
    entry.guild_id,
    entry.status_emoji,
    entry.message_id,
    entry.elapsed_ms,
    entry.error_msg
  ]);
}

/**
 * Get log level dari Script Properties
 * @returns {string} Log level (DEBUG, INFO, WARN, ERROR)
 */
function getLogLevel() {
  var level = getScriptProperty(CONFIG.LOG_LEVEL, 'INFO');
  return level.toUpperCase();
}

/**
 * Log debug message
 * @param {string} msg - Message
 */
function logDebug(msg) {
  if (shouldLog('DEBUG')) {
    Logger.log('🔍 [DEBUG] ' + msg);
  }
}

/**
 * Log info message
 * @param {string} msg - Message
 */
function logInfo(msg) {
  if (shouldLog('INFO')) {
    Logger.log('ℹ️ [INFO] ' + msg);
  }
}

/**
 * Log warning message
 * @param {string} msg - Message
 */
function logWarn(msg) {
  if (shouldLog('WARN')) {
    Logger.log('⚠️ [WARN] ' + msg);
  }
}

/**
 * Log error message
 * @param {string} msg - Message
 */
function logError(msg) {
  if (shouldLog('ERROR')) {
    Logger.log('🔴 [ERROR] ' + msg);
  }
}

/**
 * Check jika level harus di-log
 * @param {string} level - Log level
 * @returns {boolean}
 */
function shouldLog(level) {
  var levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  var currentLevel = levels[getLogLevel()] || 1;
  var messageLevel = levels[level] || 1;
  return messageLevel >= currentLevel;
}

/**
 * Validasi Script Properties wajib ada
 * @returns {Object} Validation result dengan status & messages
 */
function validateRequiredProperties() {
  var required = [
    CONFIG.DISCORD_PUBLIC_KEY,
    CONFIG.DISCORD_BOT_TOKEN,
    CONFIG.SPREADSHEET_ID
  ];

  var result = { valid: true, missing: [] };

  required.forEach(function(key) {
    var value = getScriptProperty(key);
    if (!value || String(value).trim() === '') {
      result.valid = false;
      result.missing.push(key);
    }
  });

  return result;
}

/**
 * Test konfigurasi (health check)
 * @returns {Object} Health check result
 */
function testConfiguration() {
  var result = {
    timestamp: new Date().toISOString(),
    spreadsheet: { ok: false, message: '' },
    sheets: { ok: false, message: '' },
    properties: { ok: false, message: '' }
  };

  try {
    var ss = getSpreadsheet();
    result.spreadsheet.ok = true;
    result.spreadsheet.message = 'Spreadsheet accessible ✅';
  } catch (e) {
    result.spreadsheet.message = e.message;
  }

  try {
    var requiredSheets = [
      CONFIG.SHEET_RADAR_CONFIG,
      CONFIG.SHEET_RADAR_LOGS,
      CONFIG.SHEET_CHANNEL_CACHE
    ];
    requiredSheets.forEach(function(sheetName) {
      getSheet(sheetName);
    });
    result.sheets.ok = true;
    result.sheets.message = 'All required sheets present ✅';
  } catch (e) {
    result.sheets.message = e.message;
  }

  try {
    var validation = validateRequiredProperties();
    if (validation.valid) {
      result.properties.ok = true;
      result.properties.message = 'All required properties set ✅';
    } else {
      result.properties.message = 'Missing: ' + validation.missing.join(', ');
    }
  } catch (e) {
    result.properties.message = e.message;
  }

  return result;
}
