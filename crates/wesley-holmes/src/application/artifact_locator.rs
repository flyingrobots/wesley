//! Workspace-relative artifact path resolution.

use std::path::{Component, Path};

use crate::domain::{HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity};

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
    pub fn resolve(&self, path: &str) -> HolmesResult<ResolvedArtifactPath> {
        if path.trim().is_empty() {
            return Err(invalid_path("artifact path must not be empty"));
        }

        if path.contains('\\') {
            return Err(path_escape("artifact path must use `/` separators"));
        }

        if looks_like_windows_drive_path(path) {
            return Err(path_escape("artifact path must be workspace-relative"));
        }

        let path = Path::new(path);
        if path.is_absolute() {
            return Err(path_escape("artifact path must be workspace-relative"));
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
                        return Err(path_escape(
                            "artifact path must not escape the workspace root",
                        ));
                    }
                }
                Component::Prefix(_) | Component::RootDir => {
                    return Err(path_escape("artifact path must be workspace-relative"));
                }
            }
        }

        if normalized.is_empty() {
            return Err(invalid_path("artifact path must reference a file"));
        }

        Ok(ResolvedArtifactPath {
            workspace_relative: normalized.join("/"),
        })
    }
}

fn invalid_path(message: impl Into<String>) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawArtifactPathInvalid,
        HolmesSeverity::Error,
        message,
    )
    .at_field("path")
}

fn path_escape(message: impl Into<String>) -> HolmesDiagnostic {
    HolmesDiagnostic::new(
        HolmesDiagnosticCode::HlawArtifactPathEscape,
        HolmesSeverity::Error,
        message,
    )
    .at_field("path")
}

fn looks_like_windows_drive_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}
