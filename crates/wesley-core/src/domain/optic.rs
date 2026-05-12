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
    /// Stable content hash for the full compiled artifact.
    pub artifact_hash: String,
    /// Stable schema identity derived from the lowered Wesley IR.
    pub schema_id: String,
    /// Stable digest of admission requirements and law claim templates.
    pub requirements_digest: String,
    /// The selected GraphQL operation compiled into an inspectable contract.
    pub operation: OpticOperation,
    /// Admission requirements Echo or another runtime must enforce.
    pub requirements: OpticAdmissionRequirements,
    /// Descriptor an application can present when registering this artifact.
    pub registration: OpticRegistrationDescriptor,
}

/// Wesley-produced descriptor for registering a compiled optic artifact.
///
/// This is not a runtime handle and it is not an authority grant. It is the
/// small descriptor an application can send to Echo alongside the full artifact
/// so Echo can verify the exact artifact hash and requirements digest it is
/// accepting into its registry.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpticRegistrationDescriptor {
    /// Stable artifact identity this descriptor refers to.
    pub artifact_id: String,
    /// Stable content hash for the full compiled artifact.
    pub artifact_hash: String,
    /// Stable schema identity for the referenced artifact.
    pub schema_id: String,
    /// Stable operation identity for the referenced artifact.
    pub operation_id: String,
    /// Stable digest of admission requirements and law claim templates.
    pub requirements_digest: String,
}

/// Echo-owned opaque handle for a registered optic artifact.
///
/// Wesley defines the wire shape so callers can name it, but Wesley does not
/// issue this handle. Echo or another runtime returns it after accepting and
/// storing a specific artifact hash.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpticArtifactHandle {
    /// Runtime-owned discriminator, normally `optic-artifact-handle`.
    pub kind: String,
    /// Runtime-local opaque handle identifier.
    pub id: String,
}

/// Admission requirements for an optic artifact.
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

/// Host, user, quorum, or policy authority grant for invoking an artifact.
///
/// Wesley core defines this shape so artifacts and runtime receipts can speak a
/// shared language, but Wesley does not issue these grants. A host, user,
/// quorum, or policy authority owns issuance, expiry, delegation, and
/// attestation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityGrant {
    /// Stable grant identity.
    pub grant_id: String,
    /// Principal receiving bounded authority.
    pub subject: PrincipalRef,
    /// Artifact hash this grant covers.
    pub artifact_hash: String,
    /// Operation identity this grant covers.
    pub operation_id: String,
    /// Requirements digest this grant covers.
    pub requirements_digest: String,
    /// Optional basis constraint for the invocation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_basis: Option<BasisConstraint>,
    /// Aperture constraints accepted by the grant.
    pub allowed_apertures: Vec<ApertureConstraint>,
    /// Budget constraint for invocations using the grant.
    pub budget: BudgetConstraint,
    /// Optional expiration timestamp supplied by the issuing authority.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    /// Rights granted under the artifact requirements.
    pub rights: Vec<String>,
    /// Principal or service that issued the grant.
    pub issuer: PrincipalRef,
    /// Optional signature supplied by the issuer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issuer_signature: Option<String>,
    /// Optional digest of the delegation chain.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delegation_chain_digest: Option<String>,
    /// Optional observer class bound by the grant.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observer_class: Option<ObserverClass>,
    /// Whether the grant may be transferred to another subject.
    pub non_transferable: bool,
}

/// Invocation-time presentation of a capability grant.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityPresentation {
    /// Grant identity being presented.
    pub grant_id: String,
    /// Principal presenting the grant.
    pub subject: PrincipalRef,
    /// Echo-owned artifact handle used for this invocation.
    pub artifact_handle_id: String,
    /// Operation identity being invoked.
    pub operation_id: String,
    /// Digest of the canonical variable bytes for this invocation.
    pub variables_digest: String,
    /// Optional digest of the requested basis/aperture.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basis_request_digest: Option<String>,
    /// Nonce preventing replay of the presentation.
    pub nonce: String,
    /// Presentation timestamp supplied by the caller or host.
    pub presented_at: String,
    /// Optional digest of a proof or signature over the presentation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof_digest: Option<String>,
}

/// Echo-owned authorization for one exact admitted invocation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdmissionTicket {
    /// Stable ticket identity.
    pub ticket_id: String,
    /// Echo-owned artifact handle used for this invocation.
    pub artifact_handle: OpticArtifactHandle,
    /// Capability grant identity admitted for this invocation.
    pub capability_grant_id: String,
    /// Operation identity admitted for this invocation.
    pub operation_id: String,
    /// Digest of invocation inputs admitted by the runtime.
    pub invocation_digest: String,
    /// Runtime-issued admission timestamp.
    pub issued_at: String,
    /// Optional runtime-issued ticket expiry.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

/// Constraint over the state basis allowed by a capability grant.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BasisConstraint {
    /// Optional exact basis reference the grant permits.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basis_ref: Option<String>,
    /// Optional maximum staleness in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_staleness_ms: Option<u64>,
}

