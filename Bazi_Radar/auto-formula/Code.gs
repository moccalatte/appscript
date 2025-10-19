/**
 * Apps Script implementation for the Auto-Formula Daily BaZi Overview bot.
 * Fulfils the requirements outlined in prd.md.
 */

let cachedConfig = null;

const CONFIG_DEFAULTS = {
  SHEET_NAME: 'logs',
  SPREADSHEET_NAME: 'bazi_daily_logs',
  OPENROUTER_MODEL: 'z-ai/glm-4.5-air:free',
  GEMINI_MODEL: 'gemini-2.5-flash',
  TARGET_DATE: '2025-10-19',
  PAUSE_MS_NORMAL: 60 * 1000,
  PAUSE_MS_RATELIMIT: 5 * 60 * 1000,
  KEYWORD: 'Xin You'
};

const AUTO_TRIGGER_PROPERTY_KEY = 'AUTO_RUN_TRIGGER_ID';

const BASE_PROMPT_TEMPLATE =
  'You’re an expert BaZi practitioner. Compare this natal chart with the target date and give a concise daily overview (<500 chars).\n\n' +
  'Birth Time: 07:05 (Asia/Jakarta)\n' +
  'Birth Date: 03-03-2000. Gender: Male\n\n' +
  'Hour: Yang Earth [戊, wu], Dragon [辰, chen]\n' +
  'Day:  Yang Metal [庚, geng], Monkey [申, shen]\n' +
  'Month:Yang Earth [戊, wu], Tiger [寅, yin]\n' +
  'Year: Yang Metal [庚, geng], Dragon [辰, chen]\n\n' +
  'Only discuss the day pillar for {{TARGET_DATE}}: possibilities, energy flow, and self-state.';

/**
 * Entry point for production runs. Executes exactly one Gemini → OpenRouter → Gemini cycle.
 */
function runProduction() {
  consumeAutoTrigger();
  const cfg = getConfig();
  const runId = createRunId();
  const basePrompt = buildPrompt(cfg);
  const startingPrompt = determineStartingPrompt(basePrompt);
  const cycleStatus = executeCycle({
    cfg,
    runId,
    basePrompt,
    initialPrompt: startingPrompt
  });
  if (cycleStatus === 'completed') {
    scheduleNextRun(cfg.PAUSE_MS_NORMAL, 'completed', runId);
  } else if (cycleStatus === 'rate_limited') {
    scheduleNextRun(cfg.PAUSE_MS_RATELIMIT, 'rate_limited', runId);
  }
}

/**
 * Lightweight function to verify connectivity and logging.
 */
function testOnce() {
  const cfg = getConfig();
  const runId = createRunId();
  const basePrompt = buildPrompt(cfg);
  const startingPrompt = determineStartingPrompt(basePrompt);
  executeCycle({
    cfg,
    runId,
    basePrompt,
    initialPrompt: startingPrompt
  });
}

/**
 * Executes a single request→improve→retry cycle and logs every step.
 *
 * @param {Object} params
 */
