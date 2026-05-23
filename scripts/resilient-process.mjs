import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Policy } from '@git-stunts/alfred';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

const UNREF_CLOCK = Object.freeze({
  now: () => Date.now(),
  sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });
  }
});

export function runProcess(command, args, options) {
  const timeoutPolicy = Policy.timeout(options.timeoutMs, { clock: options.clock ?? UNREF_CLOCK });
  const spawnImpl = options.spawnImpl ?? spawn;
  const cwd = options.cwd ?? ROOT_DIR;

  return timeoutPolicy.execute(
    (signal) =>
      new Promise((resolve, reject) => {
        let settled = false;
        let stdout = '';
        let stderr = '';

        const settle = (settler, value) => {
          if (settled) return;
          settled = true;
          settler(value);
        };

        const child = spawnImpl(command, args, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          killSignal: 'SIGKILL'
        });
        signal.addEventListener('abort', () => child.kill('SIGKILL'), { once: true });

        const appendOutput = (streamName, chunk) => {
          if (settled) return;

          const nextValue = (streamName === 'stdout' ? stdout : stderr) + chunk;
          if (Buffer.byteLength(nextValue, 'utf8') > options.maxBufferBytes) {
            child.kill('SIGKILL');
            settle(
              reject,
              new Error(
                `${command} ${args.join(' ')} exceeded ${options.maxBufferBytes} byte ${streamName} buffer`
              )
            );
            return;
          }

          if (streamName === 'stdout') {
            stdout = nextValue;
          } else {
            stderr = nextValue;
          }
        };

        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (chunk) => appendOutput('stdout', chunk));
        child.stderr?.on('data', (chunk) => appendOutput('stderr', chunk));
        child.on('error', (error) => {
          if (signal.aborted) return;
          settle(reject, error);
        });
        child.on('close', (status, signalName) => {
          if (signal.aborted) return;
          settle(resolve, {
            status,
            signal: signalName,
            stdout,
            stderr
          });
        });
      })
  );
}
