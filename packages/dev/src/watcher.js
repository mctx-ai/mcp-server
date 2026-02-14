/**
 * @mctx-ai/mcp-dev File Watcher
 *
 * Watches entry file and its directory for changes and triggers hot reload.
 * Uses Node's built-in fs.watch with debouncing to avoid rapid reloads.
 *
 * LIMITATION (Fix #7): Currently only watches the entry file's directory.
 * Changes to imported dependencies or files in parent/child directories
 * will NOT trigger a reload. For full dependency watching, consider using
 * a more sophisticated tool like chokidar or manually watching src/, lib/
 * directories if they exist.
 */

import { watch as fsWatch } from 'fs';
import { dirname, basename } from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};

/**
 * Format timestamp for logs
 */
function timestamp() {
  return new Date().toISOString().split('T')[1].split('.')[0];
}

/**
 * Log with timestamp
 */
function log(message) {
  console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${message}`);
}

/**
 * Watch file and directory for changes
 *
 * @param {string} filePath - Absolute path to file to watch
 * @param {Function} onChange - Callback when file changes
 *
 * Note: Only watches the entry file's directory. Changes to imported
 * dependencies or other directories will NOT trigger reload.
 */
export function watch(filePath, onChange) {
  const dir = dirname(filePath);
  const filename = basename(filePath);

  let debounceTimer = null;
  const DEBOUNCE_MS = 100;

  // Watch the directory (more reliable than watching individual files)
  // Fix #7: This only watches the entry file's directory, not dependencies
  const watcher = fsWatch(dir, { recursive: false }, (eventType, changedFile) => {
    // Filter for changes to our target file
    if (changedFile !== filename) {
      return;
    }

    // Debounce rapid changes (editors often write multiple times)
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      log(`${colors.green}Reloaded:${colors.reset} ${colors.dim}${filename}${colors.reset}`);
      onChange();
    }, DEBOUNCE_MS);
  });

  // Handle watcher errors
  watcher.on('error', (error) => {
    console.error(`Watcher error: ${error.message}`);
  });

  // Clean up on process exit
  process.on('exit', () => {
    watcher.close();
  });

  return watcher;
}
