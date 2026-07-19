//! A deliberately impractical external generator built on Wesley's public API.
//!
//! The example lowers GraphQL into canonical Wesley Shape IR, derives a stable
//! summary, compiles that summary into Brainfuck, executes the result, and
//! verifies exact generator/source/output provenance.

use std::env;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::io::{Error as IoError, ErrorKind, Write};

use wesley_core::{
    compute_generation_artifact_digest_v1, list_schema_operations_sdl, lower_schema_sdl,
    ExtensionGenerationInputV1, GenerationArtifactContentV1, GenerationContractError,
    GenerationProvenanceManifestV1, GenerationProvenanceVerificationV1, GenerationReviewV1,
    GeneratorIdentityV1, OperationType, SchemaOperation,
};

const FIXTURE_SCHEMA: &str = r#"
type Query {
  ponder(question: String!): Thought!
}

type Thought {
  answer: String!
  confidence: Int!
}
"#;

const OWNER_DECLARATION: &[u8] = br#"{
  "apiVersion": "example.brainfuck-semantics/v1",
  "cellSemantics": "wrapping-u8",
  "output": "stdout"
}"#;

const GENERATOR_SETTINGS: &[u8] = br#"{
  "commentary": "mercifully omitted",
  "tapeCells": 1
}"#;

const GENERATOR_COMPONENT: &[u8] = include_bytes!("ir_to_brainfuck.rs");
const MAX_BRAINFUCK_STEPS: usize = 1_000_000;

struct GeneratedBrainfuckExtension {
    input: ExtensionGenerationInputV1,
    source: GenerationArtifactContentV1,
    output: GenerationArtifactContentV1,
    manifest: GenerationProvenanceManifestV1,
    review: GenerationReviewV1,
    decoded_message: String,
}

impl GeneratedBrainfuckExtension {
    fn program(&self) -> Result<&str, std::str::Utf8Error> {
        std::str::from_utf8(&self.output.bytes)
    }

    fn verify(&self) -> Result<GenerationProvenanceVerificationV1, GenerationContractError> {
        self.manifest.verify(
            &self.input,
            GENERATOR_COMPONENT,
            std::slice::from_ref(&self.source),
            std::slice::from_ref(&self.output),
        )
    }
}

#[derive(Debug, Eq, PartialEq)]
enum BrainfuckError {
    InputUnsupported { offset: usize },
    PointerUnderflow { offset: usize },
    StepLimitExceeded { limit: usize },
    UnmatchedClosingBracket { offset: usize },
    UnmatchedOpeningBracket { offset: usize },
}

impl Display for BrainfuckError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InputUnsupported { offset } => {
                write!(
                    formatter,
                    "input instruction at byte {offset} is unsupported"
                )
            }
            Self::PointerUnderflow { offset } => {
                write!(formatter, "tape pointer underflow at byte {offset}")
            }
            Self::StepLimitExceeded { limit } => {
                write!(formatter, "Brainfuck execution exceeded {limit} steps")
            }
            Self::UnmatchedClosingBracket { offset } => {
                write!(formatter, "unmatched closing bracket at byte {offset}")
            }
            Self::UnmatchedOpeningBracket { offset } => {
                write!(formatter, "unmatched opening bracket at byte {offset}")
            }
        }
    }
}

impl Error for BrainfuckError {}

fn main() -> Result<(), Box<dyn Error>> {
    let mut stdout = std::io::stdout().lock();
    run(env::args().skip(1), &mut stdout)
}

fn run(
    args: impl IntoIterator<Item = String>,
    stdout: &mut impl Write,
) -> Result<(), Box<dyn Error>> {
    let source_only = match args.into_iter().collect::<Vec<_>>().as_slice() {
        [] => false,
        [flag] if flag == "--source" => true,
        _ => {
            return Err(IoError::new(
                ErrorKind::InvalidInput,
                "usage: cargo run -p wesley-core --example ir_to_brainfuck [-- --source]",
            )
            .into());
        }
    };

    let generated = generate_brainfuck_extension(FIXTURE_SCHEMA)?;
    let verification = generated.verify()?;
    let program = generated.program()?;

    if source_only {
        write_brainfuck_source(stdout, program)?;
        return Ok(());
    }

    let playback = String::from_utf8(execute_brainfuck(program)?)?;
    if playback != generated.decoded_message {
        return Err(IoError::other("Brainfuck playback did not match generated input").into());
    }

    writeln!(stdout, "IR -> Brainfuck -> stdout")?;
    write!(stdout, "{playback}")?;
    writeln!(stdout, "brainfuck instructions: {}", program.len())?;
    writeln!(stdout, "generation input: {}", generated.input.digest()?)?;
    writeln!(
        stdout,
        "emitted program: {}",
        generated.output.reference().digest
    )?;
    writeln!(
        stdout,
        "provenance manifest: {}",
        generated.manifest.digest()?
    )?;
    writeln!(
        stdout,
        "review authoritative: {}",
        generated.review.authoritative()
    )?;
    writeln!(
        stdout,
        "verified materials: {} source / {} output",
        verification.verified_source_count, verification.verified_output_count
    )?;
    stdout.flush()?;

    Ok(())
}

