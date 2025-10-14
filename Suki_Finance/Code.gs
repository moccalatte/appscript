/**
 * Suki Finance Tracker — Apps Script Backend
 * - Colorful, professionally formatted Google Sheet
 * - Asia/Jakarta timestamps (dd-MM-yyyy HH:mm display)
 * - Frontend + Backend via HtmlService
 * - REST-style JSON endpoints via doGet/doPost for external GET/POST
 *
 * Sheet columns: timestamp | direction | item | amount | category
 * NOTE: No "user" or "source" columns as requested.
 */

// Constants
const SHEET_NAME = 'transaksi';
const TZ = 'Asia/Jakarta';
const HEADER = ['timestamp', 'direction', 'item', 'amount', 'category'];
const SUMMARY_ITEMS = [
  { label: 'total_pengeluaran', metricKey: 'pengeluaranTotal' },
  { label: 'total_pemasukan', metricKey: 'pemasukanTotal' },
  { label: 'saldo', metricKey: 'saldoBerjalan' },
  { label: 'pemasukan_bulan_ini', metricKey: 'pemasukanBulanIni' },
  { label: 'pengeluaran_bulan_ini', metricKey: 'pengeluaranBulanIni' },
  { label: 'pemasukan_hari_ini', metricKey: 'pemasukanHariIni' },
  { label: 'pengeluaran_hari_ini', metricKey: 'pengeluaranHariIni' },
  { label: 'total_hari_ini', metricKey: 'totalHariIni' }
];
const FORMAT_FLAG_PROP = 'SHEET_FORMATTED_V2';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_DEFAULT_MODEL = 'z-ai/glm-4.5-air:free';
const MAX_RECEIPT_ITEMS = 50;

// Entrypoints

