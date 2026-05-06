use wesley_core::{compute_registry_hash, to_canonical_json, ApolloLoweringAdapter, LoweringPort};
use std::fs;
use std::path::PathBuf;

fn get_fixture_path(name: &str) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("../../test/fixtures/ir-parity");
    path.push(name);
    path
}

fn create_adapter() -> ApolloLoweringAdapter {
    ApolloLoweringAdapter::new(3)
}

async fn validate_schema(name: &str) {
    let sdl_path = get_fixture_path(&format!("{}.graphql", name));
    let sdl = fs::read_to_string(sdl_path).expect("Failed to read SDL fixture");
    
    let adapter = create_adapter();
    let ir = adapter.lower_sdl(&sdl).await.expect("Failed to lower SDL to L1 IR");
    
    let actual_hash = compute_registry_hash(&ir).expect("Failed to compute IR hash");
    let mut parity_ir = ir.clone();
    parity_ir.metadata = None;
    let actual_json = to_canonical_json(&parity_ir).expect("Failed to canonicalize IR");

    let hash_path = get_fixture_path(&format!("{}.l1.hash", name));
    let json_path = get_fixture_path(&format!("{}.l1.json", name));

    if !hash_path.exists() {
        println!("Initializing L1 gold master for {}", name);
        fs::write(&hash_path, &actual_hash).unwrap();
        fs::write(&json_path, serde_json::to_string_pretty(&ir).unwrap()).unwrap();
    } else {
        let expected_hash = fs::read_to_string(&hash_path).unwrap().trim().to_string();
        if actual_hash != expected_hash {
            let diff_json_path = get_fixture_path(&format!("{}.l1.actual.json", name));
            fs::write(&diff_json_path, actual_json).unwrap();
            panic!(
                "L1 Hash mismatch for {}.\nExpected: {}\nActual: {}\nActual JSON written to: {:?}",
                name, expected_hash, actual_hash, diff_json_path
            );
        }
    }
}

#[tokio::test]
async fn test_lower_small_schema() {
    validate_schema("small-schema").await;
}

#[tokio::test]
async fn test_lower_medium_schema() {
    validate_schema("medium-schema").await;
}

#[tokio::test]
async fn test_lower_large_schema() {
    validate_schema("large-schema").await;
}
