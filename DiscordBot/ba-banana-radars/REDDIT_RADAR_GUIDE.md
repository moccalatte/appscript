# 🔥 Reddit Radar Guide - Ba-ba-banana Radars

Panduan lengkap untuk setup dan menggunakan Reddit Radar dengan support custom subreddit dan top/hot posts selection.

---

## 📋 Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Setup Reddit Radar](#setup-reddit-radar)
3. [Custom Subreddit Input](#custom-subreddit-input)
4. [Top vs Hot Posts](#top-vs-hot-posts)
5. [Commands & Examples](#commands--examples)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Fitur Utama

### ✅ Reddit Radar Features

- 🔥 **Monitor Subreddit Trending**: Track top/hot posts dari subreddit apapun
- 🇮🇩 **Default Subreddit**: Indonesia, tech, news, cryptocurrency, startups
- 🎛️ **Flexible Sorting**: Pilih antara TOP posts (time-filtered) atau HOT posts (trending now)
- 🧑‍💻 **Custom Input Support**:
  - Format nama: `indonesia`
  - Format r/: `r/indonesia`
  - Format link: `https://reddit.com/r/indonesia`
  - Mixed case: `R/Indonesia` → auto-convert ke `indonesia`
- 📊 **Rich Metrics**: Score, comments, awards per post
- 🌐 **Multiple Data Sources**: Direct Reddit API, Pushshift Archive, sample fallback
- 📱 **Responsive Display**: Embed dengan karma indicators & award emojis

---

## 🚀 Setup Reddit Radar

### Step 1: Setup di Discord

Di Discord test server, gunakan:

```
/radar setup
```

Pilih:
- **Service**: 🔥 Reddit
- **Subreddit**: (opsional) Indonesia (atau custom di step nanti)
- **Sort By**: hot atau top
- **Interval**: 3h (default), atau pilih lainnya
- **Mode**: Embed atau Plain text
- **Channel**: Pilih target channel

### Step 2: Setup dengan Custom Subreddit

Setelah `/radar setup`, Anda bisa:

1. **Saat setup pertama**: 
   - Pilih service Reddit
   - Ikuti wizard
   - System akan auto-fetch default subreddit

2. **Edit existing radar**:
   - `/radar manage`
   - Pilih radar Reddit yang ingin di-edit
   - Update subreddit field di Spreadsheet (manual edit)

### Step 3: Spreadsheet Configuration

Di Google Sheet `RadarConfig`, untuk Reddit Radar row:

| Column | Value | Contoh |
|--------|-------|--------|
| guild_id | Discord server ID | `123456789` |
| service | `reddit` | `reddit` |
| channel_id | Target channel ID | `987654321` |
| interval | Frequency | `3h`, `daily` |
| mode | Output format | `embed` atau `plain` |
| status | Aktif/pause | `🟢` atau `🟡` |
| last_run | Auto-update | `2025-01-24T08:00:00Z` |
| emoji_label | Custom label | `🔥 Reddit Indonesia Hot` |

**Additional config** (di spreadsheet, optional):
- `custom_subreddit`: Subreddit custom (misal: `indonesia`, `r/tech`, link)
- `sort_by`: `hot` atau `top`

---

## 🎯 Custom Subreddit Input

### Format Support

Reddit Radar support berbagai format input untuk fleksibilitas:

```javascript
// Semua ini akan parse ke "indonesia":
"indonesia"                           // Simple name
"r/indonesia"                         // With r/ prefix
"R/Indonesia"                         // Case-insensitive
"https://reddit.com/r/indonesia"      // Full URL
"https://www.reddit.com/r/indonesia/" // URL with www & trailing slash
```

### Parsing Rules

1. **Normalisasi**: Semua convert ke lowercase
2. **URL cleanup**: Remove `https://`, `www.`, trailing slash
3. **Prefix removal**: Remove `r/` jika ada
4. **Validation**: Hanya alfanumeric + underscore allowed
5. **Error handling**: Invalid format akan rejected dengan pesan jelas

### Valid Subreddit Names

```
indonesia           ✅
tech_news          ✅
r_india            ✅
Python             ✅ (case-insensitive)
r/wallstreetbets   ✅ (format suported)
```

### Invalid Subreddit Names

```
invalid-subreddit  ❌ (dash not allowed)
tech news          ❌ (space not allowed)
r.tech             ❌ (dot not allowed)
123 numbers only   ❌ (numbers at start)
```

---

## 🔥 Top vs Hot Posts

### HOT Posts

**Apa itu?**
- Trending posts RIGHT NOW di subreddit
- Algorithm-based ranking (Reddit's sorting)
- Updates frequently (real-time)

**Kapan gunakan?**
- Want trending NOW content
- Quick pulse of community
- Setup interval: hourly (1h) atau 3h

**Contoh setup:**
```
Service: 🔥 Reddit
Subreddit: indonesia
Sort By: hot
Interval: 1h
```

### TOP Posts

**Apa itu?**
- Best posts dalam time range tertentu
- Sorted by score (upvotes - downvotes)
- More curated & quality posts

**Kapan gunakan?**
- Want quality content
- Looking for "best of" posts
- Setup interval: daily atau 3h

**Contoh setup:**
```
Service: 🔥 Reddit
Subreddit: tech
Sort By: top
Interval: daily
Time Filter: day (best posts from today)
```

### Perbandingan

| Aspek | HOT | TOP |
|-------|-----|-----|
| **Real-time?** | ✅ Yes | ❌ No |
| **Trending?** | ✅ Yes | ❌ Curated |
| **Updates** | Frequently | Batch (daily) |
| **Best for** | Now | Quality |
| **Recommended interval** | 1h-3h | daily |

---

## 💬 Commands & Examples

### Basic Commands

#### 1. Setup Reddit Radar Baru

```
/radar setup
```

Pilih Reddit → Indonesia → hot → embed → channel → save

**Output**: Embed dengan top hot posts dari r/indonesia, update setiap 3 jam

#### 2. Manage Radar

```
/radar manage
```

Pilih Reddit radar → pause/delete/update schedule

#### 3. Cek Status

```
/radar status
```

Lihat semua active radars termasuk Reddit ones

#### 4. Test Reddit Radar

```
/radar test
```

Send sample Reddit embed ke current channel (rotate demo)

---

## 🧪 Testing

### Test via Discord

1. **Setup test radar**:
```
/radar setup → Reddit → indonesia → hot → embed → #test-channel
```

2. **Wait for execution**: Trigger runs automatically based on interval

3. **Manual test**:
```
/radar test
```

Lihat sample output dengan random radar (cycle through crypto/gtrends/reddit)

### Test via Apps Script Console

```javascript
// Test 1: Fetch hot posts dari subreddit
var postsResult = fetchRedditPosts({
  subreddit: 'indonesia',
  sortBy: 'hot'
});
console.log(postsResult);

// Test 2: Fetch top posts
var topResult = fetchRedditPosts({
  subreddit: 'tech',
  sortBy: 'top',
  timeFilter: 'day'
});
console.log(topResult);

// Test 3: Test custom subreddit parsing
var parsed = parseSubreddit('r/indonesia');
console.log(parsed); // Should output: "indonesia"

// Test 4: Full radar run
var radarResult = fetchRedditRadar({
  guild_id: 'test',
  subreddit: 'indonesia',
  sort_by: 'hot',
  mode: 'embed'
});
console.log(radarResult);

// Test 5: Run all Reddit tests
testRedditRadarFetch();
testSubredditParsing();
```

### E2E Test Suite

```javascript
// Run full test including Reddit
runAllE2ETests();
```

Expected output:
```
✅ Reddit: Subreddit fetch test PASSED
```

---

## 🛠️ Advanced Usage

### Custom Subreddit in Spreadsheet

Edit RadarConfig sheet, column dengan custom config:

1. Add column: `custom_subreddit`
2. Add column: `sort_by`

Contoh row:
```
| reddit | 123456 | 987654 | 1h | embed | 🟢 | ... | r/tech_news | top |
```

### Multiple Reddit Radars

Setup multiple dengan different subreddits:

```
Radar 1: r/indonesia - hot - 1h
Radar 2: r/tech - top - daily
Radar 3: r/cryptocurrency - hot - 3h
```

Setiap radar trigger independent, running on own schedule.

### Combining with AI Summary (Future)

```
Service: Reddit
Mode: ai_summary (if implemented)
Output: AI-generated summary dari trending posts
```

---

## 🐛 Troubleshooting

### Issue 1: "Invalid subreddit" error

**Symptoms**: Error message saat setup atau test

**Causes**:
- Typo di nama subreddit
- Menggunakan character tidak valid (dash, space, dll)
- Subreddit tidak exist di Reddit

**Solutions**:
```
❌ "tech-news"        → ✅ "tech_news"
❌ "r / indonesia"    → ✅ "indonesia"
❌ "coding 101"       → ✅ "coding101"
```

Verify di https://reddit.com/r/{subreddit}

### Issue 2: "No posts found" error

**Symptoms**: Radar jalan tapi tidak ada posts di output

**Causes**:
- Subreddit private/restricted
- Reddit API blocked (rate limit)
- Network timeout

**Solutions**:
1. Check subreddit public di Reddit.com
2. Wait few minutes (API rate limit recovery)
3. Try different sort (hot vs top)
4. Check System logs: `/radar status` → check logs

### Issue 3: Subreddit parsing error

**Symptoms**: Custom subreddit tidak recognized

**Valid formats**:
```
✅ "indonesia"
✅ "r/indonesia"
✅ "R/Indonesia"
✅ "https://reddit.com/r/indonesia"
❌ "reddit.com/r/indonesia" (missing https://)
❌ "/r/indonesia" (partial URL)
```

### Issue 4: Posts tidak update

**Symptoms**: Sama posts terus, tidak ada update

**Causes**:
- Radar paused (status 🟡)
- Interval terlalu lama
- No new posts di subreddit

**Solutions**:
1. Check radar status: `/radar status` → should be 🟢
2. Reduce interval: 3h → 1h
3. Try different subreddit
4. Check last_run time di RadarLogs

### Issue 5: Wrong sort order

**Symptoms**: Setup untuk "top" tapi hasilnya "hot"

**Causes**:
- Config tidak saved correctly
- Fallback ke default (hot)

**Solutions**:
1. `/radar manage` → delete & recreate
2. Verify sort_by column di spreadsheet
3. Wait for next scheduled run
4. Manual test: `/radar test`

---

## 📚 Related Docs

- **README.md**: Main guide untuk semua radars
- **QUICK_START.md**: 15-minute setup
- **ARCHITECTURE.md**: System design & extensibility
- **TESTING.md**: Complete testing guide

---

## 🎓 Learning Resources

### Code Files

- `radar_reddit.gs` (~700 LOC) - Main Reddit Radar implementation
- `radar_registry.gs` - Service registry (includes reddit registration)
- `commands.gs` - Command handlers (updated for reddit)
- `scheduler.gs` - Scheduler (updated for reddit)
- `tests/test_main.gs` - E2E tests (includes reddit test)
- `tests/test_helpers.gs` - Unit tests (includes reddit-specific tests)

### Key Functions

```javascript
// Parse subreddit dari berbagai format
parseSubreddit(input)                          // String → String

// Fetch posts dari subreddit
fetchRedditPosts(config)                       // config.subreddit, sortBy

// Main radar orchestrator
fetchRedditRadar(config)                       // Full fetch + embed build

// Mode support (embed/plain)
fetchRedditRadarWithMode(config)               // Returns payload for Discord

// Helper functions
getTopRedditPosts(subreddit, limit)            // Top N posts
getHotRedditPosts(subreddit, limit)            // Hot N posts

// Test functions
testRedditRadarFetch()                         // E2E test
testSubredditParsing()                         // Parsing test
testRedditAPI()                                // API connectivity
testRedditRadarFullRun()                       // Full run test
```

---

## 💡 Pro Tips

### 1. Setup Multiple Subreddits

```
/radar setup → Reddit → indonesia → hot → 1h → #reddit-indo
/radar setup → Reddit → tech → top → daily → #reddit-tech
/radar setup → Reddit → news → hot → 3h → #reddit-news
```

### 2. Combine Different Sort Methods

- **Hot posts** untuk trending (update frequently)
- **Top posts** untuk quality content (update daily)

### 3. Time Management

```
Early morning (6 AM):   Top posts dari overnight
Afternoon (2 PM):       Hot posts dari morning
Evening (6 PM):         Hot posts dari afternoon
```

### 4. Community Engagement

Use Reddit Radar output untuk:
- Discussion starter di server
- Sharing trending topics
- Finding hidden gems
- Community curated content

### 5. Monitor Multiple Communities

```
Indonesian Tech:        r/indonesia + r/tech
Crypto Updates:         r/cryptocurrency + r/defi
News:                   r/news + r/worldnews
```

---

## 🔮 Future Enhancements

### Planned

- [ ] Search within subreddit (keyword filter)
- [ ] Multiple sort methods (new, rising, controversial)
- [ ] Award-based filtering (minimum awards)
- [ ] Comment count filtering
- [ ] Post age filtering
- [ ] Reddit user profile monitoring
- [ ] Subreddit stats (members, activity)

### Possible

- [ ] AI Summary untuk Reddit posts
- [ ] Cross-posting detection
- [ ] Sentiment analysis
- [ ] Comment thread summary
- [ ] Reddit saved posts sync

---

## 📞 Quick Reference

### Supported Input Formats

| Format | Example | Result |
|--------|---------|--------|
| Name | `indonesia` | ✅ |
| Prefix | `r/tech` | ✅ |
| URL | `https://reddit.com/r/news` | ✅ |
| Mixed | `R/Cryptocurrency` | ✅ |
| Invalid | `tech-news` | ❌ |

### Sort Options

| Sort | Behavior | Best For |
|------|----------|----------|
| hot | Trending now | Real-time updates |
| top | Best posts (time-filtered) | Quality content |
| new | Newest first | Fresh posts |
| rising | Growing posts | Early trends |

### Default Subreddits

```
indonesia              🇮🇩 Indonesian community
tech                   💻 Technology
news                   📰 News
cryptocurrency         ₿ Crypto
startups               🚀 Startups
```

---

## 🎉 Selesai!

Reddit Radar sudah siap digunakan! 

**Berikutnya**:
1. ✅ Setup radar pertama: `/radar setup`
2. ✅ Test dengan custom subreddit
3. ✅ Monitor trending posts
4. ✅ Share ke community

Tetap jaga energi 🍌!

---

**Version**: 1.0  
**Last Updated**: 2025-01-24  
**Status**: ✅ Production Ready
