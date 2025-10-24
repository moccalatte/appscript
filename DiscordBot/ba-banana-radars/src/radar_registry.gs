// 🗃️ radar_registry.gs - Registry untuk semua radar services
// Fungsi: Mendaftarkan semua radar services yang tersedia
// Dependency: config.gs, radar_utils.gs

/**
 * Registry of all available radar services
 * Format: { service_id: { name, emoji, description, fetch_function } }
 */
var RADAR_SERVICES = {
  'crypto': {
    id: 'crypto',
    name: '💰 Crypto',
    emoji: '💰',
    description: 'Monitor harga cryptocurrency real-time dari Binance',
    category: 'Finance',
    interval_default: '1h',
    modes_supported: ['embed', 'plain'],
    fetch_function: 'fetchCryptoRadar',
    icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Ethereum-icon-purple.svg/1200px-Ethereum-icon-purple.svg.png'
  },

  'gtrends': {
    id: 'gtrends',
    name: '📊 Google Trends',
    emoji: '📊',
    description: 'Top 10 trending queries di Google (Indonesia)',
    category: 'Trends',
    interval_default: 'daily',
    modes_supported: ['embed', 'ai_summary', 'plain'],
    fetch_function: 'fetchGtrendsRadar',
    icon_url: 'https://www.google.com/favicon.ico'
  },

  'reddit': {
    id: 'reddit',
    name: '🔥 Reddit',
    emoji: '🔥',
    description: 'Monitor trending posts dari subreddit pilihan (top/hot posts)',
    category: 'Social',
    interval_default: '3h',
    modes_supported: ['embed', 'plain'],
    fetch_function: 'fetchRedditRadar',
    icon_url: 'https://www.reddit.com/favicon.ico',
    custom_params: ['subreddit', 'sort_by']
  }

  // Future radars:
  // 'github': { ... },
  // 'news': { ... }
};
</parameter>
</invoke>

/**
 * Get radar service by ID
 * @param {string} serviceId - Service ID (misal: 'crypto', 'gtrends')
 * @returns {Object|null} Radar service object atau null
 */
function getRadarService(serviceId) {
  return RADAR_SERVICES[serviceId] || null;
}

/**
 * Get semua radar services
 * @returns {Object[]} Array of service objects
 */
function getAllRadarServices() {
  var services = [];
  for (var key in RADAR_SERVICES) {
    if (RADAR_SERVICES.hasOwnProperty(key)) {
      services.push(RADAR_SERVICES[key]);
    }
  }
  return services;
}

/**
 * Get radar services by category
 * @param {string} category - Category filter (misal: 'Finance', 'Trends')
 * @returns {Object[]} Array of service objects
 */
function getRadarServicesByCategory(category) {
  var services = [];
  for (var key in RADAR_SERVICES) {
    if (RADAR_SERVICES.hasOwnProperty(key)) {
      var svc = RADAR_SERVICES[key];
      if (svc.category === category) {
        services.push(svc);
      }
    }
  }
  return services;
}

/**
 * Validasi service ID
 * @param {string} serviceId - Service ID
 * @returns {boolean} True jika valid
 */
function isValidRadarService(serviceId) {
  return RADAR_SERVICES.hasOwnProperty(serviceId);
}

/**
 * Get supported modes untuk service tertentu
 * @param {string} serviceId - Service ID
 * @returns {string[]} Array of supported modes
 */
function getSupportedModes(serviceId) {
  var service = getRadarService(serviceId);
  return service ? service.modes_supported : [];
}

/**
 * Get default interval untuk service
 * @param {string} serviceId - Service ID
 * @returns {string} Default interval (misal: '1h', 'daily')
 */
function getDefaultInterval(serviceId) {
  var service = getRadarService(serviceId);
  return service ? service.interval_default : '1h';
}

/**
 * Build discovery catalog embed
 * Menampilkan semua available radar services
 * @returns {Object} Discord embed
 */
function buildRadarCatalogEmbed() {
  var services = getAllRadarServices();
  var fields = [];

  services.forEach(function(service) {
    fields.push(buildField({
      name: service.emoji + ' ' + service.name,
      value: service.description + '\n' +
             '**Modes**: ' + service.modes_supported.join(', ') + '\n' +
             '**Default Interval**: ' + service.interval_default,
      inline: false
    }));
  });

  return buildEmbed({
    title: '📡 Radar Catalog - Pilih radar untuk dipantau',
    description: 'Berikut adalah radar services yang tersedia di Ba-banana Radars',
    color: 0x3498db,
    fields: fields,
    footer: 'Use /radar setup untuk setup radar baru'
  });
}

/**
 * Build interval options untuk Discord select menu
 * @returns {Array} Discord select menu options
 */
function buildIntervalOptions() {
  return [
    { label: '5m ⚡', value: '5m', emoji: '⚡' },
    { label: '10m 🚀', value: '10m', emoji: '🚀' },
    { label: '30m 🔄', value: '30m', emoji: '🔄' },
    { label: '1h 🕐', value: '1h', emoji: '🕐' },
    { label: '3h 🕒', value: '3h', emoji: '🕒' },
    { label: 'Daily 🌞', value: 'daily', emoji: '🌞' }
  ];
}

