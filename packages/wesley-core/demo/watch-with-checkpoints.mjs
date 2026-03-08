/**
 * Demo: Watch GraphQL files and create checkpoints on changes
 *
 * This demonstrates how WatchCommand and CheckpointManager work together
 * to provide file monitoring with state recovery capabilities.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { CheckpointManager } from '../src/domain/checkpoint/CheckpointManager.mjs';
import { WatchCommand } from '../src/cli/WatchCommand.mjs';

const demoDir = '.wesley-demo';
const schemaFile = join(demoDir, 'schema.graphql');

async function createDemoFiles() {
  await fs.mkdir(demoDir, { recursive: true });

  const initialSchema = `type User {
  id: ID!
  name: String!
  email: String!
}

type Query {
  users: [User!]!
  user(id: ID!): User
}`;

  await fs.writeFile(schemaFile, initialSchema, 'utf8');
  console.log('📝 Created demo schema file');
}

async function demo() {
  console.log('🚀 Starting Watch + Checkpoint Demo\n');

  // Create demo files
  await createDemoFiles();

  // Initialize checkpoint manager
  const checkpointManager = new CheckpointManager('.wesley/checkpoints');

  // Create initial checkpoint
  const initialState = {
    schema: await fs.readFile(schemaFile, 'utf8'),
    lastModified: new Date().toISOString(),
    fileCount: 1
  };

  const initialCheckpointId = await checkpointManager.store(
    'initial-state',
    initialState,
    { reason: 'demo-startup' }
  );

  console.log(`💾 Created initial checkpoint: ${initialCheckpointId}`);

  let changeCount = 0;

  // Set up file watcher
  const watcher = new WatchCommand({
    patterns: ['*.graphql'],
    cwd: demoDir,
    debounceMs: 500,
    clearConsole: false, // Keep demo output visible
    onchange: async (eventType, filePath) => {
      changeCount++;

      try {
        console.log(`\n🔄 Change detected: ${eventType} - ${filePath}`);

        // Read current state
        const currentSchema = await fs.readFile(schemaFile, 'utf8');
        const currentState = {
          schema: currentSchema,
          lastModified: new Date().toISOString(),
          fileCount: 1,
          changeNumber: changeCount
        };

        // Create checkpoint
        const checkpointId = await checkpointManager.store(
          `change-${changeCount}`,
          currentState,
          {
            reason: `file-${eventType}`,
            filePath,
            previousCheckpoint: initialCheckpointId
          }
        );

        console.log(`💾 Created checkpoint: ${checkpointId}`);

        // List recent checkpoints
        const recent = await checkpointManager.list();
        console.log(`📋 Total checkpoints: ${recent.length}`);

        if (changeCount >= 3) {
          console.log('\n🎯 Demo complete! Stopping watcher...');
          await watcher.stop();
          await demonstrateRecovery();
        }

      } catch (error) {
        console.error('Error handling change:', error);
      }
    }
  });

  // Start watching
  await watcher.start();

  console.log('\n👀 Watching for changes...');
  console.log('💡 Try editing the schema file to see checkpoints created!');
  console.log('📂 Schema file:', schemaFile);

  // Simulate some changes after a delay
  setTimeout(async () => {
    console.log('\n🤖 Simulating schema changes...');

    const change1 = `type User {
  id: ID!
  name: String!
  email: String!
  createdAt: DateTime!
}

type Query {
  users: [User!]!
  user(id: ID!): User
}`;

    await fs.writeFile(schemaFile, change1, 'utf8');

    setTimeout(async () => {
      const change2 = `type User {
  id: ID!
  name: String!
  email: String!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  author: User!
}

type Query {
  users: [User!]!
  user(id: ID!): User
  posts: [Post!]!
}`;

      await fs.writeFile(schemaFile, change2, 'utf8');

      setTimeout(async () => {
        const change3 = change2 + '\n\n# Added comment for final change';
        await fs.writeFile(schemaFile, change3, 'utf8');
      }, 1000);

    }, 1000);

  }, 2000);
}

async function demonstrateRecovery() {
  console.log('\n🔄 Demonstrating checkpoint recovery...');

  const checkpointManager = new CheckpointManager('.wesley/checkpoints');
  const checkpoints = await checkpointManager.list();

  console.log('\n📋 Available checkpoints:');
  checkpoints.forEach((cp, index) => {
    console.log(`  ${index + 1}. ${cp.name} (${cp.timestamp}) - ${cp.metadata.reason}`);
  });

  // Recover from the second checkpoint
  if (checkpoints.length >= 2) {
    const secondCheckpoint = await checkpointManager.load(checkpoints[1].id);

    console.log('\n🔮 Recovering from second checkpoint...');
    console.log('📄 Schema at that point:');
    console.log('---');
    console.log(secondCheckpoint.state.schema.split('\n').slice(0, 5).join('\n'));
    console.log('...');
    console.log('---');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up demo files...');
  await fs.rm(demoDir, { recursive: true, force: true });
  console.log('✨ Demo completed successfully!');
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received interrupt signal, cleaning up...');
  try {
    await fs.rm(demoDir, { recursive: true, force: true });
  } catch (_error) {
    // Ignore cleanup errors
  }
  process.exit(0);
});

// Run the demo
demo().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
