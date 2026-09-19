//! The compiler kernel without the `resilience` feature.
//!
//! These tests carry no `required-features`, so they run in both
//! configurations. Under `--no-default-features` they are what proves the
//! synchronous kernel still lowers, hashes, and diffs SDL with the async
//! `LoweringPort` compiled out.

use wesley_core::{compute_registry_hash, diff_schema_sdl, lower_schema_sdl};

const SCHEMA: &str = r#"
"""A thing with a name."""
type Thing @table {
  id: ID!
  name: String! @unique
}
"#;

#[test]
fn the_synchronous_kernel_lowers_sdl_without_the_async_port() {
    let ir = lower_schema_sdl(SCHEMA).expect("the fixture schema lowers");

    let thing = ir
        .types
        .iter()
        .find(|definition| definition.name == "Thing")
        .expect("the lowered IR contains the Thing type");
    assert_eq!(thing.fields.len(), 2);
}

#[test]
fn the_registry_hash_is_stable_without_the_async_port() {
    let first = lower_schema_sdl(SCHEMA).expect("the fixture schema lowers");
    let second = lower_schema_sdl(SCHEMA).expect("the fixture schema lowers");

    assert_eq!(
        compute_registry_hash(&first).expect("the IR hashes"),
        compute_registry_hash(&second).expect("the IR hashes")
    );
}

#[test]
fn schema_diffing_works_without_the_async_port() {
    let changed = SCHEMA.replace("name: String! @unique", "name: String!");

    let delta = diff_schema_sdl(SCHEMA, &changed).expect("both schemas lower");

    assert!(!format!("{delta:?}").is_empty());
}
