/**
 * Wesley CLI Program
 * PURE command routing - NO generator imports!
 * Everything through dependency injection
 */

import { GeneratePipelineCommand } from './commands/generate.mjs';

export async function program(argv, ctx) {
  const command = argv[0];
  const args = argv.slice(1);
  
  // Command routing without any imports
  const commands = {
    'generate': () => new GeneratePipelineCommand(ctx),
    '--version': () => ({
      run: async () => {
        console.log('Wesley CLI v0.1.0');
        return 0;
      }
    }),
    '-v': () => ({
      run: async () => {
        console.log('Wesley CLI v0.1.0');
        return 0;
      }
    }),
    '--help': () => ({
      run: async () => {
        console.log('Wesley - GraphQL → Everything');
        console.log('');
        console.log('Commands:');
        console.log('  generate <schema>  Generate SQL, tests, and more from GraphQL');
        console.log('');
        console.log('Options:');
        console.log('  --version, -v     Show version');
        console.log('  --help            Show this help');
        return 0;
      }
    })
  };
  
  // Default to help if no command
  const cmdFactory = commands[command] || commands['--help'];
  const cmd = cmdFactory();
  
  try {
    return await cmd.run(args);
  } catch (error) {
    if (ctx.logger) {
      ctx.logger.error(error);
    } else {
      console.error(error);
    }
    return 1;
  }
}