function doGet(e) {
  // Ensure sheet exists & formatted
  const sh = ensureSheet_();

  // API mode: return JSON for summary or list
  if (e && e.parameter && e.parameter.api) {
    const api = String(e.parameter.api || '').toLowerCase();
    if (api === 'summary') {
      return jsonOut_(getSummary());
    }
    if (api === 'list') {
      const limit = e.parameter.limit ? parseInt(e.parameter.limit, 10) : 50;
      const category = e.parameter.category ? String(e.parameter.category) : null;
      return jsonOut_(listTransactions(limit, category));
    }
    return jsonOut_({ ok: false, error: 'Unknown api parameter. Use api=summary or api=list' });
  }

  // Default: serve frontend UI
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('💸 Suki Finance Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  // REST-style POST endpoint to record transactions externally
  // Accepts JSON body: { rawText: "keluar kopi 16k, sabun 10rb", direction: "keluar"|"masuk" (optional) }
  try {
    let payload = null;
    if (e && e.postData && e.postData.type === 'application/json' && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.rawText) {
      payload = { rawText: String(e.parameter.rawText), direction: e.parameter.direction ? String(e.parameter.direction) : null };
    }

    if (!payload || !payload.rawText) {
      return jsonOut_({ ok: false, error: 'Missing rawText in POST payload' });
    }

    const direction = payload.direction ? String(payload.direction).toLowerCase() : null;
    const res = recordTransactions(payload.rawText, direction);
    return jsonOut_(res);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// Frontend RPC methods (google.script.run)

function recordTransactions(rawText, directionOverride) {
  const sh = ensureSheet_();

  // Determine direction: prefer explicit override from button; otherwise infer from text
  let direction = directionOverride && (directionOverride === 'masuk' || directionOverride === 'keluar')
    ? directionOverride
    : (rawText.toLowerCase().trim().startsWith('masuk') ? 'masuk' : 'keluar');

  // Clean rawText if it contained leading direction
  const cleaned = rawText.replace(/^(masuk|keluar)\s*/i, '').trim();

  const now = new Date();
  const rows = [];
  const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);

  for (const seg of parts) {
    if (!seg) continue;
    const tokens = seg.split(/\s+/);
    const amountCandidate = tokens.pop(); // last token as amount
    const item = tokens.join(' ').trim();

    const amt = parseAmount_(amountCandidate);
    if (amt === null) {
      // Attempt AI fallback if configured (optional)
      // const ai = tryGeminiFallback_(rawText);
      // // Merge ai results if desired
      // continue; // Skip ambiguous segment without amount
      continue;
    }
    const category = guessCategory_(item);
    rows.push([now, direction, item, amt, category]);
  }

  const result = appendTransactions_(sh, rows);
  return Object.assign(result, {
    direction,
    source: 'text',
    rawText: rawText
  });
}

function processReceiptUpload(payload) {
  try {
    const sh = ensureSheet_();
    const params = payload || {};
    const direction = normalizeDirection_(params.direction, null);
    if (!direction) {
      return { ok: false, error: 'Tentukan dulu apakah ini pemasukan atau pengeluaran.' };
    }

    const base64 = stripDataUrlPrefix_(params.imageBase64 || params.base64 || '');
    if (!base64) {
      return { ok: false, error: 'Gambar struk kosong atau tidak terbaca.' };
    }

    const mimeType = (params.mimeType && String(params.mimeType).startsWith('image/'))
      ? String(params.mimeType)
      : 'image/jpeg';
    const fileName = params.fileName ? String(params.fileName) : null;

    const rawText = callGeminiReceipt_(base64, mimeType, fileName);
    if (!rawText) {
      return { ok: false, error: 'Gemini tidak mengembalikan teks dari struk.' };
    }

    const parsed = callOpenRouterParser_(rawText, direction);
    if (!parsed || !parsed.items || !parsed.items.length) {
      return {
        ok: false,
        error: 'Parser tidak menemukan item pada struk. Coba foto ulang dengan pencahayaan lebih jelas.',
        rawText
      };
    }

    const built = buildRowsFromParsed_(direction, parsed.items);
    if (!built.rows.length) {
      return {
        ok: false,
        error: 'Tidak ada baris valid yang bisa dimasukkan. Periksa hasil parser.',
        rawText,
        warnings: built.skipped || []
      };
    }

    const result = appendTransactions_(sh, built.rows);
    return Object.assign(result, {
      direction,
      source: 'image',
      rawText,
      parsedItems: parsed.items,
      warnings: built.skipped || [],
      notes: parsed.notes || null
    });
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

function appendTransactions_(sh, rows) {
  if (!rows || !rows.length) {
    const summaryInfo = refreshSummarySection_(sh);
    const summary = buildSummaryResult_(summaryInfo.metrics);
    return {
      ok: true,
      count: 0,
      inserted: [],
      summary
    };
  }

  const summaryStartRow = findSummaryStartRow_(sh);
  if (summaryStartRow) {
    sh.insertRowsBefore(summaryStartRow, rows.length);
    sh.getRange(summaryStartRow, 1, rows.length, HEADER.length).setValues(rows);
  } else {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rows.length, HEADER.length).setValues(rows);
  }

  const summaryInfo = refreshSummarySection_(sh);
  const summary = buildSummaryResult_(summaryInfo.metrics);
  return {
    ok: true,
    count: rows.length,
    inserted: rows.map(r => ({
      timestamp: formatDate_(r[0]),
      direction: r[1],
      item: r[2],
      amount: r[3],
      category: r[4]
    })),
    summary
  };
}

function normalizeDirection_(dir, fallback) {
  const val = String(dir || '').trim().toLowerCase();
  if (val === 'masuk' || val === 'keluar') return val;
  return fallback || null;
}

function stripDataUrlPrefix_(data) {
  if (!data) return '';
  const idx = data.indexOf(',');
  if (idx > -1) {
    return data.slice(idx + 1).trim();
  }
  return data.trim();
}

function callGeminiReceipt_(imageBase64, mimeType, fileName) {
  const apiKey = getScriptProp_('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Set GEMINI_API_KEY di Script Properties terlebih dahulu.');
  }
  const model = getScriptProp_('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + model + ':generateContent?key=' + encodeURIComponent(apiKey);

  const prompt = [
    'Kamu adalah OCR struk berbahasa Indonesia.',
    'Keluarkan teks mentah dari struk secara terstruktur baris demi baris.',
    'Fokus pada daftar item belanja dan nominal. Hilangkan dekorasi, total, atau ucapan terima kasih.',
    'Jika ada kolom qty/harga, gabungkan menjadi format "nama qty harga total".',
    'Jawab hanya dengan teks biasa, satu item per baris.'
  ].join('\n');

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt + (fileName ? '\nNama file: ' + fileName : '') },
          { inlineData: { mimeType: mimeType, data: imageBase64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 32,
      maxOutputTokens: 2048
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status >= 300) {
    const preview = text ? text.slice(0, 400) : '';
    throw new Error('Gemini API error (' + status + '): ' + preview);
  }

  const parsed = JSON.parse(text);
  const out = extractGeminiText_(parsed);
  if (!out) {
    throw new Error('Gemini tidak memberikan hasil yang bisa dibaca.');
  }
  return out.trim();
}

function extractGeminiText_(resp) {
  if (!resp || !resp.candidates || !resp.candidates.length) return '';
  for (const cand of resp.candidates) {
    const parts = cand && cand.content && cand.content.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part && part.text) {
        return String(part.text);
      }
    }
  }
  if (resp.text) return String(resp.text);
  return '';
}

function callOpenRouterParser_(rawText, direction) {
  const apiKey = getScriptProp_('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('Set OPENROUTER_API_KEY di Script Properties terlebih dahulu.');
  }
  const model = getScriptProp_('OPENROUTER_MODEL') || OPENROUTER_DEFAULT_MODEL;

  const system = 'Kamu adalah parser struk Bahasa Indonesia. Jawab hanya dengan JSON valid.';
  const user = [
    'Teks struk:',
    '"""',
    rawText,
    '"""',
    '',
    'Keluarkan JSON dengan format:',
    '{',
    '  "items": [',
    '    { "item": string, "amount": number, "category": string? }',
    '  ],',
    '  "notes": string optional jika ada informasi penting lain',
    '}',
    '',
    'Semua amount dalam rupiah (angka bulat). Jangan masukkan total akhir, hanya item belanja.',
    'Gunakan kategori yang paling masuk akal. Jika kosong, kembalikan null.',
    'Transaksi ini adalah "' + direction + '". Jangan menyertakan teks lain di luar JSON.'
  ].join('\n');

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0
  };

  const res = UrlFetchApp.fetch(OPENROUTER_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://script.google.com',
      'X-Title': 'Suki Finance Parser'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status >= 300) {
    const preview = text ? text.slice(0, 400) : '';
    throw new Error('OpenRouter API error (' + status + '): ' + preview);
  }

  const parsed = JSON.parse(text);
  const content = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message
    ? parsed.choices[0].message.content
    : null;
  const data = parseJsonFromText_(content);
  if (!data) {
    throw new Error('Respon OpenRouter tidak dalam format JSON.');
  }
  return data;
}