fn write_brainfuck_source(writer: &mut impl Write, program: &str) -> Result<(), std::io::Error> {
    writer.write_all(program.as_bytes())?;
    writer.flush()
}

fn generate_brainfuck_extension(
    schema: &str,
) -> Result<GeneratedBrainfuckExtension, Box<dyn Error>> {
    let shape_ir = lower_schema_sdl(schema)?;
    let operations = list_schema_operations_sdl(schema)?;
    let source = GenerationArtifactContentV1::new(
        "example:brainfuck-semantics@1",
        OWNER_DECLARATION.to_vec(),
    );
    let input = ExtensionGenerationInputV1::new(
        shape_ir,
        operations,
        None,
        vec![source.reference()],
        compute_generation_artifact_digest_v1(GENERATOR_SETTINGS),
        vec!["brainfuck-stdout".to_owned()],
    )?;

    let decoded_message = ir_summary(&input);
    let program = compile_to_brainfuck(decoded_message.as_bytes());
    let output =
        GenerationArtifactContentV1::new("example:brainfuck-program@1", program.into_bytes());
    let generator = GeneratorIdentityV1::for_bytes(
        "example:ir-to-brainfuck@1",
        env!("CARGO_PKG_VERSION"),
        GENERATOR_COMPONENT,
    )?;
    let manifest =
        GenerationProvenanceManifestV1::new(&input, generator, vec![output.reference()])?;
    let review = GenerationReviewV1::from_manifest(&input, &manifest)?;

    Ok(GeneratedBrainfuckExtension {
        input,
        source,
        output,
        manifest,
        review,
        decoded_message,
    })
}

fn ir_summary(input: &ExtensionGenerationInputV1) -> String {
    let operation_count = input.operations.len();
    let operation_noun = if operation_count == 1 {
        "OPERATION"
    } else {
        "OPERATIONS"
    };
    let operations = input
        .operations
        .iter()
        .map(operation_label)
        .collect::<Vec<_>>()
        .join(",");

    format!(
        "WESLEY LOWERED {} TYPES AND {operation_count} ROOT {operation_noun}. \
THE IR WAS BEAUTIFUL. THEN WE COMPILED IT TO BRAINFUCK. WHAT HAPPENED NEXT WAS NOT. \
OPERATIONS={operations}. SHAPE={}\n",
        input.shape_ir.types.len(),
        input.shape_digest
    )
}

fn operation_label(operation: &SchemaOperation) -> String {
    let operation_type = match operation.operation_type {
        OperationType::Query => "QUERY",
        OperationType::Mutation => "MUTATION",
        OperationType::Subscription => "SUBSCRIPTION",
    };
    format!("{operation_type}.{}", operation.field_name.to_uppercase())
}

fn compile_to_brainfuck(message: &[u8]) -> String {
    let capacity = message.iter().map(|byte| usize::from(*byte) + 4).sum();
    let mut program = String::with_capacity(capacity);
    for byte in message {
        // Clear one cell, set its exact byte value, then print it. This is not
        // optimized, but it is deterministic and portable across wrapping-u8
        // Brainfuck interpreters—which is more portability than the idea earns.
        program.push_str("[-]");
        program.extend(std::iter::repeat_n('+', usize::from(*byte)));
        program.push('.');
    }
    program
}

fn execute_brainfuck(program: &str) -> Result<Vec<u8>, BrainfuckError> {
    execute_brainfuck_with_step_limit(program, MAX_BRAINFUCK_STEPS)
}

fn execute_brainfuck_with_step_limit(
    program: &str,
    step_limit: usize,
) -> Result<Vec<u8>, BrainfuckError> {
    let instructions = program.as_bytes();
    let jumps = bracket_jumps(instructions)?;
    if let Some(offset) = instructions
        .iter()
        .position(|instruction| *instruction == b',')
    {
        return Err(BrainfuckError::InputUnsupported { offset });
    }
    let mut tape = vec![0_u8];
    let mut pointer = 0_usize;
    let mut offset = 0_usize;
    let mut steps = 0_usize;
    let mut output = Vec::new();

    while offset < instructions.len() {
        steps += 1;
        if steps > step_limit {
            return Err(BrainfuckError::StepLimitExceeded { limit: step_limit });
        }

        match instructions[offset] {
            b'>' => {
                pointer += 1;
                if pointer == tape.len() {
                    tape.push(0);
                }
                offset += 1;
            }
            b'<' => {
                pointer = pointer
                    .checked_sub(1)
                    .ok_or(BrainfuckError::PointerUnderflow { offset })?;
                offset += 1;
            }
            b'+' => {
                tape[pointer] = tape[pointer].wrapping_add(1);
                offset += 1;
            }
            b'-' => {
                tape[pointer] = tape[pointer].wrapping_sub(1);
                offset += 1;
            }
            b'.' => {
                output.push(tape[pointer]);
                offset += 1;
            }
            b'[' if tape[pointer] == 0 => {
                offset = jumps[offset].expect("validated opening bracket") + 1;
            }
            b'[' => offset += 1,
            b']' if tape[pointer] != 0 => {
                offset = jumps[offset].expect("validated closing bracket");
            }
            b']' => offset += 1,
            _ => offset += 1,
        }
    }

    Ok(output)
}

