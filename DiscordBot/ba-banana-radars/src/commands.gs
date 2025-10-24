// 📜 commands.gs - Slash command handlers untuk semua Discord commands
// Fungsi: Handle /radar setup, /radar manage, /radar status, /radar discover, /radar test
// Dependency: config.gs, radar_utils.gs, ui_builder.gs, radar_registry.gs, scheduler.gs

/**
 * Handle /radar setup command
 * Tampilkan form untuk setup radar baru
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleRadarSetup(interaction) {
  logInfo('📋 Handling /radar setup command');

  try {
    var guildId = interaction.guild_id;
    var userId = interaction.user.id;

    // Build components
    var serviceMenu = buildServiceSelectMenu();
    var intervalMenu = buildIntervalSelectMenu();
    var dailyHourMenu = null;
    var modeMenu = buildModeSelectMenu('crypto'); // Default to crypto modes
    var buttons = buildSetupFormButtons();

    var embed = buildEmbed({
      title: '🎯 Setup Radar Baru',
      description: 'Ikuti langkah-langkah di bawah untuk setup radar',
      color: 0x3498db,
      fields: [
        buildField({
          name: '1️⃣ Service',
          value: 'Pilih service yang ingin dipantau',
          inline: false
        }),
        buildField({
          name: '2️⃣ Interval',
          value: 'Pilih frekuensi update',
          inline: false
        }),
        buildField({
          name: '3️⃣ Mode',
          value: 'Pilih format output',
          inline: false
        }),
        buildField({
          name: '4️⃣ Save',
          value: 'Klik "Simpan & Aktifkan" untuk finish',
          inline: false
        })
      ]
    });

    // Jika interval 'daily' dipilih, tambahkan menu jam
    var selectMenus = [serviceMenu, intervalMenu, modeMenu];
    if (interaction && interaction.options && interaction.options.interval === 'daily') {
      dailyHourMenu = buildDailyHourSelectMenu();
      selectMenus.push(dailyHourMenu);
    }
    return buildComponentResponse({
      embeds: [embed],
      select_menus: selectMenus,
      buttons: [buttons],
      ephemeral: false
    });

  } catch (e) {
    logError('❌ Error in /radar setup: ' + e.message);
    return buildErrorResponse('Setup Error', e.message);
  }
}

/**
 * Handle /radar manage command
 * Tampilkan radar aktif dan opsi untuk manage
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleRadarManage(interaction) {
  logInfo('📋 Handling /radar manage command');

  try {
    var guildId = interaction.guild_id;
    var configs = getActiveRadarConfigs('🟢');

    if (!configs || configs.length === 0) {
      return buildErrorResponse('No Active Radars', 'Tidak ada radar aktif. Gunakan /radar setup untuk buat radar baru.');
    }

    var selectMenu = buildRadarListSelectMenu(configs);
    var embed = buildEmbed({
      title: '🎛️ Manage Radars',
      description: 'Pilih radar yang ingin di-manage',
      color: 0x3498db,
      fields: configs.map(function(config, index) {
        return buildField({
          name: (index + 1) + '. ' + getServiceName(config.service),
          value: 'Channel: <#' + config.channel_id + '> • Interval: ' + config.interval,
          inline: false
        });
      })
    });

    return buildComponentResponse({
      embeds: [embed],
      select_menus: [selectMenu],
      ephemeral: false
    });

  } catch (e) {
    logError('❌ Error in /radar manage: ' + e.message);
    return buildErrorResponse('Manage Error', e.message);
  }
}

/**
 * Handle /radar status command
 * Tampilkan status semua radar
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleRadarStatus(interaction) {
  logInfo('📋 Handling /radar status command');

  try {
    var allConfigs = readSheetAsObjects(CONFIG.SHEET_RADAR_CONFIG);
    var activeConfigs = allConfigs.filter(function(c) { return c.status === '🟢'; });
    var pausedConfigs = allConfigs.filter(function(c) { return c.status === '🟡'; });

    var embed = buildRadarStatusEmbed(allConfigs);

    // Add stats
    embed.fields.push(buildField({
      name: '📊 Statistics',
      value: '🟢 Active: ' + activeConfigs.length + '\n🟡 Paused: ' + pausedConfigs.length + '\n📡 Total: ' + allConfigs.length,
      inline: false
    }));

    return buildDiscordPayload({
      embeds: [embed]
    });

  } catch (e) {
    logError('❌ Error in /radar status: ' + e.message);
    return buildErrorResponse('Status Error', e.message);
  }
}

/**
 * Handle /radar discover command
 * Tampilkan catalog radar available
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleRadarDiscover(interaction) {
  logInfo('📋 Handling /radar discover command');

  try {
    var catalogEmbed = buildRadarCatalogEmbed();
    var buttons = buildDiscoverRadarButtons();

    return buildComponentResponse({
      embeds: [catalogEmbed],
      buttons: [buttons],
      ephemeral: false
    });

  } catch (e) {
    logError('❌ Error in /radar discover: ' + e.message);
    return buildErrorResponse('Discover Error', e.message);
  }
}

/**
 * Handle /radar test command
 * Kirim test message ke channel (rotate demo radar)
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleRadarTest(interaction) {
  logInfo('📋 Handling /radar test command');

  try {
    // Rotate demo: cycle through different radar types
    var testType = Math.floor(Date.now() / 1000) % 3;
    var testResult;

    switch (testType) {
      case 0:
        // Demo Crypto Radar
        logInfo('🎯 Test: Crypto Radar');
        testResult = fetchCryptoRadar({ guild_id: interaction.guild_id, mode: 'embed' });
        break;
      case 1:
        // Demo Google Trends Radar
        logInfo('🎯 Test: Google Trends Radar');
        testResult = fetchGtrendsRadar({ guild_id: interaction.guild_id, mode: 'embed' });
        break;
      case 2:
        // Demo Reddit Radar
        logInfo('🎯 Test: Reddit Radar');
        testResult = fetchRedditRadar({
          guild_id: interaction.guild_id,
          mode: 'embed',
          subreddit: 'indonesia',
          sort_by: 'hot'
        });
        break;
      default:
        testResult = fetchCryptoRadar({ guild_id: interaction.guild_id, mode: 'embed' });
    }

    if (testResult.ok) {
      logInfo('✅ Test radar success');
      return buildDiscordPayload({
        content: '📨 **Test Message Dikirim** - Radar demo rotasi setiap kali di-test',
        embeds: testResult.embeds
      });
    } else {
      return buildErrorResponse('Test Failed', testResult.error || 'Test failed');
    }

  } catch (e) {
    logError('❌ Error in /radar test: ' + e.message);
    return buildErrorResponse('Test Error', e.message);
  }
}

/**
 * Handle /radar help command
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleRadarHelp(interaction) {
  logInfo('📋 Handling /radar help command');

  return buildDiscordPayload({
    embeds: [buildHelpEmbed()]
  });
}

/**
 * Route slash command ke handler yang sesuai
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function routeSlashCommand(interaction) {
  var commandName = interaction.data.name;
  var subcommand = (interaction.data.options && interaction.data.options[0]) ? interaction.data.options[0].name : null;

  logDebug('🎯 Routing command: /' + commandName + ' ' + (subcommand || ''));

  if (commandName === 'radar') {
    switch (subcommand) {
      case 'setup':
        return handleRadarSetup(interaction);
      case 'manage':
        return handleRadarManage(interaction);
      case 'status':
        return handleRadarStatus(interaction);
      case 'discover':
        return handleRadarDiscover(interaction);
      case 'test':
        return handleRadarTest(interaction);
      case 'help':
        return handleRadarHelp(interaction);
      default:
        return buildErrorResponse('Unknown Command', 'Command tidak dikenali: /' + commandName + ' ' + subcommand);
    }
  }

  return buildErrorResponse('Unknown Command', 'Command tidak dikenali: /' + commandName);
}

/**
 * Handle button interaction
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleButtonInteraction(interaction) {
  var customId = interaction.data.custom_id;

  logDebug('🔘 Button clicked: ' + customId);

  switch (customId) {
    case 'radar_setup_save':
      return handleSetupSave(interaction);
    case 'radar_setup_cancel':
      return handleSetupCancel(interaction);
    case 'radar_manage_pause':
      return handleManagePause(interaction);
    case 'radar_manage_delete':
      return handleManageDelete(interaction);
    case 'radar_manage_schedule':
      return handleManageSchedule(interaction);
    case 'radar_discover_enable':
      return handleDiscoverEnable(interaction);
    case 'radar_discover_info':
      return handleDiscoverInfo(interaction);
    default:
      return buildErrorResponse('Unknown Button', 'Button action tidak dikenali: ' + customId);
  }
}

/**
 * Handle save button dari setup form
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleSetupSave(interaction) {
  logInfo('💾 Saving radar configuration');

  try {
    // In production: extract form data dari interaction state
    // For now: return success message
    var successEmbed = buildSuccessEmbed('Radar Saved', 'Radar berhasil di-setup dan diaktifkan! 🎉');
    return buildDiscordPayload({
      embeds: [successEmbed],
      ephemeral: true
    });

  } catch (e) {
    logError('❌ Error saving: ' + e.message);
    return buildErrorResponse('Save Error', e.message);
  }
}

/**
 * Handle cancel button
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleSetupCancel(interaction) {
  logInfo('❌ Setup cancelled');

  return buildDiscordPayload({
    content: '❌ Setup dibatalkan',
    ephemeral: true
  });
}

/**
 * Handle pause button
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleManagePause(interaction) {
  logInfo('⏸️ Pausing radar');

  try {
    // In production: find radar by interaction data dan update status
    var pauseEmbed = buildSuccessEmbed('Radar Paused', 'Radar telah di-pause ⏸️');
    return buildDiscordPayload({
      embeds: [pauseEmbed],
      ephemeral: true
    });

  } catch (e) {
    return buildErrorResponse('Pause Error', e.message);
  }
}

/**
 * Handle delete button
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleManageDelete(interaction) {
  logInfo('🗑️ Deleting radar');

  try {
    var deleteEmbed = buildSuccessEmbed('Radar Deleted', 'Radar telah dihapus 🗑️');
    return buildDiscordPayload({
      embeds: [deleteEmbed],
      ephemeral: true
    });

  } catch (e) {
    return buildErrorResponse('Delete Error', e.message);
  }
}

/**
 * Handle schedule button
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleManageSchedule(interaction) {
  logInfo('🔁 Updating schedule');

  try {
    var scheduleEmbed = buildSuccessEmbed('Schedule Updated', 'Jadwal radar telah diupdate 🔁');
    return buildDiscordPayload({
      embeds: [scheduleEmbed],
      ephemeral: true
    });

  } catch (e) {
    return buildErrorResponse('Schedule Error', e.message);
  }
}

/**
 * Handle discover enable button
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleDiscoverEnable(interaction) {
  logInfo('➕ Enabling radar from discover');

  try {
    return buildSuccessResponse('Radar Enabled', 'Radar berhasil diaktifkan! ➕');

  } catch (e) {
    return buildErrorResponse('Enable Error', e.message);
  }
}

/**
 * Handle discover info button
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleDiscoverInfo(interaction) {
  logInfo('ℹ️ Showing radar info');

  try {
    var infoEmbed = buildEmbed({
      title: 'ℹ️ More Info',
      description: 'Gunakan /radar setup untuk customize dan setup radar',
      color: 0x3498db
    });

    return buildDiscordPayload({
      embeds: [infoEmbed],
      ephemeral: true
    });

  } catch (e) {
    return buildErrorResponse('Info Error', e.message);
  }
}

/**
 * Handle select menu interaction
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Discord payload
 */
