// Reads what `wesley --help` says the binary has. The replay and the CLI
// reference generator both ask this, so they cannot disagree about it.
//
// Commands are the rows under `Commands:`; a row is one or two words, then at
// least two spaces, then a description. Options are every `-x` or `--long`
// under `Options:`. A blank line ends a section.
export function parseHelp(stdout) {
  const commands = new Set();
  const options = new Set();
  let section = null;
  for (const line of stdout.split('\n')) {
    if (line.trim() === 'Commands:' || line.trim() === 'Options:') section = line.trim();
    else if (line.trim() === '') section = null;
    else if (section === 'Commands:') {
      const row = line.match(/^ {2}([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?) {2,}/);
      if (row) commands.add(row[1]);
    } else if (section === 'Options:') {
      for (const option of line.match(/(?<![\w-])--?[A-Za-z][\w-]*/g) ?? []) options.add(option);
    }
  }
  return { commands, options };
}
