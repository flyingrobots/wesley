use std::process::Command;

#[test]
fn help_exits_zero_without_footprint_command() {
    let output = wesley().arg("--help").output().expect("wesley should run");

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(stdout.contains("Wesley native CLI"));
    assert!(!stdout.contains("check-footprint"));
}

#[test]
fn removed_footprint_checker_is_not_a_wesley_command() {
    let output = wesley()
        .arg("check-footprint")
        .output()
        .expect("wesley should run");

    assert_eq!(output.status.code(), Some(2));
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(stdout.is_empty());
    assert!(stderr.contains("unknown command 'check-footprint'"));
}

fn wesley() -> Command {
    Command::new(env!("CARGO_BIN_EXE_wesley"))
}
