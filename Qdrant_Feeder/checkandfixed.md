## Qdrant Feeder Fixes

- Ensured Script Properties support placeholder chaining (e.g. `{{SOME_KEY}}`) by adding resolver helpers, then wired them into `getConfig()` and `readAwesomeIntegrationConfig()`. This prevents the bot from ignoring indirection in keys such as `QDRANT_COLLECTION`.
- Added rich logging metadata: the logs sheet header now includes `collection_name`, `qdrant_url`, `vector_name`, `vector_size`, and `run_mode`, and every `makeLogRow` call now supplies those values.
- Fixed dedup behaviour so it is collection-aware. Dedup keys are now prefixed with the encoded collection name, legacy keys remain honoured, and caches/maps write/read both formats. This avoids cross-collection interference.
- Updated awesome integration pipeline to share the same logging and dedup improvements, including fixing the undefined `tz` used when mirroring dedup keys to logs.
- Menyatukan utilitas migrasi ke `Code.gs`, menambahkan `runMigrateDedupSilent()`, dan menghapus `migration_wrappers.gs` yang sudah tidak diperlukan.