function executeCycle(params) {
  const cfg = params.cfg;
  const runId = params.runId;
  const basePrompt = params.basePrompt;
  const firstPrompt = truncate(coerceString(params.initialPrompt) || basePrompt, 700);

  const firstGemini = callGemini(firstPrompt, cfg);
  logRow({
    timestamp: new Date().toISOString(),
    runId,
    provider: 'gemini',
    model: cfg.GEMINI_MODEL,
    attempt: 1,
    promptUsed: firstPrompt,
    responseRaw: firstGemini.rawBody || firstGemini.text,
    responseGemini: firstGemini.text,
    responseOpenRouter: '',
    foundXinYou: firstGemini.foundKeyword,
    status: firstGemini.status,
    httpStatus: firstGemini.httpStatus,
    errorCode: firstGemini.errorCode,
    errorMessage: firstGemini.errorMessage,
    tokensOrUsage: firstGemini.usage,
    note: firstGemini.note || 'initial'
  });

  if (firstGemini.status === 'quota_exhausted') {
    notifyDiscordStop('Gemini quota exhausted');
    return 'quota_exhausted';
  }
  if (firstGemini.status === 'rate_limited') {
    return 'rate_limited';
  }
  if (firstGemini.status === 'error') {
    notifyDiscordStop('Gemini error: ' + coerceString(firstGemini.errorMessage));
    return 'error';
  }

  if (!shouldContinueAfterGemini(firstGemini.status)) {
    return 'completed';
  }

  const improveOutcome = callOpenRouterImprove(firstPrompt, firstGemini.text || '', cfg);
  logRow({
    timestamp: new Date().toISOString(),
    runId,
    provider: 'openrouter',
    model: cfg.OPENROUTER_MODEL,
    attempt: 1,
    promptUsed: improveOutcome.request,
    responseRaw: improveOutcome.rawBody || improveOutcome.prompt,
    responseGemini: '',
    responseOpenRouter: coerceString(improveOutcome.prompt) || coerceString(improveOutcome.rawBody) || coerceString(improveOutcome.errorMessage),
    foundXinYou: null,
    status: improveOutcome.status,
    httpStatus: improveOutcome.httpStatus,
    errorCode: improveOutcome.errorCode,
    errorMessage: improveOutcome.errorMessage,
    tokensOrUsage: improveOutcome.usage,
    note: improveOutcome.note || 'improve'
  });

  if (improveOutcome.status === 'quota_exhausted') {
    notifyDiscordStop('OpenRouter quota exhausted');
    return 'quota_exhausted';
  }
  if (improveOutcome.status === 'rate_limited') {
    return 'rate_limited';
  }
  if (improveOutcome.status !== 'improved' || !improveOutcome.prompt) {
    if (improveOutcome.status === 'error') {
      notifyDiscordStop('OpenRouter error: ' + coerceString(improveOutcome.errorMessage));
    }
    return improveOutcome.status === 'error' ? 'error' : 'completed';
  }

  const improvedPrompt = truncate(coerceString(improveOutcome.prompt), 700);
  const secondGemini = callGemini(improvedPrompt, cfg);
  logRow({
    timestamp: new Date().toISOString(),
    runId,
    provider: 'gemini',
    model: cfg.GEMINI_MODEL,
    attempt: 2,
    promptUsed: improvedPrompt,
    responseRaw: secondGemini.rawBody || secondGemini.text,
    responseGemini: secondGemini.text,
    responseOpenRouter: improvedPrompt,
    foundXinYou: secondGemini.foundKeyword,
    status: secondGemini.status,
    httpStatus: secondGemini.httpStatus,
    errorCode: secondGemini.errorCode,
    errorMessage: secondGemini.errorMessage,
    tokensOrUsage: secondGemini.usage,
    note: secondGemini.note || 'retry'
  });

  if (secondGemini.status === 'quota_exhausted') {
    notifyDiscordStop('Gemini quota exhausted (improved prompt)');
    return 'quota_exhausted';
  }
  if (secondGemini.status === 'rate_limited') {
    return 'rate_limited';
  }
  if (secondGemini.status === 'error') {
    notifyDiscordStop('Gemini error after improve: ' + coerceString(secondGemini.errorMessage));
    return 'error';
  }
  return 'completed';
}

/**
 * Determines whether we should continue to the improve step after a Gemini call.
 *
 * @param {string} status
 * @returns {boolean}
 */
function shouldContinueAfterGemini(status) {
  return status === 'ok' || status === 'no_keyword';
}

/**
 * Fetches the most recent improved prompt from the log, or returns the default.
 *
 * @param {string} defaultPrompt
 * @returns {string}
 */
function determineStartingPrompt(defaultPrompt) {
  try {
    const sheet = getLoggingSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return defaultPrompt;
    }
    const rowCount = lastRow - 1;
    const startCol = 3; // provider column
    const colSpan = 9; // provider..status
    const values = sheet.getRange(2, startCol, rowCount, colSpan).getValues();
    for (var idx = values.length - 1; idx >= 0; idx--) {
      const row = values[idx];
      const provider = coerceString(row[0]).toLowerCase();
      const improvedPrompt = coerceString(row[6]).trim();
      const status = coerceString(row[8]).toLowerCase();
      if (provider === 'openrouter' && status === 'improved' && improvedPrompt) {
        return truncate(improvedPrompt, 700);
      }
    }
  } catch (err) {
    // fall back silently; logging here could recurse
  }
  return defaultPrompt;
}

/**
 * Calls Gemini with retries and returns structured outcome information.
 *
 * @param {string} prompt
 * @param {Object} cfg
 * @returns {Object}
 */
