//! Lowering port definitions.

use crate::domain::error::WesleyError;
use crate::domain::ir::WesleyIR;
use async_trait::async_trait;

/// Port for lowering GraphQL SDL to Wesley IR.
// `async_trait` marks the desugared method `#[must_use]`, and its boxed future
// is already `#[must_use]`; clippy 1.99 reports that as `double_must_use`.
#[allow(clippy::double_must_use)]
#[async_trait]
pub trait LoweringPort: Send + Sync {
    /// Lowers the given SDL string to Wesley IR.
    async fn lower_sdl(&self, sdl: &str) -> Result<WesleyIR, WesleyError>;
}
