use std::fs;
use std::path::PathBuf;
use wesley_core::{
    compute_registry_hash, to_canonical_json, ApolloLoweringAdapter, LoweringPort, TypeDefinition,
    TypeKind,
};

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
    let ir = adapter
        .lower_sdl(&sdl)
        .await
        .expect("Failed to lower SDL to L1 IR");

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

#[tokio::test]
async fn test_lower_directive_heavy_schema() {
    validate_schema("directive-heavy-schema").await;
}

#[tokio::test]
async fn test_lower_schema_extensions_schema() {
    validate_schema("schema-extensions-schema").await;
}

#[tokio::test]
async fn test_lower_legacy_alias_schema() {
    validate_schema("legacy-alias-schema").await;
}

#[tokio::test]
async fn canonicalizes_legacy_directive_aliases() {
    let sdl_path = get_fixture_path("legacy-alias-schema.graphql");
    let sdl = fs::read_to_string(sdl_path).expect("Failed to read SDL fixture");

    let adapter = create_adapter();
    let ir = adapter
        .lower_sdl(&sdl)
        .await
        .expect("Failed to lower SDL to L1 IR");

    let tenant = find_type(&ir.types, "Tenant");
    assert!(tenant.directives.contains_key("wes_table"));
    assert!(tenant.directives.contains_key("wes_rls"));
    assert!(!tenant.directives.contains_key("table"));
    assert!(!tenant.directives.contains_key("rls"));

    let tenant_id = tenant
        .fields
        .iter()
        .find(|field| field.name == "id")
        .expect("missing id field");
    assert!(tenant_id.directives.contains_key("wes_pk"));
    assert!(!tenant_id.directives.contains_key("pk"));

    let member = find_type(&ir.types, "Member");
    assert!(member.directives.contains_key("wes_table"));
    assert!(member.directives.contains_key("wes_tenant"));
    assert!(member.directives.contains_key("wes_rls"));
    assert!(!member.directives.contains_key("wesley_table"));
    assert!(!member.directives.contains_key("tenant"));

    let role = member
        .fields
        .iter()
        .find(|field| field.name == "role")
        .expect("missing role field");
    assert!(role.directives.contains_key("wes_default"));
    assert!(!role.directives.contains_key("default"));
}

#[tokio::test]
async fn rejects_duplicate_canonical_directives() {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("../../test/fixtures/ir-parity-invalid/duplicate-directive-alias.graphql");
    let sdl = fs::read_to_string(path).expect("Failed to read invalid SDL fixture");

    let adapter = create_adapter();
    let err = adapter
        .lower_sdl(&sdl)
        .await
        .expect_err("duplicate canonical directives should fail lowering");
    let message = err.to_string();

    assert!(
        message.contains("Duplicate directive '@wes_table'"),
        "unexpected error: {message}"
    );

    let diagnostic = err.diagnostic();
    assert_eq!(diagnostic.code, "WESLEY_LOWERING_ERROR");
    assert_eq!(diagnostic.severity, "ERROR");
    assert_eq!(diagnostic.message, "Duplicate directive '@wes_table'");
    assert_eq!(diagnostic.line, None);
    assert_eq!(diagnostic.column, None);
}

#[tokio::test]
async fn parse_errors_expose_stable_diagnostics_with_spans() {
    let sdl = "type Broken {\n  id:\n}\n";

    let adapter = create_adapter();
    let err = adapter
        .lower_sdl(sdl)
        .await
        .expect_err("invalid SDL syntax should fail lowering");
    let diagnostic = err.diagnostic();

    assert_eq!(diagnostic.code, "WESLEY_PARSE_ERROR");
    assert_eq!(diagnostic.severity, "ERROR");
    assert!(diagnostic.message.contains("expected"));
    assert_eq!(diagnostic.line, Some(3));
    assert_eq!(diagnostic.column, Some(1));
}

#[tokio::test]
async fn preserves_repeated_custom_directives_as_ordered_values() {
    let sdl = r#"
        directive @tag(name: String!) repeatable on FIELD_DEFINITION

        type Thing {
          name: String @tag(name: "alpha") @tag(name: "beta")
        }
    "#;

    let adapter = create_adapter();
    let ir = adapter
        .lower_sdl(sdl)
        .await
        .expect("repeatable custom directives should lower");
    let thing = find_type(&ir.types, "Thing");
    let name = thing
        .fields
        .iter()
        .find(|field| field.name == "name")
        .expect("missing name field");
    let tag_values = name.directives["tag"]
        .as_array()
        .expect("repeated custom directive should be preserved as an array");

    assert_eq!(tag_values.len(), 2);
    assert_eq!(
        tag_values[0]["name"],
        serde_json::Value::String("alpha".into())
    );
    assert_eq!(
        tag_values[1]["name"],
        serde_json::Value::String("beta".into())
    );
}

