//! Runtime optic artifact models.
//!
//! These types are intentionally domain-empty. They describe the GraphQL
//! operation shape, declared bounds, and law claims that a host/runtime can
//! admit, obstruct, witness, or replay.

use crate::domain::ir::TypeReference;
use crate::domain::operation::OperationType;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;

/// Compiled contract for one runtime-declared GraphQL optic operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OpticArtifact {
    /// Stable artifact identity derived from the schema and operation identity.
    pub artifact_id: String,
    /// Stable schema identity derived from the lowered Wesley IR.
    pub schema_id: String,
    /// The selected GraphQL operation compiled into an inspectable contract.
    pub operation: OpticOperation,
    /// Portable handle for referring to this artifact across process boundaries.
    pub handle: OpticArtifactHandle,
}

/// Portable reference to a compiled optic artifact.
///
/// The handle is not an authority grant. It carries stable artifact identity
/// plus the admission requirements a host or session layer must satisfy before
/// using the artifact.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpticArtifactHandle {
    /// Stable handle identity derived from artifact identity and requirements.
    pub handle_id: String,
    /// Stable artifact identity this handle refers to.
    pub artifact_id: String,
    /// Stable schema identity for the referenced artifact.
    pub schema_id: String,
    /// Stable operation identity for the referenced artifact.
    pub operation_id: String,
    /// Admission requirements attached to the handle.
    pub requirements: OpticAdmissionRequirements,
}

/// Admission requirements for an optic artifact or handle.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpticAdmissionRequirements {
    /// Identity binding required before a host/runtime admits the handle.
    pub identity: IdentityRequirement,
    /// Permission requirements inferred from the declared optic bounds.
    pub required_permissions: Vec<PermissionRequirement>,
    /// Resource labels that must remain inaccessible to the operation.
    pub forbidden_resources: Vec<String>,
}

/// Host/session-issued admission object for using a compiled optic artifact.
///
/// Wesley core defines this shape so artifacts and runtime receipts can speak a
/// shared language, but Wesley does not issue these handles. A host, runtime,
/// or session authority owns issuance, policy checks, expiry, and attestation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IssuedOpticHandle {
    /// Stable identity for the issued admission object.
    pub issued_handle_id: String,
    /// Compiler-produced artifact handle this issued object admits.
    pub artifact_handle: OpticArtifactHandle,
    /// Principal bound by the issuing host/session layer.
    pub bound_principal: PrincipalRef,
    /// Principal or service that issued the admission object.
    pub issuer: PrincipalRef,
    /// Intended audiences for the issued handle.
    pub audience: Vec<String>,
    /// Issuance timestamp supplied by the host/session layer.
    pub issued_at: String,
    /// Optional expiration timestamp supplied by the host/session layer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    /// Permissions actually granted by the issuing host/session layer.
    pub granted_permissions: Vec<PermissionGrant>,
    /// Optional digest of the policy artifact used for issuance.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy_digest: Option<String>,
    /// Optional digest of the issuance attestation or signature.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attestation_digest: Option<String>,
}

/// Identity requirement a host/runtime must satisfy before admission.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IdentityRequirement {
    /// Whether the host/runtime must bind a principal before admission.
    pub required: bool,
    /// Accepted principal kinds, or empty when host policy owns the vocabulary.
    pub accepted_principal_kinds: Vec<String>,
}

/// Opaque principal reference supplied by a host/session layer.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrincipalRef {
    /// Principal namespace, such as `user`, `agent`, `session`, or `service`.
    pub kind: String,
    /// Principal identifier inside the namespace.
    pub id: String,
}

/// Permission requirement inferred from an optic declaration.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequirement {
    /// Required action.
    pub action: PermissionAction,
    /// Resource label the action applies to.
    pub resource: String,
    /// Compiler source of the requirement.
    pub source: String,
}

/// Permission action required for an optic resource label.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PermissionAction {
    /// Read access is required.
    Read,
    /// Write access is required.
    Write,
}

/// Permission granted by a host/session-issued optic handle.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionGrant {
    /// Granted action.
    pub action: PermissionAction,
    /// Resource label the grant applies to.
    pub resource: String,
    /// Host/session-owned source of the grant.
    pub source: String,
}

/// Resolves compiled optic artifacts from portable handles.
pub trait OpticArtifactResolver {
    /// Resolves a handle to its full compiled artifact and verifies the handle
    /// still matches artifact identity and admission requirements.
    fn resolve_optic_artifact(
        &self,
        handle: &OpticArtifactHandle,
    ) -> Result<OpticArtifact, ResolveError>;
}

/// In-memory artifact registry for tests and single-process hosts.
#[derive(Debug, Default, Clone)]
pub struct InMemoryOpticArtifactRegistry {
    artifacts: BTreeMap<String, OpticArtifact>,
}

