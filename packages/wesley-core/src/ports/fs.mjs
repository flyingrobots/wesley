// wesley-core/src/ports/fs.js
export class FileSystemPort {
  /**
   * Check if file exists
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async exists(_path) {
    throw new Error('FileSystemPort.exists() must be implemented');
  }

  /**
   * Read file contents
   * @param {string} path
   * @returns {Promise<string>}
   */
  async read(_path) {
    throw new Error('FileSystemPort.read() must be implemented');
  }

  /**
   * Write file contents
   * @param {string} path
   * @param {string} content
   * @returns {Promise<void>}
   */
  async write(_path, _content) {
    throw new Error('FileSystemPort.write() must be implemented');
  }
}
