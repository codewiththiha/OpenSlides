//! Tauri IPC command modules.
//!
//! Split by domain for maintainability. Re-export every command so
//! `lib.rs` can register a single flat handler list.

pub mod helpers;
pub mod shared;
mod io;
mod projects;
mod quit;
mod search;
mod slides;
mod stacks;

pub use io::*;
pub use projects::*;
pub use quit::*;
pub use search::*;
pub use slides::*;
pub use stacks::*;
