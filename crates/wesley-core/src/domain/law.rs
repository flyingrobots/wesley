//! `weslaw` semantic Law IR v1.
//!
//! This module owns the first typed Rust substrate for `weslaw/v1` authoring
//! documents and the normalized `wesley.law-ir/v1` representation.

use std::collections::{BTreeMap, BTreeSet, HashSet};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use yaml_rust2::yaml::Hash as Mapping;
use yaml_rust2::{Yaml, YamlLoader};

use super::ir::{
    compute_content_hash, compute_registry_hash, to_canonical_json, Field, TypeDefinition,
    TypeKind, WesleyIR,
};
use super::operation::{OperationType, SchemaOperation};

/// Authored `weslaw` document API version accepted by the v1 loader.
pub const WESLAW_API_VERSION: &str = "weslaw/v1";

/// Normalized Wesley Law IR API version emitted by the v1 loader.
pub const WESLEY_LAW_IR_API_VERSION: &str = "wesley.law-ir/v1";

/// Canonical JSON codec name for future Law IR hashing.
pub const WESLEY_LAW_IR_CANONICAL_JSON_CODEC: &str = "wesley.law-ir.canonical-json.v1";

/// Contract bundle manifest API version emitted by the v1 hash path.
pub const WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION: &str = "wesley.contract-bundle-manifest/v1";

/// Contract bundle canonical hash input codec.
pub const WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC: &str =
    "wesley.contract-bundle.hash-input.canonical-json.v1";

/// Empty policy/profile API version used until Policy IR exists.
pub const WESLEY_EMPTY_PROFILE_API_VERSION: &str = "wesley.policy-profile.empty/v1";

/// Law diff report API version emitted by the first semantic diff model.
pub const WESLEY_LAW_DIFF_API_VERSION: &str = "wesley.law-diff/v1";

/// Diagnostic codes emitted by the `weslaw/v1` structure loader.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WeslawDiagnosticCode {
    /// The document could not be parsed as YAML.
    ParseError,
    /// The document used an unsupported `apiVersion`.
    UnsupportedApiVersion,
    /// The document shape was invalid for `weslaw/v1`.
    InvalidDocument,
    /// More than one active law entry used the same id.
    DuplicateId,
    /// An invariant used a raw string expression instead of a typed predicate.
    RawExprRejected,
    /// A law entry used a kind outside the closed v1 sum type.
    UnknownKind,
    /// A document object contained a field outside the v1 schema.
    UnknownField,
    /// A schema hash anchor did not match the active Shape IR hash.
    SchemaHashMismatch,
    /// A subject coordinate did not use the accepted v1 grammar.
    InvalidCoordinate,
    /// A subject coordinate did not resolve against Shape IR or law registries.
    UnresolvedSubject,
    /// A referenced field, enum value, argument path, resource, or verifier did not bind.
    UnresolvedReference,
    /// A law entry kind was not valid for the resolved subject kind.
    WrongSubjectKind,
    /// Active laws or their internal clauses contradicted each other.
    Conflict,
}

impl WeslawDiagnosticCode {
    /// Returns the stable external diagnostic code.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ParseError => "WESLAW_PARSE_ERROR",
            Self::UnsupportedApiVersion => "WESLAW_UNSUPPORTED_API_VERSION",
            Self::InvalidDocument => "WESLAW_INVALID_DOCUMENT",
            Self::DuplicateId => "WESLAW_DUPLICATE_ID",
            Self::RawExprRejected => "WESLAW_RAW_EXPR_REJECTED",
            Self::UnknownKind => "WESLAW_UNKNOWN_KIND",
            Self::UnknownField => "WESLAW_UNKNOWN_FIELD",
            Self::SchemaHashMismatch => "WESLAW_SCHEMA_HASH_MISMATCH",
            Self::InvalidCoordinate => "WESLAW_INVALID_COORDINATE",
            Self::UnresolvedSubject => "WESLAW_UNRESOLVED_SUBJECT",
            Self::UnresolvedReference => "WESLAW_UNRESOLVED_REFERENCE",
            Self::WrongSubjectKind => "WESLAW_WRONG_SUBJECT_KIND",
            Self::Conflict => "WESLAW_CONFLICT",
        }
    }
}

/// Error returned by `weslaw/v1` structure loading.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{code:?}: {message}")]
pub struct WeslawError {
    /// Stable diagnostic code.
    pub code: WeslawDiagnosticCode,
    /// Human-readable diagnostic summary.
    pub message: String,
    /// Dot path to the invalid field when known.
    pub path: Option<String>,
}

impl WeslawError {
    fn new(code: WeslawDiagnosticCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            path: None,
        }
    }

    fn at_path(
        code: WeslawDiagnosticCode,
        path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            message: message.into(),
            path: Some(path.into()),
        }
    }
}

/// Normalized Law IR v1 document.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LawIrV1 {
    /// Law IR API version. Always `wesley.law-ir/v1` for this struct.
    pub api_version: String,
    /// Contract family identity from the authored schema anchor.
    pub family: String,
    /// Canonical schema hash anchor supplied by the authored document.
    pub schema_hash: String,
    /// Optional authored schema source path.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_source: Option<String>,
    /// Non-shape registries visible to Law IR entries.
    pub registries: LawRegistrySetV1,
    /// Normalized active law entries.
    pub entries: Vec<LawEntryV1>,
}

/// Non-shape registries declared by a `weslaw/v1` document.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LawRegistrySetV1 {
    /// Declared runtime/resource/evidence domain ids.
    pub resources: Vec<ResourceRegistryEntryV1>,
    /// Declared external verifier ids.
    pub verifiers: Vec<VerifierRegistryEntryV1>,
    /// Declared non-shape channel ids.
    pub channels: Vec<ChannelRegistryEntryV1>,
}

/// Resource registry entry for non-shape footprint and evidence symbols.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResourceRegistryEntryV1 {
    /// Stable resource id.
    pub id: String,
    /// Owning module, product, or family.
    pub owner: String,
    /// Resource category.
    pub kind: String,
    /// Optional notes retained outside semantic hashes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/// Verifier registry entry for externally checked predicates.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerifierRegistryEntryV1 {
    /// Stable verifier id.
    pub id: String,
    /// Owning module, product, or family.
    pub owner: String,
    /// Accepted input contract ids.
    pub input_contracts: Vec<String>,
}

/// Channel registry entry for non-shape protocol subjects.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChannelRegistryEntryV1 {
    /// Stable channel name.
    pub name: String,
    /// Channel version.
    pub version: u64,
    /// Carrier or transport family.
    pub carrier: String,
}

/// Common normalized Law IR entry.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LawEntryV1 {
    /// Stable law id.
    pub id: String,
    /// Active or draft law status.
    pub status: LawStatusV1,
    /// Closed v1 law kind.
    pub kind: LawKindV1,
    /// Subject coordinate governed by this law.
    pub subject: String,
    /// Optional classifier tags.
    pub tags: Vec<String>,
    /// Optional prose rationale excluded from semantic law hashing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    /// Kind-specific law body.
    pub body: LawEntryBodyV1,
}

/// Law entry lifecycle state.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LawStatusV1 {
    /// Authoritative law included in active compilation.
    #[default]
    Active,
    /// Draft law retained for review but not active compilation.
    Draft,
}

/// Closed Law IR v1 kind set.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LawKindV1 {
    /// Scalar representation and interpretation law.
    ScalarSemantics,
    /// Discriminated input/envelope variant law.
    VariantLaw,
    /// Operation footprint and resource effect law.
    FootprintLaw,
    /// Protocol/channel law.
    ChannelLaw,
    /// Typed invariant law.
    InvariantLaw,
}

/// Kind-specific normalized Law IR v1 body.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(untagged)]
pub enum LawEntryBodyV1 {
    /// Scalar semantics body.
    ScalarSemantics(ScalarSemanticsLawV1),
    /// Variant law body.
    VariantLaw(VariantLawV1),
    /// Footprint law body.
    FootprintLaw(FootprintLawV1),
    /// Channel law body.
    ChannelLaw(ChannelLawV1),
    /// Invariant law body.
    InvariantLaw(InvariantLawV1),
}

/// Scalar semantics law body.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScalarSemanticsLawV1 {
    /// Scalar representation family.
    pub representation: ScalarRepresentationV1,
    /// Inclusive minimum value when the representation is numeric.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_inclusive: Option<u64>,
    /// Inclusive maximum value when the representation is numeric.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_inclusive: Option<u64>,
    /// Ordering semantics, when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ordering: Option<ScalarOrderingV1>,
    /// Scope semantics, when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    /// Forbidden interpretations for this scalar.
    pub forbids: Vec<ScalarForbiddenInterpretationV1>,
}

/// Scalar representation families accepted by Law IR v1.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ScalarRepresentationV1 {
    /// Integer representation.
    Integer,
    /// Opaque identifier representation.
    OpaqueIdentifier,
    /// String representation.
    String,
}

/// Closed scalar ordering vocabulary accepted by Law IR v1.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ScalarOrderingV1 {
    /// No ordering semantics are implied.
    #[serde(rename = "none")]
    None,
    /// Lamport-style logical ordering.
    Lamport,
    /// Total ordering semantics.
    Total,
    /// Partial ordering semantics.
    Partial,
}

/// Closed forbidden scalar interpretation enum.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum ScalarForbiddenInterpretationV1 {
    /// Generated code must not silently narrow the value to GraphQL signed int.
    #[serde(rename = "silentGraphQLIntNarrowing")]
    SilentGraphqlIntNarrowing,
}

/// Discriminated variant law body.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VariantLawV1 {
    /// Discriminator field and enum.
    pub discriminator: VariantDiscriminatorV1,
    /// Per-case requirements.
    pub cases: Vec<VariantCaseV1>,
}

/// Variant discriminator descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VariantDiscriminatorV1 {
    /// Discriminator field name.
    pub field: String,
    /// Discriminator enum name.
    pub r#enum: String,
}

/// Variant case law.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VariantCaseV1 {
    /// Enum value for this case.
    pub value: String,
    /// Required fields for this case.
    pub requires: Vec<String>,
    /// Forbidden fields for this case.
    pub forbids: Vec<String>,
}

/// Operation footprint law body.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FootprintLawV1 {
    /// Resource types read by the operation.
    pub reads: Vec<String>,
    /// Resource types written by the operation.
    pub writes: Vec<String>,
    /// Resource types created by the operation.
    pub creates: Vec<String>,
    /// Resource domains forbidden to the operation.
    pub forbids: Vec<String>,
    /// Bound input/resource slots.
    pub slots: Vec<FootprintSlotV1>,
    /// Closure-derived resource windows.
    pub closures: Vec<FootprintClosureV1>,
    /// Named create slots.
    pub create_slots: Vec<CreateSlotV1>,
    /// Field update surfaces.
    pub updates: Vec<FootprintUpdateV1>,
}

/// Footprint slot descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FootprintSlotV1 {
    /// Slot name.
    pub name: String,
    /// Resource kind bound to the slot.
    pub kind: String,
    /// Argument path that binds the slot.
    pub bind_from_arg: String,
    /// Access modes granted for this slot.
    pub access: Vec<String>,
}

/// Footprint closure descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FootprintClosureV1 {
    /// Closure slot name.
    pub name: String,
    /// Source slot.
    pub from_slot: String,
    /// Closure operator id.
    pub operator: String,
    /// Argument bindings passed to the operator.
    pub arg_bindings: Vec<String>,
    /// Resource kinds read by the closure.
    pub reads: Vec<String>,
    /// Cardinality label.
    pub cardinality: FootprintCardinalityV1,
}

/// Footprint create-slot descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateSlotV1 {
    /// Create slot name.
    pub name: String,
    /// Resource kind created for the slot.
    pub kind: String,
    /// Optional cardinality label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cardinality: Option<FootprintCardinalityV1>,
}

/// Closed footprint cardinality vocabulary accepted by Law IR v1.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FootprintCardinalityV1 {
    /// Exactly one resource.
    #[serde(rename = "one")]
    One,
    /// Zero or one resource.
    Optional,
    /// Zero or more resources.
    Many,
}

/// Footprint update descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FootprintUpdateV1 {
    /// Slot being updated.
    pub slot: String,
    /// Fields updated on that slot.
    pub fields: Vec<String>,
}

/// Channel law body.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChannelLawV1 {
    /// Whether the channel is ordered.
    pub ordered: bool,
    /// Channel version.
    pub version: u64,
    /// Optional compatibility posture.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compatibility: Option<ChannelCompatibilityV1>,
    /// Channel message fields.
    pub messages: Vec<ChannelMessageV1>,
}

/// Channel compatibility descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChannelCompatibilityV1 {
    /// Versioning family.
    pub versioning: String,
    /// Whether the channel version is coupled to semver.
    pub semver_coupled: bool,
}

/// Channel message descriptor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChannelMessageV1 {
    /// GraphQL field name carrying the message.
    pub field: String,
    /// GraphQL type name for the message payload.
    pub r#type: String,
}

/// Typed invariant law body.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InvariantLawV1 {
    /// Typed predicate for the invariant.
    pub predicate: PredicateV1,
}

/// Closed typed predicate set for Law IR v1 invariants.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "op")]
pub enum PredicateV1 {
    /// Checks a field against an exact JSON value.
    FieldEquals {
        /// Field name.
        field: String,
        /// Expected JSON value.
        value: serde_json::Value,
    },
    /// Delegates evaluation to a declared external verifier.
    External {
        /// Verifier id.
        verifier: String,
        /// External predicate reference.
        r#ref: String,
        /// Optional input contract id.
        #[serde(skip_serializing_if = "Option::is_none")]
        input_contract: Option<String>,
    },
}

/// Report emitted when active Law IR entries bind successfully.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LawBindingReportV1 {
    /// Active Shape IR hash used for this validation pass.
    pub schema_hash: String,
    /// Number of active entries bound against the Shape IR.
    pub bound_entry_count: usize,
}

/// Contract bundle manifest emitted after schema-bound Law IR validation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContractBundleManifestV1 {
    /// Manifest API version.
    pub api_version: String,
    /// Canonical Shape IR hash, prefixed with `sha256:`.
    pub schema_hash: String,
    /// Canonical active semantic Law IR hash.
    pub law_hash: String,
    /// Optional provenance-bearing law document hash.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_document_hash: Option<String>,
    /// Canonical policy/profile hash. v1 uses the known empty profile.
    pub profile_hash: String,
    /// Hash over schema, law, profile, compiler, and codec identities.
    pub bundle_hash: String,
    /// Law IR semantic byte codec.
    pub law_ir_codec: String,
    /// Bundle hash input codec.
    pub bundle_hash_codec: String,
    /// Compiler crate identity.
    pub compiler: String,
    /// Compiler crate version.
    pub compiler_version: String,
    /// Bound active Law IR entry count.
    pub law_entry_count: usize,
}

/// Hashes computed from a bound active Law IR document.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LawHashSetV1 {
    /// Canonical active semantic Law IR hash.
    pub law_hash: String,
    /// Provenance-bearing law document hash.
    pub law_document_hash: String,
}

