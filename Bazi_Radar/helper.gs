// helper.gs — AI routing, Discord webhook posting, and daily scheduling
// Simplified daily workflow: compute BaZi chart ➜ craft prompt ➜ call AI ➜ post overview embed.

var AI_DEFAULT_PROVIDER = 'gemini';
var GEMINI_MODEL = 'gemini-2.5-flash';
var OPENROUTER_DEFAULT_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
var EMBED_DESCRIPTION_LIMIT = 4096;
var EMBED_FIELD_LIMIT = 1024;

function getScriptProps() {
  try {
    return PropertiesService.getScriptProperties().getProperties();
  } catch (e) {
    Logger.log('Failed to read Script Properties: ' + e);
    return {};
  }
}

function getProp(props, key, def) {
  if (props && Object.prototype.hasOwnProperty.call(props, key)) return props[key];
  return def;
}

function genderToText(g) {
  if (g === '0' || g === 0) return 'female';
  if (g === '1' || g === 1) return 'male';
  return 'unknown';
}

function getTodayDateISO(tz) {
  var zone = tz || (typeof Session !== 'undefined' && Session.getScriptTimeZone ? Session.getScriptTimeZone() : 'Etc/UTC') || 'Etc/UTC';
  var now = new Date();
  return Utilities.formatDate(now, zone, 'yyyy-MM-dd');
}

function formatFourPillarsText(chart) {
  try {
    if (!chart) return '(Four pillars unavailable)';

    if (chart.fourPillars) {
      var fp = chart.fourPillars;
      function compose(label, pillar) {
        if (!pillar) return label + ': ?';
        var hs = pillar.heavenlyStem || {};
        var eb = pillar.earthlyBranch || {};
        var hanzi = (((hs.character || '') + (eb.character || '')).trim()) || '?';
        return label + ': ' + hanzi;
      }
      return [
        compose('Year', fp.yearPillar),
        compose('Month', fp.monthPillar),
        compose('Day', fp.dayPillar),
        compose('Hour', fp.hourPillar)
      ].join('\n');
    }

    if (!chart.FourPillars) return '(Four pillars unavailable)';
    var legacy = chart.FourPillars;
    function composeLegacy(label, key) {
      var pillar = legacy && legacy[key];
      if (!pillar) return label + ': ?';
      var stem = (pillar.Stem && pillar.Stem.Hanzi) || '';
      var branch = (pillar.Branch && pillar.Branch.Hanzi) || '';
      var hanzi = (stem + branch).trim() || ((pillar.GanZhi && pillar.GanZhi.Hanzi) || '?');
      return label + ': ' + hanzi;
    }
    return [
      composeLegacy('Year', 'Year'),
      composeLegacy('Month', 'Month'),
      composeLegacy('Day', 'Day'),
      composeLegacy('Hour', 'Hour')
    ].join('\n');
  } catch (e) {
    Logger.log('formatFourPillarsText error: ' + e);
    return '(Four pillars unavailable)';
  }
}

function buildDetailedPillarText(chart, shortText) {
  var sections = [];
  try {
    if (chart && chart.fourPillars) {
      var fp = chart.fourPillars;
      var combo = ['yearPillar', 'monthPillar', 'dayPillar', 'hourPillar']
        .map(function (key) {
          var pillar = fp[key] || {};
          var hs = pillar.heavenlyStem || {};
          var eb = pillar.earthlyBranch || {};
          return '【' + (hs.character || '?') + (eb.character || '') + '】';
        })
        .join(' | ');
      sections.push('漢字 Empat Pilar: ' + combo);

      function detail(label, pillar) {
        if (!pillar) return label + ': ?';
        var hs = pillar.heavenlyStem || {};
        var eb = pillar.earthlyBranch || {};
        return [
          label + ':',
          'Stem: ' + (hs.name || '?') + ' [' + (hs.character || '?') + ', ' + (hs.spelling || '?') + ']',
          'Branch: ' + (eb.name || '?') + ' [' + (eb.character || '?') + ', ' + (eb.spelling || '?') + ']'
        ].join('\n');
      }

      sections.push(detail('Year pillar', fp.yearPillar));
      sections.push(detail('Month pillar', fp.monthPillar));
      sections.push(detail('Day pillar', fp.dayPillar));
      sections.push(detail('Hour pillar', fp.hourPillar));
    }
  } catch (e) {
    Logger.log('buildDetailedPillarText error: ' + e);
  }
  var joined = sections.filter(Boolean).join('\n\n');
  if (joined) return joined;
  return shortText || '(Four pillars unavailable)';
}

