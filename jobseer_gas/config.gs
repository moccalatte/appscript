// jobseer_gas/config.gs
// Konstanta dan Konfigurasi untuk JobSeer GAS
// Update: Tambah kolom custom_subject di PARSED sheet

// Nama sheet di spreadsheet
const SHEET_NAMES = {
  RAW: 'lowongan_raw',
  PARSED: 'lowongan_parsed',
  EMAILS: 'sent_emails',
  PROFILES: 'cv_profiles',
  LOGS: 'logs'
};

// Header untuk setiap sheet
const SHEET_HEADERS = {
  RAW: ['timestamp', 'submitted_by', 'content', 'status', 'file_id', 'file_name', 'source_type', 'processed_at', 'notes'],
  PARSED: ['timestamp', 'source_raw_timestamp', 'role', 'company', 'email', 'location', 'salary', 'requirements', 'description', 'status', 'email_manual', 'custom_subject', 'cover_letter'],
  EMAILS: ['timestamp', 'candidate_email', 'recipient_email', 'job_role', 'job_company', 'subject', 'body_preview', 'status', 'message_id', 'error_message'],
  PROFILES: ['user_id', 'name', 'email', 'cv_path', 'ai_prompt', 'skills', 'experiences', 'notes', 'ai_model', 'warned', 'banned', 'created_at', 'updated_at', 'cv_url', 'custom_prompt'],
  LOGS: ['timestamp', 'level', 'message', 'user_id', 'details']
};

// Folder Drive yang digunakan
const DRIVE_FOLDERS = {
  SCREENSHOTS: 'JobSeer_Screenshots'
};

// Property keys untuk penyimpanan ID resource/pemicu
const SCRIPT_PROP_KEYS = {
  SCREENSHOT_FOLDER_ID: 'SCREENSHOT_FOLDER_ID',
  IMAGE_QUEUE_TRIGGER_ID: 'IMAGE_QUEUE_TRIGGER_ID',
  PARSE_QUEUE_TRIGGER_ID: 'PARSE_QUEUE_TRIGGER_ID'
};

// Interval pemrosesan antrean (3 menit default)
const QUEUE_INTERVAL_MS = 3 * 60 * 1000;

// Model AI
const AI_MODELS = {
  GEMINI: 'gemini-2.0-flash-exp',
  OPENROUTER: 'openrouter/auto',
  CLAUDE: 'anthropic/claude-3-5-sonnet'
};

// Emoji menus untuk keyboard (ReplyKeyboardMarkup)
const MENUS = {
  MAIN: [
    ['📝 Daftar Akun', '📋 Menu Utama'],
    ['🤖 Pilih Model', '⚙️ Admin Settings']
  ],
  USER: [
    ['👀 Lihat Profil', '📄 Ganti CV'],
    ['📝 Kirim Teks', '📸 Kirim Foto'],
    ['📨 Kirim Lamaran', '📬 Kirim Semua Draft'],
    ['💬 Chat AI', 'Kembali Menu Utama']
  ],
  APPROVAL: [
    ['✅ Kirim', '💾 Simpan Draft'],
    ['📝 Edit Prompt', '❌ Lewati'],
    ['Kembali Menu Utama']
  ],
  ADMIN: [
    ['📋 List User', '⚠️ Warn User'],
    ['⛔ Ban User', '✅ Unban User'],
    ['🗑️ Hapus User', '🧪 Automated Testing'],
    ['Kembali Menu Utama']
  ]
};

// Fungsi untuk ambil API keys dari Script Properties (fallback array)
function getApiKeys(provider) {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getProperty(provider) ? props.getProperty(provider).split(',') : [];
  if (keys.length === 0) {
    logError('No API keys found for ' + provider);
    throw new Error('API keys not configured for ' + provider);
  }
  return keys;
}

// Fungsi untuk ambil konfigurasi umum dari Properties (statis)
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    SPREADSHEET_ID: props.getProperty('SPREADSHEET_ID') || createSpreadsheet().getId(),
    DEFAULT_MODEL: AI_MODELS.GEMINI,
    THROTTLE_LIMIT: 3,
    THROTTLE_WINDOW: 30 * 1000,
    MAX_EXEC_TIME: 5 * 60 * 1000,
    API_CALL_LIMIT: 50
  };
}

// Fungsi pencegahan quota: Cek execution time dan API calls
let apiCallCount = 0;
let executionStartTime = 0;