function callGemini(prompt, cfg) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(cfg.GEMINI_MODEL) + ':generateContent?key=' + encodeURIComponent(cfg.GEMINI_API_KEY);
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: truncate(prompt, 700) }]
      }
    ]
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const keyword = cfg.KEYWORD;
  return performFetch({
    url,
    options,
    provider: 'gemini',
    parser: function (body, httpStatus) {
      return parseGeminiResponse(body, httpStatus, keyword);
    }
  });
}

/**
 * Calls OpenRouter to improve the prompt.
 *
 * @param {string} basePrompt
 * @param {string} lastGeminiResponse
 * @param {Object} cfg
 * @returns {Object}
 */
function callOpenRouterImprove(currentPrompt, lastGeminiResponse, cfg) {
  const instruction = buildImprovePromptInstruction(currentPrompt, lastGeminiResponse);
  try {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const payload = {
      model: cfg.OPENROUTER_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You are a precise prompt editor for BaZi tasks.' },
        { role: 'user', content: instruction }
      ]
    };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + cfg.OPENROUTER_API_KEY,
        'HTTP-Referer': cfg.HTTP_REFERER || 'https://script.google.com',
        'X-Title': cfg.OPENROUTER_TITLE || 'BaZi Prompt Bot',
        Accept: 'application/json'
      }
    };
    const outcome = performFetch({
      url,
      options,
      provider: 'openrouter',
      parser: parseOpenRouterResponse
    });
    outcome.request = instruction;
    if (outcome.status === 'ok' && outcome.prompt) {
      outcome.prompt = truncate(outcome.prompt, 700);
      outcome.status = 'improved';
      outcome.note = outcome.note ? outcome.note + ' | prompt improved' : 'prompt improved';
    } else if (outcome.status === 'ok') {
      outcome.status = 'error';
      outcome.errorMessage = outcome.errorMessage || 'Empty improved prompt';
      outcome.note = outcome.note ? outcome.note + ' | empty response' : 'empty response';
    }
    return outcome;
  } catch (err) {
    return {
      status: 'error',
      httpStatus: null,
      errorCode: err.name || 'Exception',
      errorMessage: err.message,
      usage: null,
      prompt: '',
      rawBody: '',
      note: 'callOpenRouterImprove exception',
      request: instruction
    };
  }
}

/**
 * Performs HTTP fetch with up to three retries and normalised response object.
 *
 * @param {Object} params
 * @returns {Object}
 */
function performFetch(params) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = UrlFetchApp.fetch(params.url, params.options);
      const httpStatus = response.getResponseCode();
      const body = response.getContentText();
      const parsed = params.parser(body, httpStatus);
      parsed.httpStatus = httpStatus;
      parsed.status = parsed.status || inferStatus(httpStatus, parsed.errorMessage);
      parsed.errorCode = parsed.errorCode || null;
      parsed.rawBody = parsed.rawBody || body;
      parsed.note = parsed.note || (attempt > 1 ? 'retried ' + attempt + 'x' : '');
      return parsed;
    } catch (err) {
      if (attempt === maxAttempts) {
        return {
          status: 'error',
          httpStatus: null,
          errorCode: err.name || 'Exception',
          errorMessage: err.message,
          usage: null,
          text: '',
          prompt: '',
          rawBody: ''
        };
      }
      Utilities.sleep(1000 * attempt);
    }
  }
  return {
    status: 'error',
    httpStatus: null,
    errorCode: 'Unknown',
    errorMessage: 'Unexpected error',
    usage: null,
    text: '',
    prompt: '',
    rawBody: ''
  };
}

/**
 * Parses Gemini response body.
 *
 * @param {string} body
 * @param {number} httpStatus
 * @returns {Object}
 */
function parseGeminiResponse(body, httpStatus, keyword) {
  const result = {
    usage: null,
    text: '',
    errorMessage: '',
    note: '',
    errorCode: null,
    rawBody: body
  };
  try {
    const json = JSON.parse(body);
    if (httpStatus >= 200 && httpStatus < 300) {
      const candidate = (json.candidates && json.candidates.length > 0) ? json.candidates[0] : null;
      const partText = candidate && candidate.content && candidate.content.parts && candidate.content.parts.length
        ? candidate.content.parts.map(function (part) { return part.text || ''; }).join('\n')
        : '';
      result.text = partText;
      result.foundKeyword = containsKeyword(partText, keyword);
      if (json.usageMetadata) {
        result.usage = JSON.stringify(json.usageMetadata);
      }
      result.status = result.foundKeyword ? 'ok' : 'no_keyword';
      if (!result.foundKeyword) {
        result.note = 'keyword missing';
      }
    } else {
      const message = extractErrorMessage(json);
      result.errorMessage = message;
      result.status = inferStatus(httpStatus, message);
      if (json.error && json.error.code) {
        result.errorCode = String(json.error.code);
      }
    }
  } catch (err) {
    result.errorMessage = err.message;
    result.status = inferStatus(httpStatus, err.message);
  }
  return result;
}

