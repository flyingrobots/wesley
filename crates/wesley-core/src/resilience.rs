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
/// where a deadline is meaningful.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ResiliencePolicy {
    lowering_timeout: Option<Duration>,
}

impl ResiliencePolicy {
    /// Returns a policy with no resilience wrappers enabled.
    #[must_use]
    pub fn disabled() -> Self {
        Self {
            lowering_timeout: None,
        }
    }

    /// Returns a policy with a schema-lowering timeout.
    ///
    /// # Errors
    ///
    /// Returns [`WesleyError::ResilienceError`] if `duration` is not accepted by
    /// `ninelives`.
    pub fn lowering_timeout(duration: Duration) -> Result<Self, WesleyError> {
        Self::disabled().with_lowering_timeout(duration)
    }

    /// Adds a schema-lowering timeout to this policy.
    ///
    /// # Errors
    ///
    /// Returns [`WesleyError::ResilienceError`] if `duration` is not accepted by
    /// `ninelives`.
    pub fn with_lowering_timeout(mut self, duration: Duration) -> Result<Self, WesleyError> {
        TimeoutPolicy::new(duration)
            .map_err(|error| WesleyError::ResilienceError(format!("invalid timeout: {error}")))?;
        self.lowering_timeout = Some(duration);
        Ok(self)
    }

    /// Returns the configured schema-lowering timeout, if enabled.
    #[must_use]
    pub fn lowering_timeout_duration(&self) -> Option<Duration> {
        self.lowering_timeout
    }

    /// Returns true when no resilience wrappers are enabled.
    #[must_use]
    pub fn is_disabled(&self) -> bool {
        self.lowering_timeout.is_none()
    }
}

/// Lowering-port adapter that applies explicit resilience policy.
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
        let Some(timeout) = self.policy.lowering_timeout_duration() else {
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
