//! SQLite database initialization, lightweight migrations, connection pool.
//!
//! Uses a `schema_version` table + imperative migrations so we never need
//! the sqlx `macros` feature (which breaks macOS release builds).

pub mod migrations;
pub mod pool;
pub mod schema;

pub use pool::{init_db, DbPool};