function truncateForDiscord(text, limit) {
  var value = (text || '').trim();
  if (!value) return '';
  if (value.length <= limit) return value;
  return value.slice(0, limit - 3) + '...';
}

function splitForDiscordFields(text) {
  var value = (text || '').trim();
  if (!value) return ['_n/a_'];
  if (value.length <= EMBED_FIELD_LIMIT) return [value];
  var chunks = [];
  var remaining = value;
  while (remaining.length > EMBED_FIELD_LIMIT) {
    var slice = remaining.slice(0, EMBED_FIELD_LIMIT);
    var breakIndex = slice.lastIndexOf('\n');
    if (breakIndex >= EMBED_FIELD_LIMIT * 0.3) {
      chunks.push(remaining.slice(0, breakIndex));
      remaining = remaining.slice(breakIndex + 1);
    } else {
      chunks.push(slice);
      remaining = remaining.slice(EMBED_FIELD_LIMIT);
    }
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

function pushChunkedField(fields, name, text) {
  var chunks = splitForDiscordFields(text);
  if (chunks.length === 1) {
    fields.push({ name: name, value: chunks[0], inline: false });
    return;
  }
  for (var i = 0; i < chunks.length; i += 1) {
    fields.push({
      name: name + ' (' + (i + 1) + '/' + chunks.length + ')',
      value: chunks[i],
      inline: false
    });
  }
}

function buildDailyOverviewPrompt(todayISO, shortPillarsText, detailedPillarsText, birthDateStr, genderText, subjectName) {
  var todayLabel = (todayISO || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3-$2-$1');
  var pillarsBlock = (detailedPillarsText || shortPillarsText || '(unavailable)');
  // Hapus header "漢字 Empat Pilar" bila ada agar sesuai format yang diinginkan
  pillarsBlock = pillarsBlock.replace(/漢字 Empat Pilar:[^\n]*\n?/, '');
  var lines = [
    'Youre an expert BaZi practitioner, you know well how to compare natal chart with date to compare. Give me todays BaZi overview based on this',
    '',
    '**Birth Chart**:',
    pillarsBlock,
    '',
    'Only talk about **daily pillar** **(' + (todayLabel || (todayISO || '')) + '**). (the possibilities, energy flow, and self-state — under 500 characters.).',
    '**TIPS** : (please fill how to get more accurate BaZi output from you (Gemini) here.)'
  ];
  return lines.join('\n');
}

function aiRequestGemini(userText, apiKey) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(GEMINI_MODEL) + ':generateContent?key=' + encodeURIComponent(apiKey);
  var payload = { contents: [{ role: 'user', parts: [{ text: userText }]}]};
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var status = res.getResponseCode();
  var body = res.getContentText();
  if (status >= 400) throw new Error('Gemini HTTP ' + status + ' — ' + body);
  var json = JSON.parse(body || '{}');
  try {
    return (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text || '').trim();
  } catch (e) {
    return '';
  }
}

function aiRequestOpenRouter(systemText, userText, apiKey, model) {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing');
  var url = 'https://openrouter.ai/api/v1/chat/completions';
  var payload = {
    model: model || OPENROUTER_DEFAULT_MODEL,
    messages: [
      { role: 'system', content: systemText || 'You are a BaZi master.' },
      { role: 'user', content: userText }
    ],
    temperature: 0.2
  };
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var status = res.getResponseCode();
  var body = res.getContentText();
  if (status >= 400) throw new Error('OpenRouter HTTP ' + status + ' — ' + body);
  var json = JSON.parse(body || '{}');
  try {
    return (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content || '').trim();
  } catch (e) {
    return '';
  }
}

function getDailyOverviewText(props, todayISO, pillarsText, detailedPillarsText, birthDateStr, genderText) {
  var provider = (getProp(props, 'AI_PROVIDER', AI_DEFAULT_PROVIDER) || '').toLowerCase();
  var subjectName = getProp(props, 'NAME', '') || 'unknown';
  var promptText = buildDailyOverviewPrompt(todayISO, pillarsText, detailedPillarsText, birthDateStr, genderText, subjectName);
  var systemPrompt = 'Kamu adalah BaZi master';
  var combinedPrompt = promptText;

  function tryOpenRouterWithRetry() {
    var orKey = getProp(props, 'OPENROUTER_API_KEY', '');
    var model = getProp(props, 'OPENROUTER_MODEL', OPENROUTER_DEFAULT_MODEL);
    try {
      return aiRequestOpenRouter(systemPrompt, promptText, orKey, model);
    } catch (e1) {
      var msg = String(e1 || '');
      if (msg.indexOf('OpenRouter HTTP 429') !== -1 || msg.indexOf('HTTP 5') !== -1) {
        Utilities.sleep(1500);
        return aiRequestOpenRouter(systemPrompt, promptText, orKey, model);
      }
      throw e1;
    }
  }

  function tryGeminiWithRetry() {
    var gemKey = getProp(props, 'GEMINI_API_KEY', '');
    try {
      return aiRequestGemini(combinedPrompt, gemKey);
    } catch (e1) {
      var msg = String(e1 || '');
      if (msg.indexOf('Gemini HTTP 429') !== -1 || msg.indexOf('HTTP 5') !== -1) {
        Utilities.sleep(1500);
        return aiRequestGemini(combinedPrompt, gemKey);
      }
      throw e1;
    }
  }

  try {
    if (provider === 'openrouter') {
      try {
        return tryOpenRouterWithRetry();
      } catch (eOpen) {
        Logger.log('OpenRouter failed, considering fallback: ' + eOpen);
        var gemKey = getProp(props, 'GEMINI_API_KEY', '');
        if (gemKey) {
          try {
            return tryGeminiWithRetry();
          } catch (eGem) {
            Logger.log('Gemini fallback also failed: ' + eGem);
          }
        }
        return 'AI sementara kelebihan beban atau dibatasi (OpenRouter). Coba lagi nanti atau gunakan fallback lain.';
      }
    } else {
      try {
        return tryGeminiWithRetry();
      } catch (eGem) {
        Logger.log('Gemini failed: ' + eGem);
        var orKey = getProp(props, 'OPENROUTER_API_KEY', '');
        if (orKey) {
          try {
            return tryOpenRouterWithRetry();
          } catch (eOpen2) {
            Logger.log('OpenRouter fallback also failed: ' + eOpen2);
          }
        }
        return 'AI sementara kelebihan beban atau dibatasi. Coba lagi nanti atau tambahkan fallback provider.';
      }
    }
  } catch (e) {
    Logger.log('AI routing unexpected error: ' + e);
    return 'AI sementara tidak tersedia. Coba lagi nanti.';
  }
}

function sanitizeOverviewText(overviewText, props) {
  var text = (overviewText || '').trim();
  if (!text) return '';

  if (text.charAt(0) === '_' && text.charAt(text.length - 1) === '_') {
    text = text.substring(1, text.length - 1).trim();
    if (!text) return '';
  }

  if (/GEMINI_API_KEY is missing/i.test(text)) {
    return 'GEMINI_API_KEY belum diisi. Tambahkan key di Script Properties atau ganti AI_PROVIDER menjadi "openrouter".';
  }
  if (/OPENROUTER_API_KEY is missing/i.test(text)) {
    return 'OPENROUTER_API_KEY belum diisi. Tambahkan key OpenRouter di Script Properties atau pakai AI_PROVIDER="gemini".';
  }

  var technicalPattern = /(openrouter http\s+\d+|gemini http\s+\d+|provider returned error|ai overview error|^error[:]?)/i;
  if (!technicalPattern.test(text)) return text;

  var provider = (getProp(props, 'AI_PROVIDER', AI_DEFAULT_PROVIDER) || '').toLowerCase();
  var hasGemKey = !!getProp(props, 'GEMINI_API_KEY', '');
  var hasOpenKey = !!getProp(props, 'OPENROUTER_API_KEY', '');

  if (provider === 'openrouter') {
    var msg = 'AI OpenRouter lagi kelebihan beban (rate limit). Coba lagi beberapa menit lagi.';
    if (!hasOpenKey) msg += ' Tambahkan OPENROUTER_API_KEY milikmu sendiri atau ganti OPENROUTER_MODEL supaya limit lebih longgar.';
    msg += hasGemKey
      ? ' Fallback Gemini otomatis juga dicoba—pastikan GEMINI_API_KEY masih aktif.'
      : ' Tambahkan GEMINI_API_KEY supaya ada fallback otomatis ke Gemini.';
    return msg;
  }

  var base = 'AI Gemini lagi kelebihan beban atau key dibatasi. Coba lagi beberapa menit lagi.';
  base += hasOpenKey
    ? ' Fallback OpenRouter juga dicoba—cek quota model yang dipilih.'
    : ' Tambahkan OPENROUTER_API_KEY supaya ada fallback ke OpenRouter.';
  return base;
}

function getDayMasterSummary(chart) {
  try {
    if (!chart || !chart.fourPillars || !chart.fourPillars.dayPillar) return '';
    var day = chart.fourPillars.dayPillar;
    var stem = day.heavenlyStem || {};
    var branch = day.earthlyBranch || {};
    var element = getElementFromStemName(stem.name);
    var emoji = element ? (ELEMENT_EMOJI[element] || '') : '';
    var descriptor = day.ganZhi && day.ganZhi.name ? ' — ' + day.ganZhi.name : '';
    var stemSpelling = capitalize(stem.spelling || '');
    var branchSpelling = capitalize(branch.spelling || '');
    return '【' + (stem.character || '?') + (branch.character || '') + '】 ' + stemSpelling +
      (branchSpelling ? ' ' + branchSpelling : '') + ' ' + emoji + descriptor;
  } catch (e) {
    Logger.log('getDayMasterSummary error: ' + e);
    return '';
  }
}

function buildDailyOverviewEmbed(chart, overviewText, props, todayISO, tz) {
  var name = getProp(props, 'NAME', '') || '';
  var embed = {
    title: '🧭 BaZi Daily Overview',
    color: 0x3498db,
    description: truncateForDiscord(overviewText || '_no content_', EMBED_DESCRIPTION_LIMIT),
    timestamp: new Date().toISOString(),
    footer: { text: 'BaZi Radar — ' + name }
  };

  var fields = [];
  if (todayISO) fields.push({ name: 'Tanggal', value: todayISO + ' (' + (tz || 'Etc/UTC') + ')', inline: true });
  var dayMasterSummary = getDayMasterSummary(chart);
  if (dayMasterSummary) fields.push({ name: 'Day Master', value: dayMasterSummary, inline: true });
  if (fields.length) embed.fields = fields;
  return { embeds: [embed] };
}

function postDiscordEmbed(webhookUrl, payload) {
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL is missing');
  var res = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var status = res.getResponseCode();
  var body = res.getContentText();
  if (status >= 400) throw new Error('Discord HTTP ' + status + ' — ' + body);
  return { status: status, body: body };
}

function runDailyOverview() {
  var props = getScriptProps();
  var tz = getProp(props, 'TIME_REGION', 'Etc/UTC');
  var todayISO = getTodayDateISO(tz);
  var birthStr = getProp(props, 'BIRTH_DATE', '');
  var genderText = genderToText(getProp(props, 'GENDER', ''));

  var chart = null;
  try {
    if (typeof buildBaziChart === 'function') {
      var genderNum = parseInt(getProp(props, 'GENDER', '0'), 10);
      if (isNaN(genderNum)) genderNum = 0;
      var name = getProp(props, 'NAME', '');
      var parsedDate = null;
      if (typeof parseBirthDate === 'function') {
        try {
          var parsed = parseBirthDate(birthStr, tz);
          parsedDate = (parsed && parsed.date) ? parsed.date : null;
        } catch (ee) {
          Logger.log('parseBirthDate failed, fallback to manual: ' + ee);
        }
      }
      if (!parsedDate && birthStr) {
        var m = birthStr.match(/^(\d{2}):(\d{2}),\s*(\d{2})-(\d{2})-(\d{4})$/);
        if (m) {
          parsedDate = new Date(parseInt(m[5], 10), parseInt(m[4], 10) - 1, parseInt(m[3], 10), parseInt(m[1], 10), parseInt(m[2], 10));
        }
      }
      chart = parsedDate ? buildBaziChart(parsedDate, tz, genderNum, name) : null;
      chart = chart && chart.chart ? chart.chart : chart;
    }
  } catch (e) {
    Logger.log('buildBaziChart failed: ' + e);
  }

  var pillarsText = formatFourPillarsText(chart);
  var pillarsDetailed = buildDetailedPillarText(chart, pillarsText);
  var overview = '';
  try {
    overview = getDailyOverviewText(props, todayISO, pillarsText, pillarsDetailed, birthStr, genderText);
  } catch (e) {
    overview = 'AI sementara tidak tersedia. Coba lagi nanti.';
    Logger.log('AI overview error: ' + e);
  }
  overview = sanitizeOverviewText(overview, props);

  var embedPayload;
  try {
    embedPayload = buildDailyOverviewEmbed(chart, overview, props, todayISO, tz);
  } catch (e) {
    Logger.log('Embed build error: ' + e);
    embedPayload = buildDailyOverviewEmbed(null, overview, props, todayISO, tz);
  }

  try {
    var webhook = getProp(props, 'DISCORD_WEBHOOK_URL', '');
    var resp = postDiscordEmbed(webhook, embedPayload);
    Logger.log('Discord posted: HTTP ' + resp.status);
  } catch (e) {
    Logger.log('Discord post error: ' + e);
    throw e;
  }
}

function scheduleDailyOverview() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function (t) {
      if (t.getHandlerFunction && t.getHandlerFunction() === 'runDailyOverview') {
        ScriptApp.deleteTrigger(t);
      }
    });
  } catch (e) {
    Logger.log('Trigger cleanup warning: ' + e);
  }

  var props = getScriptProps();
  var hour = parseInt(getProp(props, 'POST_SCHEDULE_HOUR', '6'), 10);
  var minute = parseInt(getProp(props, 'POST_SCHEDULE_MINUTE', '0'), 10);
  ScriptApp.newTrigger('runDailyOverview')
    .timeBased()
    .atHour(isNaN(hour) ? 6 : hour)
    .nearMinute(isNaN(minute) ? 0 : minute)
    .everyDays(1)
    .create();
  Logger.log('Daily trigger set for runDailyOverview at ' + hour + ':' + ('00' + minute).slice(-2));
}