#[tokio::test]
async fn lowers_graphql_type_families_into_l1_ir() {
    let sdl = r#"
        scalar DateTime @specifiedBy(url: "https://example.com/datetime")

        interface Node {
          id: ID!
        }

        interface Timestamped implements Node {
          id: ID!
          updatedAt: DateTime
        }

        type Team implements Node {
          id: ID!
        }

        type Organization implements Node {
          id: ID!
        }

        type User implements Node & Timestamped {
          id: ID!
          updatedAt: DateTime
          name: String
        }

        union SearchResult = User | Team
        extend union SearchResult = Organization

        enum Role {
          ADMIN
          MEMBER
        }
        extend enum Role {
          VIEWER
        }

        input UserFilter {
          role: Role
          ids: [ID!]!
        }
        extend input UserFilter {
          active: Boolean @wes_default(value: "true")
        }
    "#;

    let adapter = create_adapter();
    let ir = adapter
        .lower_sdl(sdl)
        .await
        .expect("Failed to lower SDL to L1 IR");

    let date_time = find_type(&ir.types, "DateTime");
    assert_eq!(date_time.kind, TypeKind::Scalar);
    assert_eq!(
        date_time.directives["specifiedBy"]["url"],
        serde_json::Value::String("https://example.com/datetime".to_string())
    );

    let timestamped = find_type(&ir.types, "Timestamped");
    assert_eq!(timestamped.kind, TypeKind::Interface);
    assert_eq!(timestamped.implements, vec!["Node"]);
    assert_eq!(
        timestamped
            .fields
            .iter()
            .map(|field| field.name.as_str())
            .collect::<Vec<_>>(),
        vec!["id", "updatedAt"]
    );

    let user = find_type(&ir.types, "User");
    assert_eq!(user.kind, TypeKind::Object);
    assert_eq!(user.implements, vec!["Node", "Timestamped"]);

    let search_result = find_type(&ir.types, "SearchResult");
    assert_eq!(search_result.kind, TypeKind::Union);
    assert_eq!(
        search_result.union_members,
        vec!["User", "Team", "Organization"]
    );

    let role = find_type(&ir.types, "Role");
    assert_eq!(role.kind, TypeKind::Enum);
    assert_eq!(role.enum_values, vec!["ADMIN", "MEMBER", "VIEWER"]);

    let user_filter = find_type(&ir.types, "UserFilter");
    assert_eq!(user_filter.kind, TypeKind::InputObject);
    let ids_field = user_filter
        .fields
        .iter()
        .find(|field| field.name == "ids")
        .expect("missing ids input field");
    assert_eq!(ids_field.r#type.base, "ID");
    assert!(!ids_field.r#type.nullable);
    assert!(ids_field.r#type.is_list);
    assert_eq!(ids_field.r#type.list_item_nullable, Some(false));
}

#[tokio::test]
async fn preserves_nested_list_type_references() {
    let sdl = r#"
        type Matrix {
          values: [[Int!]!]!
          maybeValues: [[String]]
        }
    "#;

    let adapter = create_adapter();
    let ir = adapter
        .lower_sdl(sdl)
        .await
        .expect("Failed to lower SDL to L1 IR");
    let matrix = find_type(&ir.types, "Matrix");
    let values = matrix
        .fields
        .iter()
        .find(|field| field.name == "values")
        .expect("missing values field");
    let maybe_values = matrix
        .fields
        .iter()
        .find(|field| field.name == "maybeValues")
        .expect("missing maybeValues field");

    assert_eq!(values.r#type.base, "Int");
    assert!(!values.r#type.nullable);
    assert!(values.r#type.is_list);
    assert_eq!(values.r#type.list_item_nullable, Some(false));
    assert_eq!(
        values
            .r#type
            .list_wrappers
            .iter()
            .map(|wrapper| wrapper.nullable)
            .collect::<Vec<_>>(),
        vec![false, false]
    );
    assert_eq!(values.r#type.leaf_nullable, Some(false));

    assert_eq!(maybe_values.r#type.base, "String");
    assert!(maybe_values.r#type.nullable);
    assert!(maybe_values.r#type.is_list);
    assert_eq!(maybe_values.r#type.list_item_nullable, Some(true));
    assert_eq!(
        maybe_values
            .r#type
            .list_wrappers
            .iter()
            .map(|wrapper| wrapper.nullable)
            .collect::<Vec<_>>(),
        vec![true, true]
    );
    assert_eq!(maybe_values.r#type.leaf_nullable, Some(true));
}

#[tokio::test]
async fn rejects_mixed_type_kind_consolidation() {
    let sdl = r#"
        type Thing {
          id: ID
        }

        extend input Thing {
          label: String
        }
    "#;

    let adapter = create_adapter();
    let err = adapter
        .lower_sdl(sdl)
        .await
        .expect_err("mixed type kind should fail lowering");
    let message = err.to_string();

    assert!(
        message.contains("Thing") && message.contains("Object") && message.contains("InputObject"),
        "unexpected error: {message}"
    );
}

fn find_type<'a>(types: &'a [TypeDefinition], name: &str) -> &'a TypeDefinition {
    types
        .iter()
        .find(|type_def| type_def.name == name)
        .unwrap_or_else(|| panic!("missing type {name}"))
}
