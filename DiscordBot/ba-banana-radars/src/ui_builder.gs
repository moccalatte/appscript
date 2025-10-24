// 🎨 ui_builder.gs - Builder untuk Discord UI components
// Fungsi: Build buttons, select menus, modal components dengan emoji
// Dependency: config.gs, radar_utils.gs, radar_registry.gs

/**
 * Build Discord service select menu
 * Untuk memilih service saat setup radar
 * @returns {Object} Discord select menu
 */
function buildServiceSelectMenu() {
  var services = getAllRadarServices();
  var options = services.map(function(service) {
    return {
      label: service.emoji + ' ' + service.name,
      value: service.id,
      description: service.description,
      emoji: { name: service.emoji }
    };
  });

  return buildSelectMenu({
    custom_id: 'radar_service_select',
    placeholder: '💰 Pilih Service Radar',
    options: options
  });
}

/**
 * Build Discord interval select menu
 * @returns {Object} Discord select menu
 */
function buildIntervalSelectMenu() {
  var options = buildIntervalOptions().map(function(opt) {
    return {
      label: opt.label,
      value: opt.value,
      emoji: { name: opt.emoji }
    };
  });

  return buildSelectMenu({
    custom_id: 'radar_interval_select',
    placeholder: '⏱️ Pilih Interval',
    options: options
  });
}

/**
 * Build Discord daily hour select menu
 * Digunakan saat interval 'daily' dipilih
 * @returns {Object} Discord select menu
 */
function buildDailyHourSelectMenu() {
  var options = [];
  for (var h = 0; h < 24; h++) {
    var hourStr = (h < 10 ? '0' : '') + h + ':00';
    options.push({
      label: hourStr + ' WIB',
      value: hourStr,
      emoji: { name: '🕒' }
    });
  }
  return buildSelectMenu({
    custom_id: 'radar_daily_hour_select',
    placeholder: '🕒 Pilih Jam Eksekusi (WIB)',
    options: options
  });
}

/**
 * Build Discord mode select menu
 * @param {string} serviceId - Service ID untuk filter supported modes
 * @returns {Object} Discord select menu
 */
function buildModeSelectMenu(serviceId) {
  var options = buildModeOptions(serviceId).map(function(opt) {
    return {
      label: opt.label,
      value: opt.value,
      description: opt.description,
      emoji: { name: opt.label.split(' ')[1] || '📋' }
    };
  });

  return buildSelectMenu({
    custom_id: 'radar_mode_select',
    placeholder: '📋 Pilih Mode',
    options: options
  });
}

/**
 * Build Discord channel select menu
 * @param {Array} channels - Array of channel objects
 * @returns {Object} Discord select menu
 */
function buildChannelSelectMenu(channels) {
  var options = (channels || []).map(function(ch) {
    return {
      label: ch.name || '#' + ch.id,
      value: ch.id,
      description: ch.type === 0 ? 'Text Channel' : 'Other',
      emoji: { name: '📢' }
    };
  });

  return buildSelectMenu({
    custom_id: 'radar_channel_select',
    placeholder: '📢 Pilih Channel',
    options: options
  });
}

/**
 * Build setup form buttons (Save & Cancel)
 * @returns {Object} Action row dengan buttons
 */
function buildSetupFormButtons() {
  var buttons = [
    buildButton({
      custom_id: 'radar_setup_save',
      label: 'Simpan & Aktifkan',
      style: 3, // green
      emoji: '✅'
    }),
    buildButton({
      custom_id: 'radar_setup_cancel',
      label: 'Batal',
      style: 2, // gray
      emoji: '❌'
    })
  ];

  return buildActionRow(buttons);
}

/**
 * Build manage radar buttons
 * @returns {Object} Action row dengan buttons
 */
function buildManageRadarButtons() {
  var buttons = [
    buildButton({
      custom_id: 'radar_manage_pause',
      label: 'Pause',
      style: 1, // blue
      emoji: '⏸'
    }),
    buildButton({
      custom_id: 'radar_manage_delete',
      label: 'Delete',
      style: 4, // red
      emoji: '🗑'
    }),
    buildButton({
      custom_id: 'radar_manage_schedule',
      label: 'Ubah Jadwal',
      style: 1, // blue
      emoji: '🔁'
    })
  ];

  return buildActionRow(buttons);
}

/**
 * Build discover radar buttons
 * @returns {Object} Action row dengan buttons
 */
function buildDiscoverRadarButtons() {
  var buttons = [
    buildButton({
      custom_id: 'radar_discover_enable',
      label: 'Aktifkan',
      style: 3, // green
      emoji: '➕'
    }),
    buildButton({
      custom_id: 'radar_discover_info',
      label: 'Lebih Info',
      style: 1, // blue
      emoji: 'ℹ️'
    })
  ];

  return buildActionRow(buttons);
}

/**
 * Build radar status embed
 * @param {Array} configs - Array of radar configs
 * @returns {Object} Discord embed
 */