function parseJsonFromText_(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function buildRowsFromParsed_(direction, items) {
  const now = new Date();
  const rows = [];
  const skipped = [];
  if (!Array.isArray(items)) {
    return { rows: [], skipped };
  }

  const limit = Math.min(items.length, MAX_RECEIPT_ITEMS);
  for (let i = 0; i < limit; i++) {
    const entry = items[i] || {};
    const itemName = String(entry.item || entry.name || '').trim();
    const amountCandidate = entry.amount != null ? entry.amount : (entry.total != null ? entry.total : entry.price);
    const amount = normalizeAmountValue_(amountCandidate);
    if (!itemName || amount === null) {
      skipped.push({ reason: 'invalid', index: i, entry });
      continue;
    }
    const category = entry.category
      ? String(entry.category)
      : guessCategory_(itemName);
    rows.push([now, direction, itemName, amount, category]);
  }

  if (items.length > limit) {
    skipped.push({ reason: 'limit', skippedCount: items.length - limit });
  }

  return { rows, skipped };
}

function normalizeAmountValue_(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!isFinite(value)) return null;
    return Math.round(value);
  }
  const str = String(value).toLowerCase().replace(/rp|\:|idr|\s+/g, '');
  const parsed = parseAmount_(str);
  if (parsed !== null) return parsed;
  const numeric = Number(str.replace(/[^\d]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function getScriptProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function listTransactions(limit, categoryFilter) {
  const sh = ensureSheet_();
  const dataValues = getDataValues_(sh);
  if (!dataValues.length) return { ok: true, items: [] }; // only header exists or sheet empty

  const limitCount = Math.max(1, limit || 50);
  const slice = dataValues.slice(-limitCount);
  const mapped = slice.map(r => ({
    timestamp: formatMaybeDate_(r[0]),
    direction: String(r[1]),
    item: String(r[2]),
    amount: Number(r[3]),
    category: String(r[4])
  })).reverse(); // latest first

  const filtered = categoryFilter
    ? mapped.filter(it => it.category && it.category.toLowerCase() === categoryFilter.toLowerCase())
    : mapped;

  return { ok: true, items: filtered };
}

function getSummary() {
  const sh = ensureSheet_();
  const dataValues = getDataValues_(sh);
  const metrics = computeSummaryMetrics_(dataValues);
  return buildSummaryResult_(metrics);
}

// Helpers: Sheet setup & formatting

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet. Please bind the script via Extensions → Apps Script in a Google Sheet.');

  // Set Spreadsheet timezone to Asia/Jakarta
  try {
    if (ss.getSpreadsheetTimeZone() !== TZ) {
      ss.setSpreadsheetTimeZone(TZ);
    }
  } catch (err) {
    // ignore if not permitted
  }

  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
  }

  // Ensure headers exactly match (in case of prior runs)
  const headerRange = sh.getRange(1, 1, 1, HEADER.length);
  const currentHeader = headerRange.getValues()[0];
  const needsHeaderReset = HEADER.some((h, i) => String(currentHeader[i]).toLowerCase() !== h.toLowerCase());
  if (needsHeaderReset) {
    headerRange.setValues([HEADER]);
  }

  removeLegacyRawTextColumn_(sh);
  ensureSummaryColumns_(sh);
  formatSheetOnce_(sh);
  refreshSummarySection_(sh);
  return sh;
}