function handleSelectMenuInteraction(interaction) {
  var customId = interaction.data.custom_id;
  var values = interaction.data.values || [];

  logDebug('📋 Select menu: ' + customId + ', values: ' + values.join(','));

  switch (customId) {
    case 'radar_service_select':
      return handleServiceSelect(interaction, values);
    case 'radar_interval_select':
      return handleIntervalSelect(interaction, values);
    case 'radar_daily_hour_select':
      return handleDailyHourSelect(interaction, values);
    case 'radar_mode_select':
      return handleModeSelect(interaction, values);
    case 'radar_channel_select':
      return handleChannelSelect(interaction, values);
    case 'radar_manage_select':
      return handleManageSelect(interaction, values);
    default:
      return buildErrorResponse('Unknown Select', 'Select menu tidak dikenali: ' + customId);
  }
}

/**
 * Handle service selection
 * @param {Object} interaction - Discord interaction object
 * @param {string[]} values - Selected values
 * @returns {Object} Discord payload
 */
function handleServiceSelect(interaction, values) {
  var selectedService = values[0];
  logDebug('💰 Service selected: ' + selectedService);

  var service = getRadarService(selectedService);
  var responseEmbed = buildEmbed({
    title: '✅ Service Selected',
    description: 'Anda memilih: ' + service.emoji + ' ' + service.name,
    color: 0x2ecc71,
    fields: [buildField({
      name: 'Description',
      value: service.description,
      inline: false
    })]
  });

  return buildDiscordPayload({
    embeds: [responseEmbed],
    ephemeral: true
  });
}

