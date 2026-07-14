//! Canonical input and provenance contracts for external semantic generators.
//!
//! The types in this module are deliberately domain-empty. They bind Wesley's
//! canonical compiler facts to explicit owner declarations and generated
//! outputs without interpreting any external target's semantics.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use super::ir::{compute_content_hash_bytes, to_canonical_json, WesleyIR};
use super::law::{
    compute_law_hash_v1, to_canonical_law_ir_json, validate_law_ir_v1_bindings,
    FootprintCardinalityV1, LawEntryBodyV1, LawIrV1, LawStatusV1, WESLEY_LAW_IR_API_VERSION,
};
use super::operation::{OperationType, SchemaOperation};

/// API version for [`ExtensionGenerationInputV1`].
pub const WESLEY_EXTENSION_GENERATION_INPUT_API_VERSION: &str =
    "wesley.extension-generation-input/v1";

/// Canonical JSON codec for [`ExtensionGenerationInputV1`].
pub const WESLEY_EXTENSION_GENERATION_INPUT_CODEC: &str =
    "wesley.extension-generation-input.canonical-json.v1";

/// API version for [`GenerationProvenanceManifestV1`].
pub const WESLEY_GENERATION_PROVENANCE_MANIFEST_API_VERSION: &str =
    "wesley.generation-provenance-manifest/v1";

/// Canonical JSON codec for [`GenerationProvenanceManifestV1`].
pub const WESLEY_GENERATION_PROVENANCE_MANIFEST_CODEC: &str =
    "wesley.generation-provenance-manifest.canonical-json.v1";

/// API version for the derived [`GenerationReviewV1`] projection.
pub const WESLEY_GENERATION_REVIEW_API_VERSION: &str = "wesley.generation-review/v1";

/// Canonical JSON codec for [`GenerationReviewV1`].
pub const WESLEY_GENERATION_REVIEW_CODEC: &str = "wesley.generation-review.canonical-json.v1";

/// ABI version implemented by external semantic generators consuming this contract.
pub const WESLEY_EXTENSION_GENERATOR_ABI_VERSION: &str = "wesley.extension-generator/v1";

const INPUT_HASH_DOMAIN: &str = "wesley.extension-generation-input.digest.v1";
const PROVENANCE_HASH_DOMAIN: &str = "wesley.generation-provenance-manifest.digest.v1";

/// One content-addressed source or generated artifact.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationArtifactReferenceV1 {
    /// Stable owner-defined artifact coordinate.
    pub coordinate: String,
    /// Exact SHA-256 digest of the referenced bytes.
    pub digest: String,
}

impl GenerationArtifactReferenceV1 {
    /// Constructs a reference by hashing exact artifact bytes.
    pub fn for_bytes(
        coordinate: impl Into<String>,
        bytes: &[u8],
    ) -> Result<Self, GenerationContractError> {
        let coordinate = coordinate.into();
        validate_coordinate(&coordinate)?;
        Ok(Self {
            coordinate,
            digest: compute_generation_artifact_digest_v1(bytes),
        })
    }
}

/// Exact bytes supplied to provenance verification for one artifact coordinate.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenerationArtifactContentV1 {
    /// Stable owner-defined artifact coordinate.
    pub coordinate: String,
    /// Exact artifact bytes.
    pub bytes: Vec<u8>,
}

impl GenerationArtifactContentV1 {
    /// Constructs resolved artifact content without performing ambient discovery.
    pub fn new(coordinate: impl Into<String>, bytes: Vec<u8>) -> Self {
        Self {
            coordinate: coordinate.into(),
            bytes,
        }
    }

    /// Computes the content-addressed reference for these exact bytes.
    pub fn reference(&self) -> GenerationArtifactReferenceV1 {
        GenerationArtifactReferenceV1 {
            coordinate: self.coordinate.clone(),
            digest: compute_generation_artifact_digest_v1(&self.bytes),
        }
    }
}

/// Canonical, validated Law IR carried into extension generation.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationLawInputV1 {
    /// Path-free, prose-free, normalized active Law IR.
    pub law_ir: LawIrV1,
    /// Exact semantic Law IR digest.
    pub semantic_digest: String,
    /// Exact canonical digest of the normalized typed Law IR.
    pub canonical_digest: String,
}

/// Pure semantic input consumed by an external generator.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExtensionGenerationInputV1 {
    /// Exact input contract version.
    pub api_version: String,
    /// Canonical path-free Wesley Shape IR.
    pub shape_ir: WesleyIR,
    /// Exact digest of canonical Shape IR bytes.
    pub shape_digest: String,
    /// Normalized root operation catalog.
    pub operations: Vec<SchemaOperation>,
    /// Optional validated semantic Law IR and its exact digests.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub law: Option<GenerationLawInputV1>,
    /// Exact owner-declaration artifacts outside Wesley Shape and Law IR.
    pub owner_declarations: Vec<GenerationArtifactReferenceV1>,
    /// Digest of explicit generator settings, computed by the caller.
    pub settings_digest: String,
    /// Owner-defined generated projection roles requested for this invocation.
    pub projection_roles: Vec<String>,
}

impl ExtensionGenerationInputV1 {
    /// Builds a canonical generation input from explicit in-memory facts.
    ///
    /// This function performs no filesystem, registry, network, clock, process,
    /// or environment access.
    pub fn new(
        shape_ir: WesleyIR,
        operations: Vec<SchemaOperation>,
        law_ir: Option<LawIrV1>,
        owner_declarations: Vec<GenerationArtifactReferenceV1>,
        settings_digest: String,
        projection_roles: Vec<String>,
    ) -> Result<Self, GenerationContractError> {
        validate_digest(&settings_digest, "settingsDigest")?;
        let shape_ir = normalize_shape_ir(shape_ir)?;
        let operations = normalize_operations(operations)?;
        let shape_json = canonical_json_bytes(&shape_ir)?;
        let shape_digest = compute_generation_artifact_digest_v1(&shape_json);
        let law = law_ir
            .map(|law_ir| normalize_law(law_ir, &shape_ir, &operations, &shape_digest))
            .transpose()?;

        Ok(Self {
            api_version: WESLEY_EXTENSION_GENERATION_INPUT_API_VERSION.to_owned(),
            shape_ir,
            shape_digest,
            operations,
            law,
            owner_declarations: normalize_references(owner_declarations)?,
            settings_digest,
            projection_roles: normalize_strings(projection_roles, "projectionRoles")?,
        })
    }

    /// Returns canonical JSON bytes after revalidating every embedded digest.
    pub fn canonical_bytes(&self) -> Result<Vec<u8>, GenerationContractError> {
        canonical_json_bytes(&self.normalized()?)
    }

    /// Computes the domain-separated digest of canonical generation input bytes.
    pub fn digest(&self) -> Result<String, GenerationContractError> {
        Ok(domain_digest(INPUT_HASH_DOMAIN, &self.canonical_bytes()?))
    }

    fn normalized(&self) -> Result<Self, GenerationContractError> {
        if self.api_version != WESLEY_EXTENSION_GENERATION_INPUT_API_VERSION {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::UnsupportedApiVersion,
                "apiVersion",
                WESLEY_EXTENSION_GENERATION_INPUT_API_VERSION,
                &self.api_version,
            ));
        }
        let normalized = Self::new(
            self.shape_ir.clone(),
            self.operations.clone(),
            self.law.as_ref().map(|law| law.law_ir.clone()),
            self.owner_declarations.clone(),
            self.settings_digest.clone(),
            self.projection_roles.clone(),
        )?;
        if self.shape_digest != normalized.shape_digest {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::ShapeDigestMismatch,
                "shapeDigest",
                &normalized.shape_digest,
                &self.shape_digest,
            ));
        }
        match (&self.law, &normalized.law) {
            (Some(actual), Some(expected)) => {
                if actual.semantic_digest != expected.semantic_digest {
                    return Err(GenerationContractError::mismatch(
                        GenerationContractErrorKind::LawDigestMismatch,
                        "law.semanticDigest",
                        &expected.semantic_digest,
                        &actual.semantic_digest,
                    ));
                }
                if actual.canonical_digest != expected.canonical_digest {
                    return Err(GenerationContractError::mismatch(
                        GenerationContractErrorKind::LawDigestMismatch,
                        "law.canonicalDigest",
                        &expected.canonical_digest,
                        &actual.canonical_digest,
                    ));
                }
            }
            (None, None) => {}
            _ => {
                return Err(GenerationContractError::new(
                    GenerationContractErrorKind::LawDigestMismatch,
                    "law",
                ));
            }
        }
        Ok(normalized)
    }
}

/// Generator executable or component identity bound into provenance.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GeneratorIdentityV1 {
    /// Stable generator coordinate.
    pub coordinate: String,
    /// Owner-defined generator release version.
    pub version: String,
    /// Exact digest of generator executable or component bytes.
    pub digest: String,
}

impl GeneratorIdentityV1 {
    /// Constructs a generator identity from exact executable or component bytes.
    pub fn for_bytes(
        coordinate: impl Into<String>,
        version: impl Into<String>,
        bytes: &[u8],
    ) -> Result<Self, GenerationContractError> {
        let value = Self {
            coordinate: coordinate.into(),
            version: version.into(),
            digest: compute_generation_artifact_digest_v1(bytes),
        };
        value.validate()?;
        Ok(value)
    }

    fn validate(&self) -> Result<(), GenerationContractError> {
        validate_coordinate(&self.coordinate)?;
        validate_coordinate_token(&self.version, "generator.version")?;
        validate_digest(&self.digest, &self.coordinate)
    }
}

/// Frozen schema and ABI identities used by one provenance manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationContractVersionsV1 {
    /// Extension-generation input schema identity.
    pub input_schema: String,
    /// Generation-provenance manifest schema identity.
    pub provenance_schema: String,
    /// External semantic-generator ABI identity.
    pub generator_abi: String,
}

impl Default for GenerationContractVersionsV1 {
    fn default() -> Self {
        Self {
            input_schema: WESLEY_EXTENSION_GENERATION_INPUT_API_VERSION.to_owned(),
            provenance_schema: WESLEY_GENERATION_PROVENANCE_MANIFEST_API_VERSION.to_owned(),
            generator_abi: WESLEY_EXTENSION_GENERATOR_ABI_VERSION.to_owned(),
        }
    }
}

/// Provenance for one deterministic external generation invocation.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationProvenanceManifestV1 {
    /// Exact manifest contract version.
    pub api_version: String,
    /// Exact generator identity.
    pub generator: GeneratorIdentityV1,
    /// Digest of the canonical [`ExtensionGenerationInputV1`].
    pub generation_input_digest: String,
    /// Digest of the explicit settings carried by the generation input.
    pub settings_digest: String,
    /// Frozen Wesley schema and generator ABI identities.
    pub contract_versions: GenerationContractVersionsV1,
    /// Exact owner-declaration source artifacts.
    pub source_artifacts: Vec<GenerationArtifactReferenceV1>,
    /// Exact emitted artifact references.
    pub emitted_artifacts: Vec<GenerationArtifactReferenceV1>,
}

impl GenerationProvenanceManifestV1 {
    /// Builds a provenance manifest from canonical input and explicit outputs.
    pub fn new(
        input: &ExtensionGenerationInputV1,
        generator: GeneratorIdentityV1,
        emitted_artifacts: Vec<GenerationArtifactReferenceV1>,
    ) -> Result<Self, GenerationContractError> {
        let input = input.normalized()?;
        generator.validate()?;
        let emitted_artifacts = normalize_references(emitted_artifacts)?;
        validate_manifest_reference_consistency(
            &generator,
            &input.owner_declarations,
            &emitted_artifacts,
        )?;
        Ok(Self {
            api_version: WESLEY_GENERATION_PROVENANCE_MANIFEST_API_VERSION.to_owned(),
            generator,
            generation_input_digest: input.digest()?,
            settings_digest: input.settings_digest.clone(),
            contract_versions: GenerationContractVersionsV1::default(),
            source_artifacts: input.owner_declarations.clone(),
            emitted_artifacts,
        })
    }

    /// Returns canonical JSON bytes for deterministic publication.
    pub fn canonical_bytes(&self) -> Result<Vec<u8>, GenerationContractError> {
        canonical_json_bytes(&self.normalized()?)
    }

    /// Computes the domain-separated manifest digest.
    pub fn digest(&self) -> Result<String, GenerationContractError> {
        Ok(domain_digest(
            PROVENANCE_HASH_DOMAIN,
            &self.canonical_bytes()?,
        ))
    }

    /// Verifies the generator and every referenced source and emitted artifact.
    pub fn verify(
        &self,
        input: &ExtensionGenerationInputV1,
        generator_bytes: &[u8],
        source_artifacts: &[GenerationArtifactContentV1],
        emitted_artifacts: &[GenerationArtifactContentV1],
    ) -> Result<GenerationProvenanceVerificationV1, GenerationContractError> {
        let manifest = self.normalized()?;
        let input = input.normalized()?;
        let input_digest = input.digest()?;
        if manifest.generation_input_digest != input_digest {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::GenerationInputDigestMismatch,
                "generationInputDigest",
                &input_digest,
                &manifest.generation_input_digest,
            ));
        }
        if manifest.settings_digest != input.settings_digest {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::SettingsDigestMismatch,
                "settingsDigest",
                &input.settings_digest,
                &manifest.settings_digest,
            ));
        }
        if manifest.source_artifacts != input.owner_declarations {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::SourceArtifactMismatch,
                "sourceArtifacts",
            ));
        }
        verify_digest(
            &manifest.generator.coordinate,
            &manifest.generator.digest,
            generator_bytes,
        )?;
        verify_materials(&manifest.source_artifacts, source_artifacts)?;
        verify_materials(&manifest.emitted_artifacts, emitted_artifacts)?;

        Ok(GenerationProvenanceVerificationV1 {
            generation_input_digest: input_digest,
            verified_source_count: manifest.source_artifacts.len(),
            verified_output_count: manifest.emitted_artifacts.len(),
        })
    }

    fn normalized(&self) -> Result<Self, GenerationContractError> {
        if self.api_version != WESLEY_GENERATION_PROVENANCE_MANIFEST_API_VERSION {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::UnsupportedApiVersion,
                "apiVersion",
                WESLEY_GENERATION_PROVENANCE_MANIFEST_API_VERSION,
                &self.api_version,
            ));
        }
        self.generator.validate()?;
        validate_digest(&self.generation_input_digest, "generationInputDigest")?;
        validate_digest(&self.settings_digest, "settingsDigest")?;
        let expected_versions = GenerationContractVersionsV1::default();
        if self.contract_versions != expected_versions {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::ContractVersionMismatch,
                "contractVersions",
            ));
        }
        let source_artifacts = normalize_references(self.source_artifacts.clone())?;
        let emitted_artifacts = normalize_references(self.emitted_artifacts.clone())?;
        validate_manifest_reference_consistency(
            &self.generator,
            &source_artifacts,
            &emitted_artifacts,
        )?;
        Ok(Self {
            api_version: self.api_version.clone(),
            generator: self.generator.clone(),
            generation_input_digest: self.generation_input_digest.clone(),
            settings_digest: self.settings_digest.clone(),
            contract_versions: expected_versions,
            source_artifacts,
            emitted_artifacts,
        })
    }
}

/// Receipt proving exact provenance materials were recomputed successfully.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationProvenanceVerificationV1 {
    /// Verified canonical generation-input digest.
    pub generation_input_digest: String,
    /// Number of exact source artifacts verified.
    pub verified_source_count: usize,
    /// Number of exact emitted artifacts verified.
    pub verified_output_count: usize,
}

/// Deterministic, derived, non-authoritative review projection.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationReviewV1 {
    /// Exact review projection version.
    pub api_version: String,
    /// Always false: this projection is never an authority artifact.
    #[serde(deserialize_with = "deserialize_non_authoritative")]
    authoritative: bool,
    /// Canonical generation-input digest.
    pub generation_input_digest: String,
    /// Canonical provenance-manifest digest.
    pub provenance_manifest_digest: String,
    /// Generator identity copied from the provenance manifest.
    pub generator: GeneratorIdentityV1,
    /// Owner-requested projection roles.
    pub projection_roles: Vec<String>,
    /// Exact source references copied from provenance.
    pub source_artifacts: Vec<GenerationArtifactReferenceV1>,
    /// Exact emitted references copied from provenance.
    pub emitted_artifacts: Vec<GenerationArtifactReferenceV1>,
}

fn deserialize_non_authoritative<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    if bool::deserialize(deserializer)? {
        return Err(serde::de::Error::custom(
            GenerationContractErrorKind::AuthoritativeReviewRejected.as_str(),
        ));
    }
    Ok(false)
}

impl GenerationReviewV1 {
    /// Returns false because review projections cannot claim authority.
    pub const fn authoritative(&self) -> bool {
        self.authoritative
    }

    /// Derives a non-authoritative review projection from validated input and provenance.
    pub fn from_manifest(
        input: &ExtensionGenerationInputV1,
        manifest: &GenerationProvenanceManifestV1,
    ) -> Result<Self, GenerationContractError> {
        let input = input.normalized()?;
        let manifest = manifest.normalized()?;
        let input_digest = input.digest()?;
        if manifest.generation_input_digest != input_digest {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::GenerationInputDigestMismatch,
                "generationInputDigest",
                &input_digest,
                &manifest.generation_input_digest,
            ));
        }
        if manifest.settings_digest != input.settings_digest {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::SettingsDigestMismatch,
                "settingsDigest",
                &input.settings_digest,
                &manifest.settings_digest,
            ));
        }
        if manifest.source_artifacts != input.owner_declarations {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::SourceArtifactMismatch,
                "sourceArtifacts",
            ));
        }
        Ok(Self {
            api_version: WESLEY_GENERATION_REVIEW_API_VERSION.to_owned(),
            authoritative: false,
            generation_input_digest: input_digest,
            provenance_manifest_digest: manifest.digest()?,
            generator: manifest.generator,
            projection_roles: input.projection_roles,
            source_artifacts: manifest.source_artifacts,
            emitted_artifacts: manifest.emitted_artifacts,
        })
    }

    /// Returns canonical JSON bytes for deterministic human review tooling.
    pub fn canonical_bytes(&self) -> Result<Vec<u8>, GenerationContractError> {
        if self.api_version != WESLEY_GENERATION_REVIEW_API_VERSION {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::UnsupportedApiVersion,
                "apiVersion",
                WESLEY_GENERATION_REVIEW_API_VERSION,
                &self.api_version,
            ));
        }
        if self.authoritative {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::AuthoritativeReviewRejected,
                "authoritative",
            ));
        }
        self.generator.validate()?;
        validate_digest(&self.generation_input_digest, "generationInputDigest")?;
        validate_digest(&self.provenance_manifest_digest, "provenanceManifestDigest")?;
        let normalized = Self {
            api_version: self.api_version.clone(),
            authoritative: false,
            generation_input_digest: self.generation_input_digest.clone(),
            provenance_manifest_digest: self.provenance_manifest_digest.clone(),
            generator: self.generator.clone(),
            projection_roles: normalize_strings(self.projection_roles.clone(), "projectionRoles")?,
            source_artifacts: normalize_references(self.source_artifacts.clone())?,
            emitted_artifacts: normalize_references(self.emitted_artifacts.clone())?,
        };
        validate_manifest_reference_consistency(
            &normalized.generator,
            &normalized.source_artifacts,
            &normalized.emitted_artifacts,
        )?;
        canonical_json_bytes(&normalized)
    }
}

/// Stable failure categories for generation-input and provenance validation.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GenerationContractErrorKind {
    /// A versioned artifact used an unsupported API version.
    UnsupportedApiVersion,
    /// A coordinate, generator version, or operation coordinate was malformed.
    InvalidCoordinate,
    /// A non-coordinate contract token was empty or malformed.
    InvalidToken,
    /// A digest was not a lowercase `sha256:<hex>` value.
    InvalidDigest,
    /// A set-like declaration repeated one coordinate.
    DuplicateCoordinate,
    /// One artifact coordinate was associated with conflicting digests.
    CoordinateDigestConflict,
    /// The claimed Shape IR digest did not match canonical bytes.
    ShapeDigestMismatch,
    /// Law IR failed strict binding against Shape IR and operations.
    LawBindingFailed,
    /// A claimed Law IR digest did not match canonical bytes.
    LawDigestMismatch,
    /// Frozen input-schema, provenance-schema, or generator-ABI identity changed.
    ContractVersionMismatch,
    /// A provenance manifest selected a different generation input.
    GenerationInputDigestMismatch,
    /// A provenance manifest selected different generator settings.
    SettingsDigestMismatch,
    /// Provenance source references did not equal input owner declarations.
    SourceArtifactMismatch,
    /// A referenced artifact was not supplied to verification.
    ArtifactMissing,
    /// Verification received an artifact not referenced by provenance.
    UnexpectedArtifact,
    /// Recomputed artifact bytes did not match the claimed digest.
    ArtifactDigestMismatch,
    /// A review projection attempted to claim authority.
    AuthoritativeReviewRejected,
    /// Canonical JSON serialization failed.
    CanonicalizationFailed,
}

impl GenerationContractErrorKind {
    /// Returns the stable machine-readable diagnostic code.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::UnsupportedApiVersion => "WESLEY_GENERATION_UNSUPPORTED_API_VERSION",
            Self::InvalidCoordinate => "WESLEY_GENERATION_INVALID_COORDINATE",
            Self::InvalidToken => "WESLEY_GENERATION_INVALID_TOKEN",
            Self::InvalidDigest => "WESLEY_GENERATION_INVALID_DIGEST",
            Self::DuplicateCoordinate => "WESLEY_GENERATION_DUPLICATE_COORDINATE",
            Self::CoordinateDigestConflict => "WESLEY_GENERATION_COORDINATE_DIGEST_CONFLICT",
            Self::ShapeDigestMismatch => "WESLEY_GENERATION_SHAPE_DIGEST_MISMATCH",
            Self::LawBindingFailed => "WESLEY_GENERATION_LAW_BINDING_FAILED",
            Self::LawDigestMismatch => "WESLEY_GENERATION_LAW_DIGEST_MISMATCH",
            Self::ContractVersionMismatch => "WESLEY_GENERATION_CONTRACT_VERSION_MISMATCH",
            Self::GenerationInputDigestMismatch => "WESLEY_GENERATION_INPUT_DIGEST_MISMATCH",
            Self::SettingsDigestMismatch => "WESLEY_GENERATION_SETTINGS_DIGEST_MISMATCH",
            Self::SourceArtifactMismatch => "WESLEY_GENERATION_SOURCE_ARTIFACT_MISMATCH",
            Self::ArtifactMissing => "WESLEY_GENERATION_ARTIFACT_MISSING",
            Self::UnexpectedArtifact => "WESLEY_GENERATION_UNEXPECTED_ARTIFACT",
            Self::ArtifactDigestMismatch => "WESLEY_GENERATION_ARTIFACT_DIGEST_MISMATCH",
            Self::AuthoritativeReviewRejected => "WESLEY_GENERATION_AUTHORITATIVE_REVIEW_REJECTED",
            Self::CanonicalizationFailed => "WESLEY_GENERATION_CANONICALIZATION_FAILED",
        }
    }
}

/// Structured generation-contract validation failure.
#[derive(Clone, Debug, Deserialize, Eq, Error, PartialEq, Serialize)]
#[error("{kind:?}: {subject}")]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationContractError {
    /// Stable failure category.
    pub kind: GenerationContractErrorKind,
    /// Coordinate or contract field that failed.
    pub subject: String,
    /// Expected stable value when useful.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
    /// Observed stable value when useful.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
}

impl GenerationContractError {
    fn new(kind: GenerationContractErrorKind, subject: impl Into<String>) -> Self {
        Self {
            kind,
            subject: subject.into(),
            expected: None,
            actual: None,
        }
    }

    fn mismatch(
        kind: GenerationContractErrorKind,
        subject: impl Into<String>,
        expected: impl Into<String>,
        actual: impl Into<String>,
    ) -> Self {
        Self {
            kind,
            subject: subject.into(),
            expected: Some(expected.into()),
            actual: Some(actual.into()),
        }
    }
}

/// Computes a lowercase `sha256:<hex>` digest over exact artifact bytes.
pub fn compute_generation_artifact_digest_v1(bytes: &[u8]) -> String {
    format!("sha256:{}", compute_content_hash_bytes(bytes))
}

fn normalize_shape_ir(mut shape_ir: WesleyIR) -> Result<WesleyIR, GenerationContractError> {
    shape_ir.metadata = None;
    // Shape IR ordering is already part of Wesley's canonical L1 contract.
    // Generation strips ambient metadata but does not silently assign a second
    // schema identity by reinterpreting that established ordering.
    Ok(shape_ir)
}

fn normalize_operations(
    mut operations: Vec<SchemaOperation>,
) -> Result<Vec<SchemaOperation>, GenerationContractError> {
    for (operation_index, operation) in operations.iter_mut().enumerate() {
        validate_coordinate_token(
            &operation.root_type_name,
            &format!("operations[{operation_index}].rootTypeName"),
        )?;
        validate_coordinate_token(
            &operation.field_name,
            &format!("operations[{operation_index}].fieldName"),
        )?;
        for (argument_index, argument) in operation.arguments.iter().enumerate() {
            validate_coordinate_token(
                &argument.name,
                &format!("operations[{operation_index}].arguments[{argument_index}].name"),
            )?;
        }
        operation
            .arguments
            .sort_by(|left, right| left.name.cmp(&right.name));
        reject_duplicate_keys(
            &operation.arguments,
            |argument| argument.name.as_str(),
            &format!(
                "operation:{}.{}.arguments",
                operation.root_type_name, operation.field_name
            ),
        )?;
    }
    operations.sort_by(|left, right| {
        (
            operation_type_rank(left.operation_type),
            left.root_type_name.as_str(),
            left.field_name.as_str(),
        )
            .cmp(&(
                operation_type_rank(right.operation_type),
                right.root_type_name.as_str(),
                right.field_name.as_str(),
            ))
    });
    for window in operations.windows(2) {
        if window[0].operation_type == window[1].operation_type
            && window[0].root_type_name == window[1].root_type_name
            && window[0].field_name == window[1].field_name
        {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::DuplicateCoordinate,
                format!(
                    "operation:{}.{}",
                    window[0].root_type_name, window[0].field_name
                ),
            ));
        }
    }
    Ok(operations)
}

fn normalize_law(
    mut law_ir: LawIrV1,
    shape_ir: &WesleyIR,
    operations: &[SchemaOperation],
    shape_digest: &str,
) -> Result<GenerationLawInputV1, GenerationContractError> {
    if law_ir.api_version != WESLEY_LAW_IR_API_VERSION {
        return Err(GenerationContractError::mismatch(
            GenerationContractErrorKind::UnsupportedApiVersion,
            "law.apiVersion",
            WESLEY_LAW_IR_API_VERSION,
            &law_ir.api_version,
        ));
    }
    law_ir.schema_source = None;
    for resource in &mut law_ir.registries.resources {
        resource.notes = None;
    }
    law_ir
        .registries
        .resources
        .sort_by(|left, right| left.id.cmp(&right.id));
    reject_duplicate_keys(
        &law_ir.registries.resources,
        |resource| resource.id.as_str(),
        "law.registries.resources",
    )?;
    for verifier in &mut law_ir.registries.verifiers {
        verifier.input_contracts = normalize_strings(
            std::mem::take(&mut verifier.input_contracts),
            &format!("law.verifier:{}.inputContracts", verifier.id),
        )?;
    }
    law_ir
        .registries
        .verifiers
        .sort_by(|left, right| left.id.cmp(&right.id));
    reject_duplicate_keys(
        &law_ir.registries.verifiers,
        |verifier| verifier.id.as_str(),
        "law.registries.verifiers",
    )?;
    law_ir.registries.channels.sort_by(|left, right| {
        (left.name.as_str(), left.version).cmp(&(right.name.as_str(), right.version))
    });
    for window in law_ir.registries.channels.windows(2) {
        if window[0].name == window[1].name && window[0].version == window[1].version {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::DuplicateCoordinate,
                format!("channel:{}@{}", window[0].name, window[0].version),
            ));
        }
    }
    for entry in &mut law_ir.entries {
        if entry.status != LawStatusV1::Active {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::LawBindingFailed,
                &entry.id,
            ));
        }
        entry.rationale = None;
        entry.source_index = None;
        entry.tags = normalize_strings(
            std::mem::take(&mut entry.tags),
            &format!("law.entry:{}.tags", entry.id),
        )?;
        normalize_law_body(&entry.id, &mut entry.body)?;
    }
    law_ir.entries.sort_by(|left, right| left.id.cmp(&right.id));
    reject_duplicate_keys(&law_ir.entries, |entry| entry.id.as_str(), "law.entries")?;

    validate_law_ir_v1_bindings(&law_ir, shape_ir, operations, shape_digest).map_err(|error| {
        GenerationContractError::mismatch(
            GenerationContractErrorKind::LawBindingFailed,
            error.path.unwrap_or_else(|| "law".to_owned()),
            "valid bound Law IR",
            error.code.as_str(),
        )
    })?;
    let semantic_digest = compute_law_hash_v1(&law_ir).map_err(|error| {
        GenerationContractError::mismatch(
            GenerationContractErrorKind::LawBindingFailed,
            error.path.unwrap_or_else(|| "law".to_owned()),
            "canonical semantic Law IR",
            error.code.as_str(),
        )
    })?;
    let canonical_json = to_canonical_law_ir_json(&law_ir).map_err(canonicalization_error)?;
    let canonical_digest = compute_generation_artifact_digest_v1(canonical_json.as_bytes());
    Ok(GenerationLawInputV1 {
        law_ir,
        semantic_digest,
        canonical_digest,
    })
}

fn normalize_law_body(
    entry_id: &str,
    body: &mut LawEntryBodyV1,
) -> Result<(), GenerationContractError> {
    match body {
        LawEntryBodyV1::ScalarSemantics(body) => body.forbids.sort(),
        LawEntryBodyV1::VariantLaw(body) => {
            for case in &mut body.cases {
                case.requires = normalize_strings(
                    std::mem::take(&mut case.requires),
                    &format!("law.entry:{entry_id}.case:{}.requires", case.value),
                )?;
                case.forbids = normalize_strings(
                    std::mem::take(&mut case.forbids),
                    &format!("law.entry:{entry_id}.case:{}.forbids", case.value),
                )?;
            }
            body.cases
                .sort_by(|left, right| left.value.cmp(&right.value));
            reject_duplicate_keys(
                &body.cases,
                |case| case.value.as_str(),
                &format!("law.entry:{entry_id}.cases"),
            )?;
        }
        LawEntryBodyV1::FootprintLaw(body) => {
            body.reads = normalize_strings(
                std::mem::take(&mut body.reads),
                &format!("law.entry:{entry_id}.reads"),
            )?;
            body.writes = normalize_strings(
                std::mem::take(&mut body.writes),
                &format!("law.entry:{entry_id}.writes"),
            )?;
            body.creates = normalize_strings(
                std::mem::take(&mut body.creates),
                &format!("law.entry:{entry_id}.creates"),
            )?;
            body.forbids = normalize_strings(
                std::mem::take(&mut body.forbids),
                &format!("law.entry:{entry_id}.forbids"),
            )?;
            for slot in &mut body.slots {
                slot.access = normalize_strings(
                    std::mem::take(&mut slot.access),
                    &format!("law.entry:{entry_id}.slot:{}.access", slot.name),
                )?;
            }
            body.slots.sort_by(|left, right| left.name.cmp(&right.name));
            reject_duplicate_keys(
                &body.slots,
                |slot| slot.name.as_str(),
                &format!("law.entry:{entry_id}.slots"),
            )?;
            for closure in &mut body.closures {
                closure.reads = normalize_strings(
                    std::mem::take(&mut closure.reads),
                    &format!("law.entry:{entry_id}.closure:{}.reads", closure.name),
                )?;
            }
            body.closures
                .sort_by(|left, right| left.name.cmp(&right.name));
            reject_duplicate_keys(
                &body.closures,
                |closure| closure.name.as_str(),
                &format!("law.entry:{entry_id}.closures"),
            )?;
            for slot in &mut body.create_slots {
                slot.cardinality = Some(slot.cardinality.unwrap_or(FootprintCardinalityV1::One));
            }
            body.create_slots
                .sort_by(|left, right| left.name.cmp(&right.name));
            reject_duplicate_keys(
                &body.create_slots,
                |slot| slot.name.as_str(),
                &format!("law.entry:{entry_id}.createSlots"),
            )?;
            for update in &mut body.updates {
                update.fields = normalize_strings(
                    std::mem::take(&mut update.fields),
                    &format!("law.entry:{entry_id}.update:{}.fields", update.slot),
                )?;
            }
            body.updates
                .sort_by(|left, right| left.slot.cmp(&right.slot));
            reject_duplicate_keys(
                &body.updates,
                |update| update.slot.as_str(),
                &format!("law.entry:{entry_id}.updates"),
            )?;
        }
        LawEntryBodyV1::ChannelLaw(_) | LawEntryBodyV1::InvariantLaw(_) => {}
    }
    Ok(())
}

fn normalize_references(
    references: Vec<GenerationArtifactReferenceV1>,
) -> Result<Vec<GenerationArtifactReferenceV1>, GenerationContractError> {
    let mut by_coordinate = BTreeMap::<String, String>::new();
    for reference in references {
        validate_coordinate(&reference.coordinate)?;
        validate_digest(&reference.digest, &reference.coordinate)?;
        match by_coordinate.get(&reference.coordinate) {
            Some(existing) if existing != &reference.digest => {
                return Err(GenerationContractError::mismatch(
                    GenerationContractErrorKind::CoordinateDigestConflict,
                    reference.coordinate,
                    existing,
                    reference.digest,
                ));
            }
            Some(_) => {}
            None => {
                by_coordinate.insert(reference.coordinate, reference.digest);
            }
        }
    }
    Ok(by_coordinate
        .into_iter()
        .map(|(coordinate, digest)| GenerationArtifactReferenceV1 { coordinate, digest })
        .collect())
}

