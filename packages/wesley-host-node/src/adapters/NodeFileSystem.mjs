/**
 * Node.js File System Adapter
 * Implements FileSystem port from wesley-core
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';

export class NodeFileSystem {
  async read(path) {
    return await readFile(path, 'utf8');
  }

  async write(path, content) {
    // Ensure directory exists
    const dir = dirname(path);
    await this.mkdir(dir, { recursive: true });
    
    await writeFile(path, content, 'utf8');
  }

  async exists(path) {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path, options = {}) {
    await mkdir(path, options);
  }
}