fn bracket_jumps(instructions: &[u8]) -> Result<Vec<Option<usize>>, BrainfuckError> {
    let mut jumps = vec![None; instructions.len()];
    let mut openings = Vec::new();

    for (offset, instruction) in instructions.iter().enumerate() {
        match instruction {
            b'[' => openings.push(offset),
            b']' => {
                let opening = openings
                    .pop()
                    .ok_or(BrainfuckError::UnmatchedClosingBracket { offset })?;
                jumps[opening] = Some(offset);
                jumps[offset] = Some(opening);
            }
            _ => {}
        }
    }

    if let Some(offset) = openings.pop() {
        return Err(BrainfuckError::UnmatchedOpeningBracket { offset });
    }

    Ok(jumps)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wesley_core::GenerationContractErrorKind;

    #[test]
    fn generated_brainfuck_is_deterministic_and_replays_the_ir_summary() {
        let first = generate_brainfuck_extension(FIXTURE_SCHEMA).unwrap();
        let second = generate_brainfuck_extension(FIXTURE_SCHEMA).unwrap();

        assert_eq!(
            first.input.canonical_bytes().unwrap(),
            second.input.canonical_bytes().unwrap()
        );
        assert_eq!(first.output.bytes, second.output.bytes);
        assert_eq!(
            first.manifest.canonical_bytes().unwrap(),
            second.manifest.canonical_bytes().unwrap()
        );
        assert_eq!(
            execute_brainfuck(first.program().unwrap()).unwrap(),
            first.decoded_message.as_bytes()
        );
        let mut source_bytes = Vec::new();
        run(["--source".to_owned()], &mut source_bytes).unwrap();
        assert_eq!(source_bytes, first.output.bytes);
        assert_eq!(
            compute_generation_artifact_digest_v1(&source_bytes),
            "sha256:5a895685bbf8fe174cbdf148b853fd615432fc0f795a9bb82d9bb216e6cbcfe9"
        );
        assert!(first.decoded_message.contains("QUERY.PONDER"));
        assert!(first.decoded_message.contains(&first.input.shape_digest));
        assert!(!first.review.authoritative());

        let verification = first.verify().unwrap();
        assert_eq!(verification.verified_source_count, 1);
        assert_eq!(verification.verified_output_count, 1);
    }

    #[test]
    fn semantic_input_changes_move_the_input_and_brainfuck_output() {
        let first = generate_brainfuck_extension(FIXTURE_SCHEMA).unwrap();
        let changed_schema = FIXTURE_SCHEMA.replace("ponder", "overthink");
        let changed = generate_brainfuck_extension(&changed_schema).unwrap();

        assert_ne!(
            first.input.digest().unwrap(),
            changed.input.digest().unwrap()
        );
        assert_ne!(first.output.bytes, changed.output.bytes);
        assert!(changed.decoded_message.contains("QUERY.OVERTHINK"));
    }

    #[test]
    fn provenance_rejects_tampered_brainfuck() {
        let generated = generate_brainfuck_extension(FIXTURE_SCHEMA).unwrap();
        let mut tampered = generated.output.clone();
        tampered.bytes.push(b'+');

        let error = generated
            .manifest
            .verify(
                &generated.input,
                GENERATOR_COMPONENT,
                std::slice::from_ref(&generated.source),
                std::slice::from_ref(&tampered),
            )
            .unwrap_err();

        assert_eq!(
            error.kind,
            GenerationContractErrorKind::ArtifactDigestMismatch
        );
        assert_eq!(error.subject, "example:brainfuck-program@1");
    }

    #[test]
    fn interpreter_rejects_malformed_or_ambient_input_programs() {
        assert_eq!(
            execute_brainfuck("[").unwrap_err(),
            BrainfuckError::UnmatchedOpeningBracket { offset: 0 }
        );
        assert_eq!(
            execute_brainfuck("]").unwrap_err(),
            BrainfuckError::UnmatchedClosingBracket { offset: 0 }
        );
        assert_eq!(
            execute_brainfuck(",").unwrap_err(),
            BrainfuckError::InputUnsupported { offset: 0 }
        );
        assert_eq!(
            execute_brainfuck("[,]").unwrap_err(),
            BrainfuckError::InputUnsupported { offset: 1 }
        );
    }

    #[test]
    fn interpreter_rejects_pointer_underflow() {
        assert_eq!(
            execute_brainfuck("<").unwrap_err(),
            BrainfuckError::PointerUnderflow { offset: 0 }
        );
    }

    #[test]
    fn interpreter_enforces_the_step_limit() {
        assert_eq!(
            execute_brainfuck_with_step_limit("+[]", 3).unwrap_err(),
            BrainfuckError::StepLimitExceeded { limit: 3 }
        );
    }
}
