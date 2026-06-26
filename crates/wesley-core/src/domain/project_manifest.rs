//! Domain-free Wesley project manifest parsing and validation.
//!
//! The manifest names GraphQL source files, generic output/evidence locations,
//! and extension target metadata. It intentionally does not assign database,
//! runtime, renderer, or product semantics to those targets.

use std::collections::{BTreeMap, BTreeSet};

use serde_json::{Map as JsonMap, Value as JsonValue};
use yaml_rust2::{Yaml, YamlLoader};

/// Supported Wesley project manifest API version.
pub const PROJECT_MANIFEST_API_VERSION: &str = "wesley.project-manifest/v1";

/// Domain-free project manifest for Wesley compiler and evidence workflows.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectManifest {
    /// Manifest API version.
    #[serde(default = "default_api_version")]
    pub api_version: String,
    /// GraphQL schema paths, optionally with per-schema rebuild globs.
    #[serde(default)]
    pub schema_paths: Vec<SchemaPathConfig>,
    /// Directory used for generated Wesley evidence bundles.
    #[serde(default = "default_bundle_dir")]
    pub bundle_dir: String,
    /// Global file globs that force every schema set to rebuild.
    #[serde(default)]
    pub rebuild_on_globs: Vec<String>,
    /// Preferred PR comment update behavior for automation.
    #[serde(default)]
    pub comment_mode: CommentMode,
    /// Optional dashboard artifact settings.
    #[serde(default)]
    pub dashboard: DashboardConfig,
    /// Selected extension targets. Target-specific semantics belong to modules.
    #[serde(default)]
    pub targets: Vec<ManifestTargetConfig>,
}

impl ProjectManifest {
    /// Returns schema paths with stable ids and explicit per-schema globs.
    pub fn resolved_schema_paths(&self) -> Vec<ResolvedSchemaPath> {
        self.schema_paths
            .iter()
            .enumerate()
            .map(|(index, entry)| entry.resolve(index))
            .collect()
    }
}

/// Schema path entry, either compact string form or object form.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
pub enum SchemaPathConfig {
    /// Compact schema path form.
    Path(String),
    /// Detailed schema path form.
    Detailed(DetailedSchemaPathConfig),
}

/// Detailed schema path form with a stable id and rebuild globs.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DetailedSchemaPathConfig {
    /// Stable schema set id.
    #[serde(default)]
    pub id: Option<String>,
    /// GraphQL SDL path.
    pub path: String,
    /// File globs that rebuild this schema set.
    #[serde(default)]
    pub rebuild_on_globs: Vec<String>,
}

impl SchemaPathConfig {
    fn resolve(&self, index: usize) -> ResolvedSchemaPath {
        match self {
            Self::Path(path) => ResolvedSchemaPath {
                id: slug_from_path(path, index),
                path: path.clone(),
                rebuild_on_globs: Vec::new(),
            },
            Self::Detailed(DetailedSchemaPathConfig {
                id,
                path,
                rebuild_on_globs,
            }) => ResolvedSchemaPath {
                id: id.clone().unwrap_or_else(|| slug_from_path(path, index)),
                path: path.clone(),
                rebuild_on_globs: rebuild_on_globs.clone(),
            },
        }
    }
}

/// Normalized schema path used for validation and changed-file selection.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSchemaPath {
    /// Stable schema set id.
    pub id: String,
    /// GraphQL SDL path.
    pub path: String,
    /// File globs that rebuild this schema set.
    pub rebuild_on_globs: Vec<String>,
}

/// Schema selected by changed-file analysis.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedSchemaPath {
    /// Stable schema set id.
    pub id: String,
    /// GraphQL SDL path.
    pub path: String,
    /// Bundle directory for this schema set.
    pub bundle_dir: String,
    /// Why this schema set was selected.
    pub reason: String,
}

/// PR comment update behavior for Wesley automation.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommentMode {
    /// Update the existing bot comment when possible.
    #[default]
    Update,
    /// Append a new comment for each run.
    Append,
    /// Do not write PR comments.
    Silent,
}

impl CommentMode {
    /// Stable manifest string for this mode.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Update => "update",
            Self::Append => "append",
            Self::Silent => "silent",
        }
    }
}

/// Optional dashboard artifact settings.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DashboardConfig {
    /// Whether to emit dashboard artifacts.
    #[serde(default)]
    pub enabled: bool,
    /// Dashboard artifact path.
    #[serde(default)]
    pub artifact_path: Option<String>,
}