function formatSheetOnce_(sh) {
  const props = PropertiesService.getScriptProperties();
  const formattedFlag = props.getProperty(FORMAT_FLAG_PROP);
  if (formattedFlag === 'true') {
    return; // already formatted
  }

  // Base geometry
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, HEADER.length, 200);
  sh.setColumnWidth(1, 220); // timestamp
  sh.setColumnWidth(2, 150); // direction
  sh.setColumnWidth(3, 260); // item
  sh.setColumnWidth(4, 170); // amount
  sh.setColumnWidth(5, 210); // category

  // Header styling (flat palette)
  const head = sh.getRange(1, 1, 1, HEADER.length);
  head.setFontFamily('Bricolage Grotesque');
  head.setFontWeight('bold');
  head.setFontSize(12);
  head.setHorizontalAlignment('center');
  head.setBackground('#4F6D7A');
  head.setFontColor('#FFFFFF');
  head.setBorder(true, true, true, true, true, true, '#455A64', SpreadsheetApp.BorderStyle.SOLID);

  // Amount number format (Rp)
  // Apply to entire column D: from row 2 to end
  const rowsForFormat = Math.max(1000, sh.getMaxRows()); // ensure wide coverage
  sh.getRange(2, 4, rowsForFormat, 1).setNumberFormat('"Rp" #,##0;"Rp" -#,##0');

  // Timestamp number format with Asia/Jakarta display (24h)
  sh.getRange(2, 1, rowsForFormat, 1).setNumberFormat('dd-MM-yyyy HH:mm');

  // Conditional formatting on "direction" column (B)
  const dirRange = sh.getRange(2, 2, rowsForFormat, 1);
  const ruleMasuk = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('masuk')
    .setBackground('#D7EBE0')
    .setFontColor('#1B5E20')
    .setRanges([dirRange])
    .build();
  const ruleKeluar = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('keluar')
    .setBackground('#F9E0E0')
    .setFontColor('#B71C1C')
    .setRanges([dirRange])
    .build();
  const existing = sh.getConditionalFormatRules() || [];
  sh.setConditionalFormatRules([...existing, ruleMasuk, ruleKeluar]);

  // Soft flat background for data area
  const dataRange = sh.getRange(2, 1, rowsForFormat, HEADER.length);
  dataRange.setBackground('#FAFAFA')
    .setFontFamily('Bricolage Grotesque')
    .setFontSize(11)
    .setFontColor('#37474F');

  // Freeze panes and gridlines keep visible
  sh.setFrozenRows(1);
  sh.activate();

  // Mark formatted
  props.setProperty(FORMAT_FLAG_PROP, 'true');
}

