//! Abstract Holmes side-effect ports and deterministic fakes.

use std::collections::BTreeMap;

use crate::domain::{
    ArtifactRef, HolmesDiagnostic, HolmesDiagnosticCode, HolmesResult, HolmesSeverity,
};

/// Deterministic timestamp value supplied through a clock port.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Timestamp {
    /// Stable timestamp text.
    pub value: String,
}

impl Timestamp {
    /// Create a timestamp from stable text.
    pub fn new(value: impl Into<String>) -> Self {
        Self {
            value: value.into(),
        }
    }
}

/// Port for deterministic time access.
pub trait ClockPort {
    /// Return the current timestamp according to this clock.
    fn now(&self) -> Timestamp;
}

/// Clock implementation that always returns the same timestamp.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixedClock {
    now: Timestamp,
}

impl FixedClock {
    /// Create a fixed clock.
    pub fn new(now: Timestamp) -> Self {
        Self { now }
    }
}

impl ClockPort for FixedClock {
    fn now(&self) -> Timestamp {
        self.now.clone()
    }
}

/// Port for loading artifact bytes.
pub trait ArtifactLoadPort {
    /// Load an artifact reference.
    fn read_artifact(&self, artifact: &ArtifactRef) -> HolmesResult<Vec<u8>>;
}

/// Port for writing artifact bytes.
pub trait ArtifactWritePort {
    /// Write artifact bytes to a workspace-relative path.
    fn write_artifact(&mut self, path: &str, bytes: &[u8]) -> HolmesResult<()>;
}

/// Port for workspace-local byte-oriented filesystem access.
pub trait FilesystemPort {
    /// Read bytes from a workspace-relative file.
    fn read_workspace_file(&self, path: &str) -> HolmesResult<Vec<u8>>;

    /// Write bytes to a workspace-relative file.
    fn write_workspace_file(&mut self, path: &str, bytes: &[u8]) -> HolmesResult<()>;
}

/// In-memory artifact store for deterministic tests.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct InMemoryArtifactStore {
    artifacts: BTreeMap<String, Vec<u8>>,
    writes: BTreeMap<String, Vec<u8>>,
}

impl InMemoryArtifactStore {
    /// Insert a readable artifact.
    pub fn insert(&mut self, path: impl Into<String>, bytes: impl Into<Vec<u8>>) {
        self.artifacts.insert(path.into(), bytes.into());
    }

    /// Return bytes written to a path.
    pub fn written(&self, path: &str) -> Option<&[u8]> {
        self.writes.get(path).map(Vec::as_slice)
    }
}

impl ArtifactLoadPort for InMemoryArtifactStore {
    fn read_artifact(&self, artifact: &ArtifactRef) -> HolmesResult<Vec<u8>> {
        self.artifacts.get(&artifact.path).cloned().ok_or_else(|| {
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawArtifactUnavailable,
                HolmesSeverity::Error,
                format!("artifact {:?} is unavailable", artifact.path),
            )
            .at_field("path")
        })
    }
}

impl ArtifactWritePort for InMemoryArtifactStore {
    fn write_artifact(&mut self, path: &str, bytes: &[u8]) -> HolmesResult<()> {
        let data = bytes.to_vec();
        self.writes.insert(path.to_owned(), data.clone());
        self.artifacts.insert(path.to_owned(), data);
        Ok(())
    }
}

impl FilesystemPort for InMemoryArtifactStore {
    fn read_workspace_file(&self, path: &str) -> HolmesResult<Vec<u8>> {
        self.artifacts.get(path).cloned().ok_or_else(|| {
            HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawArtifactUnavailable,
                HolmesSeverity::Error,
                format!("workspace file {path:?} is unavailable"),
            )
            .at_field("path")
        })
    }

    fn write_workspace_file(&mut self, path: &str, bytes: &[u8]) -> HolmesResult<()> {
        let data = bytes.to_vec();
        self.writes.insert(path.to_owned(), data.clone());
        self.artifacts.insert(path.to_owned(), data);
        Ok(())
    }
}

/// Port for publishing GitHub PR comments or review summaries.
pub trait GithubPublishPort {
    /// Publish a PR-facing comment body.
    fn publish_pr_comment(&mut self, body: &str) -> HolmesResult<()>;
}

