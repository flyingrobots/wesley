#![deny(warnings)]
#![deny(missing_docs)]

//! Wesley Rust Core
//!
//! Deterministic compiler kernel for GraphQL-to-Wesley IR lowering.

pub mod adapters;
pub mod domain;
pub mod ports;
pub mod resilience;

pub use adapters::apollo::{
    compile_operation_artifact, compile_operation_artifact_registration, diff_schema_sdl,
    extract_operation_directive_args, list_schema_operations_sdl, lower_schema_sdl,
    normalize_schema_sdl, resolve_operation_selections, resolve_operation_selections_with_schema,
    ApolloLoweringAdapter,
};
pub use domain::capability::*;
pub use domain::error::*;
pub use domain::ir::*;
pub use domain::law::*;
pub use domain::operation::*;
pub use domain::operation_artifact::*;
pub use domain::schema_delta::*;
pub use ports::lowering::*;
pub use resilience::*;