function removeLegacyRawTextColumn_(sh) {
  const rawColIndex = HEADER.length + 1;
  if (sh.getMaxColumns() < rawColIndex) return;
  const headerValue = String(sh.getRange(1, rawColIndex).getValue() || '').toLowerCase();
  if (headerValue === 'raw_text') {
    sh.deleteColumn(rawColIndex);
  }
}

function ensureSummaryColumns_(sh) {
  const requiredCols = Math.max(HEADER.length, 2);
  const currentCols = sh.getMaxColumns();
  if (currentCols < requiredCols) {
    sh.insertColumnsAfter(currentCols, requiredCols - currentCols);
  }
}

function ensureFilterForData_(sh, dataRowCount) {
  const existing = sh.getFilter();
  if (existing) {
    existing.remove();
  }
  const filterRows = Math.max(2, dataRowCount + 1); // include header + at least one row
  const range = sh.getRange(1, 1, filterRows, HEADER.length);
  range.createFilter();
}

function refreshSummarySection_(sh) {
  ensureSummaryColumns_(sh);
  const dataValues = getDataValues_(sh);
  const dataRowCount = dataValues.length;
  const blankRow = dataRowCount + 2; // header row (1) + data rows + 1
  const desiredSummaryStartRow = dataRowCount + 3;
  const existingSummaryRow = findSummaryStartRow_(sh);

  if (existingSummaryRow && existingSummaryRow !== desiredSummaryStartRow) {
    const columnsToClear = Math.max(HEADER.length, SUMMARY_ITEMS.length);
    let clearStartRow = existingSummaryRow;
    if (existingSummaryRow > 2) {
      const rowBeforeValues = sh.getRange(existingSummaryRow - 1, 1, 1, HEADER.length).getValues()[0];
      const isBlankBefore = rowBeforeValues.every(v => {
        if (v == null) return true;
        if (v instanceof Date) return false;
        return String(v).trim() === '';
      });
      if (isBlankBefore) {
        clearStartRow = existingSummaryRow - 1;
      }
    }
    const maxClearRows = sh.getMaxRows() - clearStartRow + 1;
    const rowsToClear = Math.min(SUMMARY_ITEMS.length + 1, Math.max(1, maxClearRows));
    sh.getRange(clearStartRow, 1, rowsToClear, columnsToClear).clearContent().clearFormat();
  }

  const requiredRows = desiredSummaryStartRow + SUMMARY_ITEMS.length - 1;
  if (sh.getMaxRows() < requiredRows) {
    sh.insertRowsAfter(sh.getMaxRows(), requiredRows - sh.getMaxRows());
  }

  sh.getRange(blankRow, 1, 1, HEADER.length).clearContent().clearFormat();

  const metrics = computeSummaryMetrics_(dataValues);
  const rows = SUMMARY_ITEMS.map(item => [
    item.label + ' :',
    metrics[item.metricKey] || 0
  ]);
  const summaryRange = sh.getRange(desiredSummaryStartRow, 1, SUMMARY_ITEMS.length, 2);
  summaryRange.setValues(rows);

  applySummaryFormatting_(sh, desiredSummaryStartRow);
  ensureFilterForData_(sh, dataRowCount);

  return { metrics, summaryStartRow: desiredSummaryStartRow };
}