/// Machine-readable semantic diff report for two Law IR v1 documents.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LawDiffReportV1 {
    /// Report API version.
    pub api_version: String,
    /// Old document schema hash anchor.
    pub old_schema_hash: String,
    /// New document schema hash anchor.
    pub new_schema_hash: String,
    /// Old semantic Law IR hash.
    pub old_law_hash: String,
    /// New semantic Law IR hash.
    pub new_law_hash: String,
    /// Semantic change events, sorted by law id and event kind.
    pub changes: Vec<LawDiffEventV1>,
}

/// Single semantic law diff event.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LawDiffEventV1 {
    /// Event classification.
    pub kind: LawDiffEventKindV1,
    /// Stable law id affected by the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_id: Option<String>,
    /// Subject coordinate affected by the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// Law kind affected by the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law_kind: Option<LawKindV1>,
    /// Review posture for this initial diff event.
    pub review_posture: LawDiffReviewPostureV1,
    /// Field-level changes when a law body changed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub field_changes: Vec<LawDiffFieldChangeV1>,
    /// Footprint resources newly read.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_reads: Vec<String>,
    /// Footprint resources no longer read.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_reads: Vec<String>,
    /// Footprint resources newly written.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_writes: Vec<String>,
    /// Footprint resources no longer written.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_writes: Vec<String>,
    /// Footprint resources newly created.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_creates: Vec<String>,
    /// Footprint resources no longer created.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_creates: Vec<String>,
    /// Footprint resources newly forbidden.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub added_forbids: Vec<String>,
    /// Footprint resources no longer forbidden.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_forbids: Vec<String>,
}

/// Law diff event classification.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LawDiffEventKindV1 {
    /// Bundle-level semantic fields changed.
    LawBundleChanged,
    /// Semantic registry facts changed.
    RegistryChanged,
    /// New active law entry.
    LawAdded,
    /// Active law entry removed.
    LawRemoved,
    /// Existing law tags changed.
    LawTagsChanged,
    /// Existing law was monotonically strengthened.
    LawStrengthened,
    /// Existing law was monotonically weakened.
    LawWeakened,
    /// Existing law changed outside a narrower v1 event class.
    LawChanged,
    /// Scalar semantic body changed.
    ScalarSemanticsChanged,
    /// Variant law body changed.
    VariantLawChanged,
    /// Footprint reach expanded.
    FootprintExpanded,
    /// Footprint reach contracted.
    FootprintContracted,
    /// Footprint changed in mixed or structural ways.
    FootprintChanged,
    /// Channel version changed.
    ChannelVersionChanged,
    /// Channel law changed without a channel-version change.
    ChannelLawChanged,
    /// Typed invariant predicate changed.
    PredicateChanged,
    /// A law no longer binds to the active schema or law registry.
    BindingBroken,
    /// Schema hash anchor changed.
    SchemaHashRebound,
}

/// Review posture for an initial semantic diff event.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum LawDiffReviewPostureV1 {
    /// The change requires human review.
    RequiresReview,
}

/// Field-level semantic law diff.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LawDiffFieldChangeV1 {
    /// Law body path that changed.
    pub path: String,
    /// Previous canonical value.
    pub old: serde_json::Value,
    /// New canonical value.
    pub new: serde_json::Value,
}

/// Loads an authored `weslaw/v1` YAML document into normalized Law IR v1.
pub fn load_weslaw_yaml(source: &str) -> Result<LawIrV1, WeslawError> {
    let documents = YamlLoader::load_from_str(source)
        .map_err(|err| WeslawError::new(WeslawDiagnosticCode::ParseError, err.to_string()))?;
    if documents.len() != 1 {
        return Err(WeslawError::new(
            WeslawDiagnosticCode::InvalidDocument,
            "weslaw/v1 documents must contain exactly one YAML document",
        ));
    }
    let document = &documents[0];
    let root = expect_mapping(document, "$")?;
    reject_unknown_fields(root, "$", &["apiVersion", "schema", "registries", "laws"])?;

    let api_version = required_string(root, "apiVersion", "$.apiVersion")?;
    if api_version != WESLAW_API_VERSION {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::UnsupportedApiVersion,
            "$.apiVersion",
            format!("unsupported weslaw apiVersion {api_version}"),
        ));
    }

    let schema = required_mapping(root, "schema", "$.schema")?;
    reject_unknown_fields(schema, "$.schema", &["family", "hash", "source"])?;
    let family = required_string(schema, "family", "$.schema.family")?;
    let schema_hash = required_string(schema, "hash", "$.schema.hash")?;
    validate_schema_hash_anchor(&schema_hash, "$.schema.hash")?;
    let schema_source = optional_string(schema, "source", "$.schema.source")?;

    let registries = match mapping_get(root, "registries") {
        Some(value) => parse_registries(expect_mapping(value, "$.registries")?)?,
        None => LawRegistrySetV1::default(),
    };

    let laws = required_sequence(root, "laws", "$.laws")?;
    let mut active_ids = HashSet::new();
    let mut entries = Vec::with_capacity(laws.len());
    for (index, law_value) in laws.iter().enumerate() {
        let path = format!("$.laws[{index}]");
        if let Some(entry) = parse_law_entry(law_value, &path)? {
            if !active_ids.insert(entry.id.clone()) {
                return Err(WeslawError::at_path(
                    WeslawDiagnosticCode::DuplicateId,
                    format!("{path}.id"),
                    format!("duplicate active law id {}", entry.id),
                ));
            }
            entries.push(entry);
        }
    }
    sort_law_ir_entries(&mut entries);

    Ok(LawIrV1 {
        api_version: WESLEY_LAW_IR_API_VERSION.to_string(),
        family,
        schema_hash,
        schema_source,
        registries,
        entries,
    })
}

/// Lowers formally known `@wes_channel` SDL directives into Law IR v1.
///
/// This is the first directive-authored law bridge: SDL remains the source of
/// structural shape, while the directive facts lower into the same canonical
/// Law IR used by authored `weslaw/v1` documents.
pub fn lower_wes_channel_directives_to_law_ir_v1(
    schema_ir: &WesleyIR,
    family: &str,
    schema_hash: &str,
    schema_source: Option<String>,
) -> Result<LawIrV1, WeslawError> {
    validate_schema_hash_anchor(schema_hash, "schemaHash")?;
    let mut entries = Vec::new();

    for definition in &schema_ir.types {
        let Some(directive) = definition.directives.get("wes_channel") else {
            continue;
        };
        if definition.kind != TypeKind::Object {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::WrongSubjectKind,
                format!("type:{}", definition.name),
                "@wes_channel may only lower from object types",
            ));
        }
        let name = directive_string_field(
            directive,
            "name",
            &format!("type:{}.@wes_channel.name", definition.name),
        )?;
        let version = directive_u64_field(
            directive,
            "version",
            &format!("type:{}.@wes_channel.version", definition.name),
        )?;
        let ordered = directive_bool_field(
            directive,
            "ordered",
            &format!("type:{}.@wes_channel.ordered", definition.name),
        )?;
        let subject = format!("channel:{name}@{version}");
        parse_subject_coordinate(&subject, &format!("type:{}.@wes_channel", definition.name))?;

        entries.push(LawEntryV1 {
            id: format!("directive.wes_channel.{name}.v{version}"),
            status: LawStatusV1::Active,
            kind: LawKindV1::ChannelLaw,
            subject,
            tags: Vec::new(),
            rationale: None,
            body: LawEntryBodyV1::ChannelLaw(ChannelLawV1 {
                ordered,
                version,
                compatibility: None,
                messages: definition
                    .fields
                    .iter()
                    .map(|field| ChannelMessageV1 {
                        field: field.name.clone(),
                        r#type: field.r#type.base.clone(),
                    })
                    .collect(),
            }),
        });
    }

    sort_law_ir_entries(&mut entries);

    Ok(LawIrV1 {
        api_version: WESLEY_LAW_IR_API_VERSION.to_string(),
        family: family.to_string(),
        schema_hash: schema_hash.to_string(),
        schema_source,
        registries: LawRegistrySetV1::default(),
        entries,
    })
}

/// Serializes Law IR v1 as canonical JSON for the public v1 representation.
///
/// This helper provides deterministic JSON bytes for `wesley.law-ir/v1`
/// exchange and fixture assertions. Semantic `lawHash` computation is stricter
/// and will be introduced separately because it excludes rationale and other
/// provenance-only fields.
pub fn to_canonical_law_ir_json(value: &LawIrV1) -> Result<String, serde_json::Error> {
    let mut normalized = value.clone();
    normalized
        .entries
        .retain(|entry| entry.status == LawStatusV1::Active);
    sort_law_ir_entries(&mut normalized.entries);
    to_canonical_json(&normalized)
}

/// Serializes canonical active semantic Law IR v1 bytes for `lawHash`.
///
/// The semantic form excludes authoring provenance such as `schemaSource`,
/// resource notes, entry status, and rationale prose. It sorts set-like arrays,
/// materializes v1 defaults, and preserves order-sensitive arrays such as
/// channel messages.
pub fn to_semantic_law_ir_json(value: &LawIrV1) -> Result<String, WeslawError> {
    let semantic = semantic_law_ir_value(value)?;
    to_canonical_json(&semantic).map_err(canonicalization_error)
}

/// Computes the `sha256:<hex>` hash over canonical active semantic Law IR v1.
pub fn compute_law_hash_v1(value: &LawIrV1) -> Result<String, WeslawError> {
    Ok(prefixed_sha256(&to_semantic_law_ir_json(value)?))
}

/// Computes law hashes from active semantic and provenance-bearing Law IR bytes.
pub fn compute_law_hash_set_v1(value: &LawIrV1) -> Result<LawHashSetV1, WeslawError> {
    let law_hash = compute_law_hash_v1(value)?;
    let document_json = to_canonical_law_ir_json(value).map_err(canonicalization_error)?;
    let law_document_hash = prefixed_sha256(&document_json);

    Ok(LawHashSetV1 {
        law_hash,
        law_document_hash,
    })
}

/// Builds the first contract bundle manifest after strict law binding succeeds.
pub fn build_contract_bundle_manifest_v1(
    law_ir: &LawIrV1,
    schema_ir: &WesleyIR,
    operations: &[SchemaOperation],
) -> Result<ContractBundleManifestV1, WeslawError> {
    let schema_hash =
        prefixed_sha256_hex(&compute_registry_hash(schema_ir).map_err(canonicalization_error)?);
    let binding = validate_law_ir_v1_bindings(law_ir, schema_ir, operations, &schema_hash)?;
    let law_hashes = compute_law_hash_set_v1(law_ir)?;
    let profile_hash = empty_profile_hash_v1()?;
    let bundle_hash = compute_bundle_hash_v1(
        &schema_hash,
        &law_hashes.law_hash,
        &profile_hash,
        WESLEY_LAW_IR_CANONICAL_JSON_CODEC,
        WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC,
        "wesley-core",
        env!("CARGO_PKG_VERSION"),
    )?;

    Ok(ContractBundleManifestV1 {
        api_version: WESLEY_CONTRACT_BUNDLE_MANIFEST_API_VERSION.to_string(),
        schema_hash,
        law_hash: law_hashes.law_hash,
        law_document_hash: Some(law_hashes.law_document_hash),
        profile_hash,
        bundle_hash,
        law_ir_codec: WESLEY_LAW_IR_CANONICAL_JSON_CODEC.to_string(),
        bundle_hash_codec: WESLEY_CONTRACT_BUNDLE_HASH_INPUT_CODEC.to_string(),
        compiler: "wesley-core".to_string(),
        compiler_version: env!("CARGO_PKG_VERSION").to_string(),
        law_entry_count: binding.bound_entry_count,
    })
}

/// Computes the first machine-readable semantic diff between two Law IR docs.
///
/// This function compares active semantic law, not authoring prose. Rationale,
/// source paths, resource notes, and draft law entries do not create diff
/// events because they do not affect `lawHash`.
pub fn diff_law_ir_v1(
    old_law_ir: &LawIrV1,
    new_law_ir: &LawIrV1,
) -> Result<LawDiffReportV1, WeslawError> {
    let old_entries = law_entry_index(&old_law_ir.entries, "$.old.entries")?;
    let new_entries = law_entry_index(&new_law_ir.entries, "$.new.entries")?;
    let old_law_hash = compute_law_hash_v1(old_law_ir)?;
    let new_law_hash = compute_law_hash_v1(new_law_ir)?;
    let mut changes = Vec::new();

    push_bundle_level_diff_events(old_law_ir, new_law_ir, &mut changes)?;

    for old_id in old_entries.keys() {
        if !new_entries.contains_key(old_id) {
            changes.push(law_lifecycle_event(
                LawDiffEventKindV1::LawRemoved,
                old_entries[old_id],
            ));
        }
    }

    for new_id in new_entries.keys() {
        if !old_entries.contains_key(new_id) {
            changes.push(law_lifecycle_event(
                LawDiffEventKindV1::LawAdded,
                new_entries[new_id],
            ));
        }
    }

    for law_id in old_entries
        .keys()
        .filter(|law_id| new_entries.contains_key(*law_id))
    {
        let old_entry = old_entries[law_id];
        let new_entry = new_entries[law_id];
        if old_entry.kind != new_entry.kind || old_entry.subject != new_entry.subject {
            changes.push(law_lifecycle_event(
                LawDiffEventKindV1::LawRemoved,
                old_entry,
            ));
            changes.push(law_lifecycle_event(LawDiffEventKindV1::LawAdded, new_entry));
            continue;
        }

        if let Some(tags_event) = diff_law_tags(old_entry, new_entry)? {
            changes.push(tags_event);
        }
        if semantic_body_value(old_entry)? == semantic_body_value(new_entry)? {
            continue;
        }
        if let Some(event) = diff_law_entry_bodies(old_entry, new_entry)? {
            changes.push(event);
        }
    }

    if changes.is_empty() && old_law_hash != new_law_hash {
        changes.push(bundle_diff_event(
            LawDiffEventKindV1::LawBundleChanged,
            vec![LawDiffFieldChangeV1 {
                path: "lawHash".to_string(),
                old: old_law_hash.clone().into(),
                new: new_law_hash.clone().into(),
            }],
        ));
    }

    sort_law_diff_events(&mut changes);

    Ok(LawDiffReportV1 {
        api_version: WESLEY_LAW_DIFF_API_VERSION.to_string(),
        old_schema_hash: old_law_ir.schema_hash.clone(),
        new_schema_hash: new_law_ir.schema_hash.clone(),
        old_law_hash,
        new_law_hash,
        changes,
    })
}

/// Records a schema-bound validation failure as a structured law diff event.
///
/// This lets CI and assurance consumers receive a machine-readable diff report
/// even when the target `weslaw` document no longer binds to the active schema.
pub fn record_law_binding_error_v1(report: &mut LawDiffReportV1, error: &WeslawError) {
    let mut error_value = serde_json::json!({
        "code": error.code.as_str(),
        "message": error.message,
    });
    if let Some(path) = &error.path {
        error_value["path"] = path.clone().into();
    }
    report.changes.push(bundle_diff_event(
        LawDiffEventKindV1::BindingBroken,
        vec![LawDiffFieldChangeV1 {
            path: "binding".to_string(),
            old: serde_json::Value::Null,
            new: error_value,
        }],
    ));
    sort_law_diff_events(&mut report.changes);
}

