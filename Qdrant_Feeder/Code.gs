/**
 * Qdrant Feeder Apps Script (per PRD qdrant_feeder_appscript.prd.md)
 * Time-driven pipeline: fetch GitHub code, chunk, upsert to Qdrant, log to Google Sheet.
 * Dedup based on repo|path|blob_sha and respect quotas.
 */

function tick() {
  runTick({ mode: 'production' });
}

function tickTest() {
  runTick({ mode: 'test' });
}

function runTick(options) {
  options = options || {};
  var mode = options.mode || 'production';
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    // Another run is active; skip safely.
    return;
  }
  try {
    var sheetCtx = ensureSheet();
    var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
    var start = new Date().getTime();
    var iteration = 0;
    while (true) {
      var cfg = getConfig();
      if (mode === 'production' && iteration === 0) {
        ensureScheduledTriggers(cfg);
      }
      var shouldContinue = runTickOnce(cfg, sheetCtx, tz);
      iteration++;
      if (mode !== 'test') {
        break;
      }
      if (!shouldContinue) {
        break;
      }
      cfg = getConfig(); // Allow edits to properties while loop runs
      var maxRuntimeMs = cfg.TEST_LOOP_MAX_RUNTIME_MS;
      if (!(maxRuntimeMs > 0)) {
        maxRuntimeMs = 280000; // ~4.6 minutes to stay within GAS quota
      }
      if ((new Date().getTime() - start) >= maxRuntimeMs) {
        break;
      }
      var sleepMs = cfg.TEST_LOOP_SLEEP_MS;
      if (sleepMs > 0) {
        Utilities.sleep(sleepMs);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function runTickOnce(cfg, sheetCtx, tz) {
  // Guard required Qdrant config
  if (!cfg.QDRANT_URL || !cfg.QDRANT_API_KEY) {
    appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, 'missing Qdrant config', 0)]);
    return false;
  }

  // Preflight Qdrant collection and vector config
  var pf = preflightQdrant();
  if (!pf.ok) {
    appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', pf.status || '', 0, pf.error || 'qdrant preflight failed', pf.elapsedMs || 0)]);
    return false;
  }

  var repos;
  try {
    repos = pickRepos(cfg.MAX_REPOS_PER_RUN);
  } catch (ePick) {
    appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, 'pickRepos error: ' + String(ePick), 0)]);
    return false;
  }
  if (!repos || repos.length === 0) {
    // Reset cursor to avoid being stuck on an empty high page, then retry once
    PropertiesService.getScriptProperties().setProperty('LAST_SEARCH_CURSOR', '1');
    try {
      repos = pickRepos(cfg.MAX_REPOS_PER_RUN);
    } catch (ePick2) {
      appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, 'pickRepos retry error: ' + String(ePick2), 0)]);
      return false;
    }
    if (!repos || repos.length === 0) {
      appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', null, 0, 'no-repos', 0)]);
      return false;
    }
  }
  var totalPoints = 0;
  var processedRepos = 0;
  var summaryOk = false;

  // Log repos found for visibility
  appendLog(sheetCtx.sheet, [makeLogRow(
    tz,
    '',
    '',
    0,
    -1,
    -1,
    '',
    '',
    (repos && repos.length) ? repos.length : 0,
    'repos-found ' + ((repos && repos.length) ? repos.map(function(x){ return x.fullName; }).join(',') : ''),
    0
  )]);

  for (var r = 0; r < repos.length; r++) {
    var repo = repos[r];
    processedRepos++;
    try {
      var meta = fetchRepoMeta(repo.owner, repo.name);
      var tree = listTreeRecursive(repo.owner, repo.name, meta.commitSha);
      var files = selectFiles(tree, cfg.MAX_FILES_PER_REPO, cfg.MAX_FILE_SIZE_BYTES, repo.fullName, meta.commitSha);

      for (var f = 0; f < files.length; f++) {
        var file = files[f];
        var dkey = dedupKey(repo.fullName, file.path, file.sha);
        if (hasDedupKey(dkey)) {
          // log dedup skip (size from tree, raw not fetched)
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, file.size || 0, -1, -1, '', null, 0, 'dedup-skip', 0)]);
          continue;
        }

        var raw = fetchRaw(repo.owner, repo.name, meta.commitSha, file.path);
        if (raw.error) {
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, file.size || 0, -1, -1, '', null, 0, raw.error, 0)]);
          continue;
        }
        if (raw.bytes > cfg.MAX_FILE_SIZE_BYTES) {
          // Guard against unexpected large raw content
          appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, raw.bytes, -1, -1, '', null, 0, 'raw-too-large', 0)]);
          continue;
        }

        var lang = detectLang(file.path);
        var chunks = chunkText(raw.text, cfg.CHUNK_SIZE_CHARS, cfg.CHUNK_OVERLAP_CHARS);
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
          fetchedAtIso: formatIsoLocal(new Date(), tz)
        }, pf.vector);

        // Prepare file logs for each chunk (size from raw to keep consistent)
        var fileLogs = [];
        for (var c = 0; c < points.length; c++) {
          var p = points[c];
          fileLogs.push(makeLogRow(tz, repo.fullName, file.path, raw.bytes, p.payload.chunk_idx, p.payload.chunk_total, p.id, null, 0, '', 0));
        }

        // Upsert per-file in slices ≤ 50
        var allOk = true;
        for (var s = 0; s < points.length; s += 50) {
          var slice = points.slice(s, Math.min(points.length, s + 50));
          var up = upsertQdrant(slice);
          totalPoints += slice.length;
          for (var li = s; li < Math.min(s + slice.length, fileLogs.length); li++) {
            fileLogs[li][6] = up.status;          // qdrant_http_status
            fileLogs[li][7] = up.upserted;        // qdrant_result_points_upserted
            fileLogs[li][8] = up.error || '';     // error_message
            fileLogs[li][9] = up.elapsedMs;       // elapsed_ms
          }
          if (up.status >= 200 && up.status < 300) {
            summaryOk = true;
          } else {
            allOk = false;
            break;
          }
        }
        appendLog(sheetCtx.sheet, fileLogs);

        // Mark dedup only after successful upsert for this file
        if (allOk) {
          try {
            // Prefer sheet-based dedup: append immediately per-file to minimize window
            var ds = findOrCreateSpreadsheet('QdrantFeedLogs').getSheetByName('awesome_dedup');
            if (!ds) {
              try { ds = findOrCreateSpreadsheet('QdrantFeedLogs').insertSheet('awesome_dedup'); ds.appendRow(['dedup_key','ts']); } catch (e) { ds = null; }
            }
            if (ds) {
              try {
                var ts = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
                ds.appendRow([dkey, ts]);
                // keep in-memory cache in sync if present
                try { if (typeof DEDUP_CACHE !== 'undefined' && DEDUP_CACHE !== null) DEDUP_CACHE[String(dkey)] = true; } catch (eCache) {}
              } catch (eAppend) {
                // If sheet append fails, log to logs for observability but do NOT write to PropertiesService (avoid property limits)
                try { appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, raw.bytes, -1, -1, '', null, 0, 'dedup-append-failed', 0)]); } catch (ee) {}
              }
            } else {
              // Sheet not available: log and skip dedup write (do not use PropertiesService)
              try { appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, file.path, raw.bytes, -1, -1, '', null, 0, 'dedup-sheet-missing', 0)]); } catch (ee2) {}
            }
          } catch (eOverall) {
            // best-effort only; do not fail processing if dedup logging fails
          }
        }
      }

    } catch (eRepo) {
      // Log repo-level error
      appendLog(sheetCtx.sheet, [makeLogRow(tz, repo.fullName, '', 0, -1, -1, '', null, 0, String(eRepo), 0)]);
    }
  }

  // Run summary log (ensures at least one row per successful run)
  appendLog(sheetCtx.sheet, [makeLogRow(
    tz,
    '',               // repo
    '',               // file_path
    totalPoints || 0, // size_bytes (repurpose as total points for summary)
    -1,               // chunk_idx
    -1,               // chunk_total
    '',               // point_id
    summaryOk ? 200 : '', // qdrant_http_status
    totalPoints || 0,     // qdrant_result_points_upserted
    'run-summary repos=' + String(processedRepos) + ' points=' + String(totalPoints),
    0                 // elapsed_ms (optional)
  )]);

  // Save paging cursor
  saveCursor();

  return true;
}

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  function intProp(k, d) {
    var v = props.getProperty(k);
    return v ? parseInt(v, 10) : d;
  }
  return {
    GITHUB_PAT: props.getProperty('GITHUB_PAT') || '',
    QDRANT_API_KEY: props.getProperty('QDRANT_API_KEY') || '',
    QDRANT_URL: props.getProperty('QDRANT_URL') || '',
    QDRANT_COLLECTION: props.getProperty('QDRANT_COLLECTION') || '',
    MAX_REPOS_PER_RUN: intProp('MAX_REPOS_PER_RUN', 2),
    MAX_FILES_PER_REPO: intProp('MAX_FILES_PER_REPO', 6),
    MAX_FILE_SIZE_BYTES: intProp('MAX_FILE_SIZE_BYTES', 65536),
    CHUNK_SIZE_CHARS: intProp('CHUNK_SIZE_CHARS', 3000),
    CHUNK_OVERLAP_CHARS: intProp('CHUNK_OVERLAP_CHARS', 200),
    TRIGGER_AUTO_INSTALL: propBool(props.getProperty('TRIGGER_AUTO_INSTALL'), true),
    TRIGGER_DAILY_HOUR: intProp('TRIGGER_DAILY_HOUR', 1),
    TRIGGER_INTERVAL_MINUTES: intProp('TRIGGER_INTERVAL_MINUTES', 15),
    TEST_LOOP_MAX_RUNTIME_MS: intProp('TEST_LOOP_MAX_RUNTIME_MS', 280000),
    TEST_LOOP_SLEEP_MS: intProp('TEST_LOOP_SLEEP_MS', 0)
  };
}