impl InMemoryOpticArtifactRegistry {
    /// Creates an empty registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Stores an artifact and returns its portable handle.
    pub fn insert(&mut self, artifact: OpticArtifact) -> OpticArtifactHandle {
        let handle = artifact.handle.clone();
        self.artifacts
            .insert(artifact.artifact_id.clone(), artifact);
        handle
    }

    /// Returns the number of stored artifacts.
    pub fn len(&self) -> usize {
        self.artifacts.len()
    }

    /// Returns true when no artifacts are stored.
    pub fn is_empty(&self) -> bool {
        self.artifacts.is_empty()
    }
}

impl OpticArtifactResolver for InMemoryOpticArtifactRegistry {
    fn resolve_optic_artifact(
        &self,
        handle: &OpticArtifactHandle,
    ) -> Result<OpticArtifact, ResolveError> {
        let artifact = self.artifacts.get(&handle.artifact_id).ok_or_else(|| {
            ResolveError::ArtifactNotFound {
                artifact_id: handle.artifact_id.clone(),
            }
        })?;
        verify_handle_matches_artifact(handle, artifact)?;
        Ok(artifact.clone())
    }
}

fn verify_handle_matches_artifact(
    handle: &OpticArtifactHandle,
    artifact: &OpticArtifact,
) -> Result<(), ResolveError> {
    if handle.handle_id != artifact.handle.handle_id {
        return Err(ResolveError::HandleIdMismatch {
            expected: artifact.handle.handle_id.clone(),
            actual: handle.handle_id.clone(),
        });
    }

    if handle.artifact_id != artifact.artifact_id {
        return Err(ResolveError::ArtifactIdMismatch {
            expected: artifact.artifact_id.clone(),
            actual: handle.artifact_id.clone(),
        });
    }

    if handle.schema_id != artifact.schema_id {
        return Err(ResolveError::SchemaIdMismatch {
            expected: artifact.schema_id.clone(),
            actual: handle.schema_id.clone(),
        });
    }

    if handle.operation_id != artifact.operation.operation_id {
        return Err(ResolveError::OperationIdMismatch {
            expected: artifact.operation.operation_id.clone(),
            actual: handle.operation_id.clone(),
        });
    }

    if handle.requirements != artifact.handle.requirements {
        return Err(ResolveError::AdmissionRequirementsMismatch {
            artifact_id: artifact.artifact_id.clone(),
        });
    }

    Ok(())
}

/// Error raised when an optic artifact handle cannot resolve cleanly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolveError {
    /// No artifact exists for the handle's artifact identity.
    ArtifactNotFound {
        /// Artifact identity requested by the handle.
        artifact_id: String,
    },
    /// The supplied handle id does not match the stored artifact handle.
    HandleIdMismatch {
        /// Handle id expected by the stored artifact.
        expected: String,
        /// Handle id supplied by the caller.
        actual: String,
    },
    /// The supplied artifact id does not match the stored artifact.
    ArtifactIdMismatch {
        /// Artifact id expected by the stored artifact.
        expected: String,
        /// Artifact id supplied by the caller.
        actual: String,
    },
    /// The supplied schema id does not match the stored artifact.
    SchemaIdMismatch {
        /// Schema id expected by the stored artifact.
        expected: String,
        /// Schema id supplied by the caller.
        actual: String,
    },
    /// The supplied operation id does not match the stored artifact.
    OperationIdMismatch {
        /// Operation id expected by the stored artifact.
        expected: String,
        /// Operation id supplied by the caller.
        actual: String,
    },
    /// Admission requirements no longer match the stored artifact handle.
    AdmissionRequirementsMismatch {
        /// Artifact identity whose requirements did not match.
        artifact_id: String,
    },
}

impl fmt::Display for ResolveError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResolveError::ArtifactNotFound { artifact_id } => {
                write!(formatter, "optic artifact '{artifact_id}' was not found")
            }
            ResolveError::HandleIdMismatch { expected, actual } => write!(
                formatter,
                "optic handle id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::ArtifactIdMismatch { expected, actual } => write!(
                formatter,
                "optic artifact id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::SchemaIdMismatch { expected, actual } => write!(
                formatter,
                "optic schema id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::OperationIdMismatch { expected, actual } => write!(
                formatter,
                "optic operation id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::AdmissionRequirementsMismatch { artifact_id } => write!(
                formatter,
                "optic admission requirements mismatch for artifact '{artifact_id}'"
            ),
        }
    }
}

impl std::error::Error for ResolveError {}