function getDailyOverviewPack(props, todayISO, pillarsText, detailedPillarsText, birthDateStr, genderText) {
  var provider = (getProp(props, 'AI_PROVIDER', AI_DEFAULT_PROVIDER) || '').toLowerCase();
  var subjectName = getProp(props, 'NAME', '') || 'unknown';
  var promptText = buildDailyOverviewPrompt(todayISO, pillarsText, detailedPillarsText, birthDateStr, genderText, subjectName);
  var systemPrompt = 'Kamu adalah BaZi master.';
  var combinedPrompt = promptText;

  var providerUsed = provider || AI_DEFAULT_PROVIDER;
  var modelUsed = provider === 'openrouter'
    ? getProp(props, 'OPENROUTER_MODEL', OPENROUTER_DEFAULT_MODEL)
    : GEMINI_MODEL;

  var text = '';
  var error = null;

  function tryOR() {
    var orKey = getProp(props, 'OPENROUTER_API_KEY', '');
    return aiRequestOpenRouter(systemPrompt, promptText, orKey, modelUsed);
  }
  function tryGem() {
    var gemKey = getProp(props, 'GEMINI_API_KEY', '');
    return aiRequestGemini(combinedPrompt, gemKey);
  }

  try {
    if (provider === 'openrouter') {
      try {
        text = tryOR();
      } catch (eOpen) {
        error = eOpen;
        Logger.log('AI pack OpenRouter failed: ' + eOpen);
        var gemKey = getProp(props, 'GEMINI_API_KEY', '');
        if (gemKey) {
          try {
            text = tryGem();
            providerUsed = 'gemini (fallback)';
            modelUsed = GEMINI_MODEL;
          } catch (eGem) {
            error = eGem;
            text = 'AI sementara kelebihan beban. Coba lagi nanti atau gunakan fallback.';
          }
        } else {
          text = 'AI sementara kelebihan beban (OpenRouter). Tambahkan GEMINI_API_KEY untuk fallback atau gunakan model OpenRouter lain.';
        }
      }
    } else {
      try {
        text = tryGem();
      } catch (eGem2) {
        error = eGem2;
        Logger.log('AI pack Gemini failed: ' + eGem2);
        var orKey = getProp(props, 'OPENROUTER_API_KEY', '');
        if (orKey) {
          try {
            text = tryOR();
            providerUsed = 'openrouter (fallback)';
            modelUsed = getProp(props, 'OPENROUTER_MODEL', OPENROUTER_DEFAULT_MODEL);
          } catch (eOpen2) {
            error = eOpen2;
            text = 'AI sementara kelebihan beban. Coba lagi nanti atau gunakan provider lain.';
          }
        } else {
          text = 'AI gagal. Tambahkan OPENROUTER_API_KEY untuk fallback.';
        }
      }
    }
  } catch (eAny) {
    error = eAny;
    text = 'AI sementara tidak tersedia.';
  }

  return {
    text: (text || '').trim(),
    prompt: combinedPrompt,
    provider: providerUsed,
    model: modelUsed,
    error: error
  };
}

