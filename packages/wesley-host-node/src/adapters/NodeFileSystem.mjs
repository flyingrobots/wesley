/**
 * Node.js File System Adapter
 * Implements FileSystem port from wesley-core
 */

import { readFile, writeFile, access, mkdir, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, join as pathJoin } from 'node:path';
import { createReadStream } from 'node:fs';

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

  async resolve(path) {
    return resolve(path);
  }

  async join(...parts) {
    return pathJoin(...parts);
  }

  /**
   * Read directory entries (non-recursive).
   * @param {string} path - Directory path to read.
   * @returns {Promise<Array<{name:string, path:string, isFile:boolean, isDirectory:boolean, isSymbolicLink:boolean}>>}
   */
  async readDir(path) {
    if (!path || typeof path !== 'string') {
      throw new TypeError('readDir(path) requires a non-empty string');
    }
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        path: resolve(path, e.name),
        isFile: e.isFile(),
        isDirectory: e.isDirectory(),
        isSymbolicLink: e.isSymbolicLink?.() || false
      }));
    } catch (err) {
      const e = new Error(`Failed to readDir(${path}): ${err?.message || err}`);
      e.code = err?.code;
      throw e;
    }
  }

  async readFile(path, encoding = 'utf8') {
    return await readFile(path, encoding);
  }

  async readStdin() {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', () => {
        resolve(data);
      });
      process.stdin.on('error', reject);
    });
  }
}