function applySummaryFormatting_(sh, headerRow) {
  const totalRows = SUMMARY_ITEMS.length;
  const labelRange = sh.getRange(headerRow, 1, totalRows, 1);
  const valueRange = sh.getRange(headerRow, 2, totalRows, 1);
  const allRange = sh.getRange(headerRow, 1, totalRows, 2);

  labelRange.setFontFamily('Bricolage Grotesque')
    .setFontWeight('bold')
    .setFontSize(11)
    .setHorizontalAlignment('left')
    .setBackground('#F4F6F8')
    .setFontColor('#37474F')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  valueRange.setFontFamily('Bricolage Grotesque')
    .setFontWeight('bold')
    .setFontSize(11)
    .setHorizontalAlignment('right')
    .setNumberFormat('"Rp" #,##0;"Rp" -#,##0')
    .setBackground('#FFFFFF')
    .setFontColor('#263238')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  allRange.setBorder(true, true, true, true, true, true, '#90A4AE', SpreadsheetApp.BorderStyle.SOLID);
}

function buildSummaryResult_(metrics) {
  return {
    ok: true,
    saldoBerjalan: metrics.saldoBerjalan,
    pemasukanBulanIni: metrics.pemasukanBulanIni,
    pengeluaranBulanIni: metrics.pengeluaranBulanIni,
    pemasukanHariIni: metrics.pemasukanHariIni,
    pengeluaranHariIni: metrics.pengeluaranHariIni,
    totalHariIni: metrics.totalHariIni
  };
}

function computeSummaryMetrics_(values) {
  if (!values || !values.length) {
    return {
      pemasukanTotal: 0,
      pengeluaranTotal: 0,
      saldoBerjalan: 0,
      pemasukanBulanIni: 0,
      pengeluaranBulanIni: 0,
      pemasukanHariIni: 0,
      pengeluaranHariIni: 0,
      totalHariIni: 0
    };
  }

  const now = new Date();
  const keyMonth = Utilities.formatDate(now, TZ, 'yyyy-MM');
  const keyDay = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');

  let pemasukanTotal = 0;
  let pengeluaranTotal = 0;
  let pemasukanBulanIni = 0;
  let pengeluaranBulanIni = 0;
  let pemasukanHariIni = 0;
  let pengeluaranHariIni = 0;

  for (const r of values) {
    const dt = r[0];
    const dir = String(r[1]).toLowerCase();
    const amt = Number(r[3]) || 0;

    const rowMonth = dt instanceof Date ? Utilities.formatDate(dt, TZ, 'yyyy-MM') : String(r[0]).slice(0, 7);
    const rowDay = dt instanceof Date ? Utilities.formatDate(dt, TZ, 'yyyy-MM-dd') : String(r[0]).slice(0, 10);

    if (dir === 'masuk') {
      pemasukanTotal += amt;
      if (rowMonth === keyMonth) pemasukanBulanIni += amt;
      if (rowDay === keyDay) pemasukanHariIni += amt;
    } else if (dir === 'keluar') {
      pengeluaranTotal += amt;
      if (rowMonth === keyMonth) pengeluaranBulanIni += amt;
      if (rowDay === keyDay) pengeluaranHariIni += amt;
    }
  }

  const saldoBerjalan = pemasukanTotal - pengeluaranTotal;
  const totalHariIni = pemasukanHariIni + pengeluaranHariIni;

  return {
    pemasukanTotal,
    pengeluaranTotal,
    saldoBerjalan,
    pemasukanBulanIni,
    pengeluaranBulanIni,
    pemasukanHariIni,
    pengeluaranHariIni,
    totalHariIni
  };
}

function getDataRowCount_(sh) {
  const summaryRow = findSummaryStartRow_(sh);
  if (summaryRow) {
    if (summaryRow <= 2) return 0;
    const rowBeforeSummary = summaryRow - 1;
    const values = sh.getRange(rowBeforeSummary, 1, 1, HEADER.length).getValues()[0];
    const isBlank = values.every(v => {
      if (v == null) return true;
      if (v instanceof Date) return false;
      return String(v).trim() === '';
    });
    if (isBlank) {
      return Math.max(0, rowBeforeSummary - 2);
    }
    return Math.max(0, summaryRow - 2);
  }
  const lastRow = sh.getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}

function getDataValues_(sh) {
  const rowCount = getDataRowCount_(sh);
  if (rowCount <= 0) return [];
  return sh.getRange(2, 1, rowCount, HEADER.length).getValues();
}