/// Formats a `wesley.law-diff/v1` report as a Markdown review summary.
pub fn format_law_diff_markdown_v1(report: &LawDiffReportV1) -> String {
    let mut output = String::new();
    output.push_str("# Wesley Law Diff\n\n");
    output.push_str("| Field | Value |\n");
    output.push_str("| --- | --- |\n");
    output.push_str(&format!("| API version | `{}` |\n", report.api_version));
    output.push_str(&format!(
        "| Old schema hash | `{}` |\n",
        report.old_schema_hash
    ));
    output.push_str(&format!(
        "| New schema hash | `{}` |\n",
        report.new_schema_hash
    ));
    output.push_str(&format!("| Old law hash | `{}` |\n", report.old_law_hash));
    output.push_str(&format!("| New law hash | `{}` |\n", report.new_law_hash));
    output.push('\n');

    if report.changes.is_empty() {
        output.push_str("No semantic law changes detected.\n");
        return output;
    }

    output.push_str("## Changes\n\n");
    output.push_str("| Kind | Law | Subject | Summary |\n");
    output.push_str("| --- | --- | --- | --- |\n");
    for change in &report.changes {
        output.push_str(&format!(
            "| `{}` | {} | {} | {} |\n",
            law_diff_kind_text(change.kind),
            markdown_code_or_dash(change.law_id.as_deref()),
            markdown_code_or_dash(change.subject.as_deref()),
            markdown_escape(&law_diff_event_summary(change)),
        ));
    }

    output
}

/// Validates active Law IR v1 entries against Shape IR and root operations.
///
/// This is the strict binding gate for `WLAW-021` through `WLAW-035`: the law
/// document must target the active schema hash, each active subject must parse,
/// schema-backed subjects must resolve, kind-specific references must bind, and
/// the bundle must expose contradictory active law instead of silently
/// accepting it.
pub fn validate_law_ir_v1_bindings(
    law_ir: &LawIrV1,
    schema_ir: &WesleyIR,
    operations: &[SchemaOperation],
    active_schema_hash: &str,
) -> Result<LawBindingReportV1, WeslawError> {
    validate_schema_hash_anchor(active_schema_hash, "activeSchemaHash")?;
    if law_ir.schema_hash != active_schema_hash {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::SchemaHashMismatch,
            "$.schema.hash",
            format!(
                "law document expects schema hash {}; active schema hash is {}",
                law_ir.schema_hash, active_schema_hash
            ),
        ));
    }

    let context = BindingContext {
        schema_ir,
        operations,
        law_ir,
    };

    let mut unique_subject_entries = HashSet::new();
    for (index, entry) in law_ir.entries.iter().enumerate() {
        let law_path = format!("$.laws[{index}]");
        let subject_path = format!("{law_path}.subject");
        let coordinate = parse_subject_coordinate(&entry.subject, &subject_path)?;
        if law_kind_has_unique_subject(entry.kind)
            && !unique_subject_entries.insert(format!("{:?}:{}", entry.kind, entry.subject))
        {
            return Err(conflict(
                entry,
                &subject_path,
                format!(
                    "more than one active {:?} entry targets {}",
                    entry.kind, entry.subject
                ),
            ));
        }
        context.bind_entry(entry, coordinate, &law_path)?;
    }

    Ok(LawBindingReportV1 {
        schema_hash: active_schema_hash.to_string(),
        bound_entry_count: law_ir.entries.len(),
    })
}

fn sort_law_ir_entries(entries: &mut [LawEntryV1]) {
    entries.sort_by(|left, right| left.id.cmp(&right.id));
}

fn law_entry_index<'entry>(
    entries: &'entry [LawEntryV1],
    path: &str,
) -> Result<BTreeMap<&'entry str, &'entry LawEntryV1>, WeslawError> {
    let mut index = BTreeMap::new();
    for (position, entry) in entries.iter().enumerate() {
        if entry.status != LawStatusV1::Active {
            continue;
        }
        if index.insert(entry.id.as_str(), entry).is_some() {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::DuplicateId,
                format!("{path}[{position}].id"),
                format!("duplicate active law id {}", entry.id),
            ));
        }
    }
    Ok(index)
}

fn sort_law_diff_events(changes: &mut [LawDiffEventV1]) {
    changes.sort_by(|left, right| {
        left.law_id
            .as_deref()
            .unwrap_or("")
            .cmp(right.law_id.as_deref().unwrap_or(""))
            .then(left.kind.cmp(&right.kind))
            .then(
                left.subject
                    .as_deref()
                    .unwrap_or("")
                    .cmp(right.subject.as_deref().unwrap_or("")),
            )
    });
}

fn law_diff_kind_text(kind: LawDiffEventKindV1) -> &'static str {
    match kind {
        LawDiffEventKindV1::LawBundleChanged => "LAW_BUNDLE_CHANGED",
        LawDiffEventKindV1::RegistryChanged => "REGISTRY_CHANGED",
        LawDiffEventKindV1::LawAdded => "LAW_ADDED",
        LawDiffEventKindV1::LawRemoved => "LAW_REMOVED",
        LawDiffEventKindV1::LawTagsChanged => "LAW_TAGS_CHANGED",
        LawDiffEventKindV1::LawStrengthened => "LAW_STRENGTHENED",
        LawDiffEventKindV1::LawWeakened => "LAW_WEAKENED",
        LawDiffEventKindV1::LawChanged => "LAW_CHANGED",
        LawDiffEventKindV1::ScalarSemanticsChanged => "SCALAR_SEMANTICS_CHANGED",
        LawDiffEventKindV1::VariantLawChanged => "VARIANT_LAW_CHANGED",
        LawDiffEventKindV1::FootprintExpanded => "FOOTPRINT_EXPANDED",
        LawDiffEventKindV1::FootprintContracted => "FOOTPRINT_CONTRACTED",
        LawDiffEventKindV1::FootprintChanged => "FOOTPRINT_CHANGED",
        LawDiffEventKindV1::ChannelVersionChanged => "CHANNEL_VERSION_CHANGED",
        LawDiffEventKindV1::ChannelLawChanged => "CHANNEL_LAW_CHANGED",
        LawDiffEventKindV1::PredicateChanged => "PREDICATE_CHANGED",
        LawDiffEventKindV1::BindingBroken => "BINDING_BROKEN",
        LawDiffEventKindV1::SchemaHashRebound => "SCHEMA_HASH_REBOUND",
    }
}

fn markdown_code_or_dash(value: Option<&str>) -> String {
    value
        .map(|value| format!("`{}`", markdown_escape(value)))
        .unwrap_or_else(|| "-".to_string())
}

fn markdown_escape(value: &str) -> String {
    value.replace('|', "\\|").replace('\n', "<br>")
}

fn law_diff_event_summary(event: &LawDiffEventV1) -> String {
    match event.kind {
        LawDiffEventKindV1::LawStrengthened => {
            format!("law strengthened: {}", summarize_field_changes(event))
        }
        LawDiffEventKindV1::LawWeakened => {
            format!("law weakened: {}", summarize_field_changes(event))
        }
        LawDiffEventKindV1::BindingBroken => {
            format!("binding broken: {}", summarize_field_changes(event))
        }
        LawDiffEventKindV1::FootprintExpanded => {
            let mut parts = Vec::new();
            push_array_summary(&mut parts, "added reads", &event.added_reads);
            push_array_summary(&mut parts, "added writes", &event.added_writes);
            push_array_summary(&mut parts, "added creates", &event.added_creates);
            push_array_summary(&mut parts, "removed forbids", &event.removed_forbids);
            join_or_field_changes(parts, event)
        }
        LawDiffEventKindV1::FootprintContracted => {
            let mut parts = Vec::new();
            push_array_summary(&mut parts, "removed reads", &event.removed_reads);
            push_array_summary(&mut parts, "removed writes", &event.removed_writes);
            push_array_summary(&mut parts, "removed creates", &event.removed_creates);
            push_array_summary(&mut parts, "added forbids", &event.added_forbids);
            join_or_field_changes(parts, event)
        }
        _ => summarize_field_changes(event),
    }
}

fn push_array_summary(parts: &mut Vec<String>, label: &str, values: &[String]) {
    if !values.is_empty() {
        parts.push(format!("{label}: {}", values.join(", ")));
    }
}

fn join_or_field_changes(parts: Vec<String>, event: &LawDiffEventV1) -> String {
    if parts.is_empty() {
        summarize_field_changes(event)
    } else {
        parts.join("; ")
    }
}

