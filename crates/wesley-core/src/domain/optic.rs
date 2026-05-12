//! Runtime optic artifact models.
//!
//! These types are intentionally domain-empty. They describe the GraphQL
//! operation shape, declared bounds, and law claims that a host/runtime can
//! admit, obstruct, witness, or replay.

use crate::domain::ir::TypeReference;
use crate::domain::operation::OperationType;
use serde::{Deserialize, Serialize};

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
/// plus the admission-facing security requirements a host or session layer must
/// satisfy before using the artifact.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OpticArtifactHandle {
    /// Stable handle identity derived from artifact identity and security context.
    pub handle_id: String,
    /// Stable artifact identity this handle refers to.
    pub artifact_id: String,
    /// Stable schema identity for the referenced artifact.
    pub schema_id: String,
    /// Stable operation identity for the referenced artifact.
    pub operation_id: String,
    /// Admission-facing security requirements attached to the handle.
    pub security: OpticSecurityContext,
}

/// Admission-facing security requirements for an optic artifact or handle.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpticSecurityContext {
    /// Identity binding required before a host/runtime admits the handle.
    pub identity: IdentityRequirement,
    /// Principal the handle is bound to, if a host/session layer has issued one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bound_principal: Option<PrincipalRef>,
    /// Issuer that bound this handle, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issuer: Option<PrincipalRef>,
    /// Permission requirements inferred from the declared optic bounds.
    pub required_permissions: Vec<PermissionRequirement>,
    /// Resource labels that must remain inaccessible to the operation.
    pub forbidden_resources: Vec<String>,
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