/// Recording GitHub publisher fake.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RecordingGithubPublisher {
    comments: Vec<String>,
}

impl RecordingGithubPublisher {
    /// Return recorded comment bodies.
    pub fn comments(&self) -> &[String] {
        &self.comments
    }
}

impl GithubPublishPort for RecordingGithubPublisher {
    fn publish_pr_comment(&mut self, body: &str) -> HolmesResult<()> {
        self.comments.push(body.to_owned());
        Ok(())
    }
}

/// Port for registering MCP resources.
pub trait McpResourcePort {
    /// Register a named MCP resource payload.
    fn put_resource(&mut self, resource_id: &str, bytes: &[u8]) -> HolmesResult<()>;
}

/// In-memory MCP resource registry fake.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct InMemoryMcpResourceRegistry {
    resources: BTreeMap<String, Vec<u8>>,
}

impl InMemoryMcpResourceRegistry {
    /// Return bytes for a registered resource.
    pub fn resource(&self, resource_id: &str) -> Option<&[u8]> {
        self.resources.get(resource_id).map(Vec::as_slice)
    }
}

impl McpResourcePort for InMemoryMcpResourceRegistry {
    fn put_resource(&mut self, resource_id: &str, bytes: &[u8]) -> HolmesResult<()> {
        self.resources
            .insert(resource_id.to_owned(), bytes.to_vec());
        Ok(())
    }
}

/// Port for loading active policy bytes.
pub trait PolicyLoadPort {
    /// Load policy bytes from a workspace-relative path.
    fn load_policy(&self, path: &str) -> HolmesResult<Vec<u8>>;
}

/// Static policy loader fake.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StaticPolicyLoader {
    path: String,
    bytes: Vec<u8>,
}

impl StaticPolicyLoader {
    /// Create a static policy loader.
    pub fn new(path: impl Into<String>, bytes: impl Into<Vec<u8>>) -> Self {
        Self {
            path: path.into(),
            bytes: bytes.into(),
        }
    }
}

impl PolicyLoadPort for StaticPolicyLoader {
    fn load_policy(&self, path: &str) -> HolmesResult<Vec<u8>> {
        if path == self.path {
            Ok(self.bytes.clone())
        } else {
            Err(HolmesDiagnostic::new(
                HolmesDiagnosticCode::HlawArtifactUnavailable,
                HolmesSeverity::Error,
                format!("policy artifact {path:?} is unavailable"),
            )
            .at_field("path"))
        }
    }
}

/// Port for rendering report payloads.
pub trait ReportRenderPort {
    /// Render a report payload.
    fn render_report(&self, body: &str) -> HolmesResult<String>;
}

/// Deterministic report renderer fake that prefixes report bodies.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct EchoReportRenderer {
    prefix: String,
}

impl EchoReportRenderer {
    /// Create a report renderer with a static prefix.
    pub fn new(prefix: impl Into<String>) -> Self {
        Self {
            prefix: prefix.into(),
        }
    }
}

impl ReportRenderPort for EchoReportRenderer {
    fn render_report(&self, body: &str) -> HolmesResult<String> {
        Ok(format!("{}{body}", self.prefix))
    }
}

/// Port for command standard output and error streams.
pub trait CommandIoPort {
    /// Write standard output text.
    fn stdout(&mut self, text: &str);

    /// Write standard error text.
    fn stderr(&mut self, text: &str);
}

/// Command I/O fake that records output streams.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RecordingCommandIo {
    stdout: Vec<String>,
    stderr: Vec<String>,
}

impl RecordingCommandIo {
    /// Return recorded standard output writes.
    pub fn stdout_lines(&self) -> &[String] {
        &self.stdout
    }

    /// Return recorded standard error writes.
    pub fn stderr_lines(&self) -> &[String] {
        &self.stderr
    }
}

impl CommandIoPort for RecordingCommandIo {
    fn stdout(&mut self, text: &str) {
        self.stdout.push(text.to_owned());
    }

    fn stderr(&mut self, text: &str) {
        self.stderr.push(text.to_owned());
    }
}