function propBool(v, dflt) {
  if (v === null || v === undefined || v === '') return dflt;
  var s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return dflt;
}

function ensureSheet() {
  var name = 'QdrantFeedLogs';
  var sheetName = 'logs';
  var ss = findOrCreateSpreadsheet(name);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  // Ensure header (simple, deterministic header creation)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'timestamp',
      'repo',
      'file_path',
      'size_bytes',
      'chunk_idx/total',
      'point_id',
      'qdrant_http_status',
      'qdrant_result_points_upserted',
      'error_message',
      'elapsed_ms',
      'dedup_key',
      'dedup_ts'
    ]);
  }
  return { spreadsheet: ss, sheet: sheet };
}

function findOrCreateSpreadsheet(name) {
  var it = DriveApp.getFilesByName(name);
  if (it.hasNext()) {
    var file = it.next();
    return SpreadsheetApp.open(file);
  }
  return SpreadsheetApp.create(name);
}

function appendLog(sheet, rows) {
  if (!rows || rows.length === 0) return;
  var startRow = sheet.getLastRow() + 1;
  // Determine number of columns from the first row provided so appendLog supports variable-width rows.
  var cols = 10;
  try {
    if (rows[0] && Array.isArray(rows[0]) && rows[0].length > 0) {
      cols = rows[0].length;
    }
  } catch (e) {
    cols = 10;
  }
  // Ensure there's enough columns in the sheet to accept the data (best-effort)
  try {
    var currentCols = sheet.getLastColumn();
    if (currentCols < cols) {
      sheet.insertColumnsAfter(currentCols, cols - currentCols);
    }
  } catch (e) {
    // ignore; we'll still attempt to write and let the platform raise if it fails
  }
  var range = sheet.getRange(startRow, 1, rows.length, cols);
  range.setValues(rows);
}