fn summarize_field_changes(event: &LawDiffEventV1) -> String {
    if event.field_changes.is_empty() {
        return "no field-level detail".to_string();
    }
    event
        .field_changes
        .iter()
        .map(|change| change.path.as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

fn push_bundle_level_diff_events(
    old_law_ir: &LawIrV1,
    new_law_ir: &LawIrV1,
    changes: &mut Vec<LawDiffEventV1>,
) -> Result<(), WeslawError> {
    let mut bundle_changes = Vec::new();
    push_value_change(
        &mut bundle_changes,
        "family",
        &old_law_ir.family,
        &new_law_ir.family,
    )?;
    if !bundle_changes.is_empty() {
        changes.push(bundle_diff_event(
            LawDiffEventKindV1::LawBundleChanged,
            bundle_changes,
        ));
    }

    let mut schema_changes = Vec::new();
    push_value_change(
        &mut schema_changes,
        "schemaHash",
        &old_law_ir.schema_hash,
        &new_law_ir.schema_hash,
    )?;
    if !schema_changes.is_empty() {
        changes.push(bundle_diff_event(
            LawDiffEventKindV1::SchemaHashRebound,
            schema_changes,
        ));
    }

    let mut registry_changes = Vec::new();
    push_json_change(
        &mut registry_changes,
        "registries",
        semantic_registry_value(&old_law_ir.registries)?,
        semantic_registry_value(&new_law_ir.registries)?,
    );
    if !registry_changes.is_empty() {
        changes.push(bundle_diff_event(
            LawDiffEventKindV1::RegistryChanged,
            registry_changes,
        ));
    }

    Ok(())
}

fn diff_law_tags(
    old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    let mut field_changes = Vec::new();
    push_json_change(
        &mut field_changes,
        "tags",
        string_vec_value(&old_entry.tags, "$.old.entries.tags")?,
        string_vec_value(&new_entry.tags, "$.new.entries.tags")?,
    );
    if field_changes.is_empty() {
        return Ok(None);
    }

    let mut event = base_diff_event(LawDiffEventKindV1::LawTagsChanged, new_entry);
    event.field_changes = field_changes;
    Ok(Some(event))
}

fn diff_law_entry_bodies(
    old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    match (&old_entry.body, &new_entry.body) {
        (LawEntryBodyV1::ScalarSemantics(old_body), LawEntryBodyV1::ScalarSemantics(new_body)) => {
            diff_scalar_semantics(old_entry, new_entry, old_body, new_body)
        }
        (LawEntryBodyV1::VariantLaw(old_body), LawEntryBodyV1::VariantLaw(new_body)) => {
            diff_variant_law(old_entry, new_entry, old_body, new_body)
        }
        (LawEntryBodyV1::FootprintLaw(old_body), LawEntryBodyV1::FootprintLaw(new_body)) => {
            diff_footprint_law(old_entry, new_entry, old_body, new_body)
        }
        (LawEntryBodyV1::ChannelLaw(old_body), LawEntryBodyV1::ChannelLaw(new_body)) => {
            diff_channel_law(old_entry, new_entry, old_body, new_body)
        }
        (LawEntryBodyV1::InvariantLaw(old_body), LawEntryBodyV1::InvariantLaw(new_body)) => {
            diff_invariant_law(old_entry, new_entry, old_body, new_body)
        }
        _ => {
            let mut event = base_diff_event(LawDiffEventKindV1::LawChanged, new_entry);
            push_json_change(
                &mut event.field_changes,
                "body",
                semantic_body_value(old_entry)?,
                semantic_body_value(new_entry)?,
            );
            Ok(Some(event))
        }
    }
}

#[derive(Default)]
struct SemanticDirection {
    strengthened: bool,
    weakened: bool,
    structural: bool,
}

impl SemanticDirection {
    fn mark_strengthened(&mut self) {
        self.strengthened = true;
    }

    fn mark_weakened(&mut self) {
        self.weakened = true;
    }

    fn mark_structural(&mut self) {
        self.structural = true;
    }

    fn note_min_change(&mut self, old: Option<u64>, new: Option<u64>) {
        match (old, new) {
            (None, Some(_)) => self.mark_strengthened(),
            (Some(_), None) => self.mark_weakened(),
            (Some(old), Some(new)) if new > old => self.mark_strengthened(),
            (Some(old), Some(new)) if new < old => self.mark_weakened(),
            _ => {}
        }
    }

    fn note_max_change(&mut self, old: Option<u64>, new: Option<u64>) {
        match (old, new) {
            (None, Some(_)) => self.mark_strengthened(),
            (Some(_), None) => self.mark_weakened(),
            (Some(old), Some(new)) if new < old => self.mark_strengthened(),
            (Some(old), Some(new)) if new > old => self.mark_weakened(),
            _ => {}
        }
    }

    fn note_scalar_forbids_change(
        &mut self,
        old: &[ScalarForbiddenInterpretationV1],
        new: &[ScalarForbiddenInterpretationV1],
    ) {
        let old_values = old.iter().copied().collect::<BTreeSet<_>>();
        let new_values = new.iter().copied().collect::<BTreeSet<_>>();
        if new_values.difference(&old_values).next().is_some() {
            self.mark_strengthened();
        }
        if old_values.difference(&new_values).next().is_some() {
            self.mark_weakened();
        }
    }

    fn note_required_or_forbidden_change(
        &mut self,
        old: &[String],
        new: &[String],
        path: &str,
    ) -> Result<(), WeslawError> {
        if !set_added(old, new, path)?.is_empty() {
            self.mark_strengthened();
        }
        if !set_removed(old, new, path)?.is_empty() {
            self.mark_weakened();
        }
        Ok(())
    }

    fn event_kind(&self, fallback: LawDiffEventKindV1) -> LawDiffEventKindV1 {
        match (self.structural, self.strengthened, self.weakened) {
            (false, true, false) => LawDiffEventKindV1::LawStrengthened,
            (false, false, true) => LawDiffEventKindV1::LawWeakened,
            _ => fallback,
        }
    }
}

fn diff_scalar_semantics(
    _old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
    old_body: &ScalarSemanticsLawV1,
    new_body: &ScalarSemanticsLawV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    let mut field_changes = Vec::new();
    let mut direction = SemanticDirection::default();
    if old_body.representation != new_body.representation {
        direction.mark_structural();
    }
    push_value_change(
        &mut field_changes,
        "body.representation",
        old_body.representation,
        new_body.representation,
    )?;
    direction.note_min_change(old_body.min_inclusive, new_body.min_inclusive);
    push_value_change(
        &mut field_changes,
        "body.minInclusive",
        old_body.min_inclusive,
        new_body.min_inclusive,
    )?;
    direction.note_max_change(old_body.max_inclusive, new_body.max_inclusive);
    push_value_change(
        &mut field_changes,
        "body.maxInclusive",
        old_body.max_inclusive,
        new_body.max_inclusive,
    )?;
    if old_body.ordering != new_body.ordering {
        direction.mark_structural();
    }
    push_value_change(
        &mut field_changes,
        "body.ordering",
        old_body.ordering,
        new_body.ordering,
    )?;
    if old_body.scope != new_body.scope {
        direction.mark_structural();
    }
    push_value_change(
        &mut field_changes,
        "body.scope",
        &old_body.scope,
        &new_body.scope,
    )?;
    direction.note_scalar_forbids_change(&old_body.forbids, &new_body.forbids);
    push_json_change(
        &mut field_changes,
        "body.forbids",
        scalar_forbids_value(old_body)?,
        scalar_forbids_value(new_body)?,
    );

    if field_changes.is_empty() {
        return Ok(None);
    }

    let mut event = base_diff_event(
        direction.event_kind(LawDiffEventKindV1::ScalarSemanticsChanged),
        new_entry,
    );
    event.field_changes = field_changes;
    Ok(Some(event))
}

fn diff_variant_law(
    _old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
    old_body: &VariantLawV1,
    new_body: &VariantLawV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    let mut field_changes = Vec::new();
    let mut direction = SemanticDirection::default();
    if old_body.discriminator.field != new_body.discriminator.field {
        direction.mark_structural();
    }
    push_value_change(
        &mut field_changes,
        "body.discriminator.field",
        &old_body.discriminator.field,
        &new_body.discriminator.field,
    )?;
    if old_body.discriminator.r#enum != new_body.discriminator.r#enum {
        direction.mark_structural();
    }
    push_value_change(
        &mut field_changes,
        "body.discriminator.enum",
        &old_body.discriminator.r#enum,
        &new_body.discriminator.r#enum,
    )?;

    let old_cases = variant_case_index(&old_body.cases, "$.old.entries.body.cases")?;
    let new_cases = variant_case_index(&new_body.cases, "$.new.entries.body.cases")?;
    for old_case in old_cases.keys() {
        if !new_cases.contains_key(old_case) {
            direction.mark_structural();
            push_json_change(
                &mut field_changes,
                &format!("body.cases.{old_case}"),
                variant_case_value(old_cases[old_case])?,
                serde_json::Value::Null,
            );
        }
    }
    for new_case in new_cases.keys() {
        if !old_cases.contains_key(new_case) {
            direction.mark_structural();
            push_json_change(
                &mut field_changes,
                &format!("body.cases.{new_case}"),
                serde_json::Value::Null,
                variant_case_value(new_cases[new_case])?,
            );
        }
    }
    for case_value in old_cases
        .keys()
        .filter(|case_value| new_cases.contains_key(*case_value))
    {
        let old_case = old_cases[case_value];
        let new_case = new_cases[case_value];
        direction.note_required_or_forbidden_change(
            &old_case.requires,
            &new_case.requires,
            "$.entries.body.cases.requires",
        )?;
        push_json_change(
            &mut field_changes,
            &format!("body.cases.{case_value}.requires"),
            string_vec_value(&old_case.requires, "$.old.entries.body.cases.requires")?,
            string_vec_value(&new_case.requires, "$.new.entries.body.cases.requires")?,
        );
        direction.note_required_or_forbidden_change(
            &old_case.forbids,
            &new_case.forbids,
            "$.entries.body.cases.forbids",
        )?;
        push_json_change(
            &mut field_changes,
            &format!("body.cases.{case_value}.forbids"),
            string_vec_value(&old_case.forbids, "$.old.entries.body.cases.forbids")?,
            string_vec_value(&new_case.forbids, "$.new.entries.body.cases.forbids")?,
        );
    }

    if field_changes.is_empty() {
        return Ok(None);
    }

    let mut event = base_diff_event(
        direction.event_kind(LawDiffEventKindV1::VariantLawChanged),
        new_entry,
    );
    event.field_changes = field_changes;
    Ok(Some(event))
}

fn diff_footprint_law(
    _old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
    old_body: &FootprintLawV1,
    new_body: &FootprintLawV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    let added_reads = set_added(&old_body.reads, &new_body.reads, "$.entries.body.reads")?;
    let removed_reads = set_removed(&old_body.reads, &new_body.reads, "$.entries.body.reads")?;
    let added_writes = set_added(&old_body.writes, &new_body.writes, "$.entries.body.writes")?;
    let removed_writes = set_removed(&old_body.writes, &new_body.writes, "$.entries.body.writes")?;
    let added_creates = set_added(
        &old_body.creates,
        &new_body.creates,
        "$.entries.body.creates",
    )?;
    let removed_creates = set_removed(
        &old_body.creates,
        &new_body.creates,
        "$.entries.body.creates",
    )?;
    let added_forbids = set_added(
        &old_body.forbids,
        &new_body.forbids,
        "$.entries.body.forbids",
    )?;
    let removed_forbids = set_removed(
        &old_body.forbids,
        &new_body.forbids,
        "$.entries.body.forbids",
    )?;

    let old_value = semantic_footprint_body_value(old_body)?;
    let new_value = semantic_footprint_body_value(new_body)?;
    let mut field_changes = Vec::new();
    for path in ["slots", "closures", "createSlots", "updates"] {
        push_json_change(
            &mut field_changes,
            &format!("body.{path}"),
            old_value[path].clone(),
            new_value[path].clone(),
        );
    }

    let footprint_expanded = !added_reads.is_empty()
        || !added_writes.is_empty()
        || !added_creates.is_empty()
        || !removed_forbids.is_empty();
    let footprint_contracted = !removed_reads.is_empty()
        || !removed_writes.is_empty()
        || !removed_creates.is_empty()
        || !added_forbids.is_empty();
    let structural_change = !field_changes.is_empty();

    if !footprint_expanded && !footprint_contracted && !structural_change {
        return Ok(None);
    }

    let event_kind = match (footprint_expanded, footprint_contracted, structural_change) {
        (true, false, false) => LawDiffEventKindV1::FootprintExpanded,
        (false, true, false) => LawDiffEventKindV1::FootprintContracted,
        _ => LawDiffEventKindV1::FootprintChanged,
    };
    let mut event = base_diff_event(event_kind, new_entry);
    event.field_changes = field_changes;
    event.added_reads = added_reads;
    event.removed_reads = removed_reads;
    event.added_writes = added_writes;
    event.removed_writes = removed_writes;
    event.added_creates = added_creates;
    event.removed_creates = removed_creates;
    event.added_forbids = added_forbids;
    event.removed_forbids = removed_forbids;
    Ok(Some(event))
}

fn diff_channel_law(
    _old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
    old_body: &ChannelLawV1,
    new_body: &ChannelLawV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    let mut field_changes = Vec::new();
    push_value_change(
        &mut field_changes,
        "body.ordered",
        old_body.ordered,
        new_body.ordered,
    )?;
    push_value_change(
        &mut field_changes,
        "body.version",
        old_body.version,
        new_body.version,
    )?;
    push_json_change(
        &mut field_changes,
        "body.compatibility",
        serde_json::to_value(&old_body.compatibility).map_err(canonicalization_error)?,
        serde_json::to_value(&new_body.compatibility).map_err(canonicalization_error)?,
    );
    push_json_change(
        &mut field_changes,
        "body.messages",
        serde_json::to_value(&old_body.messages).map_err(canonicalization_error)?,
        serde_json::to_value(&new_body.messages).map_err(canonicalization_error)?,
    );
    if field_changes.is_empty() {
        return Ok(None);
    }

    let kind = if old_body.version != new_body.version {
        LawDiffEventKindV1::ChannelVersionChanged
    } else {
        LawDiffEventKindV1::ChannelLawChanged
    };
    let mut event = base_diff_event(kind, new_entry);
    event.field_changes = field_changes;
    Ok(Some(event))
}

fn diff_invariant_law(
    _old_entry: &LawEntryV1,
    new_entry: &LawEntryV1,
    old_body: &InvariantLawV1,
    new_body: &InvariantLawV1,
) -> Result<Option<LawDiffEventV1>, WeslawError> {
    let mut field_changes = Vec::new();
    push_json_change(
        &mut field_changes,
        "body.predicate",
        serde_json::to_value(&old_body.predicate).map_err(canonicalization_error)?,
        serde_json::to_value(&new_body.predicate).map_err(canonicalization_error)?,
    );
    if field_changes.is_empty() {
        return Ok(None);
    }

    let mut event = base_diff_event(LawDiffEventKindV1::PredicateChanged, new_entry);
    event.field_changes = field_changes;
    Ok(Some(event))
}

fn law_lifecycle_event(kind: LawDiffEventKindV1, entry: &LawEntryV1) -> LawDiffEventV1 {
    base_diff_event(kind, entry)
}

fn bundle_diff_event(
    kind: LawDiffEventKindV1,
    field_changes: Vec<LawDiffFieldChangeV1>,
) -> LawDiffEventV1 {
    LawDiffEventV1 {
        kind,
        law_id: None,
        subject: None,
        law_kind: None,
        review_posture: LawDiffReviewPostureV1::RequiresReview,
        field_changes,
        added_reads: Vec::new(),
        removed_reads: Vec::new(),
        added_writes: Vec::new(),
        removed_writes: Vec::new(),
        added_creates: Vec::new(),
        removed_creates: Vec::new(),
        added_forbids: Vec::new(),
        removed_forbids: Vec::new(),
    }
}

fn base_diff_event(kind: LawDiffEventKindV1, entry: &LawEntryV1) -> LawDiffEventV1 {
    LawDiffEventV1 {
        kind,
        law_id: Some(entry.id.clone()),
        subject: Some(entry.subject.clone()),
        law_kind: Some(entry.kind),
        review_posture: LawDiffReviewPostureV1::RequiresReview,
        field_changes: Vec::new(),
        added_reads: Vec::new(),
        removed_reads: Vec::new(),
        added_writes: Vec::new(),
        removed_writes: Vec::new(),
        added_creates: Vec::new(),
        removed_creates: Vec::new(),
        added_forbids: Vec::new(),
        removed_forbids: Vec::new(),
    }
}

fn push_value_change(
    changes: &mut Vec<LawDiffFieldChangeV1>,
    path: &str,
    old: impl Serialize,
    new: impl Serialize,
) -> Result<(), WeslawError> {
    let old_value = serde_json::to_value(old).map_err(canonicalization_error)?;
    let new_value = serde_json::to_value(new).map_err(canonicalization_error)?;
    push_json_change(changes, path, old_value, new_value);
    Ok(())
}

fn push_json_change(
    changes: &mut Vec<LawDiffFieldChangeV1>,
    path: &str,
    old: serde_json::Value,
    new: serde_json::Value,
) {
    if old == new {
        return;
    }
    changes.push(LawDiffFieldChangeV1 {
        path: path.to_string(),
        old,
        new,
    });
}

fn directive_string_field(
    value: &serde_json::Value,
    field: &str,
    path: &str,
) -> Result<String, WeslawError> {
    value
        .get(field)
        .and_then(serde_json::Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                format!("directive field {field} must be a string"),
            )
        })
}

fn directive_u64_field(
    value: &serde_json::Value,
    field: &str,
    path: &str,
) -> Result<u64, WeslawError> {
    value
        .get(field)
        .and_then(serde_json::Value::as_u64)
        .ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                format!("directive field {field} must be an unsigned integer"),
            )
        })
}

fn directive_bool_field(
    value: &serde_json::Value,
    field: &str,
    path: &str,
) -> Result<bool, WeslawError> {
    value
        .get(field)
        .and_then(serde_json::Value::as_bool)
        .ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                format!("directive field {field} must be a boolean"),
            )
        })
}

fn scalar_forbids_value(body: &ScalarSemanticsLawV1) -> Result<serde_json::Value, WeslawError> {
    let forbids = body
        .forbids
        .iter()
        .map(|item| serde_json::to_value(item).map_err(canonicalization_error))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(|value| {
            value
                .as_str()
                .expect("forbidden interpretation should serialize as a string")
                .to_string()
        })
        .collect::<Vec<_>>();
    Ok(sorted_unique_strings(&forbids, "$.entries.body.forbids")?.into())
}

fn variant_case_index<'case>(
    cases: &'case [VariantCaseV1],
    path: &str,
) -> Result<BTreeMap<&'case str, &'case VariantCaseV1>, WeslawError> {
    let mut index = BTreeMap::new();
    for (position, case) in cases.iter().enumerate() {
        if index.insert(case.value.as_str(), case).is_some() {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::Conflict,
                format!("{path}[{position}].value"),
                format!("duplicate variant case value {}", case.value),
            ));
        }
    }
    Ok(index)
}

fn variant_case_value(case: &VariantCaseV1) -> Result<serde_json::Value, WeslawError> {
    Ok(serde_json::json!({
        "value": case.value,
        "requires": sorted_unique_strings(&case.requires, "$.entries.body.cases.requires")?,
        "forbids": sorted_unique_strings(&case.forbids, "$.entries.body.cases.forbids")?,
    }))
}

fn string_vec_value(values: &[String], path: &str) -> Result<serde_json::Value, WeslawError> {
    Ok(sorted_unique_strings(values, path)?.into())
}

fn set_added(old: &[String], new: &[String], path: &str) -> Result<Vec<String>, WeslawError> {
    let old_values = sorted_string_set(old, path)?;
    let new_values = sorted_string_set(new, path)?;
    Ok(new_values.difference(&old_values).cloned().collect())
}

fn set_removed(old: &[String], new: &[String], path: &str) -> Result<Vec<String>, WeslawError> {
    let old_values = sorted_string_set(old, path)?;
    let new_values = sorted_string_set(new, path)?;
    Ok(old_values.difference(&new_values).cloned().collect())
}

fn sorted_string_set(values: &[String], path: &str) -> Result<BTreeSet<String>, WeslawError> {
    Ok(sorted_unique_strings(values, path)?.into_iter().collect())
}

fn semantic_law_ir_value(value: &LawIrV1) -> Result<serde_json::Value, WeslawError> {
    let entries = value
        .entries
        .iter()
        .filter(|entry| entry.status == LawStatusV1::Active)
        .map(semantic_entry_value)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(serde_json::json!({
        "apiVersion": value.api_version,
        "family": value.family,
        "schemaHash": value.schema_hash,
        "registries": semantic_registry_value(&value.registries)?,
        "entries": entries,
    }))
}

