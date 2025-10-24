# 🚀 DEPLOYMENT Guide - Ba-ba-banana Radars

Panduan lengkap untuk production deployment & monitoring.

## 📖 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Production Setup](#production-setup)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Rollback Procedure](#rollback-procedure)
7. [Troubleshooting Production](#troubleshooting-production)

---

## Pre-Deployment Checklist

### ✅ Code Quality

- [ ] Semua E2E test PASSED (jalankan `runAllE2ETests()`)
- [ ] Manual testing `/radar discover` & `/radar setup` berhasil
- [ ] Tidak ada error di Execution Log
- [ ] Code review selesai (jika ada team)
- [ ] Backup kode di GitHub/Git (optional tapi recommended)

### ✅ Infrastructure

- [ ] Production Spreadsheet sudah dibuat (`Ba-banana Radars Config - PROD`)
- [ ] Production Spreadsheet backed up (download as Excel untuk safety)
- [ ] All sheets created: `RadarConfig`, `RadarLogs`, `ChannelCache`
- [ ] Column headers validated (lihat SETUP.md)
- [ ] Spreadsheet shared ke email account Apps Script (jika berbeda)

### ✅ Discord Configuration

- [ ] Production Discord Bot created (atau gunakan existing)
- [ ] Bot token & Public Key dicopy ke Script Properties
- [ ] Bot invited ke production server dengan correct permissions:
  - ✅ `Send Messages`
  - ✅ `Embed Links`
  - ✅ `Manage Webhooks`
  - ✅ `Read Message History`
- [ ] Production channels created:
  - `#radar-status` (untuk status reports)
  - `#radar-crypto` (untuk crypto updates)
  - `#radar-trends` (untuk trends updates)
  - `#radar-logs` (untuk error/debug logs)
- [ ] Role permissions configured

### ✅ API Keys

- [ ] `DISCORD_PUBLIC_KEY` set di Script Properties ✅
- [ ] `DISCORD_BOT_TOKEN` set di Script Properties ✅
- [ ] `SPREADSHEET_ID` pointing ke production spreadsheet ✅
- [ ] `BINANCE_API_KEY` & `BINANCE_API_SECRET` set (jika using Crypto Radar)
- [ ] `OPENROUTER_API_KEY` set (jika using AI summary)
- [ ] All keys stored securely (tidak di-commit ke Git!)

### ✅ Documentation

- [ ] README.md reviewed & up-to-date
- [ ] Runbook dokumentasi siap (lihat Monitoring section)
- [ ] Incident response plan documented
- [ ] Team trained tentang system operation

---

## Production Setup

### Create Production Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com)
2. Create spreadsheet baru: `Ba-banana Radars Config - PROD`
3. Copy all sheets dari test environment:
   - `RadarConfig` (dengan sample data atau kosong)
   - `RadarLogs` (headers saja)
   - `ChannelCache` (headers saja)
4. Verify column headers exact match (lihat SETUP.md)
5. Copy Spreadsheet ID

### Update Script Properties to Production

Di Apps Script Project Settings → Script properties, update:

| Key | Value | Notes |
|-----|-------|-------|
| `DISCORD_PUBLIC_KEY` | Production public key | From Discord Dev Portal |
| `DISCORD_BOT_TOKEN` | Production bot token | From Discord Dev Portal |
| `SPREADSHEET_ID` | Production spreadsheet ID | New ID dari step di atas |
| `BINANCE_API_KEY` | Production API key | Jika ada |
| `BINANCE_API_SECRET` | Production secret | Jika ada |
| `OPENROUTER_API_KEY` | Production API key | Jika ada |
| `LOG_LEVEL` | `INFO` | Change dari DEBUG jika were testing |

### Backup Script Properties

Sebelum update ke production, **backup current Script Properties**:

1. Buka Project Settings → Script properties
2. Screenshot atau copas semua key-value pairs
3. Simpan di safe place (encrypted password manager, private doc, dll)
4. Jika perlu rollback: cukup paste ulang ke Script Properties

---

## Deployment Steps

### Step 1: Final Code Review & Testing

```javascript
// Di Apps Script console, run:
runAllE2ETests();
```

Pastikan output: `7/7 tests PASSED ✅`

Jika ada failures:
- Fix code issues
- Re-run test
- Jangan proceed ke production sampai semua pass

### Step 2: Deploy Web App (Production Version)

1. Di Apps Script Editor, klik **"Deploy"** → **"New Deployment"**
2. Select type: **"Web app"**
3. Description: `Ba-banana Radars v1.0 - Production`
4. Execute as: Pilih account Anda
5. Who has access: **"Anyone"** (important untuk Discord webhook!)
6. Klik **"Deploy"**
7. Copy generated URL (akan jadi Interaction Endpoint URL baru)

### Step 3: Update Discord Interaction Endpoint

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) → production bot
2. Tab "General Information"
3. Scroll ke "Interactions Endpoint URL"
4. Paste URL dari Step 2
5. Klik "Save Changes"
6. Discord will verify → pastikan ada checkmark ✅