function formatIsoLocal(d, tz) {
  return Utilities.formatDate(d, tz || 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ssZ");
}

function pickRepos(maxCount) {
  // Enhanced pickRepos: optionally use awesome-list discovery when enabled.
  // If discovery via awesome lists fails or is disabled, fallback to the original GitHub Search logic.
  maxCount = (typeof maxCount === 'number' && maxCount > 0) ? maxCount : 10;

  // Check runtime flag: USE_AWESOME_DISCOVERY in Script Properties (true/1/yes)
  try {
    var props = PropertiesService.getScriptProperties();
    var useAwesomeRaw = props.getProperty('USE_AWESOME_DISCOVERY');
    var useAwesome = false;
    if (useAwesomeRaw !== null && useAwesomeRaw !== undefined && useAwesomeRaw !== '') {
      var s = String(useAwesomeRaw).toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') useAwesome = true;
    }
    if (useAwesome && typeof discoverReposFromAwesomeLists === 'function') {
      try {
        var discovered = discoverReposFromAwesomeLists(maxCount);
        if (discovered && discovered.length > 0) {
          // Log discovery usage
          try {
            var sheetCtx = ensureSheet();
            var tz = Session && typeof Session.getScriptTimeZone === 'function' ? Session.getScriptTimeZone() : 'UTC';
            appendLog(sheetCtx.sheet, [makeLogRow(tz, '', '', 0, -1, -1, '', '', discovered.length, 'pickRepos: used awesome discovery ' + discovered.map(function(x){ return x.fullName; }).join(','), 0)]);
          } catch (e) {
            // ignore logging errors
          }
          return discovered.slice(0, maxCount);
        }
      } catch (e) {
        // If awesome discovery fails, fallthrough to search; record a best-effort log
        try {
          var sheetCtx2 = ensureSheet();
          var tz2 = Session && typeof Session.getScriptTimeZone === 'function' ? Session.getScriptTimeZone() : 'UTC';
          appendLog(sheetCtx2.sheet, [makeLogRow(tz2, '', '', 0, -1, -1, '', null, 0, 'awesome discovery failed: ' + String(e), 0)]);
        } catch (e2) {}
      }
    }
  } catch (e) {
    // ignore property read errors and continue to search-based discovery
  }

  // --- Original GitHub search-based logic (fallback) ---
  var cfg = getConfig();
  var cursorPage = getCursorPage();

  var now = new Date();
  var d7 = new Date(now.getTime());
  d7.setDate(d7.getDate() - 7);
  var d30 = new Date(now.getTime());
  d30.setDate(d30.getDate() - 30);

  var pushed7 = Utilities.formatDate(d7, 'UTC', 'yyyy-MM-dd');
  var pushed30 = Utilities.formatDate(d30, 'UTC', 'yyyy-MM-dd');
  var baseLangs = '(language:python OR language:javascript OR language:go)';

  function runSearch(q, page, perPage) {
    var params = 'sort=stars&order=desc&per_page=' + (perPage || 10) + '&page=' + page;
    var url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&' + params;
    var res = getGitHub(url);
    if (res.error) {
      return { items: [], error: res.error, url: url };
    }
    var json = JSON.parse(res.text);
    return { items: (json.items || []), url: url };
  }

  // Progressive fallbacks to avoid empty results:
  // 1) 7-day window, stars>1000, paged
  // 2) 30-day window, stars>1000, page=1
  // 3) 30-day window, stars>500, page=1
  // 4) No pushed filter, stars>1000, page=1
  // 5) No pushed filter, stars>500, per_page=20
  // 6) No stars filter, per_page=20 (broadest)
  var tries = [
    { q: baseLangs + ' stars:>1000 pushed:>' + pushed7, page: cursorPage, perPage: 10 },
    { q: baseLangs + ' stars:>1000 pushed:>' + pushed30, page: 1, perPage: 10 },
    { q: baseLangs + ' stars:>500 pushed:>' + pushed30, page: 1, perPage: 10 },
    { q: baseLangs + ' stars:>1000', page: 1, perPage: 10 },
    { q: baseLangs + ' stars:>500', page: 1, perPage: 20 },
    { q: baseLangs, page: 1, perPage: 20 }
  ];

  var items = [];
  for (var t = 0; t < tries.length && items.length === 0; t++) {
    var tr = tries[t];
    var res = runSearch(tr.q, tr.page, tr.perPage);
    if (res.error) {
      // Bubble up for run-level logging in tick()
      throw new Error('GitHub search error: ' + res.error);
    }
    items = res.items;
  }


    // Logic for curated fallback list (items.length === 0) has been removed.
    // We now rely solely on awesome-list discovery via USE_AWESOME_DISCOVERY = true.

  var repos = [];
  for (var i = 0; i < items.length && repos.length < maxCount; i++) {
    var it = items[i];
    if (!it || !it.owner) continue;
    repos.push({
      owner: it.owner.login,
      name: it.name,
      stars: it.stargazers_count,
      fullName: it.full_name
    });
  }
  return repos;
}

function fetchRepoMeta(owner, repo) {
  var metaRes = getGitHub('https://api.github.com/repos/' + owner + '/' + repo);
  if (metaRes.error) throw new Error('Repo meta error: ' + metaRes.error);
  var meta = JSON.parse(metaRes.text);
  var defBranch = meta.default_branch || 'main';
  var brRes = getGitHub('https://api.github.com/repos/' + owner + '/' + repo + '/branches/' + defBranch);
  if (brRes.error) throw new Error('Branch meta error: ' + brRes.error);
  var br = JSON.parse(brRes.text);

  var commitSha = (br.commit && br.commit.sha) ? br.commit.sha : null;
  if (!commitSha) {
    // Fallback: resolve latest commit SHA on default branch
    var comRes = getGitHub('https://api.github.com/repos/' + owner + '/' + repo + '/commits/' + defBranch);
    if (comRes.error) throw new Error('Resolve commit sha error: ' + comRes.error);
    var com = JSON.parse(comRes.text);
    commitSha = (com && com.sha) ? com.sha : (Array.isArray(com) && com.length > 0 ? com[0].sha : null);
  }
  if (!commitSha) throw new Error('No commit sha for ' + owner + '/' + repo + ' branch ' + defBranch);
  return { defaultBranch: defBranch, commitSha: commitSha };
}

function listTreeRecursive(owner, repo, sha) {
  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/git/trees/' + sha + '?recursive=1';
  var res = getGitHub(url);
  if (res.error) throw new Error('Tree error: ' + res.error);
  var json = JSON.parse(res.text);
  var tree = json.tree || [];
  var files = [];
  for (var i = 0; i < tree.length; i++) {
    var t = tree[i];
    if (t.type === 'blob') {
      files.push({ path: t.path, type: t.type, sha: t.sha, size: t.size || 0 });
    }
  }
  return files;
}

function selectFiles(files, maxFiles, maxSize, repoFullName, commitSha) {
  var selected = [];
  var candidates = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (isEligiblePath(f.path, f.size, maxSize)) {
      // Staged consumption: skip files already processed (dedup) so runs can gradually consume all .py/.go/.js
      var dkey = dedupKey(repoFullName, f.path, f.sha);
      if (!hasDedupKey(dkey)) {
        candidates.push(f);
      }
    }
  }
  // Prioritize important files
  candidates.sort(function(a, b) {
    return scoreFile(b) - scoreFile(a);
  });
  for (var j = 0; j < candidates.length && selected.length < maxFiles; j++) {
    selected.push(candidates[j]);
  }
  return selected;
}

function isEligiblePath(path, size, maxSize) {
  if (size > maxSize) return false;
  var p = path.toLowerCase();
  // Skip undesired folders (including nested)
  var skipRe = /(^|\/)(test|tests|examples|dist|node_modules|vendor)\//;
  if (skipRe.test(p)) return false;
  // Allowed extensions (default scope)
  var exts = ['.py', '.js', '.go'];
  for (var i = 0; i < exts.length; i++) {
    if (p.endsWith(exts[i])) return true;
  }
  return false;
}

function scoreFile(f) {
  var p = f.path.toLowerCase();
  var s = 0;
  if (p === 'readme.md') s += 100;
  if (p.indexOf('src/') === 0) s += 40;
  if (p.indexOf('lib/') === 0) s += 30;
  if (p.indexOf('core/') === 0) s += 30;
  var base = p.split('/').pop();
  var names = ['main', 'index', 'utils', 'config', 'router', 'service'];
  for (var i = 0; i < names.length; i++) {
    if (base.indexOf(names[i]) !== -1) s += 20;
  }
  // Prefer medium-sized files under limit
  s += Math.min(20, Math.floor((f.size || 0) / 1024));
  return s;
}

function detectLang(path) {
  var p = path.toLowerCase();
  if (p.endsWith('.py')) return 'python';
  if (p.endsWith('.js')) return 'javascript';
  if (p.endsWith('.ts')) return 'typescript';
  if (p.endsWith('.go')) return 'go';
  if (p.endsWith('.md')) return 'markdown';
  return 'text';
}

function fetchRaw(owner, repo, sha, path) {
  var url = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + sha + '/' + path;
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      var text = res.getContentText();
      var bytes = res.getContent().length;
      return { text: text, bytes: bytes };
    } else {
      return { error: 'Raw fetch status ' + code };
    }
  } catch (e) {
    return { error: 'Raw fetch error: ' + String(e) };
  }
}

function chunkText(text, size, overlap) {
  var chunks = [];
  if (!text) return chunks;
  var pos = 0;
  var step = Math.max(1, size - overlap);
  while (pos < text.length) {
    var end = Math.min(text.length, pos + size);
    var slice = text.substring(pos, end);
    chunks.push(slice);
    if (end >= text.length) break;
    pos += step;
  }
  return chunks;
}

function makePoints(args, vectorCfg) {
  var repoFullName = args.repoFullName;
  var repoStars = args.repoStars;
  var defaultBranch = args.defaultBranch;
  var commitSha = args.commitSha;
  var filePath = args.filePath;
  var lang = args.lang;
  var chunks = args.chunks;
  var sourceUrl = args.sourceUrl;
  var rawUrl = args.rawUrl;
  var fetchedAtIso = args.fetchedAtIso;
  var points = [];
  var vectorSize = (vectorCfg && typeof vectorCfg.size === 'number' && vectorCfg.size > 0) ? vectorCfg.size : 384;
  var placeholder = placeholderVector(vectorSize);

  // Vector payload shape: named vs single (unnamed)
  var useNamed = vectorCfg && !!vectorCfg.useNamed;
  var vecName = vectorCfg && vectorCfg.name ? vectorCfg.name : 'sentence-transformers/all-MiniLM-L6-v2';

  for (var i = 0; i < chunks.length; i++) {
    var id = makePointId(repoFullName, commitSha, filePath, i);
    var vecPayload = useNamed ? (function() { var m = {}; m[vecName] = placeholder; return m; })() : placeholder;
    points.push({
      id: id,
      vector: vecPayload,
      payload: {
        repo: repoFullName,
        repo_stars: repoStars,
        default_branch: defaultBranch,
        commit_sha: commitSha,
        file_path: filePath,
        lang: lang,
        chunk_idx: i,
        chunk_total: chunks.length,
        content: chunks[i],
        source_url: sourceUrl,
        raw_url: rawUrl,
        fetched_at: fetchedAtIso
      }
    });
  }
  return points;
}

function placeholderVector(size) {
  var length = (typeof size === 'number' && size > 0) ? size : 384;
  var arr = [];
  for (var i = 0; i < length; i++) arr.push(0.0);
  return arr;
}

function makePointId(repoFullName, commitSha, filePath, chunkIdx) {
  var data = repoFullName + '|' + commitSha + '|' + filePath + '|' + String(chunkIdx);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, data, Utilities.Charset.UTF_8);
  var uuidBytes = [];
  for (var i = 0; i < 16 && i < bytes.length; i++) {
    uuidBytes.push((bytes[i] + 256) % 256);
  }
  // Ensure we have 16 bytes (pad with remaining digest if needed)
  for (var j = uuidBytes.length; j < 16; j++) {
    var next = (bytes[j % bytes.length] + 256) % 256;
    uuidBytes.push(next);
  }
  // Set UUID version (v5) and variant bits
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

  var parts = [];
  var idx = 0;
  var sections = [4, 2, 2, 2, 6];
  for (var s = 0; s < sections.length; s++) {
    var len = sections[s];
    var segment = '';
    for (var k = 0; k < len; k++) {
      var val = uuidBytes[idx++];
      var hex = val.toString(16);
      if (hex.length < 2) hex = '0' + hex;
      segment += hex;
    }
    parts.push(segment);
  }
  return parts.join('-');
}

function preflightQdrant() {
  var cfg = getConfig();
  var url = cfg.QDRANT_URL.replace(/\/$/, '') + '/collections/' + cfg.QDRANT_COLLECTION;
  var headers = {
    'api-key': cfg.QDRANT_API_KEY,
    'Content-Type': 'application/json'
  };
  var desiredName = 'sentence-transformers/all-MiniLM-L6-v2';
  var start = new Date();
  try {
    var res = UrlFetchApp.fetch(url, { method: 'get', headers: headers, muteHttpExceptions: true });
    var code = res.getResponseCode();
    var elapsed = new Date().getTime() - start.getTime();
    if (code >= 200 && code < 300) {
      var json = JSON.parse(res.getContentText());
      var cfgNode = json && json.result && json.result.config;
      // Try several shapes for vectors config
      var vcfg = null;
      if (cfgNode) {
        if (cfgNode.params && cfgNode.params.vectors) {
          vcfg = cfgNode.params.vectors;
        } else if (cfgNode.vectors) {
          vcfg = cfgNode.vectors;
        } else if (typeof cfgNode.vector_size === 'number') {
          vcfg = { size: cfgNode.vector_size }; // fallback older shape
        }
      }

      var vector = { useNamed: false, name: null, size: null };
      if (vcfg && typeof vcfg.size === 'number') {
        // Single unnamed vector
        vector.useNamed = false;
        vector.size = vcfg.size;
      } else if (vcfg && typeof vcfg === 'object') {
        // Named vectors map
        var keys = Object.keys(vcfg);
        if (vcfg[desiredName] && typeof vcfg[desiredName].size === 'number') {
          vector.useNamed = true;
          vector.name = desiredName;
          vector.size = vcfg[desiredName].size;
        } else {
          // Pick the first named vector that reports a positive size
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var node = vcfg[k];
            if (node && typeof node.size === 'number' && node.size > 0) {
              vector.useNamed = true;
              vector.name = k;
              vector.size = node.size;
              break;
            }
          }
          // If none provided a usable size, keep for diagnostics
          if (!vector.name && keys.length > 0 && vcfg[keys[0]] && typeof vcfg[keys[0]].size === 'number') {
            vector.useNamed = true;
            vector.name = keys[0];
            vector.size = vcfg[keys[0]].size;
          }
        }
      }

      var ok = (typeof vector.size === 'number' && vector.size > 0) && (vector.useNamed ? !!vector.name : true);
      var errMsg = ok ? '' : 'invalid Qdrant vector config (size=' + (vector.size != null ? vector.size : 'n/a') + ', name=' + (vector.useNamed ? (vector.name || 'n/a') : 'unnamed') + ')';
      return { ok: ok, status: code, error: errMsg, elapsedMs: elapsed, vector: vector };
    }
    return { ok: false, status: code, error: 'qdrant collections get error: ' + res.getContentText(), elapsedMs: elapsed, vector: null };
  } catch (e) {
    return { ok: false, status: 0, error: 'qdrant preflight exception: ' + String(e), elapsedMs: (new Date().getTime() - start.getTime()), vector: null };
  }
}

function upsertQdrant(points) {
  var cfg = getConfig();
  var url = cfg.QDRANT_URL.replace(/\/$/, '') + '/collections/' + cfg.QDRANT_COLLECTION + '/points?wait=true';
  var body = JSON.stringify({ points: points });
  var headers = {
    'api-key': cfg.QDRANT_API_KEY,
    'Content-Type': 'application/json'
  };
  var start = new Date();
  try {
    var res = UrlFetchApp.fetch(url, { method: 'put', contentType: 'application/json', payload: body, headers: headers, muteHttpExceptions: true });
    var code = res.getResponseCode();
    var elapsed = new Date().getTime() - start.getTime();
    if (code >= 200 && code < 300) {
      return { status: code, upserted: points.length, error: '', elapsedMs: elapsed };
    }
    // Retry once on timeout/5xx
    if (code >= 500 || code === 408) {
      Utilities.sleep(2000);
      var res2 = UrlFetchApp.fetch(url, { method: 'put', contentType: 'application/json', payload: body, headers: headers, muteHttpExceptions: true });
      var code2 = res2.getResponseCode();
      var elapsed2 = new Date().getTime() - start.getTime();
      if (code2 >= 200 && code2 < 300) {
        return { status: code2, upserted: points.length, error: '', elapsedMs: elapsed2 };
      } else {
        return { status: code2, upserted: 0, error: 'Qdrant retry failed: ' + code2 + ' ' + res2.getContentText(), elapsedMs: elapsed2 };
      }
    }
    return { status: code, upserted: 0, error: 'Qdrant error: ' + code + ' ' + res.getContentText(), elapsedMs: (new Date().getTime() - start.getTime()) };
  } catch (e) {
    var elapsedE = new Date().getTime() - start.getTime();
    return { status: 0, upserted: 0, error: 'Qdrant fetch exception: ' + String(e), elapsedMs: elapsedE };
  }
}

function getGitHub(url) {
  var cfg = getConfig();
  var headers = {
    'Authorization': cfg.GITHUB_PAT ? ('Bearer ' + cfg.GITHUB_PAT) : undefined,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  // Remove undefined headers
  var clean = {};
  for (var k in headers) {
    if (headers[k] !== undefined) clean[k] = headers[k];
  }
  try {
    var res = UrlFetchApp.fetch(url, { method: 'get', headers: clean, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code === 403) {
      // Treat as rate-limit
      return { error: 'GitHub 403 rate limit on ' + url };
    }
    if (code >= 200 && code < 300) {
      return { text: res.getContentText() };
    }
    return { error: 'GitHub status ' + code + ' ' + res.getContentText() };
  } catch (e) {
    return { error: 'GitHub fetch error: ' + String(e) };
  }
}

function dedupKey(repoFullName, path, blobSha) {
  return repoFullName + '@' + blobSha + ':' + path;
}

/* ---------- Dedup helpers (sheet-based consolidated) ---------- */
/*
  Consolidated dedup approach (Option A):
  - Use sheet 'awesome_dedup' as single source-of-truth.
  - Maintain an in-memory cache `DEDUP_CACHE` per execution to avoid repeated sheet reads.
  - Provide a migration helper to move legacy `PropertiesService` DEDUP_ keys into the sheet.
*/

var DEDUP_CACHE = null;

function loadDedupCache() {
  if (DEDUP_CACHE !== null) return DEDUP_CACHE;
  DEDUP_CACHE = {};
  try {
    var ss = findOrCreateSpreadsheet('QdrantFeedLogs');
    var sheet = ss.getSheetByName('awesome_dedup');
    if (!sheet) return DEDUP_CACHE;
    var last = sheet.getLastRow();
    if (last < 2) return DEDUP_CACHE;
    var vals = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      var k = vals[i][0];
      if (k) DEDUP_CACHE[String(k)] = true;
    }
  } catch (e) {
    // best-effort: leave cache empty on error
  }
  return DEDUP_CACHE;
}

function hasDedupKey(key) {
  if (!key) return false;
  try {
    var cache = loadDedupCache();
    if (cache[String(key)]) return true;
  } catch (e) {
    // ignore cache errors
  }
  // No fallback to PropertiesService: rely solely on sheet-based dedup (avoid PropertiesService usage and limits).
  return false;
}

function markDedupKey(key) {
  if (!key) return;
  // Append immediately to sheet (per-file) to minimize race window.
  try {
    var ss = findOrCreateSpreadsheet('QdrantFeedLogs');
    var sheet = ss.getSheetByName('awesome_dedup');
    if (!sheet) {
      try { sheet = ss.insertSheet('awesome_dedup'); sheet.appendRow(['dedup_key','ts']); } catch (e) { sheet = null; }
    }
    if (sheet) {
      var ts = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
      sheet.appendRow([key, ts]);
      if (DEDUP_CACHE === null) DEDUP_CACHE = {};
      DEDUP_CACHE[String(key)] = true;
      return;
    }
  } catch (e) {
    // append failed; fall through to properties fallback
  }

  // Do NOT write dedup keys into PropertiesService (limited storage). Ensure in-memory cache is updated so
  // within this execution we avoid reprocessing the same key even if sheet append failed.
  if (DEDUP_CACHE === null) DEDUP_CACHE = {};
  DEDUP_CACHE[String(key)] = true;
}

/**
 * migrateDedupPropertiesToSheet()
 * Migration helper: moves any DEDUP_ keys in PropertiesService into the awesome_dedup sheet.
 * Idempotent: safe to run multiple times.
 *
 * Returns the number of migrated keys (integer).
 */
function migrateDedupPropertiesToSheet() {
  var migrated = 0;
  try {
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties() || {};
    var rows = [];
    for (var k in all) {
      if (k && k.indexOf('DEDUP_') === 0) {
        var ded = k.substring(5); // after 'DEDUP'
        // Normalize: if leading '_' present (legacy), strip
        if (ded.charAt(0) === '_') ded = ded.substring(1);
        var keyVal = ded;
        var ts = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
        rows.push([keyVal, ts]);
        migrated++;
        try { props.deleteProperty(k); } catch (eDel) {}
      }
    }
    if (rows.length > 0) {
      var ss = findOrCreateSpreadsheet('QdrantFeedLogs');
      var sheet = ss.getSheetByName('awesome_dedup');
      if (!sheet) {
        try { sheet = ss.insertSheet('awesome_dedup'); sheet.appendRow(['dedup_key','ts']); } catch (e2) { sheet = null; }
      }
      if (sheet) {
        try {
          sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
        } catch (eSet) {
          // fallback to appendRow loop
          for (var ri = 0; ri < rows.length; ri++) {
            try { sheet.appendRow(rows[ri]); } catch (eRow) {}
          }
        }
      }
    }
  } catch (eOuter) {
    // best-effort only
  }
  // Refresh cache
  DEDUP_CACHE = null;
  loadDedupCache();
  // Log migration result for observability (best-effort)
  try { appendLogIfAvailable('migrate-dedup', 'migrated=' + String(migrated)); } catch (e) {}
  return migrated;
}

function getCursorPage() {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty('LAST_SEARCH_CURSOR');
  var p = v ? parseInt(v, 10) : 1;
  return isNaN(p) ? 1 : p;
}

function saveCursor() {
  var props = PropertiesService.getScriptProperties();
  var next = getCursorPage() + 1;
  props.setProperty('LAST_SEARCH_CURSOR', String(next));
}

function ensureScheduledTriggers(cfg) {
  if (!cfg.TRIGGER_AUTO_INSTALL) return;
  var props = PropertiesService.getScriptProperties();
  var allowedMinutes = [1, 5, 10, 15, 30];
  var interval = allowedMinutes.indexOf(cfg.TRIGGER_INTERVAL_MINUTES) !== -1 ? cfg.TRIGGER_INTERVAL_MINUTES : 15;
  var hour = cfg.TRIGGER_DAILY_HOUR;
  if (isNaN(hour) || hour < 0 || hour > 23) hour = 1;
  var signature = 'tick|' + hour + '|' + interval;
  var key = 'TRIGGER_SIGNATURE';
  var existingSig = props.getProperty(key);
  if (existingSig === signature) return;

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction && triggers[i].getHandlerFunction() === 'tick') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('tick').timeBased().atHour(hour).everyDays(1).create();
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(interval).create();
  props.setProperty(key, signature);
}

function makeLogRow(tz, repo, filePath, sizeBytes, chunkIdx, chunkTotal, pointId, httpStatus, upserted, err, elapsedMs) {
  var ts = formatIsoLocal(new Date(), tz);
  var chunkField = (chunkIdx >= 0 && chunkTotal >= 0) ? (String(chunkIdx) + '/' + String(chunkTotal)) : '';
  return [
    ts,
    repo || '',
    filePath || '',
    sizeBytes || 0,
    chunkField,
    pointId || '',
    httpStatus != null ? httpStatus : '',
    upserted != null ? upserted : '',
    err || '',
    elapsedMs || 0
  ];
}

function installTriggers() {
  // Convenience: create 15-min trigger and daily 01:00 trigger
  var triggers = ScriptApp.getProjectTriggers();
  var hasTick = false;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'tick') {
      hasTick = true;
      break;
    }
  }
  if (!hasTick) {
    ScriptApp.newTrigger('tick').timeBased().everyMinutes(15).create();
    ScriptApp.newTrigger('tick').timeBased().atHour(1).everyDays(1).create();
  }
}