/// Domain-free extension target selection.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ManifestTargetConfig {
    /// Stable target name.
    pub name: String,
    /// Optional external module identity that owns target semantics.
    #[serde(default)]
    pub module: Option<String>,
    /// Whether this target is selected when no explicit target is requested.
    #[serde(default, rename = "default")]
    pub is_default: bool,
    /// Optional output directory for this target.
    #[serde(default)]
    pub output_dir: Option<String>,
    /// Generic mutually-exclusive target group.
    #[serde(default)]
    pub exclusive_group: Option<String>,
    /// Target names that cannot be selected with this target.
    #[serde(default)]
    pub conflicts_with: Vec<String>,
}

/// Parse or validation error for a Wesley project manifest.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectManifestError {
    /// The manifest could not be parsed as JSON or YAML.
    Parse(String),
    /// The manifest API version is unsupported.
    UnsupportedApiVersion(String),
    /// The manifest shape parsed but failed validation.
    Validation(Vec<String>),
}

impl std::fmt::Display for ProjectManifestError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Parse(message) => write!(formatter, "manifest parse error: {message}"),
            Self::UnsupportedApiVersion(version) => write!(
                formatter,
                "unsupported manifest apiVersion '{version}'; expected {PROJECT_MANIFEST_API_VERSION}"
            ),
            Self::Validation(diagnostics) => {
                write!(formatter, "manifest validation failed")?;
                for diagnostic in diagnostics {
                    write!(formatter, "; {diagnostic}")?;
                }
                Ok(())
            }
        }
    }
}

impl std::error::Error for ProjectManifestError {}

/// Parse and validate a Wesley project manifest from JSON or YAML.
pub fn load_project_manifest(source: &str) -> Result<ProjectManifest, ProjectManifestError> {
    let value = parse_manifest_value(source)?;
    let manifest = serde_json::from_value::<ProjectManifest>(value)
        .map_err(|source| ProjectManifestError::Parse(source.to_string()))?;
    validate_project_manifest(&manifest)?;
    Ok(manifest)
}

/// Validate a parsed Wesley project manifest.
pub fn validate_project_manifest(manifest: &ProjectManifest) -> Result<(), ProjectManifestError> {
    if manifest.api_version != PROJECT_MANIFEST_API_VERSION {
        return Err(ProjectManifestError::UnsupportedApiVersion(
            manifest.api_version.clone(),
        ));
    }

    let mut diagnostics = Vec::new();
    let schemas = manifest.resolved_schema_paths();
    let mut schema_ids = BTreeSet::new();
    let mut schema_paths = BTreeSet::new();
    for schema in &schemas {
        if schema.id.trim().is_empty() {
            diagnostics.push("schemaPaths contains a blank id".to_owned());
        }
        if schema_id_is_dot_only(&schema.id) {
            diagnostics.push(format!(
                "schemaPath id '{}' must not be '.', '..', or only dots",
                schema.id
            ));
        } else if !schema_id_is_path_safe(&schema.id) {
            diagnostics.push(format!(
                "schemaPath id '{}' must contain only ASCII letters, digits, '.', '_', or '-'",
                schema.id
            ));
        }
        if schema.path.trim().is_empty() {
            diagnostics.push(format!("schemaPath `{}` has a blank path", schema.id));
        }
        if !schema_ids.insert(schema.id.clone()) {
            diagnostics.push(format!("duplicate schemaPath id '{}'", schema.id));
        }
        if !schema_paths.insert(normalize_path(&schema.path)) {
            diagnostics.push(format!("duplicate schemaPath path '{}'", schema.path));
        }
    }

    if manifest.bundle_dir.trim().is_empty() {
        diagnostics.push("bundleDir must not be blank".to_owned());
    }

    let mut target_names = BTreeSet::new();
    let mut default_targets = Vec::new();
    let mut exclusive_groups: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for target in &manifest.targets {
        if target.name.trim().is_empty() {
            diagnostics.push("targets contains a blank name".to_owned());
            continue;
        }
        if !target_names.insert(target.name.clone()) {
            diagnostics.push(format!("duplicate target '{}'", target.name));
        }
        if target.is_default {
            default_targets.push(target.name.clone());
        }
        if let Some(group) = target.exclusive_group.as_deref() {
            if group.trim().is_empty() {
                diagnostics.push(format!(
                    "target '{}' has a blank exclusiveGroup",
                    target.name
                ));
            } else {
                exclusive_groups
                    .entry(group.to_owned())
                    .or_default()
                    .push(target.name.clone());
            }
        }
    }

    if default_targets.len() > 1 {
        diagnostics.push(format!(
            "multiple default targets selected: {}",
            default_targets.join(", ")
        ));
    }

    for (group, targets) in exclusive_groups {
        if targets.len() > 1 {
            diagnostics.push(format!(
                "exclusive group '{group}' selects multiple targets: {}",
                targets.join(", ")
            ));
        }
    }

    for target in &manifest.targets {
        for conflict in &target.conflicts_with {
            if target_names.contains(conflict) {
                diagnostics.push(format!(
                    "target '{}' conflicts with selected target '{}'",
                    target.name, conflict
                ));
            }
        }
    }

    if diagnostics.is_empty() {
        Ok(())
    } else {
        Err(ProjectManifestError::Validation(diagnostics))
    }
}

