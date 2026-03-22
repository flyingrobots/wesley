export async function runWesleyCli({
  argv = process.argv,
  createRuntime,
  runProgram,
  exit = (code) => process.exit(code),
  errorSink = (message) => console.error(message)
} = {}) {
  if (typeof createRuntime !== 'function') {
    throw new TypeError('runWesleyCli requires createRuntime()');
  }
  if (typeof runProgram !== 'function') {
    throw new TypeError('runWesleyCli requires runProgram()');
  }

  try {
    const ctx = await createRuntime();
    const exitCode = await runProgram(argv, ctx);
    await exit(exitCode || 0);
    return exitCode || 0;
  } catch (error) {
    await errorSink(error?.stack || error);
    await exit(1);
    return 1;
  }
}