function buildRadarStatusEmbed(configs) {
  var fields = [];

  if (!configs || configs.length === 0) {
    fields.push(buildField({
      name: 'No Radars Active',
      value: 'Gunakan `/radar setup` untuk setup radar baru',
      inline: false
    }));
  } else {
    configs.forEach(function(config, index) {
      var status = config.status || '🟢';
      var service = getServiceName(config.service || 'unknown');
      var emoji = getServiceEmoji(config.service || 'unknown');

      fields.push(buildField({
        name: (index + 1) + '. ' + status + ' ' + emoji + ' ' + service,
        value: 'Channel: <#' + config.channel_id + '>\n' +
               'Interval: `' + (config.interval || '1h') + '`\n' +
               'Mode: `' + (config.mode || 'embed') + '`\n' +
               'Last Run: ' + (config.last_run ? '`' + config.last_run + '`' : '`Never`'),
        inline: false
      }));
    });
  }

  return buildEmbed({
    title: '📡 Radar Status',
    description: 'Semua radar yang sedang berjalan di server ini',
    color: 0x3498db,
    fields: fields,
    footer: 'Use /radar manage untuk mengelola'
  });
}

/**
 * Build setup confirmation embed
 * @param {Object} config - Configuration yang akan disave
 * @returns {Object} Discord embed
 */
function buildSetupConfirmEmbed(config) {
  var service = getServiceName(config.service);
  var emoji = getServiceEmoji(config.service);

  return buildEmbed({
    title: '✅ Radar Setup Confirmation',
    description: 'Review konfigurasi Anda sebelum save',
    color: 0x2ecc71,
    fields: [
      buildField({
        name: emoji + ' Service',
        value: service,
        inline: true
      }),
      buildField({
        name: '📢 Channel',
        value: '<#' + config.channel_id + '>',
        inline: true
      }),
      buildField({
        name: '⏱️ Interval',
        value: config.interval,
        inline: true
      }),
      buildField({
        name: '📋 Mode',
        value: config.mode,
        inline: true
      })
    ],
    footer: 'Click "Simpan & Aktifkan" untuk lanjut'
  });
}

/**
 * Build help embed
 * @returns {Object} Discord embed
 */
function buildHelpEmbed() {
  return buildEmbed({
    title: '🍌 Ba-banana Radars - Help',
    description: 'Bot untuk monitor tren dan data real-time',
    color: 0xf39c12,
    fields: [
      buildField({
        name: '/radar setup',
        value: 'Setup radar baru untuk channel',
        inline: false
      }),
      buildField({
        name: '/radar manage',
        value: 'Manage radar yang sudah aktif',
        inline: false
      }),
      buildField({
        name: '/radar status',
        value: 'Lihat status semua radar',
        inline: false
      }),
      buildField({
        name: '/radar discover',
        value: 'Lihat catalog radar available',
        inline: false
      }),
      buildField({
        name: '/radar test',
        value: 'Send test embed ke channel',
        inline: false
      })
    ],
    footer: 'Tetap jaga energi 🍌!'
  });
}

/**
 * Build welcome embed
 * @returns {Object} Discord embed
 */
function buildWelcomeEmbed() {
  return buildEmbed({
    title: '🍌 Selamat Datang di Ba-banana Radars!',
    description: 'Bot personal untuk monitor tren dan data real-time di Discord',
    color: 0xf39c12,
    fields: [
      buildField({
        name: '🎯 Mulai Sekarang',
        value: 'Gunakan `/radar discover` untuk lihat radar available',
        inline: false
      }),
      buildField({
        name: '💰 Crypto Radar',
        value: 'Monitor harga crypto dari Binance setiap jam',
        inline: false
      }),
      buildField({
        name: '📊 Google Trends',
        value: 'Top trending searches di Indonesia',
        inline: false
      })
    ],
    footer: 'Type /radar help untuk bantuan lebih'
  });
}

/**
 * Build error response embed
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @returns {Object} Discord embed
 */
function buildErrorResponseEmbed(title, message) {
  return buildEmbed({
    title: '🚨 ' + (title || 'Error'),
    description: message || 'Terjadi kesalahan',
    color: 0xe74c3c,
    footer: 'Contact admin jika masalah berlanjut'
  });
}

/**
 * Build loading embed
 * @param {string} message - Loading message
 * @returns {Object} Discord embed
 */
function buildLoadingEmbed(message) {
  return buildEmbed({
    title: '⏳ Loading...',
    description: message || 'Mohon tunggu',
    color: 0x95a5a6
  });
}

/**
 * Build radar list select menu
 * @param {Array} configs - Array of radar configs
 * @returns {Object} Discord select menu
 */
function buildRadarListSelectMenu(configs) {
  var options = (configs || []).map(function(config, index) {
    var status = config.status || '🟢';
    var service = getServiceName(config.service);
    var emoji = getServiceEmoji(config.service);

    return {
      label: (index + 1) + '. ' + service,
      value: 'radar_' + index,
      description: 'Channel: ' + config.channel_id + ', Status: ' + status,
      emoji: { name: emoji }
    };
  });

  return buildSelectMenu({
    custom_id: 'radar_manage_select',
    placeholder: '📡 Pilih radar untuk manage',
    options: options
  });
}

