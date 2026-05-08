#![deny(warnings)]
#![deny(missing_docs)]

//! Wesley Rust Core
//!
//! Deterministic compiler kernel for GraphQL-to-Wesley IR lowering.

pub mod adapters;
pub mod domain;
pub mod ports;

pub use adapters::apollo::{
    diff_schema_sdl, extract_operation_directive_args, lower_schema_sdl,
    resolve_operation_selections, resolve_operation_selections_with_schema, ApolloLoweringAdapter,
};
pub use domain::error::*;
pub use domain::ir::*;
pub use domain::operation::*;
pub use domain::schema_delta::*;
pub use ports::lowering::*;
