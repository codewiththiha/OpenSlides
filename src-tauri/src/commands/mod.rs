//! Tauri IPC command modules.
//!
//! Split by domain for maintainability. Re-export every command so
//! `lib.rs` can register a single flat handler list.

mod helpers;
mod highlight;
mod io;
mod projects;
mod slides;

pub use highlight::*;
pub use io::*;
pub use projects::*;
pub use slides::*;
