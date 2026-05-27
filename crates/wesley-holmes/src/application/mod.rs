//! Application services for deterministic Holmes law-assurance orchestration.

mod artifact_locator;

pub use artifact_locator::{ArtifactLocatorError, ResolvedArtifactPath, WeslawArtifactLocator};
