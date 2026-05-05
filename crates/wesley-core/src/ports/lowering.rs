//! Lowering port definitions.

use async_trait::async_trait;
use crate::domain::ir::WesleyIR;
use crate::domain::error::WesleyError;

/// Port for lowering GraphQL SDL to Wesley IR.
#[async_trait]
pub trait LoweringPort: Send + Sync {
    /// Lowers the given SDL string to Wesley IR.
    async fn lower_sdl(&self, sdl: &str) -> Result<WesleyIR, WesleyError>;
}
