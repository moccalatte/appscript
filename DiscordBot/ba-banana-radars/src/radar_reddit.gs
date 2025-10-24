// 🔥 radar_reddit.gs - Implementasi Reddit Radar untuk monitor trending posts
// Fungsi: Fetch top/hot posts dari subreddit, format embed dengan karma & award indicators
// Support custom subreddit + link, serta pilih top/hot posts
// Dependency: config.gs, radar_utils.gs, radar_registry.gs

/**
 * Reddit Radar configuration
 */
const REDDIT_CONFIG = {
  // Note: Reddit API requires authentication
  // Using public endpoint via Pushshift Archive (historical data) atau direct API
  REDDIT_API_URL: 'https://www.reddit.com',
  PUSHSHIFT_API_URL: 'https://api.pushshift.io/reddit',
  DEFAULT_SUBREDDITS: [
    { subreddit: 'indonesia', emoji: '🇮🇩', name: 'Indonesia' },
    { subreddit: 'tech', emoji: '💻', name: 'Tech' },
    { subreddit: 'news', emoji: '📰', name: 'News' },
    { subreddit: 'cryptocurrency', emoji: '₿', name: 'Crypto' },
    { subreddit: 'startups', emoji: '🚀', name: 'Startups' }
  ],
  TOP_N: 10,
  TIME_FILTER: 'day', // hour, day, week, month, year, all
  SORT_BY: 'hot', // hot, new, top, rising
  CACHE_DURATION_MS: 1800000, // 30 minutes
  REQUEST_TIMEOUT_MS: 15000,
  RETRY_COUNT: 2,
  RETRY_BACKOFF_MS: 500
};

/**
 * Sample Reddit data (fallback jika API tidak available)
 */
const SAMPLE_REDDIT_POSTS = [
  {
    title: 'Startup baru dapat funding Series A $10 juta',
    subreddit: 'startups',
    score: 2500,
    comments: 150,
    awards: 45,
    num_awards: 45,
    flair: '📊 Discussion',
    url: 'https://reddit.com/r/startups/post1',
    author: 'tech_founder'
  },
  {
    title: 'Indonesia tech scene growing rapidly',
    subreddit: 'indonesia',
    score: 1800,
    comments: 200,
    awards: 35,
    num_awards: 35,
    flair: '🎯 News',
    url: 'https://reddit.com/r/indonesia/post2',
    author: 'indo_tech'
  },
  {
    title: 'Bitcoin reaches new ATH this week',
    subreddit: 'cryptocurrency',
    score: 3200,
    comments: 500,
    awards: 120,
    num_awards: 120,
    flair: '📈 Price',
    url: 'https://reddit.com/r/cryptocurrency/post3',
    author: 'crypto_analyst'
  },
  {
    title: 'Best programming languages 2025',
    subreddit: 'tech',
    score: 1500,
    comments: 300,
    awards: 50,
    num_awards: 50,
    flair: '💡 Guide',
    url: 'https://reddit.com/r/tech/post4',
    author: 'dev_master'
  },
  {
    title: 'AI breakthrough in medical imaging',
    subreddit: 'tech',
    score: 2100,
    comments: 250,
    awards: 80,
    num_awards: 80,
    flair: '🤖 AI',
    url: 'https://reddit.com/r/tech/post5',
    author: 'ai_researcher'
  },
  {
    title: 'Indonesian startup founder tips',
    subreddit: 'indonesia',
    score: 1200,
    comments: 180,
    awards: 40,
    num_awards: 40,
    flair: '💼 Business',
    url: 'https://reddit.com/r/indonesia/post6',
    author: 'biz_mentor'
  },
  {
    title: 'Web3 integration in modern business',
    subreddit: 'tech',
    score: 1600,
    comments: 220,
    awards: 35,
    num_awards: 35,
    flair: '⛓️ Web3',
    url: 'https://reddit.com/r/tech/post7',
    author: 'web3_dev'
  },
  {
    title: 'News: Tech company IPO announced',
    subreddit: 'news',
    score: 900,
    comments: 120,
    awards: 20,
    num_awards: 20,
    flair: '📢 Breaking',
    url: 'https://reddit.com/r/news/post8',
    author: 'news_junkie'
  },
  {
    title: 'React vs Vue performance comparison',
    subreddit: 'tech',
    score: 1100,
    comments: 280,
    awards: 30,
    num_awards: 30,
    flair: '⚙️ Dev',
    url: 'https://reddit.com/r/tech/post9',
    author: 'frontend_dev'
  },
  {
    title: 'Ethereum update improves scalability',
    subreddit: 'cryptocurrency',
    score: 2800,
    comments: 450,
    awards: 100,
    num_awards: 100,
    flair: '🔧 Technical',
    url: 'https://reddit.com/r/cryptocurrency/post10',
    author: 'eth_dev'
  }
];