/**
 * Build confirmation dialog embed
 * @param {string} action - Action name (pause, delete, update)
 * @param {string} details - Details tentang action
 * @returns {Object} Discord embed
 */
function buildConfirmationEmbed(action, details) {
  var actionEmoji = {
    'pause': '⏸',
    'delete': '🗑',
    'update': '🔄',
    'resume': '▶'
  };

  var emoji = actionEmoji[action] || '❓';

  return buildEmbed({
    title: emoji + ' Konfirmasi ' + action.toUpperCase(),
    description: details || 'Yakin dengan action ini?',
    color: 0xf39c12
  });
}

/**
 * Build confirm/cancel buttons
 * @param {string} confirmId - Custom ID untuk confirm button
 * @param {string} cancelId - Custom ID untuk cancel button
 * @returns {Object} Action row
 */
function buildConfirmCancelButtons(confirmId, cancelId) {
  var buttons = [
    buildButton({
      custom_id: confirmId || 'confirm',
      label: 'Ya, Lanjutkan',
      style: 3, // green
      emoji: '✅'
    }),
    buildButton({
      custom_id: cancelId || 'cancel',
      label: 'Batal',
      style: 4, // red
      emoji: '❌'
    })
  ];

  return buildActionRow(buttons);
}

/**
 * Build test message embed
 * @param {string} radarName - Nama radar
 * @returns {Object} Discord embed
 */
function buildTestMessageEmbed(radarName) {
  return buildEmbed({
    title: '✅ Test Message',
    description: 'Ini adalah test message dari **' + radarName + '** radar',
    color: 0x2ecc71,
    fields: [
      buildField({
        name: '📨 Status',
        value: 'Test message berhasil dikirim',
        inline: true
      }),
      buildField({
        name: '⏱️ Waktu',
        value: formatTimestampWIB(new Date()),
        inline: true
      })
    ],
    footer: 'Use /radar setup untuk setup radar sebenarnya'
  });
}

/**
 * Build stats embed
 * @param {Object} stats - Statistics object
 * @returns {Object} Discord embed
 */
function buildStatsEmbed(stats) {
  stats = stats || {};

  return buildEmbed({
    title: '📊 Ba-banana Radars Statistics',
    description: 'Overview sistem radar',
    color: 0x3498db,
    fields: [
      buildField({
        name: '🟢 Active Radars',
        value: String(stats.active_radars || 0),
        inline: true
      }),
      buildField({
        name: '🟡 Paused Radars',
        value: String(stats.paused_radars || 0),
        inline: true
      }),
      buildField({
        name: '📨 Messages Sent',
        value: String(stats.messages_sent || 0),
        inline: true
      }),
      buildField({
        name: '🚨 Errors',
        value: String(stats.errors || 0),
        inline: true
      }),
      buildField({
        name: '⏱️ Avg Response Time',
        value: (stats.avg_response_ms || 0) + 'ms',
        inline: true
      }),
      buildField({
        name: '📈 Uptime',
        value: stats.uptime || 'N/A',
        inline: true
      })
    ],
    footer: 'Last updated: ' + formatTimestampWIB(new Date())
  });
}

/**
 * Build pagination buttons
 * @param {number} page - Current page
 * @param {number} totalPages - Total pages
 * @returns {Object} Action row
 */
function buildPaginationButtons(page, totalPages) {
  var buttons = [];

  if (page > 1) {
    buttons.push(buildButton({
      custom_id: 'page_prev',
      label: 'Previous',
      style: 1,
      emoji: '◀️'
    }));
  }

  buttons.push(buildButton({
    custom_id: 'page_info',
    label: 'Page ' + page + '/' + totalPages,
    style: 2,
    disabled: true
  }));

  if (page < totalPages) {
    buttons.push(buildButton({
      custom_id: 'page_next',
      label: 'Next',
      style: 1,
      emoji: '▶️'
    }));
  }

  return buildActionRow(buttons);
}

/**
 * Build success response with embed
 * @param {string} title - Title
 * @param {string} message - Message
 * @returns {Object} Discord payload
 */
function buildSuccessResponse(title, message) {
  return buildDiscordPayload({
    embeds: [buildSuccessEmbed(title, message)]
  });
}

/**
 * Build error response with embed
 * @param {string} title - Title
 * @param {string} message - Message
 * @returns {Object} Discord payload
 */
function buildErrorResponse(title, message) {
  return buildDiscordPayload({
    embeds: [buildErrorResponseEmbed(title, message)]
  });
}

/**
 * Build response with components
 * @param {Object} options - Response options
 * @returns {Object} Discord payload
 */
function buildComponentResponse(options) {
  var components = [];

  if (options.buttons) {
    components.push(buildActionRow(options.buttons));
  }

  if (options.select_menus) {
    options.select_menus.forEach(function(menu) {
      components.push(buildActionRow([menu]));
    });
  }

  return buildDiscordPayload({
    content: options.content || '',
    embeds: options.embeds || [],
    components: components,
    ephemeral: options.ephemeral || false
  });
}
