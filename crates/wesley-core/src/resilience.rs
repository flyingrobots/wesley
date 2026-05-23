//! Explicit resilience policy wrappers for compiler execution seams.

use crate::domain::error::WesleyError;
use crate::domain::ir::WesleyIR;
use crate::ports::lowering::LoweringPort;
use async_trait::async_trait;
use ninelives::{ResilienceError as NineLivesError, TimeoutPolicy};
use std::time::Duration;

/// Resilience policy knobs for compiler seams.
///
/// The default policy is disabled so ordinary in-process lowering remains a
/// deterministic compiler operation. Callers opt in at execution boundaries
/// where a cooperative async deadline is meaningful.
///
/// This policy does not preempt synchronous CPU-bound work that runs inside a
/// single future poll. Lowerers that need a hard execution deadline should run
/// behind a process, thread, or runtime boundary that can be cancelled outside
/// the parser/lowering poll itself.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ResiliencePolicy {
    cooperative_lowering_timeout: Option<Duration>,
}

impl ResiliencePolicy {
    /// Returns a policy with no resilience wrappers enabled.
    #[must_use]
    pub fn disabled() -> Self {
        Self {
            cooperative_lowering_timeout: None,
        }
    }

    /// Returns a policy with a cooperative schema-lowering timeout.
    ///
    /// The timeout is enforced when the wrapped future yields to the async
    /// runtime. It does not preempt synchronous CPU-bound parser or lowering
    /// work that runs to completion inside one poll.
    ///
    /// # Errors
    ///
    /// Returns [`WesleyError::ResilienceError`] if `duration` is not accepted by
    /// `ninelives`.
    pub fn cooperative_lowering_timeout(duration: Duration) -> Result<Self, WesleyError> {
        Self::disabled().with_cooperative_lowering_timeout(duration)
    }

    /// Adds a cooperative schema-lowering timeout to this policy.
    ///
    /// The timeout is enforced when the wrapped future yields to the async
    /// runtime. It does not preempt synchronous CPU-bound parser or lowering
    /// work that runs to completion inside one poll.
    ///
    /// # Errors
    ///
    /// Returns [`WesleyError::ResilienceError`] if `duration` is not accepted by
    /// `ninelives`.
    pub fn with_cooperative_lowering_timeout(
        mut self,
        duration: Duration,
    ) -> Result<Self, WesleyError> {
        TimeoutPolicy::new(duration)
            .map_err(|error| WesleyError::ResilienceError(format!("invalid timeout: {error}")))?;
        self.cooperative_lowering_timeout = Some(duration);
        Ok(self)
    }

    /// Returns the configured cooperative schema-lowering timeout, if enabled.
    #[must_use]
    pub fn cooperative_lowering_timeout_duration(&self) -> Option<Duration> {
        self.cooperative_lowering_timeout
    }

    /// Returns true when no resilience wrappers are enabled.
    #[must_use]
    pub fn is_disabled(&self) -> bool {
        self.cooperative_lowering_timeout.is_none()
    }
}

/// Lowering-port adapter that applies explicit cooperative resilience policy.
///
/// The timeout policy observes async cancellation points. It preserves ordinary
/// compiler errors and does not retry deterministic parse or semantic failures.
#[derive(Debug, Clone)]
pub struct ResilientLoweringPort<P> {
    inner: P,
    policy: ResiliencePolicy,
}

impl<P> ResilientLoweringPort<P> {
    /// Creates a lowering-port wrapper around an existing port.
    #[must_use]
    pub fn new(inner: P, policy: ResiliencePolicy) -> Self {
        Self { inner, policy }
    }

    /// Returns the configured resilience policy.
    #[must_use]
    pub fn policy(&self) -> ResiliencePolicy {
        self.policy
    }

    /// Returns the wrapped lowering port.
    #[must_use]
    pub fn inner(&self) -> &P {
        &self.inner
    }
}

#[async_trait]
impl<P> LoweringPort for ResilientLoweringPort<P>
where
    P: LoweringPort + Send + Sync,
{
    async fn lower_sdl(&self, sdl: &str) -> Result<WesleyIR, WesleyError> {
        let Some(timeout) = self.policy.cooperative_lowering_timeout_duration() else {
            return self.inner.lower_sdl(sdl).await;
        };

        let policy = TimeoutPolicy::new(timeout)
            .map_err(|error| WesleyError::ResilienceError(format!("invalid timeout: {error}")))?;
        let result: Result<WesleyIR, NineLivesError<WesleyError>> = policy
            .execute(|| async {
                self.inner
                    .lower_sdl(sdl)
                    .await
                    .map_err(NineLivesError::Inner)
            })
            .await;

        match result {
            Ok(ir) => Ok(ir),
            Err(NineLivesError::Inner(error)) => Err(error),
            Err(error) => Err(WesleyError::ResilienceError(format!(
                "schema lowering {error}"
            ))),
        }
    }
}