fn semantic_registry_value(
    registries: &LawRegistrySetV1,
) -> Result<serde_json::Value, WeslawError> {
    let mut resources = registries
        .resources
        .iter()
        .map(|resource| {
            Ok(serde_json::json!({
                "id": resource.id,
                "owner": resource.owner,
                "kind": resource.kind,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut resources, "id", "$.registries.resources")?;

    let mut verifiers = registries
        .verifiers
        .iter()
        .map(|verifier| {
            Ok(serde_json::json!({
                "id": verifier.id,
                "owner": verifier.owner,
                "inputContracts": sorted_unique_strings(
                    &verifier.input_contracts,
                    "$.registries.verifiers.inputContracts",
                )?,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut verifiers, "id", "$.registries.verifiers")?;

    let mut channels = registries
        .channels
        .iter()
        .map(|channel| {
            Ok(serde_json::json!({
                "name": channel.name,
                "version": channel.version,
                "carrier": channel.carrier,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    channels.sort_by(|left, right| {
        let left_key = (
            string_field(left, "name").unwrap_or_default(),
            u64_field(left, "version").unwrap_or_default(),
        );
        let right_key = (
            string_field(right, "name").unwrap_or_default(),
            u64_field(right, "version").unwrap_or_default(),
        );
        left_key.cmp(&right_key)
    });

    Ok(serde_json::json!({
        "resources": resources,
        "verifiers": verifiers,
        "channels": channels,
    }))
}

fn semantic_entry_value(entry: &LawEntryV1) -> Result<serde_json::Value, WeslawError> {
    Ok(serde_json::json!({
        "id": entry.id,
        "kind": law_kind_text(entry.kind),
        "subject": entry.subject,
        "tags": sorted_unique_strings(&entry.tags, "$.entries.tags")?,
        "body": semantic_body_value(entry)?,
    }))
}

fn semantic_body_value(entry: &LawEntryV1) -> Result<serde_json::Value, WeslawError> {
    match &entry.body {
        LawEntryBodyV1::ScalarSemantics(body) => semantic_scalar_body_value(body),
        LawEntryBodyV1::VariantLaw(body) => semantic_variant_body_value(body),
        LawEntryBodyV1::FootprintLaw(body) => semantic_footprint_body_value(body),
        LawEntryBodyV1::ChannelLaw(body) => semantic_channel_body_value(body),
        LawEntryBodyV1::InvariantLaw(body) => {
            serde_json::to_value(body).map_err(canonicalization_error)
        }
    }
}

fn semantic_scalar_body_value(
    body: &ScalarSemanticsLawV1,
) -> Result<serde_json::Value, WeslawError> {
    let mut object = serde_json::Map::new();
    object.insert(
        "representation".to_string(),
        serde_json::to_value(body.representation).map_err(canonicalization_error)?,
    );
    if let Some(min) = body.min_inclusive {
        object.insert("minInclusive".to_string(), min.into());
    }
    if let Some(max) = body.max_inclusive {
        object.insert("maxInclusive".to_string(), max.into());
    }
    if let Some(ordering) = body.ordering {
        object.insert(
            "ordering".to_string(),
            serde_json::to_value(ordering).map_err(canonicalization_error)?,
        );
    }
    if let Some(scope) = &body.scope {
        object.insert("scope".to_string(), scope.clone().into());
    }
    let forbids = body
        .forbids
        .iter()
        .map(|item| serde_json::to_value(item).map_err(canonicalization_error))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(|value| {
            value
                .as_str()
                .expect("forbidden interpretation should serialize as a string")
                .to_string()
        })
        .collect::<Vec<_>>();
    object.insert(
        "forbids".to_string(),
        sorted_unique_strings(&forbids, "$.entries.body.forbids")?.into(),
    );
    Ok(serde_json::Value::Object(object))
}

fn semantic_variant_body_value(body: &VariantLawV1) -> Result<serde_json::Value, WeslawError> {
    let mut cases = body
        .cases
        .iter()
        .map(|case| {
            Ok(serde_json::json!({
                "value": case.value,
                "requires": sorted_unique_strings(&case.requires, "$.entries.body.cases.requires")?,
                "forbids": sorted_unique_strings(&case.forbids, "$.entries.body.cases.forbids")?,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut cases, "value", "$.entries.body.cases")?;

    Ok(serde_json::json!({
        "discriminator": {
            "field": body.discriminator.field,
            "enum": body.discriminator.r#enum,
        },
        "cases": cases,
    }))
}

fn semantic_footprint_body_value(body: &FootprintLawV1) -> Result<serde_json::Value, WeslawError> {
    let mut slots = body
        .slots
        .iter()
        .map(|slot| {
            Ok(serde_json::json!({
                "name": slot.name,
                "kind": slot.kind,
                "bindFromArg": slot.bind_from_arg,
                "access": sorted_unique_strings(&slot.access, "$.entries.body.slots.access")?,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut slots, "name", "$.entries.body.slots")?;

    let mut closures = body
        .closures
        .iter()
        .map(|closure| {
            Ok(serde_json::json!({
                "name": closure.name,
                "fromSlot": closure.from_slot,
                "operator": closure.operator,
                "argBindings": closure.arg_bindings,
                "reads": sorted_unique_strings(&closure.reads, "$.entries.body.closures.reads")?,
                "cardinality": closure.cardinality,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut closures, "name", "$.entries.body.closures")?;

    let mut create_slots = body
        .create_slots
        .iter()
        .map(|slot| {
            Ok(serde_json::json!({
                "name": slot.name,
                "kind": slot.kind,
                "cardinality": slot.cardinality.unwrap_or(FootprintCardinalityV1::One),
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut create_slots, "name", "$.entries.body.createSlots")?;

    let mut updates = body
        .updates
        .iter()
        .map(|update| {
            Ok(serde_json::json!({
                "slot": update.slot,
                "fields": sorted_unique_strings(&update.fields, "$.entries.body.updates.fields")?,
            }))
        })
        .collect::<Result<Vec<_>, WeslawError>>()?;
    sort_values_by_string_field(&mut updates, "slot", "$.entries.body.updates")?;

    Ok(serde_json::json!({
        "reads": sorted_unique_strings(&body.reads, "$.entries.body.reads")?,
        "writes": sorted_unique_strings(&body.writes, "$.entries.body.writes")?,
        "creates": sorted_unique_strings(&body.creates, "$.entries.body.creates")?,
        "forbids": sorted_unique_strings(&body.forbids, "$.entries.body.forbids")?,
        "slots": slots,
        "closures": closures,
        "createSlots": create_slots,
        "updates": updates,
    }))
}

fn semantic_channel_body_value(body: &ChannelLawV1) -> Result<serde_json::Value, WeslawError> {
    let mut object = serde_json::Map::new();
    object.insert("ordered".to_string(), body.ordered.into());
    object.insert("version".to_string(), body.version.into());
    if let Some(compatibility) = &body.compatibility {
        object.insert(
            "compatibility".to_string(),
            serde_json::to_value(compatibility).map_err(canonicalization_error)?,
        );
    }
    object.insert(
        "messages".to_string(),
        serde_json::to_value(&body.messages).map_err(canonicalization_error)?,
    );
    Ok(serde_json::Value::Object(object))
}

fn compute_bundle_hash_v1(
    schema_hash: &str,
    law_hash: &str,
    profile_hash: &str,
    law_ir_codec: &str,
    bundle_hash_codec: &str,
    compiler: &str,
    compiler_version: &str,
) -> Result<String, WeslawError> {
    let input = serde_json::json!({
        "schemaHash": schema_hash,
        "lawHash": law_hash,
        "profileHash": profile_hash,
        "lawIrCodec": law_ir_codec,
        "bundleHashCodec": bundle_hash_codec,
        "compiler": compiler,
        "compilerVersion": compiler_version,
    });
    let bytes = to_canonical_json(&input).map_err(canonicalization_error)?;
    Ok(prefixed_sha256(&bytes))
}

fn empty_profile_hash_v1() -> Result<String, WeslawError> {
    let input = serde_json::json!({
        "apiVersion": WESLEY_EMPTY_PROFILE_API_VERSION,
        "entries": [],
    });
    let bytes = to_canonical_json(&input).map_err(canonicalization_error)?;
    Ok(prefixed_sha256(&bytes))
}

fn sorted_unique_strings(values: &[String], path: &str) -> Result<Vec<String>, WeslawError> {
    let mut sorted = values.to_vec();
    sorted.sort();
    if let Some((duplicate, _)) = sorted
        .windows(2)
        .find_map(|window| (window[0] == window[1]).then(|| (&window[0], &window[1])))
    {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::Conflict,
            path,
            format!("duplicate set-like value {duplicate}"),
        ));
    }
    Ok(sorted)
}

fn sort_values_by_string_field(
    values: &mut [serde_json::Value],
    field: &str,
    path: &str,
) -> Result<(), WeslawError> {
    values.sort_by(|left, right| {
        string_field(left, field)
            .unwrap_or_default()
            .cmp(string_field(right, field).unwrap_or_default())
    });
    if let Some(duplicate) = values.windows(2).find_map(|window| {
        let left = string_field(&window[0], field)?;
        let right = string_field(&window[1], field)?;
        (left == right).then_some(left)
    }) {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::Conflict,
            path,
            format!("duplicate set-like key {duplicate}"),
        ));
    }
    Ok(())
}

fn string_field<'a>(value: &'a serde_json::Value, field: &str) -> Option<&'a str> {
    value.get(field).and_then(serde_json::Value::as_str)
}

fn u64_field(value: &serde_json::Value, field: &str) -> Option<u64> {
    value.get(field).and_then(serde_json::Value::as_u64)
}

fn law_kind_text(kind: LawKindV1) -> &'static str {
    match kind {
        LawKindV1::ScalarSemantics => "scalarSemantics",
        LawKindV1::VariantLaw => "variantLaw",
        LawKindV1::FootprintLaw => "footprintLaw",
        LawKindV1::ChannelLaw => "channelLaw",
        LawKindV1::InvariantLaw => "invariantLaw",
    }
}

fn prefixed_sha256(value: &str) -> String {
    prefixed_sha256_hex(&compute_content_hash(value))
}

fn prefixed_sha256_hex(value: &str) -> String {
    format!("sha256:{value}")
}

fn canonicalization_error(error: impl std::fmt::Display) -> WeslawError {
    WeslawError::new(
        WeslawDiagnosticCode::InvalidDocument,
        format!("Law IR canonicalization failed: {error}"),
    )
}

struct BindingContext<'a> {
    schema_ir: &'a WesleyIR,
    operations: &'a [SchemaOperation],
    law_ir: &'a LawIrV1,
}

impl BindingContext<'_> {
    fn bind_entry(
        &self,
        entry: &LawEntryV1,
        coordinate: SubjectCoordinate<'_>,
        path: &str,
    ) -> Result<(), WeslawError> {
        match entry.kind {
            LawKindV1::ScalarSemantics => self.bind_scalar_semantics(entry, coordinate, path),
            LawKindV1::VariantLaw => self.bind_variant_law(entry, coordinate, path),
            LawKindV1::FootprintLaw => self.bind_footprint_law(entry, coordinate, path),
            LawKindV1::ChannelLaw => self.bind_channel_law(entry, coordinate, path),
            LawKindV1::InvariantLaw => self.bind_invariant_law(entry, coordinate, path),
        }
    }

    fn bind_scalar_semantics(
        &self,
        entry: &LawEntryV1,
        coordinate: SubjectCoordinate<'_>,
        path: &str,
    ) -> Result<(), WeslawError> {
        let SubjectCoordinate::Scalar(name) = coordinate else {
            return Err(wrong_subject_kind(entry, path, "scalar:<Name>"));
        };
        self.require_type(name, TypeKind::Scalar, entry, path)?;
        Ok(())
    }

    fn bind_variant_law(
        &self,
        entry: &LawEntryV1,
        coordinate: SubjectCoordinate<'_>,
        path: &str,
    ) -> Result<(), WeslawError> {
        let SubjectCoordinate::Input(name) = coordinate else {
            return Err(wrong_subject_kind(entry, path, "input:<Name>"));
        };
        let input = self.require_type(name, TypeKind::InputObject, entry, path)?;
        let LawEntryBodyV1::VariantLaw(body) = &entry.body else {
            return Err(wrong_subject_kind(entry, path, "variant law body"));
        };

        let discriminator = self.require_input_field(
            input,
            &body.discriminator.field,
            entry,
            format!("{path}.discriminator.field"),
        )?;
        if discriminator.r#type.base != body.discriminator.r#enum {
            return Err(unresolved_reference(
                entry,
                format!("{path}.discriminator.enum"),
                format!(
                    "discriminator field {} has type {}, not enum {}",
                    body.discriminator.field, discriminator.r#type.base, body.discriminator.r#enum
                ),
            ));
        }
        let enum_type = self.require_type_reference(
            &body.discriminator.r#enum,
            TypeKind::Enum,
            entry,
            format!("{path}.discriminator.enum"),
        )?;

        for (case_index, case) in body.cases.iter().enumerate() {
            let case_path = format!("{path}.cases[{case_index}]");
            if !enum_type
                .enum_values
                .iter()
                .any(|candidate| candidate == &case.value)
            {
                return Err(unresolved_reference(
                    entry,
                    format!("{case_path}.value"),
                    format!(
                        "enum {} has no value {}",
                        body.discriminator.r#enum, case.value
                    ),
                ));
            }
            for field in &case.requires {
                self.require_input_field(input, field, entry, format!("{case_path}.requires"))?;
            }
            for field in &case.forbids {
                self.require_input_field(input, field, entry, format!("{case_path}.forbids"))?;
            }
            if let Some(field) = first_overlap(&case.requires, &case.forbids) {
                return Err(conflict(
                    entry,
                    case_path,
                    format!(
                        "variant case {} both requires and forbids {field}",
                        case.value
                    ),
                ));
            }
        }
        Ok(())
    }

    fn bind_footprint_law(
        &self,
        entry: &LawEntryV1,
        coordinate: SubjectCoordinate<'_>,
        path: &str,
    ) -> Result<(), WeslawError> {
        let SubjectCoordinate::Operation {
            operation_type,
            field,
        } = coordinate
        else {
            return Err(wrong_subject_kind(
                entry,
                path,
                "operation:Query.<field>, operation:Mutation.<field>, or operation:Subscription.<field>",
            ));
        };
        let operation = self.require_operation(operation_type, field, entry, path)?;
        let LawEntryBodyV1::FootprintLaw(body) = &entry.body else {
            return Err(wrong_subject_kind(entry, path, "footprint law body"));
        };

        for resource in body
            .reads
            .iter()
            .chain(body.writes.iter())
            .chain(body.creates.iter())
            .chain(body.forbids.iter())
            .chain(body.slots.iter().map(|slot| &slot.kind))
            .chain(
                body.closures
                    .iter()
                    .flat_map(|closure| closure.reads.iter()),
            )
            .chain(body.create_slots.iter().map(|slot| &slot.kind))
        {
            self.require_resource(resource, entry, format!("{path}.resources"))?;
        }

        let mut slot_names = HashSet::new();
        for (slot_index, slot) in body.slots.iter().enumerate() {
            let slot_path = format!("{path}.slots[{slot_index}]");
            if !slot_names.insert(slot.name.as_str()) {
                return Err(conflict(
                    entry,
                    format!("{slot_path}.name"),
                    format!("duplicate footprint slot {}", slot.name),
                ));
            }
            self.require_arg_path(
                operation,
                &slot.bind_from_arg,
                entry,
                format!("{slot_path}.bindFromArg"),
            )?;
        }

        let mut create_slot_names = HashSet::new();
        for (slot_index, slot) in body.create_slots.iter().enumerate() {
            if !create_slot_names.insert(slot.name.as_str()) {
                return Err(conflict(
                    entry,
                    format!("{path}.createSlots[{slot_index}].name"),
                    format!("duplicate create slot {}", slot.name),
                ));
            }
        }

        for (closure_index, closure) in body.closures.iter().enumerate() {
            let closure_path = format!("{path}.closures[{closure_index}]");
            if !slot_names.contains(closure.from_slot.as_str()) {
                return Err(unresolved_reference(
                    entry,
                    format!("{closure_path}.fromSlot"),
                    format!("closure source slot {} is not declared", closure.from_slot),
                ));
            }
            for binding in &closure.arg_bindings {
                if !slot_names.contains(binding.as_str()) {
                    self.require_arg_path(
                        operation,
                        binding,
                        entry,
                        format!("{closure_path}.argBindings"),
                    )?;
                }
            }
        }

        for (update_index, update) in body.updates.iter().enumerate() {
            if !slot_names.contains(update.slot.as_str()) {
                return Err(unresolved_reference(
                    entry,
                    format!("{path}.updates[{update_index}].slot"),
                    format!("update slot {} is not declared", update.slot),
                ));
            }
        }

        let touched_resources = body
            .reads
            .iter()
            .chain(body.writes.iter())
            .chain(body.creates.iter())
            .chain(body.slots.iter().map(|slot| &slot.kind))
            .chain(
                body.closures
                    .iter()
                    .flat_map(|closure| closure.reads.iter()),
            )
            .chain(body.create_slots.iter().map(|slot| &slot.kind))
            .cloned()
            .collect::<Vec<_>>();
        if let Some(resource) = first_overlap(&body.forbids, &touched_resources) {
            return Err(conflict(
                entry,
                format!("{path}.forbids"),
                format!("resource {resource} is both forbidden and used"),
            ));
        }
        Ok(())
    }

    fn bind_channel_law(
        &self,
        entry: &LawEntryV1,
        coordinate: SubjectCoordinate<'_>,
        path: &str,
    ) -> Result<(), WeslawError> {
        let SubjectCoordinate::Channel { name, version } = coordinate else {
            return Err(wrong_subject_kind(entry, path, "channel:<name>@<version>"));
        };
        let LawEntryBodyV1::ChannelLaw(body) = &entry.body else {
            return Err(wrong_subject_kind(entry, path, "channel law body"));
        };
        if body.version != version {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                format!(
                    "channel subject {} expects version {version}, but law body declares version {}",
                    entry.subject, body.version
                ),
            ));
        }
        let carrier = self
            .channel_carrier(name, version)
            .ok_or_else(|| unresolved_subject(entry, path, Vec::new()))?;
        let carrier_type = self.require_type_reference(
            carrier,
            TypeKind::Object,
            entry,
            format!("{path}.carrier"),
        )?;
        for (message_index, message) in body.messages.iter().enumerate() {
            let message_path = format!("{path}.messages[{message_index}]");
            let field = self.require_field_on_type(
                carrier_type,
                &message.field,
                entry,
                format!("{message_path}.field"),
            )?;
            if field.r#type.base != message.r#type {
                return Err(unresolved_reference(
                    entry,
                    format!("{message_path}.type"),
                    format!(
                        "channel field {} has type {}, not {}",
                        message.field, field.r#type.base, message.r#type
                    ),
                ));
            }
            self.require_type_reference(
                &message.r#type,
                TypeKind::Object,
                entry,
                format!("{message_path}.type"),
            )?;
        }
        Ok(())
    }

    fn bind_invariant_law(
        &self,
        entry: &LawEntryV1,
        coordinate: SubjectCoordinate<'_>,
        path: &str,
    ) -> Result<(), WeslawError> {
        match coordinate {
            SubjectCoordinate::Type(name) => {
                self.require_type(name, TypeKind::Object, entry, path)?;
            }
            SubjectCoordinate::Input(name) => {
                self.require_type(name, TypeKind::InputObject, entry, path)?;
            }
            SubjectCoordinate::Enum(name) => {
                self.require_type(name, TypeKind::Enum, entry, path)?;
            }
            SubjectCoordinate::Field { owner, field } => {
                self.require_field(owner, field, entry, path)?;
            }
            SubjectCoordinate::Operation {
                operation_type,
                field,
            } => {
                self.require_operation(operation_type, field, entry, path)?;
            }
            SubjectCoordinate::Family(name) if name == self.law_ir.family => {}
            _ => {
                return Err(wrong_subject_kind(
                    entry,
                    path,
                    "type:<Name>, input:<Name>, enum:<Name>, field:<Type>.<field>, operation:<Root>.<field>, or family:<name>",
                ));
            }
        }
        let LawEntryBodyV1::InvariantLaw(body) = &entry.body else {
            return Err(wrong_subject_kind(entry, path, "invariant law body"));
        };
        match &body.predicate {
            PredicateV1::FieldEquals { field, .. } => {
                self.require_predicate_field(
                    coordinate,
                    field,
                    entry,
                    format!("{path}.predicate.field"),
                )?;
            }
            PredicateV1::External { verifier, .. } => {
                if !self
                    .law_ir
                    .registries
                    .verifiers
                    .iter()
                    .any(|candidate| candidate.id == *verifier)
                {
                    return Err(unresolved_reference(
                        entry,
                        format!("{path}.predicate.verifier"),
                        format!("verifier {verifier} is not declared"),
                    ));
                }
            }
        }
        Ok(())
    }

    fn require_type(
        &self,
        name: &str,
        expected_kind: TypeKind,
        entry: &LawEntryV1,
        path: &str,
    ) -> Result<&TypeDefinition, WeslawError> {
        match self.find_type(name) {
            Some(definition) if definition.kind == expected_kind => Ok(definition),
            Some(_) => Err(wrong_subject_kind(
                entry,
                path,
                expected_kind_label(expected_kind),
            )),
            None => Err(unresolved_subject(
                entry,
                path,
                self.closest_type_subjects(name),
            )),
        }
    }

    fn require_type_reference(
        &self,
        name: &str,
        expected_kind: TypeKind,
        entry: &LawEntryV1,
        path: impl Into<String>,
    ) -> Result<&TypeDefinition, WeslawError> {
        match self.find_type(name) {
            Some(definition) if definition.kind == expected_kind => Ok(definition),
            Some(definition) => Err(unresolved_reference(
                entry,
                path,
                format!(
                    "type {name} has kind {:?}, expected {:?}",
                    definition.kind, expected_kind
                ),
            )),
            None => Err(unresolved_reference(
                entry,
                path,
                format!("type {name} is not declared"),
            )),
        }
    }

    fn require_input_field<'a>(
        &self,
        input: &'a TypeDefinition,
        field: &str,
        entry: &LawEntryV1,
        path: impl Into<String>,
    ) -> Result<&'a Field, WeslawError> {
        if input.kind != TypeKind::InputObject {
            return Err(unresolved_reference(
                entry,
                path,
                format!("{} is not an input object", input.name),
            ));
        }
        self.require_field_on_type(input, field, entry, path)
    }

    fn require_field_on_type<'a>(
        &self,
        definition: &'a TypeDefinition,
        field: &str,
        entry: &LawEntryV1,
        path: impl Into<String>,
    ) -> Result<&'a Field, WeslawError> {
        let path = path.into();
        definition
            .fields
            .iter()
            .find(|candidate| candidate.name == field)
            .ok_or_else(|| {
                unresolved_reference(
                    entry,
                    path,
                    format!("{} has no field {field}", definition.name),
                )
            })
    }

    fn require_field(
        &self,
        owner: &str,
        field: &str,
        entry: &LawEntryV1,
        path: &str,
    ) -> Result<(), WeslawError> {
        let Some(definition) = self.find_type(owner) else {
            return Err(unresolved_subject(
                entry,
                path,
                self.closest_type_subjects(owner),
            ));
        };
        if !matches!(
            definition.kind,
            TypeKind::Object | TypeKind::Interface | TypeKind::InputObject
        ) {
            return Err(wrong_subject_kind(
                entry,
                path,
                "field:<ObjectOrInterfaceOrInput>.<field>",
            ));
        }
        if definition
            .fields
            .iter()
            .any(|candidate| candidate.name == field)
        {
            Ok(())
        } else {
            Err(unresolved_subject(
                entry,
                path,
                definition
                    .fields
                    .iter()
                    .map(|candidate| format!("field:{owner}.{}", candidate.name))
                    .collect(),
            ))
        }
    }

    fn require_operation(
        &self,
        operation_type: OperationType,
        field: &str,
        entry: &LawEntryV1,
        path: &str,
    ) -> Result<&SchemaOperation, WeslawError> {
        if let Some(operation) = self.operations.iter().find(|candidate| {
            candidate.operation_type == operation_type && candidate.field_name == field
        }) {
            Ok(operation)
        } else {
            Err(unresolved_subject(
                entry,
                path,
                self.closest_operation_subjects(operation_type),
            ))
        }
    }

    fn require_resource(
        &self,
        resource: &str,
        entry: &LawEntryV1,
        path: impl Into<String>,
    ) -> Result<(), WeslawError> {
        if self.find_type(resource).is_some()
            || self
                .law_ir
                .registries
                .resources
                .iter()
                .any(|candidate| candidate.id == resource)
        {
            Ok(())
        } else {
            Err(unresolved_reference(
                entry,
                path,
                format!("resource {resource} is neither a GraphQL type nor registry entry"),
            ))
        }
    }

    fn require_arg_path(
        &self,
        operation: &SchemaOperation,
        arg_path: &str,
        entry: &LawEntryV1,
        path: impl Into<String>,
    ) -> Result<(), WeslawError> {
        let path = path.into();
        let mut segments = arg_path.split('.');
        let Some(arg_name) = segments.next() else {
            return Err(unresolved_reference(entry, path, "empty argument path"));
        };
        let Some(argument) = operation
            .arguments
            .iter()
            .find(|candidate| candidate.name == arg_name)
        else {
            return Err(unresolved_reference(
                entry,
                path,
                format!(
                    "operation {}.{} has no argument {arg_name}",
                    operation_type_coordinate(operation.operation_type),
                    operation.field_name
                ),
            ));
        };

        let mut current_type = argument.r#type.base.as_str();
        for segment in segments {
            let definition = self.require_type_reference(
                current_type,
                TypeKind::InputObject,
                entry,
                path.clone(),
            )?;
            let field = self.require_input_field(definition, segment, entry, path.clone())?;
            current_type = field.r#type.base.as_str();
        }
        Ok(())
    }

    fn require_predicate_field(
        &self,
        coordinate: SubjectCoordinate<'_>,
        field_path: &str,
        entry: &LawEntryV1,
        path: impl Into<String>,
    ) -> Result<(), WeslawError> {
        let path = path.into();
        let root = match coordinate {
            SubjectCoordinate::Type(name) | SubjectCoordinate::Input(name) => name,
            SubjectCoordinate::Field { owner, .. } => owner,
            _ => {
                return Err(unresolved_reference(
                    entry,
                    path.clone(),
                    "fieldEquals predicates require a type, input, or field subject",
                ));
            }
        };
        let mut current_type = root;
        for segment in field_path.split('.') {
            let definition = self.find_type(current_type).ok_or_else(|| {
                unresolved_reference(
                    entry,
                    path.clone(),
                    format!("type {current_type} is not declared"),
                )
            })?;
            let field = self.require_field_on_type(definition, segment, entry, path.clone())?;
            current_type = field.r#type.base.as_str();
        }
        Ok(())
    }

    fn find_type(&self, name: &str) -> Option<&TypeDefinition> {
        self.schema_ir
            .types
            .iter()
            .find(|candidate| candidate.name == name)
    }

    fn closest_type_subjects(&self, name: &str) -> Vec<String> {
        let mut candidates = self
            .schema_ir
            .types
            .iter()
            .filter(|candidate| shares_prefix(&candidate.name, name))
            .map(|candidate| {
                format!(
                    "{}:{}",
                    coordinate_prefix_for_type(candidate.kind),
                    candidate.name
                )
            })
            .collect::<Vec<_>>();
        candidates.sort();
        candidates
    }

    fn closest_operation_subjects(&self, operation_type: OperationType) -> Vec<String> {
        let mut candidates = self
            .operations
            .iter()
            .filter(|candidate| candidate.operation_type == operation_type)
            .map(|candidate| {
                format!(
                    "operation:{}.{}",
                    operation_type_coordinate(candidate.operation_type),
                    candidate.field_name
                )
            })
            .collect::<Vec<_>>();
        candidates.sort();
        candidates
    }

    fn channel_carrier(&self, name: &str, version: u64) -> Option<&str> {
        if let Some(channel) = self
            .law_ir
            .registries
            .channels
            .iter()
            .find(|channel| channel.name == name && channel.version == version)
        {
            return Some(channel.carrier.as_str());
        }

        self.schema_ir
            .types
            .iter()
            .find(|definition| {
                definition
                    .directives
                    .get("wes_channel")
                    .is_some_and(|value| {
                        value.get("name").and_then(serde_json::Value::as_str) == Some(name)
                            && value.get("version").and_then(serde_json::Value::as_u64)
                                == Some(version)
                    })
            })
            .map(|definition| definition.name.as_str())
    }
}

#[derive(Clone, Copy)]
enum SubjectCoordinate<'a> {
    Scalar(&'a str),
    Type(&'a str),
    Input(&'a str),
    Enum(&'a str),
    Field {
        owner: &'a str,
        field: &'a str,
    },
    Operation {
        operation_type: OperationType,
        field: &'a str,
    },
    Channel {
        name: &'a str,
        version: u64,
    },
    Family(&'a str),
}

fn parse_subject_coordinate<'a>(
    subject: &'a str,
    path: &str,
) -> Result<SubjectCoordinate<'a>, WeslawError> {
    if let Some(name) = subject.strip_prefix("scalar:") {
        require_graphql_name(name, subject, path)?;
        return Ok(SubjectCoordinate::Scalar(name));
    }
    if let Some(name) = subject.strip_prefix("type:") {
        require_graphql_name(name, subject, path)?;
        return Ok(SubjectCoordinate::Type(name));
    }
    if let Some(name) = subject.strip_prefix("input:") {
        require_graphql_name(name, subject, path)?;
        return Ok(SubjectCoordinate::Input(name));
    }
    if let Some(name) = subject.strip_prefix("enum:") {
        require_graphql_name(name, subject, path)?;
        return Ok(SubjectCoordinate::Enum(name));
    }
    if let Some(rest) = subject.strip_prefix("field:") {
        let (owner, field) = split_once(rest, '.', subject, path)?;
        require_graphql_name(owner, subject, path)?;
        require_graphql_name(field, subject, path)?;
        return Ok(SubjectCoordinate::Field { owner, field });
    }
    if let Some(rest) = subject.strip_prefix("operation:") {
        let (root, field) = split_once(rest, '.', subject, path)?;
        let operation_type = parse_operation_type(root, subject, path)?;
        require_graphql_name(field, subject, path)?;
        return Ok(SubjectCoordinate::Operation {
            operation_type,
            field,
        });
    }
    if let Some(rest) = subject.strip_prefix("channel:") {
        let (name, version_text) = split_once(rest, '@', subject, path)?;
        require_dotted_name(name, subject, path)?;
        let version = version_text.parse::<u64>().map_err(|_| {
            invalid_coordinate(subject, path, "channel version must be an unsigned integer")
        })?;
        return Ok(SubjectCoordinate::Channel { name, version });
    }
    if let Some(name) = subject.strip_prefix("family:") {
        require_dotted_name(name, subject, path)?;
        return Ok(SubjectCoordinate::Family(name));
    }

    Err(invalid_coordinate(
        subject,
        path,
        "unknown subject coordinate prefix",
    ))
}

fn validate_schema_hash_anchor(schema_hash: &str, path: &str) -> Result<(), WeslawError> {
    let Some(hex) = schema_hash.strip_prefix("sha256:") else {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "schema hash must use sha256:<64 lowercase hex>",
        ));
    };
    if hex.len() == 64
        && hex
            .chars()
            .all(|character| character.is_ascii_hexdigit() && !character.is_ascii_uppercase())
    {
        Ok(())
    } else {
        Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "schema hash must use sha256:<64 lowercase hex>",
        ))
    }
}

fn split_once<'a>(
    value: &'a str,
    delimiter: char,
    subject: &str,
    path: &str,
) -> Result<(&'a str, &'a str), WeslawError> {
    let Some((left, right)) = value.split_once(delimiter) else {
        return Err(invalid_coordinate(
            subject,
            path,
            "missing coordinate delimiter",
        ));
    };
    if left.is_empty() || right.is_empty() || right.contains(delimiter) {
        return Err(invalid_coordinate(
            subject,
            path,
            "invalid coordinate segments",
        ));
    }
    Ok((left, right))
}

fn parse_operation_type(
    value: &str,
    subject: &str,
    path: &str,
) -> Result<OperationType, WeslawError> {
    match value {
        "Query" => Ok(OperationType::Query),
        "Mutation" => Ok(OperationType::Mutation),
        "Subscription" => Ok(OperationType::Subscription),
        _ => Err(invalid_coordinate(
            subject,
            path,
            "operation root must be Query, Mutation, or Subscription",
        )),
    }
}

fn require_graphql_name(name: &str, subject: &str, path: &str) -> Result<(), WeslawError> {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return Err(invalid_coordinate(subject, path, "empty GraphQL name"));
    };
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return Err(invalid_coordinate(subject, path, "invalid GraphQL name"));
    }
    if chars.all(|character| character == '_' || character.is_ascii_alphanumeric()) {
        Ok(())
    } else {
        Err(invalid_coordinate(subject, path, "invalid GraphQL name"))
    }
}

fn require_dotted_name(value: &str, subject: &str, path: &str) -> Result<(), WeslawError> {
    if value.split('.').all(is_dotted_token) {
        Ok(())
    } else {
        Err(invalid_coordinate(subject, path, "invalid dotted name"))
    }
}

fn is_dotted_token(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_lowercase()
        && chars.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

fn invalid_coordinate(subject: &str, path: &str, detail: &str) -> WeslawError {
    WeslawError::at_path(
        WeslawDiagnosticCode::InvalidCoordinate,
        path,
        format!("{detail}: {subject}"),
    )
}

fn unresolved_subject(entry: &LawEntryV1, path: &str, closest_matches: Vec<String>) -> WeslawError {
    let mut message = format!(
        "unresolved subject coordinate {} for law {}",
        entry.subject, entry.id
    );
    if !closest_matches.is_empty() {
        message.push_str("; closest matches: ");
        message.push_str(&closest_matches.join(", "));
    }
    WeslawError::at_path(
        WeslawDiagnosticCode::UnresolvedSubject,
        subject_path(path),
        message,
    )
}

fn wrong_subject_kind(entry: &LawEntryV1, path: &str, expected: &str) -> WeslawError {
    WeslawError::at_path(
        WeslawDiagnosticCode::WrongSubjectKind,
        subject_path(path),
        format!(
            "law {} with kind {:?} requires subject kind {expected}, got {}",
            entry.id, entry.kind, entry.subject
        ),
    )
}

fn unresolved_reference(
    entry: &LawEntryV1,
    path: impl Into<String>,
    detail: impl Into<String>,
) -> WeslawError {
    WeslawError::at_path(
        WeslawDiagnosticCode::UnresolvedReference,
        path,
        format!(
            "law {} has unresolved reference: {}",
            entry.id,
            detail.into()
        ),
    )
}

fn conflict(entry: &LawEntryV1, path: impl Into<String>, detail: impl Into<String>) -> WeslawError {
    WeslawError::at_path(
        WeslawDiagnosticCode::Conflict,
        path,
        format!("law {} is contradictory: {}", entry.id, detail.into()),
    )
}

fn subject_path(path: &str) -> String {
    if path.ends_with(".subject") {
        path.to_string()
    } else {
        format!("{path}.subject")
    }
}

fn expected_kind_label(kind: TypeKind) -> &'static str {
    match kind {
        TypeKind::Object => "type:<Name>",
        TypeKind::Interface => "interface:<Name>",
        TypeKind::Union => "union:<Name>",
        TypeKind::Enum => "enum:<Name>",
        TypeKind::Scalar => "scalar:<Name>",
        TypeKind::InputObject => "input:<Name>",
    }
}

fn coordinate_prefix_for_type(kind: TypeKind) -> &'static str {
    match kind {
        TypeKind::Object | TypeKind::Interface | TypeKind::Union => "type",
        TypeKind::Enum => "enum",
        TypeKind::Scalar => "scalar",
        TypeKind::InputObject => "input",
    }
}

fn operation_type_coordinate(operation_type: OperationType) -> &'static str {
    match operation_type {
        OperationType::Query => "Query",
        OperationType::Mutation => "Mutation",
        OperationType::Subscription => "Subscription",
    }
}

fn law_kind_has_unique_subject(kind: LawKindV1) -> bool {
    !matches!(kind, LawKindV1::InvariantLaw)
}

fn first_overlap(left: &[String], right: &[String]) -> Option<String> {
    let right = right.iter().collect::<HashSet<_>>();
    left.iter()
        .filter(|candidate| right.contains(candidate))
        .min()
        .cloned()
}

fn shares_prefix(left: &str, right: &str) -> bool {
    left.starts_with(right) || right.starts_with(left)
}

fn parse_registries(map: &Mapping) -> Result<LawRegistrySetV1, WeslawError> {
    reject_unknown_fields(map, "$.registries", &["resources", "verifiers", "channels"])?;
    Ok(LawRegistrySetV1 {
        resources: optional_sequence(map, "resources", "$.registries.resources")?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| {
                parse_resource_registry_entry(value, &format!("$.registries.resources[{index}]"))
            })
            .collect::<Result<Vec<_>, _>>()?,
        verifiers: optional_sequence(map, "verifiers", "$.registries.verifiers")?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| {
                parse_verifier_registry_entry(value, &format!("$.registries.verifiers[{index}]"))
            })
            .collect::<Result<Vec<_>, _>>()?,
        channels: optional_sequence(map, "channels", "$.registries.channels")?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| {
                parse_channel_registry_entry(value, &format!("$.registries.channels[{index}]"))
            })
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn parse_resource_registry_entry(
    value: &Yaml,
    path: &str,
) -> Result<ResourceRegistryEntryV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["id", "owner", "kind", "notes"])?;
    Ok(ResourceRegistryEntryV1 {
        id: required_string(map, "id", &format!("{path}.id"))?,
        owner: required_string(map, "owner", &format!("{path}.owner"))?,
        kind: required_string(map, "kind", &format!("{path}.kind"))?,
        notes: optional_string(map, "notes", &format!("{path}.notes"))?,
    })
}

fn parse_verifier_registry_entry(
    value: &Yaml,
    path: &str,
) -> Result<VerifierRegistryEntryV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["id", "owner", "inputContracts"])?;
    Ok(VerifierRegistryEntryV1 {
        id: required_string(map, "id", &format!("{path}.id"))?,
        owner: required_string(map, "owner", &format!("{path}.owner"))?,
        input_contracts: optional_string_list(
            map,
            "inputContracts",
            &format!("{path}.inputContracts"),
        )?
        .unwrap_or_default(),
    })
}

fn parse_channel_registry_entry(
    value: &Yaml,
    path: &str,
) -> Result<ChannelRegistryEntryV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["name", "version", "carrier"])?;
    Ok(ChannelRegistryEntryV1 {
        name: required_string(map, "name", &format!("{path}.name"))?,
        version: required_u64(map, "version", &format!("{path}.version"))?,
        carrier: required_string(map, "carrier", &format!("{path}.carrier"))?,
    })
}

