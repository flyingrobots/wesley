#![deny(warnings)]
#![deny(missing_docs)]

//! Wesley Rust Core
//!
//! Deterministic compiler kernel for GraphQL-to-Wesley IR lowering.

pub mod adapters;
pub mod domain;
pub mod ports;
pub mod resilience;

#[deprecated(since = "0.1.1", note = "use compile_operation_artifact")]
#[doc = "Deprecated compatibility alias for [`compile_operation_artifact`]."]
pub use adapters::apollo::compile_operation_artifact as compile_runtime_optic;
#[deprecated(since = "0.1.1", note = "use compile_operation_artifact_registration")]
#[doc = "Deprecated compatibility alias for [`compile_operation_artifact_registration`]."]
pub use adapters::apollo::compile_operation_artifact_registration as compile_runtime_optic_registration;
pub use adapters::apollo::{
    compile_operation_artifact, compile_operation_artifact_registration, diff_schema_sdl,
    extract_operation_directive_args, list_schema_operations_sdl, lower_schema_sdl,
    normalize_schema_sdl, resolve_operation_selections, resolve_operation_selections_with_schema,
    ApolloLoweringAdapter,
};
pub use domain::capability::*;
pub use domain::error::*;
pub use domain::extension_generation::*;
pub use domain::ir::*;
pub use domain::operation::*;
pub use domain::operation_artifact::*;
pub use domain::project_manifest::*;
pub use domain::schema_delta::*;
pub use ports::lowering::*;
pub use resilience::*;
