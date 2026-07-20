//! Unified IPC error type for all Tauri commands.
//!
//! Serializes as `{ "code": "...", "message": "..." }` so the frontend
//! `normalizeCommandError` / `isCancelledError` in src/lib/tauri-api.ts)
//! can branch on the failure kind instead of matching message strings
//! across the IPC bridge.
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum CommandError {
    /// The user dismissed a native dialog — the frontend stays silent.
    #[serde(rename = "CANCELLED")]
    Cancelled(String),
    /// The target row does not exist.
    #[serde(rename = "NOT_FOUND")]
    NotFound(String),
    /// Caller-supplied input was rejected (e.g. deleting the last slide).
    #[serde(rename = "VALIDATION")]
    Validation(String),
    /// Everything else (DB failure, IO, serialization…).
    #[serde(rename = "ERROR")]
    Failed(String),
}

impl CommandError {
    pub fn failed(msg: impl Into<String>) -> Self {
        Self::Failed(msg.into())
    }
}

impl From<String> for CommandError {
    fn from(s: String) -> Self {
        Self::Failed(s)
    }
}

impl From<&str> for CommandError {
    fn from(s: &str) -> Self {
        Self::Failed(s.to_string())
    }
}

impl From<sqlx::Error> for CommandError {
    fn from(e: sqlx::Error) -> Self {
        Self::Failed(e.to_string())
    }
}

pub type CommandResult<T> = Result<T, CommandError>;
