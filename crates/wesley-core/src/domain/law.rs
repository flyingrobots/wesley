//! `weslaw` semantic Law IR v1.
//!
//! This module owns the first typed Rust substrate for `weslaw/v1` authoring
//! documents and the normalized `wesley.law-ir/v1` representation.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use yaml_rust2::yaml::Hash as Mapping;
use yaml_rust2::{Yaml, YamlLoader};

use super::ir::to_canonical_json;

/// Authored `weslaw` document API version accepted by the v1 loader.
pub const WESLAW_API_VERSION: &str = "weslaw/v1";

/// Normalized Wesley Law IR API version emitted by the v1 loader.
pub const WESLEY_LAW_IR_API_VERSION: &str = "wesley.law-ir/v1";

/// Canonical JSON codec name for future Law IR hashing.
pub const WESLEY_LAW_IR_CANONICAL_JSON_CODEC: &str = "wesley.law-ir.canonical-json.v1";

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
    pub ordering: Option<String>,
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

/// Closed forbidden scalar interpretation enum.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
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
    pub cardinality: String,
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
    pub cardinality: Option<String>,
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
        let entry = parse_law_entry(law_value, &path)?;
        if entry.status == LawStatusV1::Active {
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

fn sort_law_ir_entries(entries: &mut [LawEntryV1]) {
    entries.sort_by(|left, right| left.id.cmp(&right.id));
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

fn parse_law_entry(value: &Yaml, path: &str) -> Result<LawEntryV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    let kind_text = required_string(map, "kind", &format!("{path}.kind"))?;
    let kind = parse_kind(&kind_text, &format!("{path}.kind"))?;
    reject_unknown_fields(map, path, allowed_law_fields(kind))?;

    let status = parse_status(
        optional_string(map, "status", &format!("{path}.status"))?
            .unwrap_or_else(|| "active".to_string()),
        &format!("{path}.status"),
    )?;
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

    Ok(LawEntryV1 {
        id: required_string(map, "id", &format!("{path}.id"))?,
        status,
        kind,
        subject: required_string(map, "subject", &format!("{path}.subject"))?,
        tags,
        rationale,
        body,
    })
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
    validate_scalar_semantics(representation, min_inclusive, max_inclusive, &forbids, path)?;
    Ok(ScalarSemanticsLawV1 {
        representation,
        min_inclusive,
        max_inclusive,
        ordering: optional_string(semantics, "ordering", &format!("{path}.semantics.ordering"))?,
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
        cardinality: required_string(map, "cardinality", &format!("{path}.cardinality"))?,
    })
}

fn parse_create_slot(value: &Yaml, path: &str) -> Result<CreateSlotV1, WeslawError> {
    let map = expect_mapping(value, path)?;
    reject_unknown_fields(map, path, &["name", "kind", "cardinality"])?;
    Ok(CreateSlotV1 {
        name: required_string(map, "name", &format!("{path}.name"))?,
        kind: required_string(map, "kind", &format!("{path}.kind"))?,
        cardinality: optional_string(map, "cardinality", &format!("{path}.cardinality"))?,
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