Jika gagal verify:
- Check `DISCORD_PUBLIC_KEY` di Script Properties
- Check `main.gs` → `verifyDiscordSignature()` function
- Check Execution Log untuk error detail

### Step 4: Manual Smoke Test

Di production Discord server, jalankan commands:

```
/radar discover          → Pastikan embed muncul dengan katalog
/radar status            → Pastikan tampil "No radars active" atau list existing
/radar setup             → Setup 1 radar (misal: Crypto, 1 hour interval)
/radar test              → Trigger sample embed ke channel
```

Verify setiap output:
- ✅ Embed muncul dengan emoji
- ✅ Tidak ada error message
- ✅ Response time reasonable (< 5 seconds)
- ✅ Entries added ke production Spreadsheet

### Step 5: Monitor First 24 Hours

Setelah deploy, monitor closely:

1. **Check Execution Log** setiap 1 jam:
   - Di Apps Script → ⌛ icon
   - Cek recent invocations
   - Look for errors atau timeout

2. **Check RadarLogs Sheet** setiap 2 jam:
   - Lihat apakah radar run on schedule
   - Lihat status_emoji (✅ OK atau 🔴 ERROR)
   - Check elapsed_ms (target < 5000ms)

3. **Check Discord Channels**:
   - Verify embeds dikirim ke channel correct
   - Verify no duplicate messages
   - Verify emoji rendering correct

---

## Post-Deployment Verification

### ✅ System Health Check

```javascript
// Run ini di Apps Script console untuk health check:
function healthCheck() {
  var status = {
    timestamp: new Date().toISOString(),
    spreadsheet: 'CHECKING',
    triggers: 'CHECKING',
    config: 'CHECKING'
  };
  
  try {
    // Check spreadsheet
    var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
    var sheets = ['RadarConfig', 'RadarLogs', 'ChannelCache'];
    sheets.forEach(function(name) {
      if (!ss.getSheetByName(name)) throw new Error('Sheet ' + name + ' not found');
    });
    status.spreadsheet = 'OK ✅';
  } catch(e) {
    status.spreadsheet = 'ERROR ❌: ' + e.message;
  }
  
  try {
    // Check triggers
    var triggers = ScriptApp.getProjectTriggers();
    status.triggers = 'OK ✅ (' + triggers.length + ' triggers)';
  } catch(e) {
    status.triggers = 'ERROR ❌: ' + e.message;
  }
  
  try {
    // Check config
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('DISCORD_PUBLIC_KEY')) throw new Error('DISCORD_PUBLIC_KEY missing');
    if (!props.getProperty('DISCORD_BOT_TOKEN')) throw new Error('DISCORD_BOT_TOKEN missing');
    if (!props.getProperty('SPREADSHEET_ID')) throw new Error('SPREADSHEET_ID missing');
    status.config = 'OK ✅';
  } catch(e) {
    status.config = 'ERROR ❌: ' + e.message;
  }
  
  Logger.log(JSON.stringify(status, null, 2));
  return status;
}

// Run:
healthCheck();
```