function findSummaryStartRow_(sh) {
  const candidates = [
    SUMMARY_ITEMS[0].label + ' :',
    SUMMARY_ITEMS[1].label + ' :',
    SUMMARY_ITEMS[1].label,
    SUMMARY_ITEMS[0].label
  ];
  for (const text of candidates) {
    const finder = sh.createTextFinder(text);
    if (!finder) continue;
    const matches = finder
      .matchCase(true)
      .matchEntireCell(true)
      .findAll() || [];
    for (const rng of matches) {
      if (rng.getColumn() === 1) {
        return rng.getRow();
      }
    }
  }
  return null;
}

// Helpers: parsing & categorization

function parseAmount_(s) {
  if (s == null) return null;
  let t = ('' + s).toLowerCase().trim();

  // Normalize separators, but keep decimal for "5.2jt"
  t = t.replace(/,/g, '').replace(/\s+/g, '');

  // jt / juta
  const jutaMatch = t.match(/^([\d]+(?:\.\d+)?)\s*(jt|juta)$/);
  if (jutaMatch) {
    const base = parseFloat(jutaMatch[1]);
    if (!isNaN(base)) return Math.round(base * 1000000);
  }
  if (/jt|juta/.test(t) && !isNaN(parseFloat(t))) {
    const num = parseFloat(t);
    return Math.round(num * 1000000);
  }

  // rb / ribu / k
  const ribuMatch = t.match(/^([\d]+(?:\.\d+)?)\s*(rb|ribu|k)$/);
  if (ribuMatch) {
    const base = parseFloat(ribuMatch[1]);
    if (!isNaN(base)) return Math.round(base * 1000);
  }
  if (/(rb|ribu|k)$/.test(t) && !isNaN(parseFloat(t))) {
    const num = parseFloat(t);
    return Math.round(num * 1000);
  }

  // plain number (accept 16000 or 16.000 style—commas removed)
  const plain = t.replace(/\./g, '');
  if (!isNaN(Number(plain))) {
    return Number(plain);
  }

  return null;
}

function guessCategory_(text) {
  const t = String(text || '').toLowerCase();

  if (/(kopi|teh|minum|makan|nasi|roti|snack|warteg|warung|resto)/.test(t)) return 'Makanan & Minuman';
  if (/(sabun|sampo|odol|tissue|detergen|pembersih)/.test(t)) return 'Kebersihan';
  if (/(gojek|grab|bensin|tol|parkir|ojol|transport)/.test(t)) return 'Transport';
  if (/(baju|celana|sepatu|pakaian|topi|jaket)/.test(t)) return 'Pakaian';
  if (/(listrik|wifi|air|pulsa|token|paket data|internet)/.test(t)) return 'Tagihan';
  if (/(netflix|spotify|game|bioskop|hiburan|konser)/.test(t)) return 'Hiburan';
  return 'Lainnya';
}

// Optional: Gemini fallback (disabled by default)
function tryGeminiFallback_(rawText) {
  // Enable iff script property GEMINI_API_KEY is set
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return null;

  const prompt = 'Analisis teks transaksi berikut, keluarkan JSON dengan field "direction", dan "items":[{"item","amount","category"}]. Teks: ' + rawText;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    muteHttpExceptions: true
  });

  const text = res.getContentText();
  try {
    const parsed = JSON.parse(text);
    // You may tailor extraction per actual API response shape
    return parsed;
  } catch (err) {
    return null;
  }
}

// Utilities

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate_(d) {
  try {
    return Utilities.formatDate(d, TZ, 'dd-MM-yyyy HH:mm');
  } catch (err) {
    return String(d);
  }
}

function formatMaybeDate_(d) {
  if (d instanceof Date) return formatDate_(d);
  // try parse if stored as string
  return String(d);
}

/**
 * Example clickable constructs in this backend:
 * - [`function doGet()`](Code.gs:30)
 * - [`function recordTransactions()`](Code.gs:79)
 * - [`function getSummary()`](Code.gs:162)
 * - [`function ensureSheet_()`](Code.gs:171)
 * - [`function parseAmount_()`](Code.gs:494)
 * - [`function guessCategory_()`](Code.gs:532)
 */