function buildDebugEmbed(chart, props, pack, pillarsText, todayISO) {
  var footerName = getProp(props, 'NAME', '') || '';
  var debugEmbed = {
    title: '🐞 BaZi Daily — Debug',
    color: 0xbdc3c7,
    description: 'Diagnostic payload (settings & prompt).',
    timestamp: new Date().toISOString(),
    footer: { text: 'BaZi Radar — ' + footerName }
  };

  var settingsLines = [
    'today_date: ' + todayISO,
    'AI_PROVIDER: ' + (pack.provider || ''),
    'MODEL: ' + (pack.model || ''),
    'TIME_REGION: ' + (getProp(props, 'TIME_REGION', '') || ''),
    'LOCALE: ' + (getProp(props, 'LOCALE', 'id-ID') || ''),
    'BIRTH_DATE: ' + (getProp(props, 'BIRTH_DATE', '') || ''),
    'GENDER: ' + (getProp(props, 'GENDER', '') || ''),
    'NAME: ' + footerName,
    'POST_SCHEDULE_HOUR: ' + (getProp(props, 'POST_SCHEDULE_HOUR', '6') || ''),
    'POST_SCHEDULE_MINUTE: ' + (getProp(props, 'POST_SCHEDULE_MINUTE', '0') || '')
  ];

  var fields = [];
  fields.push({ name: '⚙️ Settings', value: truncateForDiscord(settingsLines.join('\n'), EMBED_FIELD_LIMIT), inline: false });
  pushChunkedField(fields, '📝 Prompt', pack.prompt || '_n/a_');

  if (pack.error) {
    pushChunkedField(fields, '❗ AI Error', String(pack.error));
  }

  debugEmbed.fields = fields;

  return { embeds: [debugEmbed] };
}