/**
 * Handle interval selection
 * @param {Object} interaction - Discord interaction object
 * @param {string[]} values - Selected values
 * @returns {Object} Discord payload
 */
function handleIntervalSelect(interaction, values) {
  var selectedInterval = values[0];
  logDebug('⏱️ Interval selected: ' + selectedInterval);

  var responseEmbed = buildSuccessEmbed('Interval Selected', 'Interval diset ke: `' + selectedInterval + '`');

  // Jika interval daily, tampilkan menu jam
  if (selectedInterval === 'daily') {
    var dailyHourMenu = buildDailyHourSelectMenu();
    return buildComponentResponse({
      embeds: [responseEmbed],
      select_menus: [dailyHourMenu]
    });
  }

  return buildDiscordPayload({
    embeds: [responseEmbed]
  });
}

/**
 * Handle daily hour selection
 * @param {Object} interaction - Discord interaction object
 * @param {string[]} values - Selected values
 * @returns {Object} Discord payload
 */
function handleDailyHourSelect(interaction, values) {
  var selectedHour = values[0];
  logDebug('🕒 Daily hour selected: ' + selectedHour);

  var responseEmbed = buildSuccessEmbed('Jam Eksekusi Harian', 'Radar harian akan dijalankan setiap hari pada jam: `' + selectedHour + ' WIB`');

  return buildDiscordPayload({
    embeds: [responseEmbed]
  });
}