/**
 * Build mode options untuk Discord select menu
 * @param {string} serviceId - Service ID untuk filter modes
 * @returns {Array} Discord select menu options
 */
function buildModeOptions(serviceId) {
  var allModes = {
    'embed': { label: 'Embed 🌈', value: 'embed', description: 'Formatted embed message' },
    'ai_summary': { label: 'AI Summary 🤖', value: 'ai_summary', description: 'AI-generated summary' },
    'plain': { label: 'Plain Text 📜', value: 'plain', description: 'Simple text format' }
  };

  var supported = getSupportedModes(serviceId);
  var options = [];

  supported.forEach(function(mode) {
    if (allModes[mode]) {
      options.push(allModes[mode]);
    }
  });

  return options;
}

/**
 * Build status emoji based pada condition
 * @param {string} status - Status string
 * @returns {string} Emoji representation
 */
function getStatusEmoji(status) {
  var statusMap = {
    'active': '🟢',
    'paused': '🟡',
    'inactive': '🔴',
    'error': '🚨',
    'ok': '✅',
    'warn': '⚠️'
  };
  return statusMap[status] || '❓';
}

/**
 * Get service emoji
 * @param {string} serviceId - Service ID
 * @returns {string} Emoji untuk service
 */
function getServiceEmoji(serviceId) {
  var service = getRadarService(serviceId);
  return service ? service.emoji : '❓';
}

/**
 * Get service name
 * @param {string} serviceId - Service ID
 * @returns {string} Nama service
 */
function getServiceName(serviceId) {
  var service = getRadarService(serviceId);
  return service ? service.name : 'Unknown Service';
}

/**
 * Validasi radar configuration
 * @param {Object} config - Radar config object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateRadarConfig(config) {
  var errors = [];

  if (!config.service || !isValidRadarService(config.service)) {
    errors.push('Invalid service: ' + config.service);
  }

  if (!config.guild_id || String(config.guild_id).trim() === '') {
    errors.push('Missing guild_id');
  }

  if (!config.channel_id || String(config.channel_id).trim() === '') {
    errors.push('Missing channel_id');
  }

  if (!config.interval || String(config.interval).trim() === '') {
    errors.push('Missing interval');
  }

  var validIntervals = ['5m', '10m', '30m', '1h', '3h', 'daily'];
  if (validIntervals.indexOf(config.interval) === -1) {
    errors.push('Invalid interval: ' + config.interval + ' (valid: ' + validIntervals.join(', ') + ')');
  }

  if (!config.mode || String(config.mode).trim() === '') {
    errors.push('Missing mode');
  }

  var modes = getSupportedModes(config.service);
  if (modes.indexOf(config.mode) === -1) {
    errors.push('Invalid mode for service ' + config.service + ': ' + config.mode + ' (valid: ' + modes.join(', ') + ')');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Get radar fetch function
 * @param {string} serviceId - Service ID
 * @returns {Function|null} Fetch function reference
 */
function getRadarFetchFunction(serviceId) {
  var service = getRadarService(serviceId);
  if (!service) return null;

  var funcName = service.fetch_function;
  try {
    return window[funcName] || eval(funcName);
  } catch (e) {
    logError('❌ Cannot find fetch function: ' + funcName);
    return null;
  }
}

/**
 * Build radar config row untuk Spreadsheet
 * @param {Object} config - Radar config
 * @returns {Array} Row data
 */
function buildRadarConfigRow(config) {
  return [
    config.guild_id || '',
    config.service || '',
    config.channel_id || '',
    config.interval || '1h',
    config.mode || 'embed',
    config.status || '🟢',
    config.last_run || '',
    config.emoji_label || ''
  ];
}

/**
 * Parse radar config row dari Spreadsheet
 * @param {Array} row - Row data
 * @returns {Object} Radar config object
 */
function parseRadarConfigRow(row) {
  return {
    guild_id: row[0] || '',
    service: row[1] || '',
    channel_id: row[2] || '',
    interval: row[3] || '1h',
    mode: row[4] || 'embed',
    status: row[5] || '🟢',
    last_run: row[6] || '',
    emoji_label: row[7] || ''
  };
}

/**
 * Test radar registry (untuk E2E test)
 * @returns {Object} Test result
 */
function testRadarRegistry() {
  var result = {
    services_count: 0,
    services_valid: true,
    errors: []
  };

  try {
    var services = getAllRadarServices();
    result.services_count = services.length;

    services.forEach(function(service) {
      if (!service.id || !service.name || !service.emoji) {
        result.services_valid = false;
        result.errors.push('Invalid service: ' + JSON.stringify(service));
      }

      if (service.modes_supported.length === 0) {
        result.services_valid = false;
        result.errors.push('Service ' + service.id + ' has no modes');
      }
    });

    if (result.services_count === 0) {
      result.services_valid = false;
      result.errors.push('No services registered');
    }

    logInfo('✅ Registry test: ' + result.services_count + ' services found');
  } catch (e) {
    result.services_valid = false;
    result.errors.push(e.message);
  }

  return result;
}
