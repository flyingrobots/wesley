/**
 * AutomaticallyRegisteredProgram - Factory pattern for Commander.js programs
 * 
 * Subclasses automatically register themselves with Commander by virtue of being declared.
 * This eliminates the need for a large wesley.mjs registration file.
 */

const registeredPrograms = new Map();
const aliasMap = new Map(); // Maps alias -> program name

export class AutomaticallyRegisteredProgram {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.aliases = [];
    
    // Auto-register this program
    if (!registeredPrograms.has(name)) {
      registeredPrograms.set(name, this);
    }
  }

  // Subclasses must implement this to configure Commander options
  configureCommander(cmd) {
    return cmd;
  }

  // Subclasses must implement this to define execution logic
  async execute() {
    throw new Error(`Program '${this.name}' must implement execute()`);
  }

  // Factory method to create Commander command
  createCommand(commander) {
    const cmd = commander
      .command(this.name)
      .description(this.description);

    // Let subclass configure commander options (which may add aliases)
    const configuredCmd = this.configureCommander(cmd);

    // Extract aliases from the configured command and register them
    if (configuredCmd._aliases && configuredCmd._aliases.length > 0) {
      this.aliases = configuredCmd._aliases;
      // Register aliases in our map
      this.aliases.forEach(alias => {
        aliasMap.set(alias, this.name);
      });
    }

    // Set up action handler
    configuredCmd.action(async (options) => {
      try {
        await this.execute(options);
      } catch (error) {
        console.error(`💥 ${this.name} failed:`, error.message);
        process.exit(1);
      }
    });

    return configuredCmd;
  }

  // Static method to get all registered programs
  static getAllPrograms() {
    return Array.from(registeredPrograms.values());
  }

  // Static method to find a program by name or alias
  static findProgram(nameOrAlias) {
    // First try direct name lookup
    const program = registeredPrograms.get(nameOrAlias);
    if (program) return program;

    // Then try alias lookup
    const actualName = aliasMap.get(nameOrAlias);
    if (actualName) return registeredPrograms.get(actualName);

    return null;
  }

  // Static method to register all programs with Commander
  static registerAll(commander) {
    const programs = AutomaticallyRegisteredProgram.getAllPrograms();
    programs.forEach(program => {
      program.createCommand(commander);
    });
    return commander;
  }

  // Static method to clear registry (for testing)
  static clearRegistry() {
    registeredPrograms.clear();
  }
}

export default AutomaticallyRegisteredProgram;