/// Select schema paths affected by a set of changed files.
pub fn select_changed_schema_paths(
    manifest: &ProjectManifest,
    changed_files: impl IntoIterator<Item = impl AsRef<str>>,
) -> Vec<SelectedSchemaPath> {
    let changed = changed_files
        .into_iter()
        .map(|path| normalize_path(path.as_ref()))
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();
    let schemas = manifest.resolved_schema_paths();

    if changed.is_empty() {
        let schema_count = schemas.len();
        return schemas
            .into_iter()
            .map(|schema| SelectedSchemaPath {
                bundle_dir: schema_bundle_dir(&manifest.bundle_dir, &schema.id, schema_count),
                id: schema.id,
                path: schema.path,
                reason: "no changed files provided".to_owned(),
            })
            .collect();
    }

    for glob in &manifest.rebuild_on_globs {
        if changed.iter().any(|path| glob_matches(glob, path)) {
            let schema_count = schemas.len();
            return schemas
                .into_iter()
                .map(|schema| SelectedSchemaPath {
                    bundle_dir: schema_bundle_dir(&manifest.bundle_dir, &schema.id, schema_count),
                    id: schema.id,
                    path: schema.path,
                    reason: format!("matched global rebuild glob `{glob}`"),
                })
                .collect();
        }
    }

    let schema_count = schemas.len();
    schemas
        .into_iter()
        .filter_map(|schema| {
            let schema_path = normalize_path(&schema.path);
            let bundle_dir = schema_bundle_dir(&manifest.bundle_dir, &schema.id, schema_count);
            if changed.iter().any(|path| path == &schema_path) {
                return Some(SelectedSchemaPath {
                    bundle_dir,
                    id: schema.id,
                    path: schema.path,
                    reason: format!("matched schema path `{schema_path}`"),
                });
            }

            for glob in &schema.rebuild_on_globs {
                if changed.iter().any(|path| glob_matches(glob, path)) {
                    return Some(SelectedSchemaPath {
                        bundle_dir,
                        id: schema.id,
                        path: schema.path,
                        reason: format!("matched schema rebuild glob `{glob}`"),
                    });
                }
            }

            None
        })
        .collect()
}

fn schema_bundle_dir(base: &str, schema_id: &str, schema_count: usize) -> String {
    let base = normalize_path(base);
    if schema_count <= 1 {
        return base;
    }
    join_normalized_path(&base, schema_id)
}

fn join_normalized_path(base: &str, child: &str) -> String {
    match base {
        "." => format!("./{child}"),
        "/" => format!("/{child}"),
        _ => format!("{base}/{child}"),
    }
}

fn schema_id_is_path_safe(id: &str) -> bool {
    id.chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-'))
}

fn schema_id_is_dot_only(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|character| character == '.')
}

fn default_api_version() -> String {
    PROJECT_MANIFEST_API_VERSION.to_owned()
}

fn default_bundle_dir() -> String {
    ".wesley-cache".to_owned()
}

fn parse_manifest_value(source: &str) -> Result<JsonValue, ProjectManifestError> {
    match serde_json::from_str::<JsonValue>(source) {
        Ok(value) => Ok(value),
        Err(json_error) => {
            let documents = YamlLoader::load_from_str(source).map_err(|yaml_error| {
                ProjectManifestError::Parse(format!(
                    "not valid JSON ({json_error}); not valid YAML ({yaml_error})"
                ))
            })?;
            let Some(document) = documents.first() else {
                return Err(ProjectManifestError::Parse(
                    "YAML source contained no document".to_owned(),
                ));
            };
            yaml_to_json(document)
        }
    }
}