fn parse_law_entry(value: &Yaml, path: &str) -> Result<Option<LawEntryV1>, WeslawError> {
    let map = expect_mapping(value, path)?;
    let status = parse_status(
        optional_string(map, "status", &format!("{path}.status"))?
            .unwrap_or_else(|| "active".to_string()),
        &format!("{path}.status"),
    )?;
    if status == LawStatusV1::Draft {
        return Ok(None);
    }

    let kind_text = required_string(map, "kind", &format!("{path}.kind"))?;
    let kind = parse_kind(&kind_text, &format!("{path}.kind"))?;
    reject_unknown_fields(map, path, allowed_law_fields(kind))?;

    let tags = optional_string_list(map, "tags", &format!("{path}.tags"))?.unwrap_or_default();
    let rationale = optional_string(map, "rationale", &format!("{path}.rationale"))?;
    let body = match kind {
        LawKindV1::ScalarSemantics => {
            LawEntryBodyV1::ScalarSemantics(parse_scalar_semantics(map, path)?)
        }
        LawKindV1::VariantLaw => LawEntryBodyV1::VariantLaw(parse_variant_law(map, path)?),
        LawKindV1::FootprintLaw => LawEntryBodyV1::FootprintLaw(parse_footprint_law(map, path)?),
        LawKindV1::ChannelLaw => LawEntryBodyV1::ChannelLaw(parse_channel_law(map, path)?),
        LawKindV1::InvariantLaw => LawEntryBodyV1::InvariantLaw(parse_invariant_law(map, path)?),
    };

    Ok(Some(LawEntryV1 {
        id: required_string(map, "id", &format!("{path}.id"))?,
        status,
        kind,
        subject: required_string(map, "subject", &format!("{path}.subject"))?,
        tags,
        rationale,
        body,
    }))
}

