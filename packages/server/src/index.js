/**
 * @mctx-ai/mcp-server
 *
 * Build MCP servers with an Express-like API - no protocol knowledge required.
 *
 * Main package entry point that exports core functionality.
 */

// Core server factory
export { createServer } from './server.js';

// Type system for tool/prompt inputs
export { T, buildInputSchema } from './types.js';

// Advanced features
export { conversation } from './conversation.js';
export { createProgress } from './progress.js';
export { log } from './log.js';

// Security functions
export {
  sanitizeError,
  validateRequestSize,
  validateResponseSize,
  validateStringInput,
  validateUriScheme,
  canonicalizePath,
  sanitizeInput,
} from './security.js';