/**
 * Parses OpenRouter response body.
 *
 * @param {string} body
 * @param {number} httpStatus
 * @returns {Object}
 */
function parseOpenRouterResponse(body, httpStatus) {
  const result = {
    usage: null,
    prompt: '',
    errorMessage: '',
    note: '',
    errorCode: null,
    rawBody: body
  };
  try {
    const json = JSON.parse(body);
    if (httpStatus >= 200 && httpStatus < 300) {
      const choice = (json.choices && json.choices.length > 0) ? json.choices[0] : null;
      const content = choice && choice.message ? choice.message.content : '';
      result.prompt = normalizeMessageContent(content);
      if (json.usage) {
        result.usage = JSON.stringify(json.usage);
      }
      result.status = 'ok';
    } else {
      const message = extractErrorMessage(json);
      result.errorMessage = message;
      result.status = inferStatus(httpStatus, message);
      if (json.error && json.error.code) {
        result.errorCode = String(json.error.code);
      }
    }
  } catch (err) {
    result.errorMessage = err.message;
    result.status = inferStatus(httpStatus, err.message);
  }
  return result;
}

/**
 * Infers canonical status from HTTP status code and error message.
 *
 * @param {number|null} httpStatus
 * @param {string} message
 * @returns {string}
 */
function inferStatus(httpStatus, message) {
  const lower = (message || '').toLowerCase();
  if (httpStatus === 429 || lower.indexOf('rate limit') >= 0 || lower.indexOf('too many requests') >= 0 ||
    lower.indexOf('resourceexhausted') >= 0) {
    return 'rate_limited';
  }
  if (lower.indexOf('quota') >= 0 && lower.indexOf('exceed') >= 0) {
    return 'quota_exhausted';
  }
  if (httpStatus && httpStatus >= 200 && httpStatus < 300) {
    return 'ok';
  }
  return 'error';
}

/**
 * Builds the base prompt, replacing placeholders and ensuring length.
 *
 * @param {Object} cfg
 * @returns {string}
 */
function buildPrompt(cfg) {
  const prompt = BASE_PROMPT_TEMPLATE.replace('{{TARGET_DATE}}', cfg.TARGET_DATE);
  return truncate(prompt, 700);
}

/**
 * Creates instruction for OpenRouter improvement call.
 *
 * @param {string} basePrompt
 * @param {string} lastGeminiResponse
 * @returns {string}
 */
function buildImprovePromptInstruction(currentPrompt, lastGeminiResponse) {
  const snippet = truncate(lastGeminiResponse || '', 600);
  return 'Improve this BaZi prompt for accuracy and clarity (<=700 chars). Target: daily day-pillar overview (possibilities, energy flow, self-state) under 500 chars. Ensure classical BaZi terminology and avoid generic platitudes.\n' +
    'Base:\n"' + currentPrompt + '"\n' +
    'Last Gemini output:\n"' + snippet + '"\n' +
    'Return only the improved prompt.';
}

/**
 * Retrieves configuration from script properties with defaults.
 *
 * @returns {Object}
 */
function getConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const props = PropertiesService.getScriptProperties().getProperties();
  cachedConfig = {
    GEMINI_API_KEY: assertProperty(props.GEMINI_API_KEY, 'GEMINI_API_KEY'),
    OPENROUTER_API_KEY: assertProperty(props.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
    DISCORD_WEBHOOK_URL: assertProperty(props.DISCORD_WEBHOOK_URL, 'DISCORD_WEBHOOK_URL'),
    SHEET_NAME: props.SHEET_NAME || CONFIG_DEFAULTS.SHEET_NAME,
    SPREADSHEET_NAME: props.SPREADSHEET_NAME || CONFIG_DEFAULTS.SPREADSHEET_NAME,
    OPENROUTER_MODEL: props.OPENROUTER_MODEL || CONFIG_DEFAULTS.OPENROUTER_MODEL,
    GEMINI_MODEL: props.GEMINI_MODEL || CONFIG_DEFAULTS.GEMINI_MODEL,
    TARGET_DATE: props.TARGET_DATE || CONFIG_DEFAULTS.TARGET_DATE,
    PAUSE_MS_NORMAL: parseInteger(props.PAUSE_MS_NORMAL, CONFIG_DEFAULTS.PAUSE_MS_NORMAL),
    PAUSE_MS_RATELIMIT: parseInteger(props.PAUSE_MS_RATELIMIT, CONFIG_DEFAULTS.PAUSE_MS_RATELIMIT),
    KEYWORD: props.KEYWORD || CONFIG_DEFAULTS.KEYWORD,
    HTTP_REFERER: props.HTTP_REFERER,
    OPENROUTER_TITLE: props.OPENROUTER_TITLE
  };
  return cachedConfig;
}

/**
 * Ensures a property exists.
 *
 * @param {string} value
 * @param {string} name
 * @returns {string}
 */
function assertProperty(value, name) {
  if (!value) {
    throw new Error('Missing required script property: ' + name);
  }
  return value;
}

/**
 * Parses integer property with fallback.
 *
 * @param {string} value
 * @param {number} defaultValue
 * @returns {number}
 */
function parseInteger(value, defaultValue) {
  if (!value) {
    return defaultValue;
  }
  var parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Detects keyword in text (case sensitive exact match).
 *
 * @param {string} text
 * @param {string} keyword
 * @returns {boolean}
 */
function containsKeyword(text, keyword) {
  if (!text || !keyword) {
    return false;
  }
  return text.indexOf(keyword) !== -1;
}

/**
 * Normalises message content returned by providers into plain text.
 *
 * @param {*} content
 * @returns {string}
 */
function normalizeMessageContent(content) {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(function (part) {
      if (typeof part === 'string') {
        return part;
      }
      if (part && typeof part === 'object') {
        if (typeof part.text === 'string') {
          return part.text;
        }
        if (typeof part.content === 'string') {
          return part.content;
        }
      }
      return '';
    }).join('\n');
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') {
      return content.text;
    }
    if (typeof content.content === 'string') {
      return content.content;
    }
  }
  return String(content);
}

/**
 * Safely coerces any value into a string.
 *
 * @param {*} value
 * @returns {string}
 */
function coerceString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Simple string truncation helper.
 *
 * @param {string} value
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(value, maxLen) {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value);
  if (str.length <= maxLen) {
    return str;
  }
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Appends a log row to the Google Sheet.
 *
 * @param {Object} entry
 */
function logRow(entry) {
  const sheet = getLoggingSheet();
  const responseRaw = truncate(coerceString(entry.responseRaw), 2500);
  const responseGemini = truncate(coerceString(entry.responseGemini), 2500);
  const responseOpenRouter = truncate(coerceString(entry.responseOpenRouter), 2500);
  const row = [
    entry.timestamp,
    entry.runId,
    entry.provider,
    entry.model,
    entry.attempt,
    truncate(coerceString(entry.promptUsed), 1500),
    responseRaw,
    responseGemini,
    responseOpenRouter,
    entry.foundXinYou,
    entry.status,
    entry.httpStatus,
    entry.errorCode,
    entry.errorMessage,
    entry.tokensOrUsage,
    entry.note
  ];
  sheet.appendRow(row);
}

let cachedSheet = null;

/**
 * Ensures spreadsheet and sheet exist, creating them if needed.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getLoggingSheet() {
  if (cachedSheet) {
    return cachedSheet;
  }
  const cfg = getConfig();
  const spreadsheet = ensureSpreadsheet(cfg.SPREADSHEET_NAME);
  const sheet = ensureSheet(spreadsheet, cfg.SHEET_NAME);
  ensureHeader(sheet);
  cachedSheet = sheet;
  return sheet;
}

/**
 * Fetches existing spreadsheet by name or creates a new one.
 *
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function ensureSpreadsheet(name) {
  const files = DriveApp.getFilesByName(name);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return SpreadsheetApp.create(name);
}

/**
 * Ensures a sheet with desired name exists.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) {
    return sheet;
  }
  sheet = spreadsheet.insertSheet(sheetName);
  const defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    spreadsheet.deleteSheet(defaultSheet);
  }
  return sheet;
}

/**
 * Writes header row if blank.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureHeader(sheet) {
  const headers = [
    'timestamp',
    'runId',
    'provider',
    'model',
    'attempt',
    'promptUsed',
    'responseRaw',
    'responseGemini',
    'responseOpenRouter',
    'foundXinYou',
    'status',
    'httpStatus',
    'errorCode',
    'errorMessage',
    'tokensOrUsage',
    'note'
  ];
  const range = sheet.getRange(1, 1, 1, headers.length);
  const firstRow = range.getValues()[0];
  const needsUpdate = firstRow.length !== headers.length || headers.some(function (header, idx) {
    return firstRow[idx] !== header;
  });
  if (needsUpdate) {
    range.setValues([headers]);
  }
}

/**
 * Sends final stop notification to Discord webhook.
 *
 * @param {string} reason
 */
