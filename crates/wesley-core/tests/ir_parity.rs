use wesley_core::{WesleyIR, compute_registry_hash, to_canonical_json};
use std::fs;
use std::path::PathBuf;

fn get_fixture_path(name: &str) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("../../test/fixtures/ir-parity");
    path.push(name);
    path
}

#[test]
fn test_small_schema_parity() {
    let ir_json = fs::read_to_string(get_fixture_path("small-schema.ir.json")).unwrap();
    let expected_hash = fs::read_to_string(get_fixture_path("small-schema.hash")).unwrap().trim().to_string();
    let expected_canonical = fs::read_to_string(get_fixture_path("small-schema.canonical.json")).unwrap();

    let ir: WesleyIR = serde_json::from_str(&ir_json).unwrap();
    
    // Check hash parity
    let actual_hash = compute_registry_hash(&ir).unwrap();
    assert_eq!(actual_hash, expected_hash, "Hash mismatch for small-schema");

    // Check canonical JSON parity
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;
    let actual_canonical = to_canonical_json(&parity_ir).unwrap();
    assert_eq!(actual_canonical, expected_canonical, "Canonical JSON mismatch for small-schema");
}

#[test]
fn test_medium_schema_parity() {
    let ir_json = fs::read_to_string(get_fixture_path("medium-schema.ir.json")).unwrap();
    let expected_hash = fs::read_to_string(get_fixture_path("medium-schema.hash")).unwrap().trim().to_string();
    let expected_canonical = fs::read_to_string(get_fixture_path("medium-schema.canonical.json")).unwrap();

    let ir: WesleyIR = serde_json::from_str(&ir_json).unwrap();
    
    // Check hash parity
    let actual_hash = compute_registry_hash(&ir).unwrap();
    assert_eq!(actual_hash, expected_hash, "Hash mismatch for medium-schema");

    // Check canonical JSON parity
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;
    let actual_canonical = to_canonical_json(&parity_ir).unwrap();
    assert_eq!(actual_canonical, expected_canonical, "Canonical JSON mismatch for medium-schema");
}

#[test]
fn test_large_schema_parity() {
    let ir_json = fs::read_to_string(get_fixture_path("large-schema.ir.json")).unwrap();
    let expected_hash = fs::read_to_string(get_fixture_path("large-schema.hash")).unwrap().trim().to_string();
    let expected_canonical = fs::read_to_string(get_fixture_path("large-schema.canonical.json")).unwrap();

    let ir: WesleyIR = serde_json::from_str(&ir_json).unwrap();
    
    // Check hash parity
    let actual_hash = compute_registry_hash(&ir).unwrap();
    assert_eq!(actual_hash, expected_hash, "Hash mismatch for large-schema");

    // Check canonical JSON parity
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;
    let actual_canonical = to_canonical_json(&parity_ir).unwrap();
    assert_eq!(actual_canonical, expected_canonical, "Canonical JSON mismatch for large-schema");
}
