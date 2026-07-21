//! Connection pool options + pragmas.

use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous,
};
use sqlx::SqlitePool;
use std::str::FromStr;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use super::schema::BASE_SCHEMA;
use super::migrations::run_migrations;

pub type DbPool = SqlitePool;

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {e}"))?;

    let db_path = app_dir.join("openslides.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    // WAL + relaxed sync so the debounced auto-save never blocks reads
    // (scrolling/animation) on the full-DB write lock; busy_timeout avoids
    // transient SQLITE_BUSY instead of erroring the mutation. These are
    // per-connection pragmas, so they live on the pool's connect options,
    // applied identically to all 5 pooled connections.
    // Added memory-cache tuning: 20MB cache (default 2MB) + 256MB mmap keeps
    // projects/slides indices in RAM, making reordering/dashboard instant even with thousands of slides.
    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Invalid DB URL: {e}"))?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .pragma("temp_store", "memory")
        .pragma("cache_size", "-20000")
        .pragma("mmap_size", "268435456")
        .pragma("busy_timeout", "5000");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .connect_with(options)
        .await
        .map_err(|e| format!("Failed to open SQLite pool: {e}"))?;

    sqlx::raw_sql(BASE_SCHEMA)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to run base schema: {e}"))?;

    run_migrations(&pool).await?;

    Ok(pool)
}