/**
 * Parse subreddit dari input (support nama atau link)
 * @param {string} input - Subreddit name atau link (misal: "indonesia" atau "r/indonesia" atau "https://reddit.com/r/indonesia")
 * @returns {string} Subreddit name (atau null jika invalid)
 */
function parseSubreddit(input) {
  if (!input) return null;

  input = String(input).trim().toLowerCase();

  // Remove URL protocol jika ada
  input = input.replace(/^https?:\/\/(www\.)?reddit\.com\//i, '');

  // Remove r/ prefix jika ada
  input = input.replace(/^r\//i, '');

  // Remove trailing slash
  input = input.replace(/\/$/, '');

  // Validate: hanya alphanumeric dan underscore
  if (!/^[a-z0-9_]+$/.test(input)) {
    return null;
  }

  return input;
}

/**
 * Get time range dalam seconds berdasarkan filter
 * @param {string} timeFilter - Time filter (hour, day, week, month, year, all)
 * @returns {number} Seconds
 */
function getTimeRangeSeconds(timeFilter) {
  var ranges = {
    'hour': 3600,
    'day': 86400,
    'week': 604800,
    'month': 2592000,
    'year': 31536000,
    'all': 315360000
  };

  return ranges[timeFilter] || ranges['day'];
}

/**
 * Fetch Reddit trending posts dari subreddit
 * Support top/hot sorting dengan custom subreddit input
 *
 * @param {Object} config - Configuration object
 *   - subreddit: subreddit name (bisa nama atau link)
 *   - sortBy: 'top' atau 'hot' (default: 'hot')
 *   - timeFilter: 'hour', 'day', 'week', 'month', 'year', 'all' (default: 'day')
 * @returns {Object} { ok, posts, subreddit, sortBy, error }
 */
function fetchRedditPosts(config) {
  config = config || {};

  var subredditInput = config.subreddit || 'indonesia';
  var sortBy = config.sortBy || 'hot';
  var timeFilter = config.timeFilter || 'day';

  logDebug('📍 Fetching Reddit posts: subreddit=' + subredditInput + ', sort=' + sortBy);

  try {
    // Parse subreddit input (support nama atau link)
    var subreddit = parseSubreddit(subredditInput);
    if (!subreddit) {
      return {
        ok: false,
        error: 'Invalid subreddit: ' + subredditInput + '. Format: "indonesia" atau "r/indonesia" atau link'
      };
    }

    logDebug('✅ Parsed subreddit: r/' + subreddit);

    // Validate sortBy
    var validSorts = ['hot', 'new', 'top', 'rising'];
    if (validSorts.indexOf(sortBy) === -1) {
      sortBy = 'hot'; // Default ke hot jika invalid
      logWarn('⚠️ Invalid sort, defaulting to hot');
    }

    // Attempt 1: Try direct Reddit API
    var result = fetchFromRedditDirect(subreddit, sortBy, timeFilter);
    if (result.ok) {
      return {
        ok: true,
        posts: result.posts,
        subreddit: subreddit,
        sortBy: sortBy,
        timeFilter: timeFilter,
        source: 'reddit_api'
      };
    }

    // Attempt 2: Try Pushshift API (historical data)
    result = fetchFromPushshift(subreddit, timeFilter);
    if (result.ok) {
      return {
        ok: true,
        posts: result.posts,
        subreddit: subreddit,
        sortBy: 'top',
        timeFilter: timeFilter,
        source: 'pushshift'
      };
    }

    // Fallback: Use sample data
    logWarn('⚠️ Using sample Reddit data (APIs not available)');

    var posts = SAMPLE_REDDIT_POSTS.filter(function(p) {
      return p.subreddit === subreddit;
    });

    if (posts.length === 0) {
      posts = SAMPLE_REDDIT_POSTS; // Semua jika subreddit tidak match
    }

    return {
      ok: true,
      posts: posts.slice(0, REDDIT_CONFIG.TOP_N),
      subreddit: subreddit,
      sortBy: sortBy,
      timeFilter: timeFilter,
      source: 'sample'
    };

  } catch (e) {
    logError('❌ Error fetching Reddit posts: ' + e.message);
    return {
      ok: false,
      error: e.message
    };
  }
}

/**
 * Fetch dari Reddit API langsung dengan support top/hot
 * @param {string} subreddit - Subreddit name
 * @param {string} sortBy - Sort method (hot, top, new, rising)
 * @param {string} timeFilter - Time filter untuk top posts
 * @returns {Object} { ok, posts, error }
 */
function fetchFromRedditDirect(subreddit, sortBy, timeFilter) {
  try {
    // Top posts biasanya lebih bagus dengan time filter
    var sort = sortBy === 'top' ? 'top' : sortBy;
    var timeParam = (sort === 'top') ? ('t=' + encodeURIComponent(timeFilter) + '&') : '';

    var url = REDDIT_CONFIG.REDDIT_API_URL + '/r/' + encodeURIComponent(subreddit) +
      '/' + sort + '.json?' +
      timeParam +
      'limit=' + REDDIT_CONFIG.TOP_N;

    logDebug('🌐 Reddit API URL: ' + url);

    var result = fetchWithRetry(url, {
      retries: REDDIT_CONFIG.RETRY_COUNT,
      backoffMs: REDDIT_CONFIG.RETRY_BACKOFF_MS,
      headers: { 'User-Agent': 'Ba-banana-Radars/1.0 (+https://github.com)' }
    });

    if (!result.ok) {
      logDebug('❌ Reddit API error: ' + result.code);
      return { ok: false, error: 'Reddit API failed: ' + result.code };
    }

    var data = result.data;
    if (!data.data || !data.data.children) {
      return { ok: false, error: 'Invalid Reddit response structure' };
    }

    var posts = data.data.children
      .map(function(child) {
        var post = child.data;
        return {
          title: post.title,
          subreddit: post.subreddit,
          score: post.score || 0,
          comments: post.num_comments || 0,
          awards: post.all_awardings ? post.all_awardings.length : (post.num_awards || 0),
          url: 'https://reddit.com' + post.permalink,
          created_at: new Date(post.created_utc * 1000).toISOString(),
          author: post.author,
          flair: post.link_flair_text || ''
        };
      })
      .filter(function(p) { return p.title; });

    logDebug('✅ Fetched ' + posts.length + ' posts from Reddit API');

    return {
      ok: true,
      posts: posts
    };

  } catch (e) {
    logDebug('⚠️ Reddit API fetch failed: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Fetch dari Pushshift API (alternative Reddit data source)
 * @param {string} subreddit - Subreddit name
 * @param {string} timeFilter - Time filter
 * @returns {Object} { ok, posts, error }
 */
function fetchFromPushshift(subreddit, timeFilter) {
  try {
    // Calculate time range
    var now = Math.floor(Date.now() / 1000);
    var timeRange = getTimeRangeSeconds(timeFilter);
    var after = now - timeRange;

    var url = REDDIT_CONFIG.PUSHSHIFT_API_URL + '/submission/search?' +
      'subreddit=' + encodeURIComponent(subreddit) + '&' +
      'after=' + after + '&' +
      'sort=score&' +
      'size=' + REDDIT_CONFIG.TOP_N + '&' +
      'metadata=true';

    logDebug('🌐 Pushshift API URL: ' + url);

    var result = fetchWithRetry(url, {
      retries: REDDIT_CONFIG.RETRY_COUNT,
      backoffMs: REDDIT_CONFIG.RETRY_BACKOFF_MS,
      headers: { 'User-Agent': 'Ba-banana-Radars/1.0' }
    });

    if (!result.ok) {
      return { ok: false, error: 'Pushshift API failed: ' + result.code };
    }

    var data = result.data;
    if (!data.data || !Array.isArray(data.data)) {
      return { ok: false, error: 'Invalid Pushshift response' };
    }

    var posts = data.data
      .map(function(post) {
        return {
          title: post.title,
          subreddit: post.subreddit,
          score: post.score || 0,
          comments: post.num_comments || 0,
          awards: post.num_awards || 0,
          url: 'https://reddit.com' + post.permalink,
          created_at: new Date(post.created_utc * 1000).toISOString(),
          author: post.author,
          flair: post.link_flair_text || ''
        };
      });

    logDebug('✅ Fetched ' + posts.length + ' posts from Pushshift');

    return {
      ok: true,
      posts: posts
    };

  } catch (e) {
    logDebug('⚠️ Pushshift fetch failed: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Build embed field untuk Reddit post
 * @param {number} rank - Ranking (1-10)
 * @param {Object} post - Post data
 * @returns {Object} Embed field
 */
function buildRedditPostField(rank, post) {
  var scoreEmoji = post.score > 2000 ? '🔥' : (post.score > 1000 ? '📈' : '👍');
  var awardsEmoji = post.awards > 50 ? '⭐⭐' : (post.awards > 10 ? '⭐' : '');

  var value = '**' + post.score + ' upvotes** ' + scoreEmoji + '  |  ' +
              '💬 ' + post.comments + ' comments\n' +
              '🏆 ' + post.awards + ' awards ' + awardsEmoji + '\n' +
              '🔗 [View Post](' + post.url + ')';

  if (post.author) {
    value += ' • by /u/' + post.author;
  }

  return buildField({
    name: rank + '. ' + post.title.substring(0, 50) + (post.title.length > 50 ? '...' : ''),
    value: value,
    inline: false
  });
}

/**
 * Main Reddit radar fetch function
 * @param {Object} config - Radar config dari Spreadsheet
 * @returns {Object} { ok, embed, embeds, error, elapsedMs }
 */
function fetchRedditRadar(config) {
  logInfo('🚀 Reddit Radar: Starting fetch');

  var startTime = Date.now();

  try {
    // Extract custom subreddit dari config jika ada
    var subredditInput = config.custom_subreddit || config.subreddit || 'indonesia';
    var sortBy = config.sort_by || 'hot';

    // Fetch posts
    var postsResult = fetchRedditPosts({
      subreddit: subredditInput,
      sortBy: sortBy,
      timeFilter: 'day'
    });

    if (!postsResult.ok) {
      throw new Error(postsResult.error || 'Failed to fetch posts');
    }

    var posts = postsResult.posts;

    if (posts.length === 0) {
      throw new Error('No posts found');
    }

    // Build fields
    var fields = [];
    posts.forEach(function(post, index) {
      fields.push(buildRedditPostField(index + 1, post));
    });

    // Determine color based on score
    var avgScore = calculateAverage(posts.map(function(p) { return p.score; }));
    var color = avgScore > 1500 ? 0xff4500 : (avgScore > 500 ? 0xffa500 : 0x818589);

    // Build embed
    var subredditDisplay = 'r/' + postsResult.subreddit;
    var sortEmoji = sortBy === 'hot' ? '🔥' : (sortBy === 'top' ? '🏆' : '📌');

    var embed = buildEmbed({
      title: sortEmoji + ' ' + subredditDisplay + ' ' + sortBy.toUpperCase() + ' Posts',
      description: 'Top trending posts dari subreddit ' + subredditDisplay + '\n' +
                   '📊 Source: ' + postsResult.source + ' • 🔄 Last updated: ' + formatTimestampWIB(new Date()),
      color: color,
      fields: fields,
      footer: 'Reddit Radar • Ba-banana 🍌',
      timestamp: new Date()
    });

    var elapsedMs = Date.now() - startTime;

    logInfo('✅ Reddit Radar fetch success (' + posts.length + ' posts, elapsed: ' + elapsedMs + 'ms)');

    return {
      ok: true,
      embed: embed,
      embeds: [embed],
      elapsedMs: elapsedMs,
      posts_count: posts.length,
      subreddit: postsResult.subreddit,
      sortBy: sortBy
    };

  } catch (e) {
    var elapsedMs = Date.now() - startTime;
    logError('❌ Reddit Radar error: ' + e.message);

    return {
      ok: false,
      embed: buildErrorEmbed('Reddit Radar Error', e.message),
      embeds: [buildErrorEmbed('Reddit Radar Error', e.message)],
      elapsedMs: elapsedMs,
      error: e.message
    };
  }
}

/**
 * Fetch Reddit radar dengan mode support
 * @param {Object} config - Radar config
 * @returns {Object} { ok, payload, elapsedMs, error }
 */
function fetchRedditRadarWithMode(config) {
  var radarResult = fetchRedditRadar(config);

  if (!radarResult.ok) {
    return {
      ok: false,
      payload: buildDiscordPayload({
        content: '❌ Reddit Radar Error',
        embeds: [radarResult.embed]
      }),
      error: radarResult.error
    };
  }

  var mode = config.mode || 'embed';
  var payload;

  if (mode === 'plain') {
    // Plain text mode
    var postsResult = fetchRedditPosts({
      subreddit: config.custom_subreddit || config.subreddit || 'indonesia',
      sortBy: config.sort_by || 'hot'
    });

    var lines = [
      '🔥 **REDDIT POSTS - r/' + postsResult.subreddit + '**',
      ''
    ];

    (postsResult.posts || []).forEach(function(post, i) {
      lines.push(
        (i + 1) + '. ' + post.title + '\n' +
        '   👍 ' + post.score + ' upvotes • 💬 ' + post.comments + ' comments • ' +
        '🏆 ' + post.awards + ' awards\n' +
        '   🔗 ' + post.url
      );
    });

    payload = buildDiscordPayload({
      content: lines.join('\n')
    });
  } else {
    // Default: embed mode
    payload = buildDiscordPayload({
      content: '📡 **Reddit Radar Update**',
      embeds: radarResult.embeds
    });
  }

  return {
    ok: true,
    payload: payload,
    elapsedMs: radarResult.elapsedMs
  };
}

/**
 * Test Reddit radar (untuk E2E test)
 * @returns {Object} Test result
 */
function testRedditRadarFetch() {
  logInfo('🧪 Testing Reddit Radar...');

  var startTime = Date.now();
  var result = {
    name: 'Reddit Radar Fetch',
    ok: false,
    posts_fetched: 0,
    errors: []
  };

  try {
    // Test fetch dari default subreddit
    var postsResult = fetchRedditPosts({
      subreddit: 'indonesia',
      sortBy: 'hot'
    });

    if (!postsResult.ok) {
      result.errors.push('Fetch failed: ' + postsResult.error);
      return result;
    }

    var posts = postsResult.posts || [];
    result.posts_fetched = posts.length;

    if (posts.length === 0) {
      result.errors.push('No posts returned');
      return result;
    }

    // Validate post structure
    var valid = 0;
    posts.forEach(function(post) {
      if (post.title && isFinite(post.score) && isFinite(post.comments)) {
        valid++;
      }
    });

    if (valid === posts.length) {
      result.ok = true;
      logInfo('✅ Reddit Radar test: ' + posts.length + ' posts fetched');
    } else {
      result.errors.push('Invalid post structure in ' + (posts.length - valid) + ' posts');
    }

  } catch (e) {
    result.errors.push(e.message);
    logError('❌ Reddit Radar test failed: ' + e.message);
  }

  result.elapsedMs = Date.now() - startTime;
  return result;
}

/**
 * Test subreddit parsing
 * @returns {Object} Test result
 */
function testSubredditParsing() {
  var testCases = [
    { input: 'indonesia', expected: 'indonesia' },
    { input: 'r/indonesia', expected: 'indonesia' },
    { input: 'R/Indonesia', expected: 'indonesia' },
    { input: 'https://reddit.com/r/indonesia', expected: 'indonesia' },
    { input: 'https://www.reddit.com/r/indonesia/', expected: 'indonesia' },
    { input: 'tech_news', expected: 'tech_news' },
    { input: 'r/tech_news', expected: 'tech_news' },
    { input: 'invalid-subreddit', expected: null },
    { input: '', expected: null }
  ];

  var result = {
    name: 'Subreddit Parsing',
    ok: true,
    errors: []
  };

  testCases.forEach(function(test) {
    var parsed = parseSubreddit(test.input);
    if (parsed !== test.expected) {
      result.ok = false;
      result.errors.push(
        'Parsing failed for "' + test.input + '": expected "' + test.expected +
        '", got "' + parsed + '"'
      );
    }
  });

  if (result.ok) {
    logInfo('✅ Subreddit parsing test: all cases passed');
  }

  return result;
}

/**
 * Get top posts dari subreddit
 * @param {string} subreddit - Subreddit name atau link
 * @param {number} limit - Limit jumlah posts
 * @returns {Array} Array of posts
 */
function getTopRedditPosts(subreddit, limit) {
  limit = limit || 5;

  var result = fetchRedditPosts({
    subreddit: subreddit,
    sortBy: 'top',
    timeFilter: 'day'
  });

  if (!result.ok) {
    return [];
  }

  return result.posts.slice(0, limit);
}

/**
 * Get hot posts dari subreddit
 * @param {string} subreddit - Subreddit name atau link
 * @param {number} limit - Limit jumlah posts
 * @returns {Array} Array of posts
 */
function getHotRedditPosts(subreddit, limit) {
  limit = limit || 5;

  var result = fetchRedditPosts({
    subreddit: subreddit,
    sortBy: 'hot',
    timeFilter: 'day'
  });

  if (!result.ok) {
    return [];
  }

  return result.posts.slice(0, limit);
}
