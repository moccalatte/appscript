/**
 * awesome_integration.gs
 *
 * Integration script: discover repositories referenced from "awesome-*" lists (README links),
 * validate them, scan repository files (*.py, *.js, *.ts, *.go), chunk, and upsert to Qdrant.
 *
 * Purpose:
 * - Merge the "awesome" discovery flow into the main pipeline so we can delete `awesome.gs`.
 * - Provide two entry points:
 *    - `testAwesomeRun()`  -> quick test run that performs discovery -> fetch -> upsert in a single invocation
 *    - `prodAwesomeRun()`  -> production-oriented run (can be scheduled) which processes a limited number of repos/files
 *
 * Design notes & constraints (beginner-friendly):
 * - This integration avoids storing large state in Script Properties (PropertiesService) to prevent hitting size/row limits.
 *   Instead, dedup / processed markers are stored in the project's spreadsheet `QdrantFeedLogs` in a sheet named `awesome_dedup`.
 * - We reuse existing helper functions from `Code.gs` (for example: `getGitHub`, `fetchRepoMeta`, `listTreeRecursive`,
 *   `selectFiles`, `fetchRaw`, `chunkText`, `makePoints`, `upsertQdrant`, `appendLog`, `makeLogRow`, `ensureSheet`, `getConfig`, `preflightQdrant`).
 *   Those functions must be present (they are in `Code.gs`).
 * - The test function runs a small, deterministic job and feeds Qdrant in one run so you can verify end-to-end.
 * - The production function is rate/size-aware and logs progress to the logs sheet.
 *
 * How to use (quick start):
 * 1) Add required Script Properties:
 *    - `GITHUB_PAT` (recommended) for higher GitHub API quota.
 *    - `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`
 * 2) From the Apps Script editor:
 *    - Run `testAwesomeRun()` to perform a single small end-to-end feeding.
 *    - Inspect the spreadsheet `QdrantFeedLogs` -> `logs` for details and `awesome_dedup` for dedup records.
 * 3) For production scheduling, create a time-driven trigger for `prodAwesomeRun`.
 *
 * Safety:
 * - All network errors are logged and swallowed per-repo to allow the run to continue.
 * - Duplicate prevention is implemented via the `awesome_dedup` sheet (one row per key).
 *
 * NOTE: Keep this file in the same project as `Code.gs` so existing helper functions are accessible.
 */

/* Default awesome lists: override via Script Properties key `AWESOME_DEFAULT_LISTS_JSON` (JSON array of {owner,repo}) */
var AWESOME_DEFAULT_LISTS_LOCAL = [
  { owner: 'vinta', repo: 'awesome-python' },
  { owner: 'avelino', repo: 'awesome-go' },
  { owner: 'sorrycc', repo: 'awesome-javascript' }
];

function readAwesomeIntegrationConfig() {
  var cfg = {
    lists: AWESOME_DEFAULT_LISTS_LOCAL,
    maxReposPerRun: 5,
    maxFilesPerRepo: 4,
    maxValidationRequests: 30,
    dedupSheetName: 'awesome_dedup',
    verboseLogging: false
  };
  try {
    var props = PropertiesService.getScriptProperties();
    var v = props.getProperty('AWESOME_DEFAULT_LISTS_JSON');
    if (v) {
      try {
        var parsed = JSON.parse(v);
        if (Array.isArray(parsed) && parsed.length > 0) {
          var clean = [];
          for (var i = 0; i < parsed.length; i++) {
            var it = parsed[i];
            if (it && typeof it.owner === 'string' && typeof it.repo === 'string') {
              clean.push({ owner: String(it.owner), repo: String(it.repo) });
            }
          }
          if (clean.length > 0) cfg.lists = clean;
        }
      } catch (e) {
        // ignore invalid JSON, keep default
      }
    }
    var mr = parseInt(props.getProperty('AWESOME_MAX_REPOS_PER_RUN') || '', 10);
    if (!isNaN(mr) && mr > 0) cfg.maxReposPerRun = mr;
    var mf = parseInt(props.getProperty('AWESOME_MAX_FILES_PER_REPO') || '', 10);
    if (!isNaN(mf) && mf > 0) cfg.maxFilesPerRepo = mf;
    var mv = parseInt(props.getProperty('AWESOME_MAX_VALIDATION_REQUESTS') || '', 10);
    if (!isNaN(mv) && mv > 0) cfg.maxValidationRequests = mv;
    var dn = props.getProperty('AWESOME_DEDUP_SHEET_NAME');
    if (dn) cfg.dedupSheetName = dn;

    // VERBOSE_LOGGING can be set as Script Property (true/1/yes)
    var vb = props.getProperty('VERBOSE_LOGGING');
    if (vb !== null && vb !== undefined && String(vb).toLowerCase() !== '') {
      var s = String(vb).toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') cfg.verboseLogging = true;
      else cfg.verboseLogging = false;
    }
  } catch (e) {
    // ignore - keep defaults
  }
  return cfg;
}

/* ---------- README scraping helpers (adapted from awesome.gs) ---------- */

/**
 * fetchReadmeToMarkdown(owner, repo)
 * Fetch README via GitHub API readme endpoint and decode base64 content -> markdown string
 */
function fetchReadmeToMarkdown(owner, repo) {
  if (!owner || !repo) throw new Error('invalid owner/repo');
  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/readme';
  var res = getGitHub(url);
  if (!res || res.error) {
    throw new Error('Readme fetch error: ' + (res && res.error ? res.error : 'unknown'));
  }
  var rd = null;
  try {
    rd = JSON.parse(res.text || '{}');
  } catch (e) {
    throw new Error('Readme parse error: ' + String(e));
  }
  var contentB64 = rd.content || '';
  if (!contentB64) return null;
  try {
    var raw = Utilities.base64Decode(contentB64);
    var md = Utilities.newBlob(raw).getDataAsString();
    return md;
  } catch (e) {
    try {
      var raw2 = Utilities.base64Decode(contentB64, Utilities.Charset.UTF_8);
      return Utilities.newBlob(raw2).getDataAsString();
    } catch (e2) {
      throw new Error('Readme decode error: ' + String(e2));
    }
  }
}

/**
 * extractGithubReposFromMarkdown(md)
 * Returns array of { owner, name }
 */
function extractGithubReposFromMarkdown(md) {
  var out = [];
  if (!md || typeof md !== 'string') return out;

  var cleaned = md.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, ' ');
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ');
  cleaned = cleaned.replace(/(^|\n)([ \t]{4}.*(\n|$))+/g, '\n');
  cleaned = cleaned.replace(/`[^`]*`/g, ' ');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/\[[^\]]+\]:\s*https?:\/\/[^\s]+/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  var reFull = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[\/\s\)\]\,]|$)/g;
  var reNoScheme = /(?:^|\s|\(|\[)github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[\/\s\)\]\,]|$)/g;
  var reProtocolRel = /(?:^|\s|\(|\[)\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[\/\s\)\]\,]|$)/g;

  var m;
  var candidates = [];
  while ((m = reFull.exec(cleaned)) !== null) {
    if (m[1] && m[2]) candidates.push({ owner: m[1], name: m[2] });
  }
  while ((m = reNoScheme.exec(cleaned)) !== null) {
    if (m[1] && m[2]) candidates.push({ owner: m[1], name: m[2] });
  }
  while ((m = reProtocolRel.exec(cleaned)) !== null) {
    if (m[1] && m[2]) candidates.push({ owner: m[1], name: m[2] });
  }

  var seen = {};
  var ownerNameRe = /^[A-Za-z0-9_.-]+$/;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c || !c.owner || !c.name) continue;
    var owner = String(c.owner).replace(/\/+$/g, '');
    var name = String(c.name).replace(/\/+$/g, '');
    if (!ownerNameRe.test(owner) || !ownerNameRe.test(name)) continue;
    var key = (owner + '/' + name).toLowerCase();
    if (seen[key]) continue;
    var lowOwner = owner.toLowerCase();
    if (lowOwner === 'github' || lowOwner === 'gist.github') continue;
    seen[key] = true;
    out.push({ owner: owner, name: name });
  }

  return out;
}

/* ---------- Dedup via spreadsheet (avoids PropertiesService growth) ---------- */

/**
 * getDedupSheet()
 * Ensures the dedup sheet exists in QdrantFeedLogs and returns it.
 * Columns:
 *   A: dedup_key (string, unique)
 *   B: timestamp_iso
 */
function getDedupSheet(dedupSheetName) {
  dedupSheetName = dedupSheetName || 'awesome_dedup';
  var ss = findOrCreateSpreadsheet('QdrantFeedLogs');
  var sheet = ss.getSheetByName(dedupSheetName);
  if (!sheet) {
    try {
      sheet = ss.insertSheet(dedupSheetName);
      sheet.appendRow(['dedup_key', 'ts']);
    } catch (e) {
      // fallback: try to use first sheet if cannot create
      var sheets = ss.getSheets();
      sheet = (sheets && sheets.length > 0) ? sheets[0] : null;
    }
  }
  return sheet;
}

/**
 * loadDedupMap(sheet)
 * Reads the dedup sheet into a map { key: true } for fast membership tests.
 */
function loadDedupMap(sheet) {
  var map = {};
  if (!sheet) return map;
  try {
    var last = sheet.getLastRow();
    if (last < 2) return map;
    var range = sheet.getRange(2, 1, last - 1, 1);
    var vals = range.getValues();
    for (var i = 0; i < vals.length; i++) {
      var k = vals[i][0];
      if (k) map[String(k)] = true;
    }
  } catch (e) {
    // ignore - empty map
  }
  return map;
}

/**
 * appendDedupKeys(sheet, keys)
 * Appends dedup keys to the dedup sheet. keys: array of string keys.
 * Hybrid observability: mirrors dedup writes into `logs` for operator visibility.
 */
function appendDedupKeys(sheet, keys) {
  if (!sheet || !keys || keys.length === 0) return;
  var rows = [];
  var ts = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  for (var i = 0; i < keys.length; i++) {
    rows.push([keys[i], ts]);
  }
  try {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  } catch (e) {
    // last-resort: appendRow in loop
    for (var j = 0; j < rows.length; j++) {
      try { sheet.appendRow(rows[j]); } catch (e2) {}
    }
  }

  // Hybrid observability: also append dedup events into the `logs` sheet so operators can
  // see dedup keys inline with run events. We keep `awesome_dedup` as the primary store
  // for performance (loadDedupMap reads from it), but mirror events to logs for visibility.
  try {
    var sheetCtx = ensureSheet();
    var tz = (Session && typeof Session.getScriptTimeZone === 'function') ? Session.getScriptTimeZone() : 'UTC';
    var logRows = [];
    for (var k = 0; k < keys.length; k++) {
      var dk = keys[k];
      // Build a log row matching the logs header:
      // timestamp, repo, file_path, size_bytes, chunk_idx/total, point_id, qdrant_http_status,
      // qdrant_result_points_upserted, error_message, elapsed_ms, dedup_key, dedup_ts
      var tsLocal = Utilities.formatDate(new Date(), tz || 'UTC', "yyyy-MM-dd'T'HH:mm:ssZ");
      var row = [
        tsLocal,        // timestamp
        '',             // repo
        '',             // file_path
        0,              // size_bytes
        '',             // chunk_idx/total
        '',             // point_id
        '',             // qdrant_http_status
        0,              // qdrant_result_points_upserted
        'dedup-key-added', // error_message / note
        0,              // elapsed_ms
        dk,             // dedup_key
        ts              // dedup_ts (UTC canonical)
      ];
      logRows.push(row);
    }
    if (logRows.length > 0) {
      appendLog(sheetCtx.sheet, logRows);
    }
  } catch (e3) {
    // best-effort only; don't let observability mirror failures break the main flow
  }
}

/* ---------- Discovery -> Validation -> Feed pipeline ---------- */

/**
 * discoverReposFromAwesomeLists(maxRepos)
 * Scans configured awesome lists READMEs and returns up to maxRepos candidate repos:
 *    { owner, name, fullName }
 *
 * This function validates each candidate's GitHub metadata (limited requests).
 */
function discoverReposFromAwesomeLists(maxRepos) {
  maxRepos = (typeof maxRepos === 'number' && maxRepos > 0) ? maxRepos : 10;
  var cfg = readAwesomeIntegrationConfig();
  var lists = cfg.lists;
  var maxValidationRequests = cfg.maxValidationRequests;

  var candidates = [];
  var seen = {};
  var validations = 0;

  for (var i = 0; i < lists.length && candidates.length < maxRepos; i++) {
    var cur = lists[i];
    if (!cur || !cur.owner || !cur.repo) continue;
    var md = null;
    try {
      md = fetchReadmeToMarkdown(cur.owner, cur.repo);
    } catch (e) {
      try { appendLogIfAvailable('awesome-readme-err', cur.owner + '/' + cur.repo + ': ' + String(e)); } catch (ee) {}
      continue;
    }
    if (!md) continue;
    var extracted = extractGithubReposFromMarkdown(md);

    // VERBOSE logging: record extracted candidates from README (raw extraction) when enabled
    try {
      if (cfg.verboseLogging && extracted && extracted.length > 0) {
        // Limit output to first 50 items to avoid huge logs
        var maxShow = Math.min(50, extracted.length);
        var snippet = extracted.slice(0, maxShow).map(function(x){ return x.owner + '/' + x.name; }).join(',');
        appendLogIfAvailable('verbose-extracted', cur.owner + '/' + cur.repo + ' -> extracted=' + String(extracted.length) + ' sample=' + snippet);
        if (extracted.length > maxShow) {
          appendLogIfAvailable('verbose-extracted', cur.owner + '/' + cur.repo + ' (truncated) showing first ' + String(maxShow) + ' of ' + String(extracted.length));
        }
      }
    } catch (eLog) {
      // best-effort only
    }

    for (var j = 0; j < extracted.length && candidates.length < maxRepos; j++) {
      var e = extracted[j];
      if (!e || !e.owner || !e.name) continue;
      var key = (e.owner + '/' + e.name).toLowerCase();
      if (seen[key]) continue;
      // Validate metadata via GitHub to avoid false positives
      if (validations >= maxValidationRequests) break;
      validations++;
      try {
        var url = 'https://api.github.com/repos/' + e.owner + '/' + e.name;
        var res = getGitHub(url);
        if (res && res.error) {
          // log but continue
          continue;
        }
        var meta = null;
        try { meta = JSON.parse(res.text || '{}'); } catch (pe) { continue; }
        if (meta && meta.full_name) {
          if (meta.archived || meta.private || meta.disabled) {
            // skip
            continue;
          }
          seen[key] = true;
          candidates.push({ owner: e.owner, name: e.name, stars: (meta.stargazers_count || 0), fullName: meta.full_name });
        }
      } catch (e2) {
        continue;
      }
    }
  }

  // Sort by stars desc
  candidates.sort(function(a, b) { return (b.stars || 0) - (a.stars || 0); });
  return candidates.slice(0, maxRepos);
}

/**
 * runAwesomeFeed(opts)
 * Core worker: discovers repos, iterates files, chunks, upserts to Qdrant.
 * opts:
 *   - mode: 'test' | 'production'
 *   - maxRepos: integer
 *   - maxFilesPerRepo: integer (overrides config)
 */
function runAwesomeFeed(opts) {
  opts = opts || {};
  var mode = opts.mode || 'production';
  var cfg = readAwesomeIntegrationConfig();
  var appCfg = getConfig();
  var maxRepos = (typeof opts.maxRepos === 'number' && opts.maxRepos > 0) ? opts.maxRepos : cfg.maxReposPerRun;
  var maxFilesPerRepo = (typeof opts.maxFilesPerRepo === 'number' && opts.maxFilesPerRepo > 0) ? opts.maxFilesPerRepo : cfg.maxFilesPerRepo;
  var dedupSheetName = cfg.dedupSheetName;

  var sheetCtx = ensureSheet();
  var tz = Session && typeof Session.getScriptTimeZone === 'function' ? Session.getScriptTimeZone() : 'UTC';

  // Preflight Qdrant
  var pf = preflightQdrant();
  if (!pf.ok) {
    appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', pf.status || '', 0, pf.error || 'qdrant preflight failed', pf.elapsedMs || 0)]);
    return false;
  }
  var vectorCfg = pf.vector || { useNamed: false, size: 384, name: null };

  // Discover repos
  var repos = [];
  try {
    repos = discoverReposFromAwesomeLists(maxRepos);
  } catch (e) {
    appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, 'discoverRepos error: ' + String(e), 0)]);
    return false;
  }
  if (!repos || repos.length === 0) {
    appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, 'no-awesome-repos-found', 0)]);
    return false;
  }

  // Prepare dedup sheet map
  var dedupSheet = getDedupSheet(dedupSheetName);
  var dedupMap = loadDedupMap(dedupSheet);
  var newDedupKeys = [];

  // Log discovered repos
  appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', '', (repos && repos.length) ? repos.length : 0, 'awesome-repos-found ' + repos.map(function(x){ return x.fullName; }).join(','), 0)]);

  var totalPoints = 0;
  var processedRepos = 0;
  var summaryOk = false;

  for (var ri = 0; ri < repos.length; ri++) {
    var repo = repos[ri];
    processedRepos++;
    try {
      var meta = fetchRepoMeta(repo.owner, repo.name);
      var tree = listTreeRecursive(repo.owner, repo.name, meta.commitSha);
      // Re-use Code.gs selectFiles but allow overriding maxFilesPerRepo
      var files = selectFiles(tree, maxFilesPerRepo, getConfig().MAX_FILE_SIZE_BYTES, repo.fullName, meta.commitSha);

      // NEW: log when no eligible files were found for a repo so it's visible in the logs sheet
      if (!files || files.length === 0) {
        try {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, '', 0, -1, -1, '', null, 0, 'no-eligible-files (tree_len=' + (tree ? tree.length : 0) + ')', 0)]);
        } catch (e) {
          // swallow logging errors
        }
        continue;
      }

      for (var fi = 0; fi < files.length; fi++) {
        var file = files[fi];
        var dkey = dedupKey(repo.fullName, file.path, file.sha);

        // Dedup check using sheet map
        if (dedupMap[dkey]) {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, file.size || 0, -1, -1, '', null, 0, 'dedup-skip (sheet)', 0)]);
          continue;
        }

        var raw = fetchRaw(repo.owner, repo.name, meta.commitSha, file.path);
        if (raw.error) {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, file.size || 0, -1, -1, '', null, 0, raw.error, 0)]);
          continue;
        }
        if (raw.bytes > getConfig().MAX_FILE_SIZE_BYTES) {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, raw.bytes, -1, -1, '', null, 0, 'raw-too-large', 0)]);
          continue;
        }

        var lang = detectLang(file.path);
        // accept .ts as TypeScript in detection by existing detectLang in Code.gs; if not present, fallback:
        if (!lang) lang = detectLang(file.path);

        var chunks = chunkText(raw.text, getConfig().CHUNK_SIZE_CHARS, getConfig().CHUNK_OVERLAP_CHARS);

        // NEW: if chunking produced no chunks, log and skip
        if (!chunks || chunks.length === 0) {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, raw.bytes, -1, -1, '', null, 0, 'no-chunks', 0)]);
          continue;
        }

        var sourceUrl = 'https://github.com/' + repo.owner + '/' + repo.name + '/blob/' + meta.defaultBranch + '/' + file.path;
        var rawUrl = 'https://raw.githubusercontent.com/' + repo.owner + '/' + repo.name + '/' + meta.commitSha + '/' + file.path;

        var points = makePoints({
          repoFullName: repo.fullName,
          repoStars: repo.stars,
          defaultBranch: meta.defaultBranch,
          commitSha: meta.commitSha,
          filePath: file.path,
          lang: lang,
          chunks: chunks,
          sourceUrl: sourceUrl,
          rawUrl: rawUrl,
          fetchedAtIso: Utilities.formatDate(new Date(), tz || 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'")
        }, vectorCfg);

        // NEW: if makePoints returned no points, log and skip
        if (!points || points.length === 0) {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, raw.bytes, -1, -1, '', null, 0, 'no-points-generated', 0)]);
          continue;
        }

        var fileLogs = [];
        for (var c = 0; c < points.length; c++) {
          var p = points[c];
          fileLogs.push(makeLogRow(tz, repo.fullName, file.path, raw.bytes, p.payload.chunk_idx, p.payload.chunk_total, p.id, null, 0, '', 0));
        }

        // Upsert in batches <= 50
        var allOk = true;
        for (var s = 0; s < points.length; s += 50) {
          var slice = points.slice(s, Math.min(points.length, s + 50));
          var up = upsertQdrant(slice);
          totalPoints += slice.length;
          // annotate logs for slice
          for (var li = s; li < Math.min(s + slice.length, fileLogs.length); li++) {
            fileLogs[li][6] = up.status;
            fileLogs[li][7] = up.upserted;
            fileLogs[li][8] = up.error || '';
            fileLogs[li][9] = up.elapsedMs || 0;
          }
          if (up.status >= 200 && up.status < 300) {
            summaryOk = true;
          } else {
            allOk = false;
            break;
          }
        }
        appendLog(sheetCtx.sheet, fileLogs);

        // On success mark dedup (sheet)
        if (allOk) {
          dedupMap[dkey] = true;
          newDedupKeys.push(dkey);
        }
      }

    } catch (eRepo) {
      appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, '', 0, -1, -1, '', null, 0, 'repo error: ' + String(eRepo), 0)]);
      continue;
    }
    // In test mode, process only one repo to keep run short
    if (mode === 'test') {
      break;
    }
  }

  // Persist new dedup keys in sheet
  if (newDedupKeys.length > 0) {
    appendDedupKeys(dedupSheet, newDedupKeys);
  }

  appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', totalPoints || 0, -1, -1, '', summaryOk ? 200 : '', totalPoints || 0, 'awesome-run-summary repos=' + String(processedRepos) + ' points=' + String(totalPoints), 0)]);
  return true;
}

/* ---------- Public entrypoints ---------- */

/**
 * testAwesomeRun()
 * Quick end-to-end test:
 *  - discover up to configured repos from awesome lists
 *  - process up to configured files per repo
 *  - perform Qdrant upserts in a single GAS invocation
 *
 * Use this to validate the end-to-end behavior locally in the editor.
 */
function testAwesomeRun() {
  var cfg = readAwesomeIntegrationConfig();
  // Respect configured limits for quick test runs (fallback to small defaults if missing)
  var maxRepos = (typeof cfg.maxReposPerRun === 'number' && cfg.maxReposPerRun > 0) ? cfg.maxReposPerRun : 2;
  var maxFilesPerRepo = (typeof cfg.maxFilesPerRepo === 'number' && cfg.maxFilesPerRepo > 0) ? cfg.maxFilesPerRepo : 2;
  return runAwesomeFeed({ mode: 'test', maxRepos: maxRepos, maxFilesPerRepo: maxFilesPerRepo });
}

/**
 * prodAwesomeRun()
 * Production-oriented run designed to be scheduled via time-driven trigger.
 * Uses configured defaults (AWESOME_MAX_REPOS_PER_RUN etc).
 */
function prodAwesomeRun() {
  return runAwesomeFeed({ mode: 'production' });
}

/* ---------- Small helper: use existing best-effort append log if available ---------- */

/**
 * appendLogIfAvailable(tag, msg)
 * Best-effort logging to either project's logging helpers or fallback to the `QdrantFeedLogs` -> `logs` sheet.
 * This mirrors the fallback behavior used in awesome.gs to centralize visibility.
 */
function appendLogIfAvailable(tag, msg) {
  try {
    if (typeof appendLog === 'function' && typeof makeLogRow === 'function') {
      try {
        var sheetCtx = ensureSheet();
        var tz = (Session && typeof Session.getScriptTimeZone === 'function') ? Session.getScriptTimeZone() : 'UTC';
        if (sheetCtx && sheetCtx.sheet) {
          appendLog(sheetCtx.sheet, [ makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, tag + ': ' + String(msg), 0) ]);
          return;
        }
      } catch (e) {
        // fall through
      }
    }
  } catch (e) {
    // fall through
  }

  // fallback: write simple row
  try {
    var ss = findOrCreateSpreadsheet('QdrantFeedLogs');
    var sheet = ss.getSheetByName('logs');
    if (!sheet) {
      try { sheet = ss.insertSheet('logs'); } catch (e) { var sheets = ss.getSheets(); sheet = (sheets && sheets.length > 0) ? sheets[0] : null; }
      if (sheet && sheet.getLastRow() === 0) {
        sheet.appendRow(['timestamp','tag','message']);
      }
    }
    if (!sheet) return;
    var ts = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    try { sheet.appendRow([ts, tag, String(msg)]); } catch (e) {}
  } catch (e) {
    // swallow
  }
}

/* End of awesome_integration.gs */
