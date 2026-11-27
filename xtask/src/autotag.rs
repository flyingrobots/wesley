//! The release autotag decision: whether a push to `main` is a merged
//! release-prep pull request, and if so which annotated tag it gets.

use super::{command_label, git_output, version_from_release_arg, Error};
use std::env;
use std::fs;
use std::process::Command;

/// What the autotag workflow should do with one push to `main`.
#[derive(Debug, PartialEq, Eq)]
enum AutotagDecision {
    /// Create this annotated tag at the pushed commit.
    Tag(String),
    /// Create nothing, for this reason. Skipping is the normal outcome: most
    /// pushes to `main` are not release-prep merges.
    Skip(String),
}

/// The facts about one push to `main` that decide whether it is tagged.
struct AutotagInput<'a> {
    /// The version the primary version source declares at the pushed commit.
    version: &'a str,
    /// The head branch of the merged pull request, if the commit has one.
    head_branch: Option<&'a str>,
    /// The title of that pull request.
    pr_title: Option<&'a str>,
    /// The commit being considered: `HEAD` of the pushed `main`.
    head_commit: &'a str,
    /// The expected tag, if it already exists.
    existing_tag: Option<ExistingTag<'a>>,
}

/// A release tag that already exists in the repository.
#[derive(Clone, Copy)]
struct ExistingTag<'a> {
    /// The commit the tag peels to.
    commit: &'a str,
    /// Whether the ref names a tag object rather than the commit itself.
    annotated: bool,
}

/// Decides whether a push to `main` is a release-prep merge that earns a tag.
///
/// Follows the Continuum release runbook, section 16: a branch name is useful
/// but is not the only line of defense, so the pull request's title must name
/// the same version its branch does. A push that is not a release-prep merge is
/// skipped. A push that *claims* to be one and disagrees with itself is an
/// error, because tagging the wrong commit cannot be undone.
fn autotag_decision(input: &AutotagInput<'_>) -> Result<AutotagDecision, Error> {
    let version = version_from_release_arg(input.version)?;
    let tag = format!("v{version}");

    let (Some(head_branch), Some(pr_title)) = (input.head_branch, input.pr_title) else {
        return Ok(AutotagDecision::Skip(
            "the pushed commit has no merged pull request".to_string(),
        ));
    };
    let Some(branch_version) = head_branch.strip_prefix(AUTOTAG_RELEASE_BRANCH_PREFIX) else {
        return Ok(AutotagDecision::Skip(format!(
            "`{head_branch}` is not a release-prep branch"
        )));
    };

    let mut failures = Vec::new();
    if branch_version != version {
        failures.push(format!(
            "branch `{head_branch}` names `{branch_version}`, but {AUTOTAG_VERSION_SOURCE} declares `{version}`"
        ));
    }
    if !title_names_tag(pr_title, &tag) {
        failures.push(format!(
            "pull request title `{pr_title}` does not name `{tag}`"
        ));
    }
    if !failures.is_empty() {
        return Err(Error::CheckFailed {
            check: "autotag release-prep agreement".to_string(),
            failures,
        });
    }

    let Some(existing) = input.existing_tag else {
        return Ok(AutotagDecision::Tag(tag));
    };
    // Public tags are never moved, so neither defect below can be repaired
    // here, and neither may pass as a green skip.
    let mut failures = Vec::new();
    if existing.commit != input.head_commit {
        failures.push(format!(
            "tag `{tag}` already exists at `{}`, not at the release commit `{}`",
            existing.commit, input.head_commit
        ));
    }
    if !existing.annotated {
        failures.push(format!(
            "tag `{tag}` is a lightweight tag; release tags are annotated"
        ));
    }
    if !failures.is_empty() {
        return Err(Error::CheckFailed {
            check: "autotag existing tag".to_string(),
            failures,
        });
    }
    // A rerun on the commit that is already tagged: nothing to do.
    Ok(AutotagDecision::Skip(format!(
        "tag `{tag}` already points at this commit"
    )))
}

/// The branch prefix a release-prep pull request is opened from.
const AUTOTAG_RELEASE_BRANCH_PREFIX: &str = "release/v";
/// The primary version source, first in `.continuum/release.yml`.
const AUTOTAG_VERSION_SOURCE: &str = "crates/wesley-core/Cargo.toml";

