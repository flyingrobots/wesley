#![deny(warnings)]
#![deny(missing_docs)]

//! Wesley Rust Core
//!
//! Deterministic compiler kernel for GraphQL-to-Wesley IR lowering.

pub mod domain;
pub mod ports;
pub mod adapters;

pub use domain::ir::*;
pub use domain::error::*;
pub use domain::footprint::*;
pub use ports::lowering::*;
pub use adapters::apollo::{check_footprint, extract_footprint, ApolloLoweringAdapter};