/// Constraint over a read or rewrite aperture.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApertureConstraint {
    /// Aperture kind, such as `file_range` or `symbol_context`.
    pub kind: String,
    /// Optional numeric limit owned by the host/runtime policy.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
}

/// Budget constraint attached to a capability grant.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BudgetConstraint {
    /// Optional maximum operation count.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_operations: Option<u64>,
    /// Optional maximum byte budget.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_bytes: Option<u64>,
    /// Optional maximum runtime in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_millis: Option<u64>,
}

/// Observer class bound by a capability grant.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ObserverClass {
    /// No runtime observation rights.
    Oc0,
    /// Minimal reading rights.
    Oc1,
    /// Bounded runtime observation rights.
    Oc2,
    /// Broad runtime observation rights under explicit policy.
    Oc3,
}

/// Permission granted by a capability grant.
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

/// Artifact resolver input accepted by Wesley-side registries.
pub type OpticArtifactRef = OpticRegistrationDescriptor;

/// Resolves compiled optic artifacts from registration descriptors.
pub trait OpticArtifactResolver {
    /// Resolves a registration descriptor to its full compiled artifact and
    /// verifies the descriptor still matches artifact identity and requirements.
    fn resolve_optic_artifact(
        &self,
        registration: &OpticRegistrationDescriptor,
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

    /// Stores an artifact and returns its registration descriptor.
    pub fn insert(&mut self, artifact: OpticArtifact) -> OpticRegistrationDescriptor {
        let registration = artifact.registration.clone();
        self.artifacts
            .insert(artifact.artifact_id.clone(), artifact);
        registration
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
        registration: &OpticRegistrationDescriptor,
    ) -> Result<OpticArtifact, ResolveError> {
        let artifact = self
            .artifacts
            .get(&registration.artifact_id)
            .ok_or_else(|| ResolveError::ArtifactNotFound {
                artifact_id: registration.artifact_id.clone(),
            })?;
        verify_registration_matches_artifact(registration, artifact)?;
        Ok(artifact.clone())
    }
}

fn verify_registration_matches_artifact(
    registration: &OpticRegistrationDescriptor,
    artifact: &OpticArtifact,
) -> Result<(), ResolveError> {
    if registration.artifact_id != artifact.artifact_id {
        return Err(ResolveError::ArtifactIdMismatch {
            expected: artifact.artifact_id.clone(),
            actual: registration.artifact_id.clone(),
        });
    }

    if registration.artifact_hash != artifact.artifact_hash {
        return Err(ResolveError::ArtifactHashMismatch {
            expected: artifact.artifact_hash.clone(),
            actual: registration.artifact_hash.clone(),
        });
    }

    if registration.schema_id != artifact.schema_id {
        return Err(ResolveError::SchemaIdMismatch {
            expected: artifact.schema_id.clone(),
            actual: registration.schema_id.clone(),
        });
    }

    if registration.operation_id != artifact.operation.operation_id {
        return Err(ResolveError::OperationIdMismatch {
            expected: artifact.operation.operation_id.clone(),
            actual: registration.operation_id.clone(),
        });
    }

    if registration.requirements_digest != artifact.requirements_digest {
        return Err(ResolveError::RequirementsDigestMismatch {
            expected: artifact.requirements_digest.clone(),
            actual: registration.requirements_digest.clone(),
        });
    }

    Ok(())
}

/// Error raised when an optic artifact reference cannot resolve cleanly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolveError {
    /// No artifact exists for the referenced artifact identity.
    ArtifactNotFound {
        /// Artifact identity requested by the descriptor.
        artifact_id: String,
    },
    /// The supplied artifact id does not match the stored artifact.
    ArtifactIdMismatch {
        /// Artifact id expected by the stored artifact.
        expected: String,
        /// Artifact id supplied by the caller.
        actual: String,
    },
    /// The supplied artifact hash does not match the stored artifact.
    ArtifactHashMismatch {
        /// Artifact hash expected by the stored artifact.
        expected: String,
        /// Artifact hash supplied by the caller.
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
    /// The supplied requirements digest does not match the stored artifact.
    RequirementsDigestMismatch {
        /// Requirements digest expected by the stored artifact.
        expected: String,
        /// Requirements digest supplied by the caller.
        actual: String,
    },
}

impl fmt::Display for ResolveError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResolveError::ArtifactNotFound { artifact_id } => {
                write!(formatter, "optic artifact '{artifact_id}' was not found")
            }
            ResolveError::ArtifactIdMismatch { expected, actual } => write!(
                formatter,
                "optic artifact id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::ArtifactHashMismatch { expected, actual } => write!(
                formatter,
                "optic artifact hash mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::SchemaIdMismatch { expected, actual } => write!(
                formatter,
                "optic schema id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::OperationIdMismatch { expected, actual } => write!(
                formatter,
                "optic operation id mismatch: expected '{expected}', got '{actual}'"
            ),
            ResolveError::RequirementsDigestMismatch { expected, actual } => write!(
                formatter,
                "optic requirements digest mismatch: expected '{expected}', got '{actual}'"
            ),
        }
    }
}

impl std::error::Error for ResolveError {}

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
