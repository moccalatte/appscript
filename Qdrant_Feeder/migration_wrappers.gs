/**
 * migration_wrappers.gs
 *
 * Small wrapper helpers to run dedup migration from the Apps Script UI easily.
 * - Adds a custom menu "Qdrant Feeder" with a migration entry.
 * - Provides a confirmed migration flow with user-facing alerts and best-effort logging.
 *
 * Usage:
 * - Open the Apps Script project (or the spreadsheet created by the script).
 * - Reload the editor / open the spreadsheet; the "Qdrant Feeder" menu will appear.
 * - Select "Migrate dedup (Properties → Sheet)" and confirm to run migration.
 *
 * Notes:
 * - This wrapper calls `migrateDedupPropertiesToSheet()` which is expected to exist
 *   in the project (implemented in `Code.gs`). The migration function is idempotent.
 * - The wrapper tries to surface results via UI alerts and also logs a short message
 *   with `appendLogIfAvailable()` when possible.
 */

/**
 * onOpen()
 * Adds a convenient top-level menu to the active Spreadsheet so operators can
 * run the migration from the UI without opening the script editor.
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('Qdrant Feeder')
      .addItem('Migrate dedup (Properties → Sheet)', 'uiMigrateDedupConfirm')
      .addToUi();
  } catch (e) {
    // If there's no active spreadsheet (script editor context only), do nothing.
    // This is best-effort to surface menu in Spreadsheet UI.
  }
}

/**
 * uiMigrateDedupConfirm()
 * UI wrapper that asks the user for confirmation before triggering migration.
 * Runs when the user selects the menu entry.
 */
function uiMigrateDedupConfirm() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    'Migrate dedup keys',
    'This will migrate any legacy dedup keys from Script Properties into the sheet `awesome_dedup` and remove the old properties. This action is idempotent. Proceed?',
    ui.ButtonSet.YES_NO
  );
  if (resp === ui.Button.YES) {
    uiMigrateDedup();
  } else {
    ui.alert('Migration cancelled.');
  }
}

/**
 * uiMigrateDedup()
 * Runs the migration helper and shows the result to the operator.
 * Best-effort: logs a short message via `appendLogIfAvailable()` if available.
 */
function uiMigrateDedup() {
  var ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;
  try {
    // Call the migration helper. It should return an integer count.
    var migrated = 0;
    if (typeof migrateDedupPropertiesToSheet === 'function') {
      migrated = migrateDedupPropertiesToSheet();
    } else {
      // If the helper is not present, surface a helpful message.
      var msg = 'Migration helper not found: migrateDedupPropertiesToSheet() is not defined in the project.';
      if (ui) ui.alert('Migration failed', msg, ui.ButtonSet.OK);
      try { appendLogIfAvailable('migrate-dedup', msg); } catch (e) {}
      return;
    }

    var summary = 'Dedup migration completed. Keys migrated: ' + String(migrated);
    if (ui) {
      ui.alert('Migration finished', summary, ui.ButtonSet.OK);
    } else {
      // Fallback display if no Spreadsheet UI available
      Logger.log(summary);
    }

    // Best-effort: also log to the project's logs sheet for observability
    try { appendLogIfAvailable('migrate-dedup', summary); } catch (e) { /* swallow */ }

  } catch (e) {
    var errMsg = 'Migration error: ' + String(e);
    if (ui) ui.alert('Migration error', errMsg, ui.ButtonSet.OK);
    try { appendLogIfAvailable('migrate-dedup', errMsg); } catch (ee) {}
  }
}

/**
 * runMigrateDedupSilent()
 * Convenience function to run the migration programmatically (no UI).
 * Useful if you prefer to invoke migration from the Script Editor's function dropdown.
 */
function runMigrateDedupSilent() {
  try {
    if (typeof migrateDedupPropertiesToSheet === 'function') {
      var migrated = migrateDedupPropertiesToSheet();
      try { appendLogIfAvailable('migrate-dedup', 'migrated=' + String(migrated)); } catch (e) {}
      return migrated;
    } else {
      try { appendLogIfAvailable('migrate-dedup', 'helper not found'); } catch (e) {}
      return 0;
    }
  } catch (e) {
    try { appendLogIfAvailable('migrate-dedup', 'error: ' + String(e)); } catch (ee) {}
    throw e;
  }
}