/// Inspectable contract for a selected GraphQL operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OpticOperation {
    /// Stable operation identity derived from the selected operation shape.
    pub operation_id: String,
    /// Optional GraphQL operation name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// GraphQL operation kind.
    pub kind: OperationKind,
    /// Root schema field selected by the operation.
    pub root_field: String,
    /// Codec shape for the operation variables or root field arguments.
    pub variable_shape: CodecShape,
    /// Codec shape for the selected response payload.
    pub payload_shape: CodecShape,
    /// Directives preserved from the executable operation.
    pub directives: Vec<DirectiveRecord>,
    /// Declared resource footprint, when the operation supplies one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub declared_footprint: Option<Footprint>,
    /// Compiler-produced templates for laws relevant to this operation.
    pub law_claims: Vec<LawClaimTemplate>,
}

/// GraphQL executable operation kind.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OperationKind {
    /// GraphQL query operation.
    Query,
    /// GraphQL mutation operation.
    Mutation,
    /// GraphQL subscription operation.
    Subscription,
}

impl From<OperationType> for OperationKind {
    fn from(value: OperationType) -> Self {
        match value {
            OperationType::Query => OperationKind::Query,
            OperationType::Mutation => OperationKind::Mutation,
            OperationType::Subscription => OperationKind::Subscription,
        }
    }
}

impl From<OperationKind> for OperationType {
    fn from(value: OperationKind) -> Self {
        match value {
            OperationKind::Query => OperationType::Query,
            OperationKind::Mutation => OperationType::Mutation,
            OperationKind::Subscription => OperationType::Subscription,
        }
    }
}

/// Named codec view for variables or payload data.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodecShape {
    /// Logical shape name.
    pub type_name: String,
    /// Fields visible inside the shape.
    pub fields: Vec<CodecField>,
}

/// One field inside a codec shape.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodecField {
    /// Field name or selected response path.
    pub name: String,
    /// GraphQL type reference for the field.
    pub type_ref: TypeReference,
    /// Whether the field is non-null in the GraphQL type system.
    pub required: bool,
    /// Whether the field has an outer or nested list wrapper.
    pub list: bool,
}

/// Directive preserved from a compiled executable operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveRecord {
    /// Schema coordinate or operation coordinate where the directive was found.
    pub coordinate: String,
    /// Directive name without the `@` prefix.
    pub name: String,
    /// Canonical JSON object containing the directive arguments.
    pub arguments_canonical_json: String,
}

/// Declared resource families an operation may read, write, or must not touch.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Footprint {
    /// Resource labels the operation declares it may read.
    pub reads: Vec<String>,
    /// Resource labels the operation declares it may write.
    pub writes: Vec<String>,
    /// Resource labels the operation declares forbidden.
    pub forbids: Vec<String>,
}

/// Compiler-produced declaration that a law is relevant to an operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LawClaimTemplate {
    /// Stable law identifier.
    pub law_id: String,
    /// Stable claim identity for this operation and law pairing.
    pub claim_id: String,
    /// Operation identity this claim applies to.
    pub operation_id: String,
    /// Evidence categories a runtime or verifier should produce.
    pub required_evidence: Vec<EvidenceKind>,
}

/// Evidence category requested by a law claim template.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EvidenceKind {
    /// Evidence produced by the Wesley compiler.
    Compiler,
    /// Evidence produced by codec inspection or fixture vectors.
    Codec,
    /// Evidence produced by host/runtime policy.
    HostPolicy,
    /// Evidence produced from runtime trace data.
    RuntimeTrace,
    /// Evidence produced by a domain verifier outside Wesley core.
    DomainVerifier,
}

/// Runtime or verifier-produced verdict for one law claim.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LawWitness {
    /// Stable law identifier.
    pub law_id: String,
    /// Claim identity this witness evaluates.
    pub claim_id: String,
    /// Optional state basis reference evaluated by the checker.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basis_ref: Option<String>,
    /// Identifier for the checker that produced the verdict.
    pub checker_id: String,
    /// Optional hash of the checker artifact.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checker_artifact_hash: Option<String>,
    /// Verdict for the law claim.
    pub verdict: LawVerdict,
    /// Digests of evidence artifacts considered by the checker.
    pub evidence_digests: Vec<String>,
    /// Optional digest of the runtime trace considered by the checker.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_trace_digest: Option<String>,
    /// Optional reason for an obstructed verdict.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub obstruction_reason: Option<String>,
    /// Replay hints supplied by the runtime or verifier.
    pub replay_hints: Vec<ReplayHint>,
}

/// Verdict produced for a law claim.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LawVerdict {
    /// The checker found the law satisfied.
    Satisfied,
    /// The checker found a concrete obstruction.
    Obstructed,
    /// The checker cannot establish satisfaction or obstruction.
    Unknown,
}

/// Hint that helps a runtime replay or inspect a witnessed interaction.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReplayHint {
    /// Hint kind, such as `trace`, `basis`, or `artifact`.
    pub kind: String,
    /// Hint value, intentionally opaque to Wesley core.
    pub value: String,
}
