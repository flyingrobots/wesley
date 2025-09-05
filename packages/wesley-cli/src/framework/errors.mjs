export class ExitError extends Error {
  constructor(exitCode, cause) {
    super(cause?.message || 'Command exited', { cause });
    this.name = 'ExitError';
    this.exitCode = exitCode ?? 1;
  }
}

export default { ExitError };