/// Whether a title names exactly this tag as a whole word, so that `v0.3.0`
/// does not match inside `v0.3.0-alpha.2`.
fn title_names_tag(title: &str, tag: &str) -> bool {
    let is_version_char = |ch: char| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '+');
    title
        .split(|ch: char| !is_version_char(ch))
        .any(|word| word.trim_end_matches('.') == tag)
}

/// Whether `refs/tags/<tag>` names a tag object. A lightweight tag names the
/// commit directly, so `git cat-file -t` reports `commit` for it.
fn tag_is_annotated(tag: &str) -> Result<bool, Error> {
    let reference = format!("refs/tags/{tag}");
    Ok(git_output(&["cat-file", "-t", reference.as_str()])?.trim() == "tag")
}

/// The commit a tag points at, or `None` when the tag does not exist.
fn commit_of_tag(tag: &str) -> Result<Option<String>, Error> {
    let reference = format!("refs/tags/{tag}^{{commit}}");
    let args = ["rev-parse", "--verify", "--quiet", reference.as_str()];
    let label = command_label("git", &args);
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|source| Error::Usage(format!("failed to spawn `{label}`: {source}")))?;
    // `--verify --quiet` exits 1 with no output when the ref does not exist.
    if !output.status.success() {
        return Ok(None);
    }
    Ok(Some(
        String::from_utf8_lossy(&output.stdout).trim().to_string(),
    ))
}

/// The `package.version` declared by the autotag version source manifest.
fn autotag_package_version(manifest: &str) -> Result<String, Error> {
    let manifest: toml::Value = toml::from_str(manifest).map_err(|source| {
        Error::Usage(format!(
            "failed to parse {AUTOTAG_VERSION_SOURCE}: {source}"
        ))
    })?;
    manifest
        .get("package")
        .and_then(|package| package.get("version"))
        .and_then(toml::Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| {
            Error::Usage(format!(
                "{AUTOTAG_VERSION_SOURCE} declares no package.version"
            ))
        })
}