fn parse_scalar_semantics(map: &Mapping, path: &str) -> Result<ScalarSemanticsLawV1, WeslawError> {
    let semantics = required_mapping(map, "semantics", &format!("{path}.semantics"))?;
    reject_unknown_fields(
        semantics,
        &format!("{path}.semantics"),
        &[
            "representation",
            "minInclusive",
            "maxInclusive",
            "ordering",
            "scope",
            "forbids",
        ],
    )?;
    let representation = parse_scalar_representation(
        required_string(
            semantics,
            "representation",
            &format!("{path}.semantics.representation"),
        )?,
        &format!("{path}.semantics.representation"),
    )?;
    let min_inclusive = optional_u64(
        semantics,
        "minInclusive",
        &format!("{path}.semantics.minInclusive"),
    )?;
    let max_inclusive = optional_u64(
        semantics,
        "maxInclusive",
        &format!("{path}.semantics.maxInclusive"),
    )?;
    let forbids = optional_string_list(semantics, "forbids", &format!("{path}.semantics.forbids"))?
        .unwrap_or_default()
        .into_iter()
        .map(|item| parse_scalar_forbidden(item, &format!("{path}.semantics.forbids")))
        .collect::<Result<Vec<_>, _>>()?;
    let ordering = optional_string(semantics, "ordering", &format!("{path}.semantics.ordering"))?
        .map(|value| parse_scalar_ordering(value, &format!("{path}.semantics.ordering")))
        .transpose()?;
    validate_scalar_semantics(representation, min_inclusive, max_inclusive, &forbids, path)?;
    Ok(ScalarSemanticsLawV1 {
        representation,
        min_inclusive,
        max_inclusive,
        ordering,
        scope: optional_string(semantics, "scope", &format!("{path}.semantics.scope"))?,
        forbids,
    })
}

fn validate_scalar_semantics(
    representation: ScalarRepresentationV1,
    min_inclusive: Option<u64>,
    max_inclusive: Option<u64>,
    forbids: &[ScalarForbiddenInterpretationV1],
    path: &str,
) -> Result<(), WeslawError> {
    let is_integer = representation == ScalarRepresentationV1::Integer;
    if !is_integer {
        if min_inclusive.is_some() || max_inclusive.is_some() {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                format!("{path}.semantics.representation"),
                "integer ranges require representation: integer",
            ));
        }
        if forbids.contains(&ScalarForbiddenInterpretationV1::SilentGraphqlIntNarrowing) {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                format!("{path}.semantics.forbids"),
                "silentGraphQLIntNarrowing is meaningful only for integer-like scalars",
            ));
        }
    }
    if let (Some(min), Some(max)) = (min_inclusive, max_inclusive) {
        if min > max {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                format!("{path}.semantics.maxInclusive"),
                "minInclusive must not exceed maxInclusive",
            ));
        }
    }
    Ok(())
}

fn parse_variant_law(map: &Mapping, path: &str) -> Result<VariantLawV1, WeslawError> {
    let discriminator = required_mapping(map, "discriminator", &format!("{path}.discriminator"))?;
    reject_unknown_fields(
        discriminator,
        &format!("{path}.discriminator"),
        &["field", "enum"],
    )?;
    let cases = required_sequence(map, "cases", &format!("{path}.cases"))?
        .iter()
        .enumerate()
        .map(|(index, value)| parse_variant_case(value, &format!("{path}.cases[{index}]")))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(VariantLawV1 {
        discriminator: VariantDiscriminatorV1 {
            field: required_string(
                discriminator,
                "field",
                &format!("{path}.discriminator.field"),
            )?,
            r#enum: required_string(discriminator, "enum", &format!("{path}.discriminator.enum"))?,
        },
        cases,
    })
}

fn parse_variant_case(value: &Yaml, path: &str) -> Result<VariantCaseV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["value", "requires", "forbids"])?;
    Ok(VariantCaseV1 {
        value: required_string(map, "value", &format!("{path}.value"))?,
        requires: optional_string_list(map, "requires", &format!("{path}.requires"))?
            .unwrap_or_default(),
        forbids: optional_string_list(map, "forbids", &format!("{path}.forbids"))?
            .unwrap_or_default(),
    })
}

fn parse_footprint_law(map: &Mapping, path: &str) -> Result<FootprintLawV1, WeslawError> {
    Ok(FootprintLawV1 {
        reads: optional_string_list(map, "reads", &format!("{path}.reads"))?.unwrap_or_default(),
        writes: optional_string_list(map, "writes", &format!("{path}.writes"))?.unwrap_or_default(),
        creates: optional_string_list(map, "creates", &format!("{path}.creates"))?
            .unwrap_or_default(),
        forbids: optional_string_list(map, "forbids", &format!("{path}.forbids"))?
            .unwrap_or_default(),
        slots: optional_sequence(map, "slots", &format!("{path}.slots"))?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| parse_footprint_slot(value, &format!("{path}.slots[{index}]")))
            .collect::<Result<Vec<_>, _>>()?,
        closures: optional_sequence(map, "closures", &format!("{path}.closures"))?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| {
                parse_footprint_closure(value, &format!("{path}.closures[{index}]"))
            })
            .collect::<Result<Vec<_>, _>>()?,
        create_slots: optional_sequence(map, "createSlots", &format!("{path}.createSlots"))?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| parse_create_slot(value, &format!("{path}.createSlots[{index}]")))
            .collect::<Result<Vec<_>, _>>()?,
        updates: optional_sequence(map, "updates", &format!("{path}.updates"))?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| {
                parse_footprint_update(value, &format!("{path}.updates[{index}]"))
            })
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn parse_footprint_slot(value: &Yaml, path: &str) -> Result<FootprintSlotV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["name", "kind", "bindFromArg", "access"])?;
    Ok(FootprintSlotV1 {
        name: required_string(map, "name", &format!("{path}.name"))?,
        kind: required_string(map, "kind", &format!("{path}.kind"))?,
        bind_from_arg: required_string(map, "bindFromArg", &format!("{path}.bindFromArg"))?,
        access: optional_string_list(map, "access", &format!("{path}.access"))?.unwrap_or_default(),
    })
}