fn yaml_to_json(value: &Yaml) -> Result<JsonValue, ProjectManifestError> {
    match value {
        Yaml::Real(value) => value
            .parse::<f64>()
            .map(JsonValue::from)
            .map_err(|source| ProjectManifestError::Parse(source.to_string())),
        Yaml::Integer(value) => Ok(JsonValue::from(*value)),
        Yaml::String(value) => Ok(JsonValue::from(value.clone())),
        Yaml::Boolean(value) => Ok(JsonValue::from(*value)),
        Yaml::Array(values) => values
            .iter()
            .map(yaml_to_json)
            .collect::<Result<Vec<_>, _>>()
            .map(JsonValue::from),
        Yaml::Hash(values) => {
            let mut object = JsonMap::new();
            for (key, value) in values {
                let key = match key {
                    Yaml::String(key) => key.clone(),
                    _ => {
                        return Err(ProjectManifestError::Parse(
                            "YAML manifest keys must be strings".to_owned(),
                        ));
                    }
                };
                object.insert(key, yaml_to_json(value)?);
            }
            Ok(JsonValue::Object(object))
        }
        Yaml::Null | Yaml::BadValue => Ok(JsonValue::Null),
        Yaml::Alias(_) => Err(ProjectManifestError::Parse(
            "YAML aliases are not supported in Wesley manifests".to_owned(),
        )),
    }
}

fn slug_from_path(path: &str, index: usize) -> String {
    let mut slug = normalize_path(path)
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    let slug = slug.trim_matches('-').to_owned();
    if slug.is_empty() {
        format!("schema-{index}")
    } else {
        slug
    }
}

fn normalize_path(path: &str) -> String {
    let path = path.trim().replace('\\', "/");
    let is_absolute = path.starts_with('/');
    let is_current = path == "." || path == "./";
    let normalized = path
        .split('/')
        .filter(|segment| !segment.is_empty() && *segment != ".")
        .collect::<Vec<_>>()
        .join("/");

    if normalized.is_empty() {
        if is_absolute {
            "/".to_owned()
        } else if is_current {
            ".".to_owned()
        } else {
            String::new()
        }
    } else if is_absolute {
        format!("/{normalized}")
    } else {
        normalized
    }
}

fn glob_matches(pattern: &str, path: &str) -> bool {
    let pattern = normalize_path(pattern);
    let path = normalize_path(path);
    if pattern.is_empty() {
        return false;
    }
    if !pattern.contains('*') && !pattern.contains('?') {
        return pattern == path;
    }

    let pattern_segments = pattern.split('/').collect::<Vec<_>>();
    let path_segments = path.split('/').collect::<Vec<_>>();
    match_glob_segments(&pattern_segments, &path_segments)
}

fn match_glob_segments(pattern: &[&str], path: &[&str]) -> bool {
    match pattern.split_first() {
        None => path.is_empty(),
        Some((&"**", rest)) => {
            match_glob_segments(rest, path)
                || (!path.is_empty() && match_glob_segments(pattern, &path[1..]))
        }
        Some((segment_pattern, rest)) => {
            if let Some((path_segment, path_rest)) = path.split_first() {
                segment_matches(segment_pattern, path_segment)
                    && match_glob_segments(rest, path_rest)
            } else {
                false
            }
        }
    }
}

fn segment_matches(pattern: &str, value: &str) -> bool {
    let pattern = pattern.as_bytes();
    let value = value.as_bytes();
    let mut pattern_index = 0;
    let mut value_index = 0;
    let mut star_index = None;
    let mut star_value_index = 0;

    while value_index < value.len() {
        if pattern_index < pattern.len()
            && (pattern[pattern_index] == b'?' || pattern[pattern_index] == value[value_index])
        {
            pattern_index += 1;
            value_index += 1;
        } else if pattern_index < pattern.len() && pattern[pattern_index] == b'*' {
            star_index = Some(pattern_index);
            star_value_index = value_index;
            pattern_index += 1;
        } else if let Some(star) = star_index {
            pattern_index = star + 1;
            star_value_index += 1;
            value_index = star_value_index;
        } else {
            return false;
        }
    }

    while pattern_index < pattern.len() && pattern[pattern_index] == b'*' {
        pattern_index += 1;
    }

    pattern_index == pattern.len()
}