Expected output:
```json
{
  "timestamp": "2025-01-24T08:00:00.000Z",
  "spreadsheet": "OK ✅",
  "triggers": "OK ✅ (5 triggers)",
  "config": "OK ✅"
}
```

### ✅ Validate All Radars Running

Setelah 24 jam, check RadarLogs:

```
Harus ada minimal:
- 24 entries untuk Crypto Radar (jika interval 1h)
- 24 entries untuk Gtrends Radar (jika interval 1h daily)
- Semua dengan status_emoji = ✅
- elapsed_ms mostly < 3000ms
```

---

## Monitoring & Maintenance

### Daily Monitoring Checklist

Jalankan setiap hari (recommend: pagi hari sebelum peak hours):

```
☑️ Check Execution Log → no errors
☑️ Check RadarLogs sheet → latest runs OK ✅
☑️ Check Discord channels → embeds received
☑️ Check AppScript triggers → all active ✅
☑️ Check Script Properties → all keys present
```

### Weekly Monitoring

1. **Review Spreadsheet Size**:
   - RadarLogs mungkin grow besar
   - Archive old logs jika rows > 10,000 (performance impact)
   
2. **Review Error Rates**:
   - Hitung % error entries di RadarLogs
   - Target: < 5% error rate
   - Investigate jika > 10%

3. **Performance Review**:
   - Average elapsed_ms per radar
   - Target: < 2000ms
   - If > 3000ms: optimize atau scale

### Monthly Maintenance

1. **Backup Data**:
   ```
   - Download RadarLogs as CSV (archive)
   - Download RadarConfig as backup
   - Store di cloud storage (Google Drive, AWS S3, etc)
   ```

2. **Dependency Update Check**:
   - Check Binance API changelog
   - Check Discord API changelog
   - Check Google Apps Script runtime updates

3. **Disk Quota Check**:
   - Google Sheets unlimited storage tapi dapat hit limits
   - Monitor spreadsheet size
   - Archive atau delete old RadarLogs entries jika perlu

### Monitoring Dashboard (Optional)

Setup Google Data Studio untuk visual monitoring:

1. Connect Google Sheets (RadarLogs) ke Data Studio
2. Create charts:
   - Daily run count
   - Error rate % over time
   - Average execution time trend
   - Service distribution (Crypto vs Gtrends)
3. Share dashboard ke team
4. Set up alerts via Data Studio notifications

---

## Rollback Procedure

### Scenario 1: Critical Bug in Production

**Jika terjadi bug yang break system**:

1. **Immediate**: Pause semua radar:
   ```javascript
   // Di Apps Script console:
   function pauseAllRadars() {
     var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
     var sheet = ss.getSheetByName('RadarConfig');
     var range = sheet.getRange('F2:F' + sheet.getLastRow()); // F = status column
     range.setValue('🟡'); // Set semua status jadi paused
     Logger.log('All radars paused');
   }
   pauseAllRadars();
   ```

2. **Short-term**: Revert code ke last known good version:
   - Di Apps Script: undo changes (Ctrl+Z) atau restore dari version history
   - Atau: create new deployment dari backup script
   - Update Interaction Endpoint URL ke deployment lama

3. **Investigation**: Debug issue:
   - Check Execution Log
   - Check RadarLogs untuk error entries
   - Identify root cause
   - Fix bug di code

4. **Verification**: Re-test:
   - Run E2E test suite
   - Manual smoke test di test server
   - Verify fix works

5. **Re-deploy**: Deploy fixed version:
   - New deployment
   - Update Discord Interaction Endpoint
   - Resume radars: set status back to 🟢

### Scenario 2: Spreadsheet Corruption

**Jika Spreadsheet accidentally deleted/corrupted**:

1. **Immediate**: Create new production spreadsheet dari backup:
   ```
   - Buat spreadsheet baru dengan same sheets & headers
   - Restore data dari last backup (download CSV kemarin)
   - Set SPREADSHEET_ID ke new ID di Script Properties
   ```

2. **Verify**: Jalankan health check
   ```javascript
   healthCheck(); // Di console
   ```