fn parse_footprint_closure(value: &Yaml, path: &str) -> Result<FootprintClosureV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(
        map,
        path,
        &[
            "name",
            "fromSlot",
            "operator",
            "argBindings",
            "reads",
            "cardinality",
        ],
    )?;
    Ok(FootprintClosureV1 {
        name: required_string(map, "name", &format!("{path}.name"))?,
        from_slot: required_string(map, "fromSlot", &format!("{path}.fromSlot"))?,
        operator: required_string(map, "operator", &format!("{path}.operator"))?,
        arg_bindings: optional_string_list(map, "argBindings", &format!("{path}.argBindings"))?
            .unwrap_or_default(),
        reads: optional_string_list(map, "reads", &format!("{path}.reads"))?.unwrap_or_default(),
        cardinality: optional_string(map, "cardinality", &format!("{path}.cardinality"))?
            .map(|value| parse_footprint_cardinality(value, &format!("{path}.cardinality")))
            .transpose()?
            .unwrap_or(FootprintCardinalityV1::One),
    })
}

fn parse_create_slot(value: &Yaml, path: &str) -> Result<CreateSlotV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["name", "kind", "cardinality"])?;
    Ok(CreateSlotV1 {
        name: required_string(map, "name", &format!("{path}.name"))?,
        kind: required_string(map, "kind", &format!("{path}.kind"))?,
        cardinality: optional_string(map, "cardinality", &format!("{path}.cardinality"))?
            .map(|value| parse_footprint_cardinality(value, &format!("{path}.cardinality")))
            .transpose()?,
    })
}

fn parse_footprint_update(value: &Yaml, path: &str) -> Result<FootprintUpdateV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["slot", "fields"])?;
    Ok(FootprintUpdateV1 {
        slot: required_string(map, "slot", &format!("{path}.slot"))?,
        fields: optional_string_list(map, "fields", &format!("{path}.fields"))?.unwrap_or_default(),
    })
}

fn parse_channel_law(map: &Mapping, path: &str) -> Result<ChannelLawV1, WeslawError> {
    Ok(ChannelLawV1 {
        ordered: required_bool(map, "ordered", &format!("{path}.ordered"))?,
        version: required_u64(map, "version", &format!("{path}.version"))?,
        compatibility: match mapping_get(map, "compatibility") {
            Some(value) => Some(parse_channel_compatibility(
                value,
                &format!("{path}.compatibility"),
            )?),
            None => None,
        },
        messages: optional_sequence(map, "messages", &format!("{path}.messages"))?
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, value)| {
                parse_channel_message(value, &format!("{path}.messages[{index}]"))
            })
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn parse_channel_compatibility(
    value: &Yaml,
    path: &str,
) -> Result<ChannelCompatibilityV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["versioning", "semverCoupled"])?;
    Ok(ChannelCompatibilityV1 {
        versioning: required_string(map, "versioning", &format!("{path}.versioning"))?,
        semver_coupled: required_bool(map, "semverCoupled", &format!("{path}.semverCoupled"))?,
    })
}

fn parse_channel_message(value: &Yaml, path: &str) -> Result<ChannelMessageV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["field", "type"])?;
    Ok(ChannelMessageV1 {
        field: required_string(map, "field", &format!("{path}.field"))?,
        r#type: required_string(map, "type", &format!("{path}.type"))?,
    })
}

fn parse_invariant_law(map: &Mapping, path: &str) -> Result<InvariantLawV1, WeslawError> {
    if mapping_get(map, "expr").is_some() {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::RawExprRejected,
            format!("{path}.expr"),
            "raw invariant expressions are not accepted in weslaw/v1",
        ));
    }
    let predicate = required_mapping(map, "predicate", &format!("{path}.predicate"))?;
    let predicate_path = format!("{path}.predicate");
    match required_string(predicate, "op", &format!("{predicate_path}.op"))?.as_str() {
        "fieldEquals" => {
            reject_unknown_fields(predicate, &predicate_path, &["op", "field", "value"])?;
            Ok(InvariantLawV1 {
                predicate: PredicateV1::FieldEquals {
                    field: required_string(predicate, "field", &format!("{predicate_path}.field"))?,
                    value: yaml_to_json_value(
                        required_value(predicate, "value", &format!("{predicate_path}.value"))?,
                        &format!("{predicate_path}.value"),
                    )?,
                },
            })
        }
        "external" => {
            reject_unknown_fields(
                predicate,
                &predicate_path,
                &["op", "verifier", "ref", "inputContract"],
            )?;
            Ok(InvariantLawV1 {
                predicate: PredicateV1::External {
                    verifier: required_string(
                        predicate,
                        "verifier",
                        &format!("{predicate_path}.verifier"),
                    )?,
                    r#ref: required_string(predicate, "ref", &format!("{predicate_path}.ref"))?,
                    input_contract: optional_string(
                        predicate,
                        "inputContract",
                        &format!("{predicate_path}.inputContract"),
                    )?,
                },
            })
        }
        other => Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            format!("{predicate_path}.op"),
            format!("unknown predicate op {other}"),
        )),
    }
}

fn parse_kind(kind: &str, path: &str) -> Result<LawKindV1, WeslawError> {
    match kind {
        "scalarSemantics" => Ok(LawKindV1::ScalarSemantics),
        "variantLaw" => Ok(LawKindV1::VariantLaw),
        "footprintLaw" => Ok(LawKindV1::FootprintLaw),
        "channelLaw" => Ok(LawKindV1::ChannelLaw),
        "invariantLaw" => Ok(LawKindV1::InvariantLaw),
        _ => Err(WeslawError::at_path(
            WeslawDiagnosticCode::UnknownKind,
            path,
            format!("unknown law kind {kind}"),
        )),
    }
}

fn parse_status(status: String, path: &str) -> Result<LawStatusV1, WeslawError> {
    match status.as_str() {
        "active" => Ok(LawStatusV1::Active),
        "draft" => Ok(LawStatusV1::Draft),
        _ => Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            format!("unknown law status {status}"),
        )),
    }
}

fn parse_scalar_representation(
    representation: String,
    path: &str,
) -> Result<ScalarRepresentationV1, WeslawError> {
    match representation.as_str() {
        "integer" => Ok(ScalarRepresentationV1::Integer),
        "opaqueIdentifier" => Ok(ScalarRepresentationV1::OpaqueIdentifier),
        "string" => Ok(ScalarRepresentationV1::String),
        _ => Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            format!("unknown scalar representation {representation}"),
        )),
    }
}

fn parse_scalar_forbidden(
    value: String,
    path: &str,
) -> Result<ScalarForbiddenInterpretationV1, WeslawError> {
    match value.as_str() {
        "silentGraphQLIntNarrowing" => {
            Ok(ScalarForbiddenInterpretationV1::SilentGraphqlIntNarrowing)
        }
        _ => Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            format!("unknown scalar forbidden interpretation {value}"),
        )),
    }
}

fn parse_scalar_ordering(value: String, path: &str) -> Result<ScalarOrderingV1, WeslawError> {
    match value.as_str() {
        "none" => Ok(ScalarOrderingV1::None),
        "lamport" => Ok(ScalarOrderingV1::Lamport),
        "total" => Ok(ScalarOrderingV1::Total),
        "partial" => Ok(ScalarOrderingV1::Partial),
        _ => Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            format!("unknown scalar ordering {value}"),
        )),
    }
}

fn parse_footprint_cardinality(
    value: String,
    path: &str,
) -> Result<FootprintCardinalityV1, WeslawError> {
    match value.as_str() {
        "one" => Ok(FootprintCardinalityV1::One),
        "optional" => Ok(FootprintCardinalityV1::Optional),
        "many" => Ok(FootprintCardinalityV1::Many),
        _ => Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            format!("unknown footprint cardinality {value}"),
        )),
    }
}

fn allowed_law_fields(kind: LawKindV1) -> &'static [&'static str] {
    match kind {
        LawKindV1::ScalarSemantics => &[
            "id",
            "status",
            "kind",
            "subject",
            "tags",
            "rationale",
            "semantics",
        ],
        LawKindV1::VariantLaw => &[
            "id",
            "status",
            "kind",
            "subject",
            "tags",
            "rationale",
            "discriminator",
            "cases",
        ],
        LawKindV1::FootprintLaw => &[
            "id",
            "status",
            "kind",
            "subject",
            "tags",
            "rationale",
            "reads",
            "writes",
            "creates",
            "forbids",
            "slots",
            "closures",
            "createSlots",
            "updates",
        ],
        LawKindV1::ChannelLaw => &[
            "id",
            "status",
            "kind",
            "subject",
            "tags",
            "rationale",
            "ordered",
            "version",
            "compatibility",
            "messages",
        ],
        LawKindV1::InvariantLaw => &[
            "id",
            "status",
            "kind",
            "subject",
            "tags",
            "rationale",
            "predicate",
            "expr",
        ],
    }
}

fn expect_mapping<'a>(value: &'a Yaml, path: &str) -> Result<&'a Mapping, WeslawError> {
    value.as_hash().ok_or_else(|| {
        WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "expected object",
        )
    })
}

fn required_mapping<'a>(
    map: &'a Mapping,
    key: &str,
    path: &str,
) -> Result<&'a Mapping, WeslawError> {
    let value = required_value(map, key, path)?;
    expect_mapping(value, path)
}

fn required_sequence<'a>(
    map: &'a Mapping,
    key: &str,
    path: &str,
) -> Result<&'a [Yaml], WeslawError> {
    let value = required_value(map, key, path)?;
    value.as_vec().map(Vec::as_slice).ok_or_else(|| {
        WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "expected array",
        )
    })
}

fn optional_sequence<'a>(
    map: &'a Mapping,
    key: &str,
    path: &str,
) -> Result<Option<&'a [Yaml]>, WeslawError> {
    match mapping_get(map, key) {
        Some(value) => value.as_vec().map(Vec::as_slice).map(Some).ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                "expected array",
            )
        }),
        None => Ok(None),
    }
}

fn required_value<'a>(map: &'a Mapping, key: &str, path: &str) -> Result<&'a Yaml, WeslawError> {
    mapping_get(map, key).ok_or_else(|| {
        WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            format!("missing required field {key}"),
        )
    })
}

fn required_string(map: &Mapping, key: &str, path: &str) -> Result<String, WeslawError> {
    required_value(map, key, path)?
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                "expected string",
            )
        })
}

fn optional_string(map: &Mapping, key: &str, path: &str) -> Result<Option<String>, WeslawError> {
    match mapping_get(map, key) {
        Some(value) => value.as_str().map(str::to_string).map(Some).ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::InvalidDocument,
                path,
                "expected string",
            )
        }),
        None => Ok(None),
    }
}

fn required_u64(map: &Mapping, key: &str, path: &str) -> Result<u64, WeslawError> {
    yaml_u64(required_value(map, key, path)?, path)
}

fn optional_u64(map: &Mapping, key: &str, path: &str) -> Result<Option<u64>, WeslawError> {
    match mapping_get(map, key) {
        Some(value) => yaml_u64(value, path).map(Some),
        None => Ok(None),
    }
}

fn yaml_u64(value: &Yaml, path: &str) -> Result<u64, WeslawError> {
    let Some(integer) = value.as_i64() else {
        return Err(WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "expected unsigned integer",
        ));
    };
    u64::try_from(integer).map_err(|_| {
        WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "expected unsigned integer",
        )
    })
}

fn required_bool(map: &Mapping, key: &str, path: &str) -> Result<bool, WeslawError> {
    required_value(map, key, path)?.as_bool().ok_or_else(|| {
        WeslawError::at_path(
            WeslawDiagnosticCode::InvalidDocument,
            path,
            "expected boolean",
        )
    })
}

fn optional_string_list(
    map: &Mapping,
    key: &str,
    path: &str,
) -> Result<Option<Vec<String>>, WeslawError> {
    match mapping_get(map, key) {
        Some(value) => {
            let sequence = value.as_vec().ok_or_else(|| {
                WeslawError::at_path(
                    WeslawDiagnosticCode::InvalidDocument,
                    path,
                    "expected string array",
                )
            })?;
            sequence
                .iter()
                .enumerate()
                .map(|(index, item)| {
                    item.as_str().map(str::to_string).ok_or_else(|| {
                        WeslawError::at_path(
                            WeslawDiagnosticCode::InvalidDocument,
                            format!("{path}[{index}]"),
                            "expected string",
                        )
                    })
                })
                .collect::<Result<Vec<_>, _>>()
                .map(Some)
        }
        None => Ok(None),
    }
}

fn reject_unknown_fields(map: &Mapping, path: &str, allowed: &[&str]) -> Result<(), WeslawError> {
    for key in map.keys() {
        let key_text = key.as_str().ok_or_else(|| {
            WeslawError::at_path(
                WeslawDiagnosticCode::UnknownField,
                path,
                "object keys must be strings",
            )
        })?;
        if !allowed.contains(&key_text) {
            return Err(WeslawError::at_path(
                WeslawDiagnosticCode::UnknownField,
                format!("{path}.{key_text}"),
                format!("unknown field {key_text}"),
            ));
        }
    }
    Ok(())
}

fn mapping_get<'a>(map: &'a Mapping, key: &str) -> Option<&'a Yaml> {
    map.get(&Yaml::String(key.to_string()))
}

fn yaml_to_json_value(value: &Yaml, path: &str) -> Result<serde_json::Value, WeslawError> {
    match value {
        Yaml::Real(text) => {
            let number = text
                .parse::<f64>()
                .ok()
                .and_then(serde_json::Number::from_f64);
            number
                .map(serde_json::Value::Number)
                .ok_or_else(|| invalid_json_value(path, "unsupported YAML real value"))
        }
        Yaml::Integer(integer) => Ok(serde_json::Value::Number((*integer).into())),
        Yaml::String(text) => Ok(serde_json::Value::String(text.clone())),
        Yaml::Boolean(value) => Ok(serde_json::Value::Bool(*value)),
        Yaml::Array(items) => items
            .iter()
            .enumerate()
            .map(|(index, item)| yaml_to_json_value(item, &format!("{path}[{index}]")))
            .collect::<Result<Vec<_>, _>>()
            .map(serde_json::Value::Array),
        Yaml::Hash(map) => {
            let mut object = serde_json::Map::new();
            for (key, value) in map {
                let Some(key_text) = key.as_str() else {
                    return Err(invalid_json_value(path, "YAML object keys must be strings"));
                };
                object.insert(
                    key_text.to_string(),
                    yaml_to_json_value(value, &format!("{path}.{key_text}"))?,
                );
            }
            Ok(serde_json::Value::Object(object))
        }
        Yaml::Null => Ok(serde_json::Value::Null),
        Yaml::Alias(_) | Yaml::BadValue => Err(invalid_json_value(
            path,
            "unsupported YAML value for JSON conversion",
        )),
    }
}

fn invalid_json_value(path: &str, message: &str) -> WeslawError {
    WeslawError::at_path(WeslawDiagnosticCode::InvalidDocument, path, message)
}
