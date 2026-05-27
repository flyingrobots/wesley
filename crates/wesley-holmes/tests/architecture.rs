use std::fs;
use std::path::{Path, PathBuf};

#[test]
fn domain_sources_do_not_import_ambient_adapters() {
    let domain_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/domain");
    let mut files = Vec::new();
    collect_rs_files(&domain_dir, &mut files);

    let forbidden = [
        ("use std::fs", "filesystem imports"),
        ("std::fs::", "filesystem references"),
        ("use std::net", "network imports"),
        ("std::net::", "network references"),
        ("use std::process", "process imports"),
        ("std::process::", "process references"),
        ("SystemTime", "wall-clock access"),
        ("Instant::now", "wall-clock access"),
        ("chrono::Utc::now", "wall-clock access"),
        ("reqwest", "HTTP client dependency"),
        ("octocrab", "GitHub client dependency"),
    ];

    for file in files {
        let source = fs::read_to_string(&file)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", file.display()));
        for (token, reason) in forbidden {
            assert!(
                !source.contains(token),
                "domain file {} contains forbidden {reason}: {token}",
                file.display()
            );
        }
    }
}

fn collect_rs_files(directory: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", directory.display()))
    {
        let entry = entry.expect("failed to read directory entry");
        let path = entry.path();
        if path.is_dir() {
            collect_rs_files(&path, files);
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("rs") {
            files.push(path);
        }
    }
}