3. **Resume**: Unpause radars & test

### Scenario 3: Discord Bot Token Compromised

**Jika token bocor/leak**:

1. **Immediate**: Regenerate token:
   - Discord Dev Portal → Bot → "Regenerate"
   - Copy new token

2. **Update**: Set DISCORD_BOT_TOKEN di Script Properties:
   - Paste new token
   - Save

3. **Verify**: Test command di Discord:
   ```
   /radar status  → pastikan masih responsive
   ```

4. **Audit**: Check token usage history jika possible

---

## Troubleshooting Production

### Issue 1: Radar tidak jalan on-schedule

**Symptoms**: Entries tidak ada di RadarLogs pada waktu expected

**Diagnosis**:
1. Check Execution Log → cari trigger execution
2. Check RadarConfig sheet → status jadi 🟡 atau 🔴?
3. Check timezone di Apps Script settings → correct timezone?

**Fix**:
```javascript
// Check triggers
function debugTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('Total triggers: ' + triggers.length);
  triggers.forEach(function(t) {
    Logger.log('Handler: ' + t.getHandlerFunction() + ', Type: ' + t.getTriggerSource());
  });
}

// Recreate triggers if missing
function recreateSchedule() {
  var props = PropertiesService.getScriptProperties();
  removeTriggersByHandler('runActiveRadars');
  ScriptApp.newTrigger('runActiveRadars')
    .timeBased()
    .everyHours(1) // sesuaikan dengan desired interval
    .create();
  Logger.log('Schedule recreated');
}

// Run di console:
debugTriggers();
recreateSchedule();
```

### Issue 2: Embeds tidak muncul di Discord channel

**Symptoms**: Radar run (entry ada di RadarLogs) tapi no embeds di Discord

**Diagnosis**:
1. Check RadarLogs → status_emoji = ✅?
2. Check Discord channel permissions → bot punya "Send Messages"?
3. Check channel_id di RadarConfig → correct channel?

**Fix**:
1. Verify bot permissions:
   - Discord: Settings → Roles → Bot role → Permissions
   - Atau per-channel: Right-click channel → Edit → Permissions

2. Verify channel_id di RadarConfig:
   ```
   Right-click Discord channel → "Copy Channel ID"
   Paste ke RadarConfig sheet column C
   ```

3. Manual test:
   ```javascript
   // Di console, run:
   var config = {
     channel_id: '123456789',
     mode: 'embed'
   };
   testRadarManually('crypto', config);
   ```

### Issue 3: API Rate Limit Errors

**Symptoms**: RadarLogs status_emoji = ⚠️ atau 🔴, error_msg = "Rate limit"

**Diagnosis**:
- Binance API rate limit: 1200 requests / minute
- Google Trends: dapat rate limit jika request terlalu frequent
- Discord API: 5 requests / 5 seconds per webhook

**Fix**:
1. Reduce frequency di RadarConfig:
   - Change interval dari `10m` ke `30m` atau `1h`

2. Add retry logic (sudah ada di code, tapi bisa increase retry count):
   ```javascript
   // Di config.gs, adjust:
   RETRY_COUNT: 3 // increase dari 2
   RETRY_BASE_MS: 500 // increase backoff
   ```

3. Stagger radar runs:
   - Jika multiple radars, jalankan di waktu berbeda
   - Contoh: Crypto @ 06:00, Gtrends @ 06:10

### Issue 4: AI Summary tidak generate

**Symptoms**: Radar berjalan tapi summary kosong atau error

**Diagnosis**:
1. Check Script Properties → `OPENROUTER_API_KEY` ada?
2. Check OpenRouter account → quota available?
3. Check error di RadarLogs → error_msg?

**Fix**:
1. Verify API key valid:
   ```javascript
   // Test OpenRouter connection
   function testOpenRouter() {
     var key = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
     if (!key) {
       Logger.log('API key not set');
       return;
     }
     var res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/auth/key', {
       headers: { 'Authorization': 'Bearer ' + key },
       muteHttpExceptions: true
     });
     Logger.log('Status: ' + res.getResponseCode());
     Logger.log('Response: ' + res.getContentText());
   }
   testOpenRouter();
   ```