/// Prints the autotag decision for the checked-out commit as `key=value` lines
/// suitable for `$GITHUB_OUTPUT`.
///
/// The pull request's head branch and title arrive through the
/// `AUTOTAG_HEAD_BRANCH` and `AUTOTAG_PR_TITLE` environment variables rather
/// than arguments: a title is text a contributor chose, and a workflow must
/// never interpolate it into a command line.
pub(crate) fn run_release_autotag_plan() -> Result<(), Error> {
    let manifest = fs::read_to_string(AUTOTAG_VERSION_SOURCE).map_err(|source| {
        Error::Usage(format!("failed to read {AUTOTAG_VERSION_SOURCE}: {source}"))
    })?;
    let version = autotag_package_version(&manifest)?;
    let version = version.as_str();

    let head_commit = git_output(&["rev-parse", "HEAD"])?;
    let expected_tag = format!("v{}", version_from_release_arg(version)?);
    let existing_tag_commit = commit_of_tag(&expected_tag)?;
    let existing_tag = match existing_tag_commit.as_deref() {
        None => None,
        Some(commit) => Some(ExistingTag {
            commit,
            annotated: tag_is_annotated(&expected_tag)?,
        }),
    };

    let head_branch = env::var("AUTOTAG_HEAD_BRANCH")
        .ok()
        .filter(|value| !value.is_empty());
    let pr_title = env::var("AUTOTAG_PR_TITLE")
        .ok()
        .filter(|value| !value.is_empty());
    let decision = autotag_decision(&AutotagInput {
        version,
        head_branch: head_branch.as_deref(),
        pr_title: pr_title.as_deref(),
        head_commit: head_commit.trim(),
        existing_tag,
    })?;
    match decision {
        AutotagDecision::Tag(tag) => println!("decision=tag\ntag={tag}"),
        AutotagDecision::Skip(reason) => println!("decision=skip\nreason={reason}"),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const AUTOTAG_HEAD: &str = "1111111111111111111111111111111111111111";
    const AUTOTAG_ELSEWHERE: &str = "2222222222222222222222222222222222222222";

    fn autotag_input<'a>(
        version: &'a str,
        head_branch: Option<&'a str>,
        pr_title: Option<&'a str>,
        existing_tag: Option<ExistingTag<'a>>,
    ) -> AutotagInput<'a> {
        AutotagInput {
            version,
            head_branch,
            pr_title,
            head_commit: AUTOTAG_HEAD,
            existing_tag,
        }
    }

    const fn annotated_at(commit: &str) -> ExistingTag<'_> {
        ExistingTag {
            commit,
            annotated: true,
        }
    }

    #[test]
    fn autotag_tags_a_merged_release_prep_pull_request() {
        let input = autotag_input(
            "0.3.0-alpha.2",
            Some("release/v0.3.0-alpha.2"),
            Some("chore(release): prepare v0.3.0-alpha.2"),
            None,
        );

        assert_eq!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Tag("v0.3.0-alpha.2".to_string())
        );
    }

    #[test]
    fn autotag_skips_an_ordinary_merge_to_main() {
        let input = autotag_input(
            "0.3.0-alpha.2",
            Some("core/803-lean-core-resilience-feature"),
            Some("feat(core): put the async lowering port behind a `resilience` feature"),
            None,
        );

        assert!(matches!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Skip(reason) if reason.contains("not a release-prep")
        ));
    }

    #[test]
    fn autotag_skips_a_push_with_no_pull_request() {
        let input = autotag_input("0.3.0-alpha.2", None, None, None);

        assert!(matches!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Skip(reason) if reason.contains("no merged pull request")
        ));
    }

    #[test]
    fn autotag_skips_a_rerun_when_the_tag_already_points_at_this_commit() {
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.1"),
            Some("chore(release): prepare v0.3.0-alpha.1"),
            Some(annotated_at(AUTOTAG_HEAD)),
        );

        assert!(matches!(
            autotag_decision(&input).unwrap(),
            AutotagDecision::Skip(reason) if reason.contains("already points at this commit")
        ));
    }

    #[test]
    fn autotag_refuses_a_lightweight_tag_even_at_the_release_commit() {
        // Release tags are annotated. A lightweight tag at HEAD peels to the
        // same commit, so a green skip would let the publish dispatch run from
        // a tag this workflow would never have created.
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.1"),
            Some("chore(release): prepare v0.3.0-alpha.1"),
            Some(ExistingTag {
                commit: AUTOTAG_HEAD,
                annotated: false,
            }),
        );

        assert!(matches!(
            autotag_decision(&input),
            Err(Error::CheckFailed { failures, .. })
                if failures.iter().any(|failure| failure.contains("lightweight"))
        ));
    }

    #[test]
    fn autotag_fails_loudly_when_the_tag_exists_on_another_commit() {
        // A green skip here would hide that an immutable version is attached to
        // the wrong source.
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.1"),
            Some("chore(release): prepare v0.3.0-alpha.1"),
            Some(annotated_at(AUTOTAG_ELSEWHERE)),
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_refuses_a_release_branch_that_disagrees_with_the_manifest() {
        let input = autotag_input(
            "0.3.0-alpha.1",
            Some("release/v0.3.0-alpha.2"),
            Some("chore(release): prepare v0.3.0-alpha.2"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_refuses_a_release_branch_whose_title_names_another_version() {
        let input = autotag_input(
            "0.3.0-alpha.2",
            Some("release/v0.3.0-alpha.2"),
            Some("chore(release): prepare v0.3.0-alpha.3"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_does_not_mistake_a_longer_version_in_the_title_for_a_match() {
        let input = autotag_input(
            "0.3.0",
            Some("release/v0.3.0"),
            Some("chore(release): prepare v0.3.0-alpha.2"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    #[test]
    fn autotag_refuses_a_version_with_build_metadata() {
        let input = autotag_input(
            "0.3.0+build.7",
            Some("release/v0.3.0+build.7"),
            Some("chore(release): prepare v0.3.0+build.7"),
            None,
        );

        assert!(autotag_decision(&input).is_err());
    }

    // --- autotag version source ---

    #[test]
    fn autotag_reads_package_version_from_a_whole_manifest() {
        let manifest = "[package]\nname = \"wesley-core\"\nversion = \"1.2.3-alpha.2\"\n\n[dependencies]\nhex = \"0.4\"\n";

        assert_eq!(
            autotag_package_version(manifest).expect("manifest should yield a version"),
            "1.2.3-alpha.2"
        );
    }

    #[test]
    fn autotag_refuses_a_manifest_without_package_version() {
        match autotag_package_version("[package]\nname = \"wesley-core\"\n") {
            Err(Error::Usage(message)) => {
                assert!(message.contains("declares no package.version"), "{message}");
            }
            other => panic!("expected a usage error, got {other:?}"),
        }
    }
}