// Reset API call counter di awal setiap execution
function resetApiCallCount() {
  apiCallCount = 0;
  executionStartTime = new Date().getTime();
}

function checkQuota() {
  const currentTime = new Date().getTime();
  const elapsedTime = currentTime - executionStartTime;

  if (elapsedTime > getConfig().MAX_EXEC_TIME) {
    logError('Execution time limit exceeded: ' + elapsedTime + 'ms');
    throw new Error('Quota: Execution time exceeded');
  }

  if (apiCallCount >= getConfig().API_CALL_LIMIT) {
    logError('API call limit exceeded: ' + apiCallCount + ' calls');
    throw new Error('Quota: API calls exceeded');
  }

  apiCallCount++;
}

// Fungsi pencegahan rate limiting: Delay antar API calls
function rateLimitDelay(ms = 1000) {
  Utilities.sleep(ms);
}

// Fungsi pencegahan security: Validate input (no script injection)
function validateInput(input) {
  if (typeof input !== 'string' || input.length > 10000) {
    throw new Error('Invalid input: too long or not string');
  }
  return input.replace(/<script[^>]*>.*?<\/script>/gi, '');
}

// Fungsi pencegahan error: Safe execution dengan try-catch
function safeExecute(func, ...args) {
  try {
    checkQuota();
    const result = func(...args);
    return result;
  } catch (e) {
    logError('Safe execute failed: ' + e.message);
    throw e;
  }
}

// Fungsi validasi timestamp
function isValidTimestamp(ts) {
  try {
    if (typeof ts === 'string') {
      return !isNaN(new Date(ts).getTime());
    }
    return ts instanceof Date || !isNaN(ts.getTime());
  } catch (e) {
    return false;
  }
}

// Fungsi parsing timestamp yang aman
function parseTimestamp(ts) {
  try {
    if (typeof ts === 'string') {
      const parsed = new Date(ts);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return ts instanceof Date ? ts : new Date(ts);
  } catch (e) {
    return new Date();
  }
}

function isSameTimestamp(a, b) {
  try {
    const timeA = parseTimestamp(a).getTime();
    const timeB = parseTimestamp(b).getTime();
    return !isNaN(timeA) && !isNaN(timeB) && timeA === timeB;
  } catch (e) {
    return false;
  }
}

// Fungsi sanitize string untuk comparison
function sanitizeString(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim();
}

// Fungsi log (ke spreadsheet, bukan properties)
function logInfo(message, userId = '', details = '') {
  try {
    appendToSheet(SHEET_NAMES.LOGS, [new Date(), 'INFO', message, userId, details]);
  } catch (e) {
    // Silently fail, jangan throw error di log function
    console.log('Log error: ' + e.message);
  }
}

function logError(message, userId = '', details = '') {
  try {
    appendToSheet(SHEET_NAMES.LOGS, [new Date(), 'ERROR', message, userId, details]);
  } catch (e) {
    // Silently fail, jangan throw error di log function
    console.log('Log error: ' + e.message);
  }
}

function logWarning(message, userId = '', details = '') {
  try {
    appendToSheet(SHEET_NAMES.LOGS, [new Date(), 'WARNING', message, userId, details]);
  } catch (e) {
    console.log('Log error: ' + e.message);
  }
}

// Fungsi auto buat spreadsheet jika belum ada
function createSpreadsheet() {
  const spreadsheet = SpreadsheetApp.create('JobSeer Data');
  Object.keys(SHEET_NAMES).forEach(key => {
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES[key]) || spreadsheet.insertSheet(SHEET_NAMES[key]);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SHEET_HEADERS[key.toUpperCase()]);
    }
    // Freeze header row
    sheet.setFrozenRows(1);
  });
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  logInfo('Spreadsheet created and configured: ' + spreadsheet.getId());
  return spreadsheet;
}

// Fungsi backup data
function backupData() {
  try {
    logInfo('Backup triggered');
    // TODO: Implement backup logic (copy to archive spreadsheet)
  } catch (e) {
    logError('Backup failed: ' + e.message);
  }
}

// Fungsi reset semua data (HATI-HATI!)
function resetAllData() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    Object.keys(SHEET_NAMES).forEach(key => {
      const sheet = spreadsheet.getSheetByName(SHEET_NAMES[key]);
      if (sheet) {
        const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
        range.clearContent();
      }
    });
    logWarning('All data cleared');
  }
}