function notifyDiscordStop(reason) {
  try {
    const cfg = getConfig();
    const payload = {
      username: 'BaZi Bot',
      content: '🛑 Bot stopped: ' + reason
    };
    UrlFetchApp.fetch(cfg.DISCORD_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    logRow({
      timestamp: new Date().toISOString(),
      runId: createRunId(),
      provider: 'discord',
      model: 'webhook',
      attempt: 0,
      promptUsed: '',
      responseRaw: '',
      responseGemini: '',
      responseOpenRouter: '',
      foundXinYou: null,
      status: 'error',
      httpStatus: null,
      errorCode: err.name || 'Exception',
      errorMessage: err.message,
      tokensOrUsage: null,
      note: 'notifyDiscordStop'
    });
  }
}

function consumeAutoTrigger() {
  try {
    const props = PropertiesService.getScriptProperties();
    const triggerId = props.getProperty(AUTO_TRIGGER_PROPERTY_KEY);
    if (!triggerId) {
      return;
    }
    const triggers = ScriptApp.getProjectTriggers();
    var found = false;
    for (var i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      if (trigger.getUniqueId && trigger.getUniqueId() === triggerId) {
        found = true;
        break;
      }
    }
    if (!found) {
      props.deleteProperty(AUTO_TRIGGER_PROPERTY_KEY);
    }
  } catch (err) {
    // intentionally swallow; scheduling will recreate as needed
  }
}

function scheduleNextRun(delayMs, reason, runId) {
  var requestedDelay = Number(delayMs) || 0;
  if (requestedDelay < 60000) {
    requestedDelay = 60000;
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const existingId = props.getProperty(AUTO_TRIGGER_PROPERTY_KEY);
    if (existingId) {
      const triggers = ScriptApp.getProjectTriggers();
      for (var i = 0; i < triggers.length; i++) {
        const trigger = triggers[i];
        if (trigger.getUniqueId && trigger.getUniqueId() === existingId) {
          return;
        }
      }
      props.deleteProperty(AUTO_TRIGGER_PROPERTY_KEY);
    }
    const trigger = ScriptApp.newTrigger('runProduction')
      .timeBased()
      .after(requestedDelay)
      .create();
    props.setProperty(AUTO_TRIGGER_PROPERTY_KEY, trigger.getUniqueId());
  } catch (err) {
    try {
      logRow({
        timestamp: new Date().toISOString(),
        runId: runId || createRunId(),
        provider: 'system',
        model: 'scheduler',
        attempt: 0,
        promptUsed: reason || 'scheduleNextRun',
        responseRaw: '',
        responseGemini: '',
        responseOpenRouter: '',
        foundXinYou: null,
        status: 'error',
        httpStatus: null,
        errorCode: err.name || 'Exception',
        errorMessage: err.message,
        tokensOrUsage: null,
        note: 'scheduleNextRun failure'
      });
    } catch (innerErr) {
      // last resort: do nothing
    }
  }
}

/**
 * Extracts best-effort error message from API payload.
 *
 * @param {Object} json
 * @returns {string}
 */
function extractErrorMessage(json) {
  if (!json) {
    return '';
  }
  if (json.error) {
    if (typeof json.error === 'string') {
      return json.error;
    }
    if (json.error.message) {
      return json.error.message;
    }
  }
  if (json.message) {
    return json.message;
  }
  return JSON.stringify(json);
}

/**
 * Generates a short run identifier.
 *
 * @returns {string}
 */
function createRunId() {
  return Utilities.getUuid().split('-')[0];
}
