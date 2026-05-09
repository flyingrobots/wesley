export function summarizeChecks(checks) {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  return {
    totalChecks: checks.length,
    passed,
    failed
  };
}

export function createCheck(id, pass, message, details) {
  return {
    id,
    status: pass ? 'pass' : 'fail',
    message,
    details
  };
}
