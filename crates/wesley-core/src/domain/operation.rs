//! GraphQL operation analysis data.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::ir::TypeReference;

/// Arguments extracted from a directive attached to a GraphQL operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OperationDirectiveArgs {
    /// Directive name without the leading `@`.
    pub directive_name: String,
    /// Directive arguments represented as JSON-compatible values.
    pub arguments: IndexMap<String, serde_json::Value>,
}

/// GraphQL root operation type.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OperationType {
    /// GraphQL query root field.
    Query,
    /// GraphQL mutation root field.
    Mutation,
    /// GraphQL subscription root field.
    Subscription,
}

/// A field argument on a schema root operation.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OperationArgument {
    /// Argument name.
    pub name: String,
    /// Argument type reference.
    pub r#type: TypeReference,
    /// Default value, if the schema declares one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    /// Generic map of directives attached to the argument.
    pub directives: IndexMap<String, serde_json::Value>,
}

/// Compute a stable u32 op id from a root operation's kind and field name.
///
/// The algorithm is FNV-1a 32-bit with the canonical seed `0x811c9dc5`:
///
/// 1. Seed `hash = 0x811c9dc5`.
/// 2. Step `hash` with [`operation_type_rank`] of `operation_type`.
/// 3. Step `hash` with each UTF-8 byte of `field_name` in order.
///
/// Each step is `hash = (hash * 0x01000193) ^ byte`, computed modulo 2³² (wrapping).
///
/// This is the cross-language identifier consumed by EINT envelopes:
/// every encoder/decoder that derives op ids from a Wesley schema must
/// produce identical values here, regardless of host language. Changing
/// the algorithm — even reordering the input bytes — is a breaking change
/// to every deployed contract.
#[must_use]
pub fn stable_op_id(operation_type: OperationType, field_name: &str) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    hash = fnv1a_step(hash, operation_type_rank(operation_type));
    for byte in field_name.as_bytes() {
        hash = fnv1a_step(hash, *byte);
    }
    hash
}

/// Canonical numeric rank for [`OperationType`].
///
/// `Query = 0`, `Mutation = 1`, `Subscription = 2`. These ranks are part of
/// the [`stable_op_id`] preimage and must never change.
#[must_use]
pub fn operation_type_rank(operation_type: OperationType) -> u8 {
    match operation_type {
        OperationType::Query => 0,
        OperationType::Mutation => 1,
        OperationType::Subscription => 2,
    }
}

#[inline]
fn fnv1a_step(hash: u32, byte: u8) -> u32 {
    hash.wrapping_mul(0x0100_0193) ^ u32::from(byte)
}

/// A root schema operation field described as domain-empty data.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaOperation {
    /// Root operation kind for the field.
    pub operation_type: OperationType,
    /// Root GraphQL object type that owns this operation field.
    pub root_type_name: String,
    /// Root field name.
    pub field_name: String,
    /// Root field arguments.
    pub arguments: Vec<OperationArgument>,
    /// Root field result type.
    pub result_type: TypeReference,
    /// Generic map of directives attached to the root field.
    pub directives: IndexMap<String, serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::{operation_type_rank, stable_op_id, OperationType};

    #[test]
    fn operation_type_rank_is_pinned() {
        assert_eq!(operation_type_rank(OperationType::Query), 0);
        assert_eq!(operation_type_rank(OperationType::Mutation), 1);
        assert_eq!(operation_type_rank(OperationType::Subscription), 2);
    }

    #[test]
    fn stable_op_id_matches_canonical_seed() {
        // Empty field name with each rank must produce a single FNV-1a step
        // from the seed 0x811c9dc5.
        let seed: u32 = 0x811c_9dc5;
        let multiplier: u32 = 0x0100_0193;

        let expected_query = seed.wrapping_mul(multiplier);
        let expected_mutation = seed.wrapping_mul(multiplier) ^ 1_u32;
        let expected_subscription = seed.wrapping_mul(multiplier) ^ 2_u32;

        assert_eq!(stable_op_id(OperationType::Query, ""), expected_query);
        assert_eq!(stable_op_id(OperationType::Mutation, ""), expected_mutation);
        assert_eq!(
            stable_op_id(OperationType::Subscription, ""),
            expected_subscription
        );
    }

    #[test]
    fn stable_op_id_is_pinned_for_domain_neutral_operations() {
        // These exact u32s are the contract surface between Rust and TypeScript
        // emitters; any change here is a breaking change to every consumer that
        // routes EINT envelopes by op_id. Pin them.
        assert_eq!(
            stable_op_id(OperationType::Mutation, "createRecord"),
            1_670_356_121
        );
        assert_eq!(
            stable_op_id(OperationType::Mutation, "updateRecord"),
            3_583_386_294
        );
        assert_eq!(
            stable_op_id(OperationType::Mutation, "createCheckpoint"),
            3_744_251_216
        );
        assert_eq!(
            stable_op_id(OperationType::Query, "recordSnapshot"),
            3_126_837_072
        );
        assert_eq!(
            stable_op_id(OperationType::Query, "recordWindow"),
            3_315_867_368
        );
    }

    #[test]
    fn stable_op_id_separates_query_from_mutation_for_same_name() {
        let q = stable_op_id(OperationType::Query, "createRecord");
        let m = stable_op_id(OperationType::Mutation, "createRecord");
        assert_ne!(q, m);
    }

    #[test]
    fn stable_op_id_is_byte_order_sensitive() {
        let ab = stable_op_id(OperationType::Query, "ab");
        let ba = stable_op_id(OperationType::Query, "ba");
        assert_ne!(ab, ba);
    }
}
