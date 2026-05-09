use wesley_core::{diff_schema_sdl, ChangeKind, TypeKind};

#[test]
fn identical_schemas_produce_empty_delta() {
    let sdl = r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
        }
    "#;

    let delta = diff_schema_sdl(sdl, sdl).expect("schema diff should succeed");

    assert!(delta.is_empty());
    assert!(!delta.has_breaking_changes());
}

#[test]
fn detects_added_and_removed_types() {
    let old_sdl = r#"
        type Query {
          viewer: Viewer
        }

        type Viewer {
          id: ID!
        }
    "#;
    let new_sdl = r#"
        type Query {
          viewer: Viewer
        }

        type Team {
          id: ID!
        }
    "#;

    let delta = diff_schema_sdl(old_sdl, new_sdl).expect("schema diff should succeed");

    assert_eq!(delta.added_types[0].name, "Team");
    assert!(!delta.added_types[0].breaking);
    assert_eq!(delta.removed_types[0].name, "Viewer");
    assert!(delta.removed_types[0].breaking);
    assert!(delta.has_breaking_changes());
}

#[test]
fn classifies_field_changes_from_l1_shape() {
    let old_sdl = r#"
        type User {
          id: ID!
          name: String
          age: Int
        }

        input UserFilter {
          id: ID
        }
    "#;
    let new_sdl = r#"
        type User {
          id: ID!
          age: String
          email: String!
        }

        input UserFilter {
          id: ID
          slug: String!
        }
    "#;

    let delta = diff_schema_sdl(old_sdl, new_sdl).expect("schema diff should succeed");
    let user = delta
        .modified_types
        .iter()
        .find(|change| change.name == "User")
        .expect("User should be modified");
    let filter = delta
        .modified_types
        .iter()
        .find(|change| change.name == "UserFilter")
        .expect("UserFilter should be modified");

    assert!(user.field_changes.iter().any(|change| {
        change.name == "name" && change.kind == ChangeKind::Removed && change.breaking
    }));
    assert!(user.field_changes.iter().any(|change| {
        change.name == "age" && change.kind == ChangeKind::Changed && change.breaking
    }));
    assert!(user.field_changes.iter().any(|change| {
        change.name == "email" && change.kind == ChangeKind::Added && !change.breaking
    }));
    assert!(filter.field_changes.iter().any(|change| {
        change.name == "slug" && change.kind == ChangeKind::Added && change.breaking
    }));
}

#[test]
fn detects_field_argument_changes() {
    let old_sdl = r#"
        type Query {
          search(term: String, limit: Int = 20, scope: SearchScope): [SearchResult!]!
        }

        enum SearchScope {
          ALL
        }

        type SearchResult {
          id: ID!
        }
    "#;
    let new_sdl = r#"
        type Query {
          search(term: String!, first: Int!, scope: SearchScope @deprecated(reason: "legacy")): [SearchResult!]!
        }

        enum SearchScope {
          ALL
        }

        type SearchResult {
          id: ID!
        }
    "#;

    let delta = diff_schema_sdl(old_sdl, new_sdl).expect("schema diff should succeed");
    let query = delta
        .modified_types
        .iter()
        .find(|change| change.name == "Query")
        .expect("Query should be modified");

    assert!(query.breaking);
    assert!(query.field_changes.iter().any(|change| {
        change.name == "search(first)" && change.kind == ChangeKind::Added && change.breaking
    }));
    assert!(query.field_changes.iter().any(|change| {
        change.name == "search(limit)" && change.kind == ChangeKind::Removed && change.breaking
    }));
    assert!(query.field_changes.iter().any(|change| {
        change.name == "search(term)" && change.kind == ChangeKind::Changed && change.breaking
    }));
    assert!(query.field_changes.iter().any(|change| {
        change.name == "search(scope)" && change.kind == ChangeKind::Changed && change.breaking
    }));
}

#[test]
fn detects_enum_union_implements_and_directive_changes() {
    let old_sdl = r#"
        directive @tag(name: String!) on OBJECT

        interface Node {
          id: ID!
        }

        type User implements Node @tag(name: "old") {
          id: ID!
        }

        type Team {
          id: ID!
        }

        type Organization {
          id: ID!
        }

        union SearchResult = User | Team

        enum Role {
          ADMIN
          MEMBER
        }
    "#;
    let new_sdl = r#"
        directive @tag(name: String!) on OBJECT

        interface Node {
          id: ID!
        }

        type User @tag(name: "new") {
          id: ID!
        }

        type Team {
          id: ID!
        }

        type Organization {
          id: ID!
        }

        union SearchResult = User | Organization

        enum Role {
          ADMIN
          VIEWER
        }
    "#;

    let delta = diff_schema_sdl(old_sdl, new_sdl).expect("schema diff should succeed");
    let user = delta
        .modified_types
        .iter()
        .find(|change| change.name == "User")
        .expect("User should be modified");
    let search_result = delta
        .modified_types
        .iter()
        .find(|change| change.name == "SearchResult")
        .expect("SearchResult should be modified");
    let role = delta
        .modified_types
        .iter()
        .find(|change| change.name == "Role")
        .expect("Role should be modified");

    assert!(user
        .directive_changes
        .iter()
        .any(|change| change.name == "tag" && change.breaking));
    assert!(user
        .implements_changes
        .iter()
        .any(|change| change.name == "Node" && change.kind == ChangeKind::Removed));
    assert!(search_result
        .union_member_changes
        .iter()
        .any(|change| change.name == "Organization" && !change.breaking));
    assert!(search_result
        .union_member_changes
        .iter()
        .any(|change| change.name == "Team" && change.breaking));
    assert!(role
        .enum_value_changes
        .iter()
        .any(|change| change.name == "VIEWER" && !change.breaking));
    assert!(role
        .enum_value_changes
        .iter()
        .any(|change| change.name == "MEMBER" && change.breaking));
}

#[test]
fn detects_type_kind_changes() {
    let old_sdl = r#"
        type Thing {
          id: ID!
        }
    "#;
    let new_sdl = r#"
        input Thing {
          id: ID!
        }
    "#;

    let delta = diff_schema_sdl(old_sdl, new_sdl).expect("schema diff should succeed");
    let thing = &delta.modified_types[0];
    let kind_change = thing
        .kind_change
        .as_ref()
        .expect("Thing should have a kind change");

    assert!(thing.breaking);
    assert_eq!(kind_change.old_kind, TypeKind::Object);
    assert_eq!(kind_change.new_kind, TypeKind::InputObject);
}

#[test]
fn rejects_invalid_schema_syntax() {
    let error = diff_schema_sdl("type Query { ok: String }", "type Query {").unwrap_err();

    assert!(error.to_string().contains("expected"));
}
