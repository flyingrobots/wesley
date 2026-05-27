//! Workspace-relative artifact path resolution.

use std::path::{Component, Path};

/// Error returned when an artifact path cannot be normalized safely.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactLocatorError {
    /// Human-readable explanation of the failed path normalization.
    pub message: String,
}

impl ArtifactLocatorError {
    /// Build a new locator error.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

/// A normalized artifact path that stays inside the configured workspace root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedArtifactPath {
    /// Workspace-relative path using `/` separators.
    pub workspace_relative: String,
}

/// Resolves `weslaw` artifact references without touching the filesystem.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WeslawArtifactLocator {
    workspace_root: String,
}

impl WeslawArtifactLocator {
    /// Create a locator for a workspace root label.
    pub fn new(workspace_root: impl Into<String>) -> Self {
        Self {
            workspace_root: workspace_root.into(),
        }
    }

    /// Return the configured workspace root label.
    pub fn workspace_root(&self) -> &str {
        &self.workspace_root
    }

    /// Normalize a user-authored artifact path relative to the workspace.
    ///
    /// The resolver is lexical by design. It rejects absolute paths, Windows
    /// prefixes, empty paths, and `..` components that would escape the
    /// workspace root. It does not perform symlink or filesystem
    /// canonicalization.
    pub fn resolve(&self, path: &str) -> Result<ResolvedArtifactPath, ArtifactLocatorError> {
        if path.trim().is_empty() {
            return Err(ArtifactLocatorError::new("artifact path must not be empty"));
        }

        let path = Path::new(path);
        if path.is_absolute() {
            return Err(ArtifactLocatorError::new(
                "artifact path must be workspace-relative",
            ));
        }

        let mut normalized = Vec::new();
        for component in path.components() {
            match component {
                Component::CurDir => {}
                Component::Normal(segment) => {
                    normalized.push(segment.to_string_lossy().into_owned())
                }
                Component::ParentDir => {
                    if normalized.pop().is_none() {
                        return Err(ArtifactLocatorError::new(
                            "artifact path must not escape the workspace root",
                        ));
                    }
                }
                Component::Prefix(_) | Component::RootDir => {
                    return Err(ArtifactLocatorError::new(
                        "artifact path must be workspace-relative",
                    ));
                }
            }
        }

        if normalized.is_empty() {
            return Err(ArtifactLocatorError::new(
                "artifact path must reference a file",
            ));
        }

        Ok(ResolvedArtifactPath {
            workspace_relative: normalized.join("/"),
        })
    }
}
