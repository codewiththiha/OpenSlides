//! Re-export compatibility shim — shared helpers were split into commands/shared/.
//! Existing command files can continue to `use super::helpers::*`.

pub use super::shared::dialogs::*;
pub use super::shared::naming::*;
pub use super::shared::project_queries::*;
pub use super::shared::slide_queries::*;
