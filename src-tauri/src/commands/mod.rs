//! Tauri IPC command modules.
//!
//! Split by domain for maintainability. Re-export every command so
//! `lib.rs` can register a single flat handler list.

mod helpers;
mod highlight_measure;
mod io;
mod merustmar;
mod projects;
mod quit;
mod slides;

pub use highlight_measure::*;
pub use io::*;
pub use merustmar::*;
pub use projects::*;
pub use quit::*;
pub use slides::*;