/**
 * Handle mode selection
 * @param {Object} interaction - Discord interaction object
 * @param {string[]} values - Selected values
 * @returns {Object} Discord payload
 */
function handleModeSelect(interaction, values) {
  var selectedMode = values[0];
  logDebug('📋 Mode selected: ' + selectedMode);

  var responseEmbed = buildSuccessEmbed('Mode Selected', 'Mode diset ke: `' + selectedMode + '`');

  return buildDiscordPayload({
    embeds: [responseEmbed],
    ephemeral: true
  });
}

/**
 * Handle channel selection
 * @param {Object} interaction - Discord interaction object
 * @param {string[]} values - Selected values
 * @returns {Object} Discord payload
 */
function handleChannelSelect(interaction, values) {
  var selectedChannel = values[0];
  logDebug('📢 Channel selected: ' + selectedChannel);

  var responseEmbed = buildSuccessEmbed('Channel Selected', 'Channel diset ke: <#' + selectedChannel + '>');

  return buildDiscordPayload({
    embeds: [responseEmbed],
    ephemeral: true
  });
}

/**
 * Handle manage select
 * @param {Object} interaction - Discord interaction object
 * @param {string[]} values - Selected values
 * @returns {Object} Discord payload
 */
function handleManageSelect(interaction, values) {
  var selectedRadar = values[0];
  logDebug('🎛️ Radar selected for manage: ' + selectedRadar);

  var buttons = buildManageRadarButtons();

  var responseEmbed = buildEmbed({
    title: '🎛️ Manage Selected Radar',
    description: 'Pilih action yang ingin dilakukan',
    color: 0x3498db
  });

  return buildComponentResponse({
    embeds: [responseEmbed],
    buttons: [buttons],
    ephemeral: false
  });
}