function runDoublePostTest() {
  var props = getScriptProps();
  var tz = getProp(props, 'TIME_REGION', 'Etc/UTC');
  var todayISO = getTodayDateISO(tz);
  var birthStr = getProp(props, 'BIRTH_DATE', '');
  var genderText = genderToText(getProp(props, 'GENDER', ''));

  var chart = null;
  try {
    if (typeof buildBaziChart === 'function') {
      var genderNum = parseInt(getProp(props, 'GENDER', '0'), 10);
      if (isNaN(genderNum)) genderNum = 0;
      var name = getProp(props, 'NAME', '');
      var parsedDate = null;
      if (typeof parseBirthDate === 'function') {
        try {
          var parsed = parseBirthDate(birthStr, tz);
          parsedDate = (parsed && parsed.date) ? parsed.date : null;
        } catch (ee) {
          Logger.log('parseBirthDate failed (test): ' + ee);
        }
      }
      if (!parsedDate && birthStr) {
        var m = birthStr.match(/^(\d{2}):(\d{2}),\s*(\d{2})-(\d{2})-(\d{4})$/);
        if (m) {
          parsedDate = new Date(parseInt(m[5], 10), parseInt(m[4], 10) - 1, parseInt(m[3], 10), parseInt(m[1], 10), parseInt(m[2], 10));
        }
      }
      chart = parsedDate ? buildBaziChart(parsedDate, tz, genderNum, name) : null;
      chart = chart && chart.chart ? chart.chart : chart;
    }
  } catch (e) {
    Logger.log('buildBaziChart failed (test): ' + e);
  }

  var pillarsText = formatFourPillarsText(chart);
  var pillarsDetailed = buildDetailedPillarText(chart, pillarsText);
  var pack = getDailyOverviewPack(props, todayISO, pillarsText, pillarsDetailed, birthStr, genderText);
  var overview = sanitizeOverviewText(pack.text, props);
  var webhook = getProp(props, 'DISCORD_WEBHOOK_URL', '');

  var embedPayload;
  try {
    embedPayload = buildDailyOverviewEmbed(chart, overview, props, todayISO, tz);
  } catch (e) {
    Logger.log('Embed build error (test): ' + e);
    embedPayload = buildDailyOverviewEmbed(null, overview, props, todayISO, tz);
  }

  var resp1 = postDiscordEmbed(webhook, embedPayload);
  Logger.log('Test post original: HTTP ' + resp1.status);

  var debugPayload = buildDebugEmbed(chart, props, pack, pillarsDetailed, todayISO);
  var resp2 = postDiscordEmbed(webhook, debugPayload);
  Logger.log('Test post debug: HTTP ' + resp2.status);
}
