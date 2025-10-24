# 🏗️ ARCHITECTURE - Ba-ba-banana Radars

Dokumentasi lengkap arsitektur dan struktur proyek dalam Bahasa Indonesia.

## 📋 Table of Contents

1. [Overview Sistem](#overview-sistem)
2. [Struktur File](#struktur-file)
3. [Flow Diagram](#flow-diagram)
4. [Module Descriptions](#module-descriptions)
5. [Data Flow](#data-flow)
6. [Component Interactions](#component-interactions)
7. [Design Patterns](#design-patterns)
8. [Scalability & Performance](#scalability--performance)

---

## Overview Sistem

### Visi Arsitektur

Ba-banana Radars adalah sistem monitoring real-time berbasis **Google Apps Script (GAS)** yang menghubungkan berbagai sumber data (Crypto, Google Trends) ke Discord. Sistem dirancang dengan prinsip:

- **Modularity**: Setiap radar service adalah modul independent
- **Scalability**: Mudah tambah radar baru tanpa perubahan core logic
- **Reliability**: Error handling & retry logic untuk setiap service
- **Observability**: Comprehensive logging untuk audit & debugging

### Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Runtime** | Google Apps Script | No server to manage, auto-scaling |
| **Storage** | Google Sheets | Free, accessible, audit-friendly |
| **Messaging** | Discord API v10 | Webhook + Interaction endpoints |
| **External APIs** | Binance, Google Trends, OpenRouter | Via UrlFetchApp |
| **Scheduling** | Apps Script Triggers | Time-based automation |
| **Language** | JavaScript (ES5) | GAS compatibility |

---

## Struktur File

### Directory Layout

```
ba-banana-radars/
│
├── src/                           # 🔧 Source code (semua *.gs files)
│   ├── main.gs                    # 🍌 Entry point, doPost handler
│   ├── config.gs                  # 📑 Spreadsheet & Properties wrapper
│   ├── radar_utils.gs             # 🛠️ Utilities (embed, posting, validation)
│   ├── radar_registry.gs          # 🗃️ Service registry & catalog
│   ├── radar_crypto.gs            # 💰 Crypto radar (Binance fetcher)
│   ├── radar_gtrends.gs           # 📊 Google Trends radar
│   ├── ui_builder.gs              # 🎨 Discord component builders
│   ├── scheduler.gs               # ⏰ Trigger management
│   ├── commands.gs                # 📜 Slash command handlers
│   └── ai_summary.gs              # 🧠 AI summary (optional)
│
├── tests/                         # 🧪 Test suite
│   ├── test_main.gs               # E2E test coordinator
│   └── test_helpers.gs            # Unit test helpers
│
├── logs/                          # 📊 Runtime logs (local only)
│   └── .gitkeep
│
├── README.md                      # 📖 Main documentation
├── SETUP.md                       # 🔧 Detailed setup guide
├── TESTING.md                     # 🧪 Testing guide
├── DEPLOYMENT.md                  # 🚀 Production deployment
├── ARCHITECTURE.md                # 🏗️ This file
└── .gitignore                     # 🚫 Git ignore rules
```

### File Purposes (Quick Reference)

| File | Size | Purpose | Key Functions |
|------|------|---------|---------------|
| `main.gs` | ~380 LOC | Discord webhook entry point | `doPost()`, route interactions |
| `config.gs` | ~410 LOC | Spreadsheet & Properties wrapper | Read/write sheet, logging |
| `radar_utils.gs` | ~490 LOC | Shared utilities | Embed builders, Discord posting, validation |
| `radar_registry.gs` | ~350 LOC | Service registry | Register & manage radar services |
| `radar_crypto.gs` | ~360 LOC | Crypto Radar impl | Fetch Binance tickers, build embeds |
| `radar_gtrends.gs` | ~390 LOC | Google Trends impl | Fetch trends, parse data |
| `ui_builder.gs` | ~580 LOC | Discord UI components | Build buttons, menus, embeds |
| `scheduler.gs` | ~420 LOC | Trigger orchestration | Create/manage triggers, run radars |
| `commands.gs` | ~540 LOC | Slash command handlers | `/radar setup`, `/radar manage`, etc |
| `ai_summary.gs` | ~240 LOC | AI integration (optional) | OpenRouter API calls |
| `test_main.gs` | ~330 LOC | E2E test suite | `runAllE2ETests()` coordinator |
| `test_helpers.gs` | ~480 LOC | Unit test utilities | Individual component tests |

**Total: ~5,300 LOC**

---

## Flow Diagram

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Discord Server (Guild)                       │
│  User runs /radar command atau click button di Discord          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP POST (webhook)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Google Apps Script                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  main.gs (doPost)                                       │    │
│  │  1. Terima webhook POST dari Discord                   │    │
│  │  2. Verify signature (Ed25519)                          │    │
│  │  3. Parse interaction (command / button / select)       │    │
│  │  4. Route ke handler sesuai type                        │    │
│  └────────────┬────────────────────────────────────────────┘    │
│               │                                                   │
│       ┌───────┴────────┬───────────┬──────────────┐              │
│       │                │           │              │              │
│       ▼                ▼           ▼              ▼              │
│  ┌─────────┐   ┌─────────────┐ ┌──────────┐ ┌──────────┐       │
│  │Slash    │   │Button       │ │Select    │ │Modal     │       │
│  │Commands │   │Interaction  │ │Menu      │ │Submit    │       │
│  │(setup,  │   │(pause, del, │ │(service, │ │          │       │
│  │manage,  │   │schedule)    │ │interval, │ │          │       │
│  │status)  │   │             │ │mode)     │ │          │       │
│  └────┬────┘   └──────┬──────┘ └────┬─────┘ └──────────┘       │
│       │                │             │                           │
│       └────────────────┴─────────────┘                           │
│                        │                                          │
│                        ▼                                          │
│       ┌──────────────────────────────────────┐                   │
│       │ commands.gs (route & handle)         │                   │
│       │ - Build response embeds/components   │                   │
│       │ - Call radar services if needed      │                   │
│       └────────────┬─────────────────────────┘                   │
│                    │                                              │
│       ┌────────────┴─────────────────┐                           │
│       │                              │                           │
│       ▼                              ▼                           │
│  ┌──────────────────┐        ┌──────────────────┐               │
│  │radar_crypto.gs   │        │radar_gtrends.gs  │               │
│  │Fetch Binance API │        │Fetch Trends      │               │
│  │Build crypto      │        │Build trends      │               │
│  │embeds            │        │embeds            │               │
│  └────────┬─────────┘        └────────┬─────────┘               │
│           │                           │                         │
│           └───────────────┬───────────┘                         │
│                           │                                     │
│                           ▼                                     │
│       ┌──────────────────────────────────────┐                 │
│       │ ui_builder.gs + radar_utils.gs       │                 │
│       │ - Build Discord embeds/components    │                 │
│       │ - Format data with emoji & colors    │                 │
│       └────────────┬─────────────────────────┘                 │
│                    │                                            │
│                    ▼                                            │
│       ┌──────────────────────────────────────┐                 │
│       │ config.gs (Spreadsheet I/O)          │                 │
│       │ - Write interaction response         │                 │
│       │ - Log radar run to RadarLogs sheet   │                 │
│       │ - Update last_run timestamp          │                 │
│       └────────────┬─────────────────────────┘                 │
│                    │                                            │
│                    ▼                                            │
│       ┌──────────────────────────────────────┐                 │
│       │ radar_utils.gs                       │                 │
│       │ sendDiscordInteractionResponse()     │                 │
│       │ - POST response ke Discord API       │                 │
│       └────────────┬─────────────────────────┘                 │
│                    │                                            │
│                    │ HTTP 200 + JSON payload                   │
│                    ▼                                            │
│              ┌──────────────┐                                  │
│              │ Apps Script  │                                  │
│              │ Response OK  │                                  │
│              └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                    HTTP 200 response
                             │
                             ▼
                   ┌──────────────────┐
                   │ Discord Server   │
                   │ - Embed posted   │
                   │ - Component resp │
                   │ - Status update  │
                   └──────────────────┘
```

### Scheduler / Background Job Flow

```
┌──────────────────────────────────────────────────────┐
│ Apps Script Time-Based Trigger (every 1h / 3h / etc) │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ scheduler.gs                    │
    │ runActiveRadars()               │
    └────────────┬───────────────────┘
                 │
    ┌────────────┴──────────────────┐
    │                               │
    ▼                               ▼
┌──────────────────┐      ┌────────────────────┐
│ config.gs        │      │ For each radar:    │
│ getActive        │      │ - Check status 🟢  │
│ RadarConfigs()   │      │ - Is due? Check    │
│ = active radars  │      │   last_run time    │
└──────────────────┘      └─────────┬──────────┘
                                    │
                        ┌───────────┴────────────┐
                        │                        │
                        ▼                        ▼
                   ┌─────────────┐       ┌──────────────┐
                   │ radar_crypto│       │radar_gtrends │
                   │.gs runSingle│       │.gs runSingle │
                   │Radar()      │       │Radar()       │
                   └──────┬──────┘       └───────┬──────┘
                          │                      │
                          └──────────┬───────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │ config.gs                │
                        │ logRadarRun()            │
                        │ - Write to RadarLogs    │
                        │ - Record success/error  │
                        │ - Update last_run       │
                        └──────────────────────────┘
```

---

## Module Descriptions

### 1. **main.gs** 🍌 - Entry Point

**Responsibility**: Handle Discord webhook POST requests

**Key Functions**:
- `doPost(e)` - Main webhook handler, verify signature, route requests
- `handleSlashCommand(interaction)` - Process slash command
- `handleComponentInteraction(interaction)` - Process button/select menu
- `handleModalSubmit(interaction)` - Process form submission

**Dependencies**: config, radar_utils, commands, scheduler

**API Endpoints**:
- `POST /macros/d/{scriptId}/userweb` - Discord webhook
- `GET /macros/d/{scriptId}/userweb` - Health check

---

### 2. **config.gs** 📑 - Configuration & Storage

**Responsibility**: Wrapper untuk Spreadsheet & Script Properties

**Key Functions**:
- `getScriptProperty(key, default)` - Read property
- `getSheet(name)` - Get spreadsheet sheet
- `readSheetAsObjects(name)` - Read sheet as array of objects
- `appendRowToSheet(name, data)` - Add row
- `logRadarRun(entry)` - Write log entry
- `validateRequiredProperties()` - Check config valid

**Data Storage**:
- **RadarConfig Sheet**: Radar configurations (guild_id, service, interval, etc)
- **RadarLogs Sheet**: Execution logs (timestamp, status, error)
- **ChannelCache Sheet**: Discord channel cache (untuk quick lookup)
- **Script Properties**: Sensitive credentials (token, API keys)

---

### 3. **radar_utils.gs** 🛠️ - Shared Utilities

**Responsibility**: Common functions untuk formatting, Discord API, validation

**Key Functions**:
- `buildEmbed(options)` - Build Discord embed
- `buildButton(options)` - Build Discord button
- `buildDiscordPayload(options)` - Build complete payload
- `postToDiscordWebhook(url, payload)` - POST to webhook
- `sendDiscordInteractionResponse(token, payload)` - Send interaction response
- `verifyDiscordSignature(pk, sig, ts, body)` - Verify Ed25519
- `fetchWithRetry(url, options)` - HTTP fetch dengan retry logic
- `formatUSD(amount)`, `formatPercentage(percent)` - Formatting helpers

---

### 4. **radar_registry.gs** 🗃️ - Service Registry

**Responsibility**: Register & manage all available radar services

**Registry Structure**:
```javascript
RADAR_SERVICES = {
  'crypto': { name, emoji, description, modes, fetch_function, ... },
  'gtrends': { name, emoji, description, modes, fetch_function, ... }
  // Future: 'reddit', 'github', 'news', etc
}
```

**Key Functions**:
- `getRadarService(id)` - Get service by ID
- `getAllRadarServices()` - Get all services
- `validateRadarConfig(config)` - Validate radar setup
- `buildRadarCatalogEmbed()` - Build discover embed
- `buildIntervalOptions()` - Build interval dropdown
- `buildModeOptions(serviceId)` - Build mode dropdown untuk service

---

### 5. **radar_crypto.gs** 💰 - Crypto Radar

**Responsibility**: Fetch & format cryptocurrency data dari Binance

**Data Source**: Binance Spot Public API (ticker/24h endpoint)

**Key Functions**:
- `fetchBinanceTicker(symbol)` - Fetch single ticker
- `fetchCryptoTickers(symbols)` - Fetch multiple dengan pacing
- `fetchCryptoRadar(config)` - Main radar orchestrator
- `fetchCryptoRadarWithMode(config)` - Dengan mode support (embed/plain)
- `testCryptoRadarFetch()` - E2E test

**Supported Symbols**:
```
BTCUSDT, ETHUSDT, XRPUSDT, XLMUSDT, TONUSDT
```

**Output Modes**:
- `embed`: Discord rich embed dengan price & change %
- `plain`: Simple text format

---

### 6. **radar_gtrends.gs** 📊 - Google Trends Radar

**Responsibility**: Fetch & format trending search queries

**Data Source**: Google Trends (fallback: sample data, optional: SerpAPI)

**Key Functions**:
- `fetchGoogleTrends()` - Fetch trending queries
- `fetchTrendsFromSerpAPI(apiKey)` - Fetch dari SerpAPI (optional)
- `fetchGtrendsRadar(config)` - Main radar orchestrator
- `fetchGtrendsRadarWithMode(config)` - Dengan mode support
- `generateTrendsSummary(trends, mode)` - AI summary (optional)
- `testGtrendsRadarFetch()` - E2E test

**Output Modes**:
- `embed`: Discord rich embed dengan trending list
- `ai_summary`: AI-generated insights (jika OpenRouter available)
- `plain`: Simple text format

---

### 7. **ui_builder.gs** 🎨 - Discord Component Builder

**Responsibility**: Build Discord UI components (embeds, buttons, menus) dengan emoji

**Key Functions**:
- `buildServiceSelectMenu()` - Service picker dropdown
- `buildIntervalSelectMenu()` - Interval picker
- `buildModeSelectMenu(serviceId)` - Mode picker
- `buildChannelSelectMenu(channels)` - Channel picker
- `buildRadarStatusEmbed(configs)` - Status display embed
- `buildSetupConfirmEmbed(config)` - Setup confirmation
- `buildErrorResponseEmbed(title, msg)` - Error display
- `buildConfirmCancelButtons()` - Yes/No buttons

**Component Types**:
- **Embeds**: Rich message formatting dengan fields, color, emoji
- **Buttons**: Interactive buttons dengan emoji labels
- **Select Menus**: Dropdown for user selection
- **Action Rows**: Container untuk components

---

### 8. **scheduler.gs** ⏰ - Trigger Management

**Responsibility**: Manage time-based triggers & orchestrate radar runs

**Key Functions**:
- `runActiveRadars()` - Main scheduler: fetch active radars & run each
- `runSingleRadar(config)` - Execute single radar
- `createTriggerForInterval(interval)` - Create/update trigger
- `createDailyTriggerAt(hour, minute)` - Daily trigger at specific time
- `removeAllTriggers()` - Remove semua triggers
- `listActiveTriggers()` - List active triggers
- `pauseAllRadars()` - Pause semua (set status 🟡)
- `resumeAllRadars()` - Resume semua (set status 🟢)

**Interval Support**:
```
5m, 10m, 30m, 1h, 3h, daily
```

**Constraint**: Max 20 triggers per Apps Script user

---

### 9. **commands.gs** 📜 - Slash Command Handlers

**Responsibility**: Handle `/radar` slash commands & component interactions

**Commands**:
- `/radar setup` → Setup new radar (form dengan dropdowns)
- `/radar manage` → Manage active radars (list + buttons)
- `/radar status` → Show radar status (embed)
- `/radar discover` → Show catalog (embed + buttons)
- `/radar test` → Send test message (sample radar output)

**Component Handlers**:
- Button clicks: `handleSetupSave()`, `handleManagePause()`, `handleManageDelete()`
- Select menu: `handleServiceSelect()`, `handleIntervalSelect()`, `handleModeSelect()`
- Modal submit: `handleModalSubmit()`

---

### 10. **ai_summary.gs** 🧠 - AI Integration (Optional)

**Responsibility**: Generate AI summaries via OpenRouter API

**Requirement**: `OPENROUTER_API_KEY` di Script Properties

**Key Functions**:
- `isAISummaryAvailable()` - Check jika AI enabled
- `generateCryptoSummary(tickers, mode)` - Summary untuk crypto
- `generateTrendsSummary(trends, mode)` - Summary untuk trends
- `callOpenRouterAPI(prompt)` - Raw API call ke OpenRouter
- `testAISummary()` - E2E test

**API Model**: `gpt-3.5-turbo` (default, configurable)

---

### 11. **test_main.gs** 🧪 - E2E Test Suite

**Responsibility**: Coordinate comprehensive E2E testing

**Main Function**:
- `runAllE2ETests()` - Run all tests, return summary

**Coverage**:
1. Config read/write
2. Embed builder
3. Crypto radar fetch
4. Gtrends radar fetch
5. Scheduler triggers
6. Command routing
7. Main endpoint

**Output**:
- Logs ke Execution Log (real-time)
- Log entries ke RadarLogs sheet (persistent)

---

### 12. **test_helpers.gs** 🛠️ - Unit Test Helpers

**Responsibility**: Individual component testing utilities

**Test Functions**:
- `testSpreadsheetAccess()` - Verify spreadsheet & sheets
- `testBinanceAPI()` - Test crypto API connectivity
- `testGoogleTrendsAPI()` - Test trends API
- `testAISummaryAvailability()` - Check AI config
- `testRadarRegistryIntegrity()` - Validate registry
- `testValidationFunctions()` - Test validators
- `testLoggingSystem()` - Test log output
- `testUtilityFunctions()` - Test utility functions
- `benchmarkRadarServices()` - Performance benchmarks
- `testFullRadarRun()` - Integration test
- `runDiagnostic()` - Full diagnostic report

---

## Data Flow

### Configuration Data Flow

```
User runs /radar setup
    ↓
commands.handleRadarSetup()
    ↓
Build form (dropdowns, buttons)
    ↓
User selects: service, interval, mode, channel
    ↓
Button click: "Save & Activate"
    ↓
commands.handleSetupSave()
    ↓
config.appendRowToSheet(RadarConfig, [guild, service, channel, interval, mode, 🟢, ...])
    ↓
scheduler.setupRadarSchedule(config)
    ↓
Create time-based trigger untuk interval
    ↓
RadarConfig sheet updated ✅
Trigger created ✅
```

### Radar Execution Data Flow

```
Apps Script trigger fires (time-based)
    ↓
scheduler.runActiveRadars()
    ↓
config.getActiveRadarConfigs('🟢')
    ↓
For each active radar config:
  radar_crypto.fetchCryptoRadar(config)
    atau
  radar_gtrends.fetchGtrendsRadar(config)
    ↓
  External API call (Binance / Google Trends)
    ↓
  ui_builder.buildEmbed() + radar_utils formatting
    ↓
  radar_utils.postToDiscordWebhook()
    ↓
  config.logRadarRun({ status: '✅', elapsed_ms: 1500 })
```

### Error Handling Data Flow

```
Radar execution error (API timeout, invalid data, etc)
    ↓
Catch exception in runSingleRadar()
    ↓
config.logRadarRun({ status: '🔴', error_msg: '...' })
    ↓
radar_utils.buildErrorEmbed()
    ↓
Send error notification to Discord (optional webhook)
    ↓
RadarLogs sheet updated with error details
    ↓
System continues processing next radar
```

---

## Component Interactions

### Interaction Matrix

| Component | Depends On | Used By |
|-----------|-----------|---------|
| main.gs | config, radar_utils, commands | — (entry point) |
| config.gs | — | All modules |
| radar_utils.gs | config | All modules |
| radar_registry.gs | config, radar_utils | commands, scheduler, ui_builder |
| radar_crypto.gs | config, radar_utils, radar_registry | scheduler, commands |
| radar_gtrends.gs | config, radar_utils, ai_summary | scheduler, commands |
| ui_builder.gs | radar_utils, radar_registry | commands |
| scheduler.gs | config, radar_crypto, radar_gtrends | main, commands |
| commands.gs | config, radar_registry, ui_builder, radar_utils, scheduler | main |
| ai_summary.gs | config, radar_utils | radar_gtrends, commands |
| test_main.gs | All modules | — (testing only) |
| test_helpers.gs | All modules | test_main |

### Key Handoff Points

**main.gs → commands.gs**: Parse interaction, route command
**commands.gs → scheduler.gs**: Setup radar, create triggers
**scheduler.gs → radar_crypto/gtrends.gs**: Execute radar fetch
**radar_crypto/gtrends.gs → radar_utils.gs**: Post to Discord
**radar_utils.gs → config.gs**: Log execution result

---

## Design Patterns

### 1. **Registry Pattern** (radar_registry.gs)

Services registered dalam object map, diakses dinamically:

```javascript
RADAR_SERVICES = {
  'crypto': { fetch_function: 'fetchCryptoRadar', ... },
  'gtrends': { fetch_function: 'fetchGtrendsRadar', ... }
}
```

**Benefit**: Easy to add new radar types tanpa modifying core logic

### 2. **Wrapper Pattern** (config.gs)

Wrap Google Sheets API dalam functions yang easier to use:

```javascript
getSheet(name) → SpreadsheetApp.openById(...).getSheetByName(...)
readSheetAsObjects(name) → Array of objects dengan header keys
appendRowToSheet(name, data) → Append row directly
```

**Benefit**: Consistent API, error handling centralized, easy to refactor storage

### 3. **Builder Pattern** (ui_builder.gs, radar_utils.gs)

Build complex Discord objects step-by-step:

```javascript
buildEmbed({ title, description, color, fields })
buildButton({ label, custom_id, style })
buildActionRow(components)
buildDiscordPayload({ content, embeds, components })
```

**Benefit**: Readable, maintainable component construction

### 4. **Retry Strategy** (radar_utils.gs)

Fetch dengan exponential backoff:

```javascript
fetchWithRetry(url, { retries: 2, backoffMs: 300 })
// Attempt 1 → fail → sleep 300ms
// Attempt 2 → fail → sleep 600ms
// Attempt 3 → return error
```

**Benefit**: Resilient ke network hiccups & rate limits

### 5. **Error Aggregation** (scheduler.gs)

Process all radars, collect errors, log each:

```javascript
results = []
for each radar:
  try:
    results.push(runSingleRadar())
  catch e:
    log error + continue
return { ok: all_ok, results }
```

**Benefit**: One failure tidak break entire orchestration

### 6. **Validation-First** (radar_registry.gs)

Validate config sebelum execute:

```javascript
validateRadarConfig(config) → { valid, errors }
if (!valid) throw error
runSingleRadar(config)
```

**Benefit**: Catch config issues early, better error messages

---

## Scalability & Performance

### Horizontal Scaling

**Current Limits**:
- Max 20 triggers per Apps Script user (Discord limit)
- Max 6 requests/minute ke Discord API (rate limit)
- Spreadsheet performance: reasonable up to 100K rows (RadarLogs)

**Solutions**:
1. **Trigger Consolidation**: Group radars dengan same interval → 1 trigger
2. **Batching**: Process multiple radars dalam single execution
3. **Pagination**: Split large reports across multiple embeds
4. **Archiving**: Move old RadarLogs ke archive sheet/spreadsheet

### Vertical Optimization

**Performance Targets**:
- Crypto radar fetch: < 2000ms
- Gtrends radar fetch: < 2000ms
- Scheduler run: < 5000ms total
- Discord webhook post: < 500ms

**Optimizations**:
1. **Caching**: Cache channel list, radar config locally
2. **Pacing**: Spread API requests (sleep 100ms between tickers)
3. **Lazy Loading**: Only fetch data needed
4. **Compression**: Limit embed fields ke 25 (Discord limit)

### Monitoring Metrics

Tracked via RadarLogs sheet:
- `elapsed_ms`: Execution time
- `status_emoji`: Success/failure/warning
- `error_msg`: Error details
- Aggregates: % error rate, avg response time

---

## Future Extensibility

### Adding New Radar Service

1. Create `radar_newservice.gs`
2. Implement `fetchNewServiceRadar(config)` returning standard result format
3. Register di `radar_registry.gs`:
   ```javascript
   RADAR_SERVICES['newservice'] = {
     id: 'newservice',
     name: '🎯 New Service',
     fetch_function: 'fetchNewServiceRadar',
     ...
   }
   ```
4. Add tests di `test_helpers.gs`
5. No changes needed to main orchestration logic!

### Custom Output Modes

Add mode to service's `modes_supported`:
```javascript
modes_supported: ['embed', 'ai_summary', 'plain', 'custom_mode']
```

Update fetch function untuk handle new mode.

---

## Deployment Architecture

```
Production Flow:

GitHub Repo
    ↓
Copy *.gs files
    ↓
Google Apps Script Project
    ↓
Deploy Web App (v1.0)
    ↓
Set Interaction Endpoint URL di Discord Dev Portal
    ↓
Link Spreadsheet (RadarConfig, RadarLogs, ChannelCache)
    ↓
Set Script Properties (tokens, API keys)
    ↓
Test: /radar discover
    ↓
Create trigger: scheduler.createTriggerForInterval('1h')
    ↓
Setup radar via /radar setup
    ↓
Monitor via RadarLogs sheet
```

---

**Architecture Version**: 1.0  
**Last Updated**: 2025-01-24  
**Maintainer**: Ba-banana Team 🍌