2. Jika key valid, check quota di OpenRouter dashboard

3. Fallback: Disable AI summary untuk sementara:
   - Set radar mode ke `embed` (bukan `ai_summary`)
   - Re-test

---

## Incident Response Plan

### Severity Levels

| Level | Definition | Response Time |
|-------|-----------|----------------|
| 🟢 Low | Minor issue, system functional | 24 hours |
| 🟡 Medium | Partial outage, some radars down | 2-4 hours |
| 🔴 High | Complete outage, no embeds sent | 30 minutes |
| 🚨 Critical | Production system down, users affected | Immediate |

### Response Procedure

1. **Alert**: Detect issue via monitoring
2. **Assess**: Determine severity level
3. **Communicate**: Notify team / users (jika applicable)
4. **Mitigate**: Pause problematic radars / reduce scope
5. **Investigate**: Root cause analysis
6. **Fix**: Implement solution
7. **Verify**: Re-test thoroughly
8. **Resolve**: Resume operations
9. **Post-Mortem**: Document lessons learned

### Escalation Path

```
Issue Detected
    ↓
Automated Alert (Execution Log, RadarLogs)
    ↓
Manual Check (daily monitoring checklist)
    ↓
Severity Assessment
    ↓
If 🟢 Low: Document & schedule fix
If 🟡 Medium: Immediate investigation & fix
If 🔴 High or 🚨: Immediate incident response
```

---

## Logging & Auditing

### View Audit Log

Semua activity logged ke RadarLogs sheet:

```
timestamp      | service | guild_id | status_emoji | elapsed_ms | error_msg
2025-01-24T... | crypto  | 123456   | ✅          | 1200       | (none)
2025-01-24T... | gtrends | 123456   | ✅          | 1800       | (none)
```

### Export Logs for Analysis

```javascript
function exportLogsForAnalysis(days = 30) {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  var sheet = ss.getSheetByName('RadarLogs');
  var data = sheet.getDataRange().getValues();
  
  // Filter last N days
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  var filtered = data.filter(function(row) {
    var ts = new Date(row[0]); // column A = timestamp
    return ts > cutoff;
  });
  
  // Create new sheet untuk export
  var exportSheet = ss.insertSheet('Export_' + new Date().getTime());
  exportSheet.getRange(1, 1, filtered.length, filtered[0].length).setValues(filtered);
  
  Logger.log('Exported ' + filtered.length + ' rows');
  return exportSheet.getName();
}

// Run & download:
exportLogsForAnalysis(7); // last 7 days
```

---

## Performance Optimization

### If System Slow

1. **Check Spreadsheet Size**:
   - RadarLogs bisa grow large
   - Archive old entries (> 1 month)

2. **Optimize Radar Frequency**:
   - Reduce dari 10m ke 30m intervals
   - Group multiple radars ke same interval

3. **Enable Caching** (optional):
   - Cache last price untuk Crypto Radar
   - Skip fetch jika cache fresh

---

## Success Criteria

Sistem dikatakan **production-ready** jika:

- ✅ All E2E tests PASSED
- ✅ Manual smoke test OK di production
- ✅ First 24-hour monitoring clean (< 5% error rate)
- ✅ Performance metrics acceptable (< 3000ms avg)
- ✅ Rollback plan documented & tested
- ✅ Team trained & on-call ready
- ✅ Monitoring dashboard live
- ✅ Incident response plan in place

---

## Handoff Checklist

Sebelum project go-live sepenuhnya:

- [ ] All documentation reviewed by team
- [ ] Access granted ke production systems
- [ ] Runbook printed / bookmarked
- [ ] Escalation contacts updated
- [ ] On-call schedule finalized
- [ ] Budget/costs approved
- [ ] Team trained & sign-off

---

**Versi**: 1.0  
**Last Updated**: 2025-01-24

Safe deployment! 🚀✅
```

Sekarang saya akan membuat file `.gitignore`: