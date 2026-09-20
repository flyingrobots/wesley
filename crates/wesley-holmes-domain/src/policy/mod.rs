//! Domain-level law assurance policy parsing, normalization, and matching.
//!
//! - `schema`: the policy document as written, and the normalized policy.
//! - `normalize`: parsing a document and resolving a profile through inheritance.
//! - `validate`: threshold and suppression validation, and the parsers they share.
//! - `suppression`: applying a normalized policy to findings.

mod normalize;
mod schema;
mod suppression;
mod validate;

pub use normalize::{normalize_law_assurance_policy, parse_law_assurance_policy};
pub use schema::{
    HOLMES_LAW_ASSURANCE_POLICY_API_VERSION, LawAssuranceCoverageThresholdPolicy,
    LawAssurancePolicyProfile, LawAssurancePolicySchema, LawAssuranceSuppressionMatch,
    LawAssuranceSuppressionRule, LawAssuranceSuppressionTarget, LawAssuranceSuppressionTargetKind,
    NormalizedLawAssurancePolicy,
};
pub use suppression::{
    AnnotatedFinding, SuppressionApplicationRecord, SuppressionPolicyOutcome,
    SuppressionRejectionReason, SuppressionRejectionRecord, apply_suppression_policy,
    map_semantic_finding_severities, matching_suppressions_for_finding,
};
