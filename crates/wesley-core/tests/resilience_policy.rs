use async_trait::async_trait;
use std::time::{Duration, Instant};
use wesley_core::{
    ApolloLoweringAdapter, LoweringPort, ResiliencePolicy, ResilientLoweringPort, WesleyError,
    WesleyIR,
};

#[derive(Clone)]
struct PendingLowerer;

#[async_trait]
impl LoweringPort for PendingLowerer {
    async fn lower_sdl(&self, _sdl: &str) -> Result<WesleyIR, WesleyError> {
        std::future::pending().await
    }
}

#[derive(Clone)]
struct BlockingLowerer;

#[async_trait]
impl LoweringPort for BlockingLowerer {
    async fn lower_sdl(&self, _sdl: &str) -> Result<WesleyIR, WesleyError> {
        std::thread::sleep(Duration::from_millis(20));
        Ok(WesleyIR {
            version: "1.0.0".to_string(),
            metadata: None,
            types: Vec::new(),
        })
    }
}

#[tokio::test(start_paused = true)]
async fn resilient_lowering_port_maps_timeout_to_resilience_error() {
    let policy = ResiliencePolicy::cooperative_lowering_timeout(Duration::from_millis(50))
        .expect("valid timeout");
    let lowerer = ResilientLoweringPort::new(PendingLowerer, policy);

    let task = tokio::spawn(async move { lowerer.lower_sdl("type Query { id: ID }").await });
    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_millis(50)).await;

    let error = task
        .await
        .expect("lowering task should join")
        .expect_err("pending lowerer should time out");

    let diagnostic = error.diagnostic();
    assert_eq!(diagnostic.code, "WESLEY_RESILIENCE_ERROR");
    assert!(diagnostic.message.contains("schema lowering"));
    assert!(diagnostic.message.contains("timed out"));
}

#[tokio::test]
async fn resilient_lowering_port_does_not_preempt_synchronous_poll_work() {
    let policy = ResiliencePolicy::cooperative_lowering_timeout(Duration::from_millis(1))
        .expect("valid timeout");
    let lowerer = ResilientLoweringPort::new(BlockingLowerer, policy);

    let started = Instant::now();
    let ir = lowerer
        .lower_sdl("type Query { id: ID }")
        .await
        .expect("cooperative timeout should not claim hard preemption");

    assert!(started.elapsed() >= Duration::from_millis(20));
    assert_eq!(ir.version, "1.0.0");
}

#[tokio::test]
async fn resilient_lowering_port_disabled_policy_forwards_success() {
    let lowerer =
        ResilientLoweringPort::new(ApolloLoweringAdapter::new(0), ResiliencePolicy::disabled());

    let ir = lowerer
        .lower_sdl("type Query { id: ID }")
        .await
        .expect("disabled resilience policy should not block normal lowering");

    assert!(lowerer.policy().is_disabled());
    assert_eq!(ir.types[0].name, "Query");
}

#[tokio::test]
async fn resilient_lowering_port_preserves_compiler_parse_errors() {
    let policy = ResiliencePolicy::cooperative_lowering_timeout(Duration::from_secs(5))
        .expect("valid timeout");
    let lowerer = ResilientLoweringPort::new(ApolloLoweringAdapter::new(0), policy);

    let error = lowerer
        .lower_sdl("type Query {")
        .await
        .expect_err("invalid SDL should remain a compiler error");

    match error {
        WesleyError::ParseError { .. } => {}
        other => panic!("expected parse error, got {other:?}"),
    }
}