fn validate_manifest_reference_consistency(
    generator: &GeneratorIdentityV1,
    source_artifacts: &[GenerationArtifactReferenceV1],
    emitted_artifacts: &[GenerationArtifactReferenceV1],
) -> Result<(), GenerationContractError> {
    let mut references = Vec::with_capacity(1 + source_artifacts.len() + emitted_artifacts.len());
    references.push(GenerationArtifactReferenceV1 {
        coordinate: generator.coordinate.clone(),
        digest: generator.digest.clone(),
    });
    references.extend_from_slice(source_artifacts);
    references.extend_from_slice(emitted_artifacts);
    normalize_references(references).map(|_| ())
}

fn verify_materials(
    expected: &[GenerationArtifactReferenceV1],
    actual: &[GenerationArtifactContentV1],
) -> Result<(), GenerationContractError> {
    let actual_references = normalize_references(
        actual
            .iter()
            .map(GenerationArtifactContentV1::reference)
            .collect(),
    )?;
    let mut actual_by_coordinate = actual_references
        .into_iter()
        .map(|reference| (reference.coordinate, reference.digest))
        .collect::<BTreeMap<_, _>>();
    for reference in expected {
        let Some(actual_digest) = actual_by_coordinate.remove(&reference.coordinate) else {
            return Err(GenerationContractError::new(
                GenerationContractErrorKind::ArtifactMissing,
                &reference.coordinate,
            ));
        };
        if actual_digest != reference.digest {
            return Err(GenerationContractError::mismatch(
                GenerationContractErrorKind::ArtifactDigestMismatch,
                &reference.coordinate,
                &reference.digest,
                actual_digest,
            ));
        }
    }
    if let Some((coordinate, _)) = actual_by_coordinate.into_iter().next() {
        return Err(GenerationContractError::new(
            GenerationContractErrorKind::UnexpectedArtifact,
            coordinate,
        ));
    }
    Ok(())
}

fn verify_digest(
    coordinate: &str,
    expected_digest: &str,
    bytes: &[u8],
) -> Result<(), GenerationContractError> {
    let actual_digest = compute_generation_artifact_digest_v1(bytes);
    if expected_digest != actual_digest {
        return Err(GenerationContractError::mismatch(
            GenerationContractErrorKind::ArtifactDigestMismatch,
            coordinate,
            expected_digest,
            actual_digest,
        ));
    }
    Ok(())
}

fn normalize_strings(
    mut values: Vec<String>,
    subject: &str,
) -> Result<Vec<String>, GenerationContractError> {
    for value in &values {
        validate_token(value, subject)?;
    }
    values.sort();
    values.dedup();
    Ok(values)
}

fn reject_duplicate_keys<T, F>(
    values: &[T],
    key: F,
    subject: &str,
) -> Result<(), GenerationContractError>
where
    F: Fn(&T) -> &str,
{
    if let Some(window) = values
        .windows(2)
        .find(|window| key(&window[0]) == key(&window[1]))
    {
        return Err(GenerationContractError::new(
            GenerationContractErrorKind::DuplicateCoordinate,
            format!("{subject}.{}", key(&window[0])),
        ));
    }
    Ok(())
}

fn validate_coordinate(coordinate: &str) -> Result<(), GenerationContractError> {
    validate_coordinate_token(coordinate, coordinate)
}

fn validate_token(value: &str, subject: &str) -> Result<(), GenerationContractError> {
    validate_token_as(value, subject, GenerationContractErrorKind::InvalidToken)
}

fn validate_coordinate_token(value: &str, subject: &str) -> Result<(), GenerationContractError> {
    validate_token_as(
        value,
        subject,
        GenerationContractErrorKind::InvalidCoordinate,
    )
}

fn validate_token_as(
    value: &str,
    subject: &str,
    kind: GenerationContractErrorKind,
) -> Result<(), GenerationContractError> {
    if value.is_empty()
        || value.trim() != value
        || value.chars().any(|character| character.is_control())
    {
        return Err(GenerationContractError::new(kind, subject));
    }
    Ok(())
}

fn validate_digest(digest: &str, subject: &str) -> Result<(), GenerationContractError> {
    let valid = digest.len() == 71
        && digest.starts_with("sha256:")
        && digest[7..]
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
    if !valid {
        return Err(GenerationContractError::new(
            GenerationContractErrorKind::InvalidDigest,
            subject,
        ));
    }
    Ok(())
}

fn canonical_json_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>, GenerationContractError> {
    to_canonical_json(value)
        .map(String::into_bytes)
        .map_err(canonicalization_error)
}

fn canonicalization_error(error: impl std::fmt::Display) -> GenerationContractError {
    GenerationContractError::mismatch(
        GenerationContractErrorKind::CanonicalizationFailed,
        "canonicalJson",
        "serializable value",
        error.to_string(),
    )
}

fn domain_digest(domain: &str, bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update((domain.len() as u64).to_be_bytes());
    hasher.update(domain.as_bytes());
    hasher.update((bytes.len() as u64).to_be_bytes());
    hasher.update(bytes);
    format!("sha256:{}", hex::encode(hasher.finalize()))
}

const fn operation_type_rank(kind: OperationType) -> u8 {
    match kind {
        OperationType::Query => 0,
        OperationType::Mutation => 1,
        OperationType::Subscription => 2,
    }
}
