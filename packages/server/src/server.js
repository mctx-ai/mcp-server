/**
 * Core MCP Server Implementation
 *
 * Provides createServer() factory that returns a Cloudflare Worker-compatible
 * app with tool/resource/prompt registration and JSON-RPC 2.0 routing.
 */

import { buildInputSchema } from './types.js';
import { matchUri, isTemplate } from './uri.js';
import { conversation } from './conversation.js';
import { createProgress, PROGRESS_DEFAULTS } from './progress.js';
import { createAsk } from './sampling.js';
import { generateCompletions } from './completion.js';
import { log, getLogBuffer, clearLogBuffer, setLogLevel } from './log.js';

/**
 * Safe JSON serialization handling circular refs, BigInt, Date
 * @param {*} value - Value to serialize
 * @returns {string} JSON string
 */
function safeSerialize(value) {
  const seen = new WeakSet();

  return JSON.stringify(value, (key, val) => {
    // Handle null/undefined
    if (val === undefined) return null;
    if (val === null) return null;

    // Handle primitives
    if (typeof val !== 'object') {
      if (typeof val === 'bigint') return val.toString();
      return val;
    }

    // Handle Date
    if (val instanceof Date) {
      return val.toISOString();
    }

    // Handle circular references
    if (seen.has(val)) {
      return '[Circular]';
    }
    seen.add(val);

    return val;
  });
}

/**
 * Sanitize error messages for production
 * Removes stack traces and redacts sensitive patterns
 * @param {Error} error - Error object
 * @returns {string} Sanitized message
 */
function sanitizeError(error) {
  let message = error.message || 'Unknown error';

  // Redact AWS keys
  message = message.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]');

  // Redact JWT tokens
  message = message.replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');

  // Redact connection strings
  message = message.replace(/(?:mongodb|postgres|mysql):\/\/[^\s]+/g, '[REDACTED_CONNECTION_STRING]');

  // Redact API keys (common patterns)
  message = message.replace(/[a-zA-Z0-9_-]{32,}/g, (match) => {
    // Only redact if it looks like a key (alphanumeric, long enough)
    if (/^[a-zA-Z0-9_-]+$/.test(match) && match.length >= 32) {
      return '[REDACTED_API_KEY]';
    }
    return match;
  });

  return message;
}

/**
 * Parse pagination cursor
 * @param {string|undefined} cursor - Base64 encoded offset
 * @returns {number} Offset number
 */
function parseCursor(cursor) {
  if (!cursor) return 0;

  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const offset = parseInt(decoded, 10);
    return isNaN(offset) ? 0 : offset;
  } catch {
    return 0;
  }
}

/**
 * Create pagination cursor
 * @param {number} offset - Offset number
 * @returns {string} Base64 encoded cursor
 */
function createCursor(offset) {
  return Buffer.from(String(offset), 'utf-8').toString('base64');
}

/**
 * Paginate items array
 * @param {Array} items - Items to paginate
 * @param {string|undefined} cursor - Pagination cursor
 * @param {number} pageSize - Items per page (default 50)
 * @returns {{items: Array, nextCursor?: string}} Paginated result
 */
function paginate(items, cursor, pageSize = 50) {
  const offset = parseCursor(cursor);
  const paginatedItems = items.slice(offset, offset + pageSize);

  const result = { items: paginatedItems };

  // Add nextCursor if more items exist
  if (offset + pageSize < items.length) {
    result.nextCursor = createCursor(offset + pageSize);
  }

  return result;
}


/**
 * Create MCP server instance
 * @returns {Object} Server app with registration methods and fetch handler
 */
export function createServer() {
  // Internal registries
  const tools = new Map();
  const resources = new Map();
  const prompts = new Map();

  // Client capabilities (set during initialization, not implemented yet)
  // NOTE: In HTTP/stateless mode, sampling requires bidirectional communication
  // which isn't available. This would work in WebSocket/SSE transport.
  const clientCapabilities = { sampling: false };

  /**
   * Register a tool
   * @param {string} name - Tool name
   * @param {Function} handler - Tool handler function
   * @returns {Object} App instance (for chaining)
   */
  function tool(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Tool handler for "${name}" must be a function`);
    }

    tools.set(name, handler);
    return app;
  }

  /**
   * Register a resource
   * @param {string} uri - Resource URI (may contain {param} templates)
   * @param {Function} handler - Resource handler function
   * @returns {Object} App instance (for chaining)
   */
  function resource(uri, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Resource handler for "${uri}" must be a function`);
    }

    resources.set(uri, handler);
    return app;
  }

  /**
   * Register a prompt
   * @param {string} name - Prompt name
   * @param {Function} handler - Prompt handler function
   * @returns {Object} App instance (for chaining)
   */
  function prompt(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Prompt handler for "${name}" must be a function`);
    }

    prompts.set(name, handler);
    return app;
  }

  /**
   * Handle tools/list request
   * @param {Object} params - Request params
   * @returns {Object} List of tools with pagination
   */
  function handleToolsList(params = {}) {
    const toolsList = Array.from(tools.entries()).map(([name, handler]) => {
      const tool = {
        name,
        description: handler.description || '',
        inputSchema: buildInputSchema(handler.input),
      };

      return tool;
    });

    const { items, nextCursor } = paginate(toolsList, params.cursor);

    const result = { tools: items };
    if (nextCursor) result.nextCursor = nextCursor;

    return result;
  }

  /**
   * Handle tools/call request
   * @param {Object} params - Request params
   * @param {Object} [meta] - Request metadata (_meta field)
   * @returns {Promise<Object>} Tool result
   */
  async function handleToolsCall(params, meta = {}) {
    const { name, arguments: args } = params;

    if (!name) {
      throw new Error('Tool name is required');
    }

    const handler = tools.get(name);
    if (!handler) {
      throw new Error(`Tool "${name}" not found`);
    }

    // Validate arguments exist
    if (args === undefined || args === null) {
      throw new Error('Tool arguments are required');
    }

    try {
      // Create ask function for sampling support
      // NOTE: In stateless HTTP mode, sendRequest callback isn't available.
      // Sampling requires bidirectional communication (WebSocket/SSE).
      // For now, ask is null in HTTP mode.
      const ask = null; // TODO: Enable when streaming transport is added

      // Check if handler is a generator function
      const isGenerator = handler.constructor.name === 'GeneratorFunction' ||
                         handler.constructor.name === 'AsyncGeneratorFunction';

      if (isGenerator) {
        // Execute generator with progress tracking
        return await executeGeneratorHandler(handler, args, ask, meta);
      }

      // Execute regular handler (support both sync and async)
      // Pass ask as second argument
      const result = await handler(args, ask);

      // Wrap result based on type
      if (typeof result === 'string') {
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      // For objects/arrays, serialize safely
      const serialized = safeSerialize(result);
      return {
        content: [{ type: 'text', text: serialized }],
      };

    } catch (error) {
      // Return error as content with isError flag
      const sanitized = sanitizeError(error);
      return {
        content: [{ type: 'text', text: sanitized }],
        isError: true,
      };
    }
  }

  /**
   * Execute generator-based handler with progress tracking
   * @private
   * @param {GeneratorFunction} handler - Generator handler
   * @param {Object} args - Tool arguments
   * @param {Function|null} ask - Ask function (or null if not supported)
   * @param {Object} meta - Request metadata
   * @returns {Promise<Object>} Tool result
   */
  async function executeGeneratorHandler(handler, args, ask, meta) {
    const progressToken = meta.progressToken;
    const startTime = Date.now();
    let yieldCount = 0;

    // NOTE: In HTTP mode, progress notifications are collected but can't be sent
    // until the request completes. In a streaming transport (WebSocket/SSE),
    // these would be sent immediately as notifications.
    const progressNotifications = [];

    try {
      // Execute generator
      const generator = handler(args, ask);
      let lastResult;

      for await (const value of generator) {
        yieldCount++;

        // Enforce max yields guardrail
        if (yieldCount > PROGRESS_DEFAULTS.maxYields) {
          throw new Error(
            `Generator exceeded maximum yields (${PROGRESS_DEFAULTS.maxYields})`
          );
        }

        // Enforce max execution time guardrail
        const elapsed = Date.now() - startTime;
        if (elapsed > PROGRESS_DEFAULTS.maxExecutionTime) {
          throw new Error(
            `Generator exceeded maximum execution time (${PROGRESS_DEFAULTS.maxExecutionTime}ms)`
          );
        }

        // Check if yielded value is a progress notification
        if (value && typeof value === 'object' && value.type === 'progress') {
          // Store progress notification
          // In streaming mode, would send via progressToken
          if (progressToken) {
            progressNotifications.push({
              progressToken,
              ...value,
            });
          }
        } else {
          // Non-progress yield - store as last result
          lastResult = value;
        }
      }

      // Return final result from generator's return value
      // Generator's return value is the actual result
      if (typeof lastResult === 'string') {
        return {
          content: [{ type: 'text', text: lastResult }],
        };
      }

      const serialized = safeSerialize(lastResult);
      return {
        content: [{ type: 'text', text: serialized }],
      };

    } catch (error) {
      const sanitized = sanitizeError(error);
      return {
        content: [{ type: 'text', text: sanitized }],
        isError: true,
      };
    }
  }

  /**
   * Handle resources/list request
   * @param {Object} params - Request params
   * @returns {Object} List of static resources with pagination
   */
  function handleResourcesList(params = {}) {
    // Only return static resources (not templates)
    const resourcesList = Array.from(resources.entries())
      .filter(([uri]) => !isTemplate(uri))
      .map(([uri, handler]) => ({
        uri,
        name: handler.name || uri,
        description: handler.description || '',
        mimeType: handler.mimeType || 'text/plain',
      }));

    const { items, nextCursor } = paginate(resourcesList, params.cursor);

    const result = { resources: items };
    if (nextCursor) result.nextCursor = nextCursor;

    return result;
  }

  /**
   * Handle resources/templates/list request
   * @param {Object} params - Request params
   * @returns {Object} List of resource templates with pagination
   */
  function handleResourceTemplatesList(params = {}) {
    // Only return template resources (containing {param})
    const templatesList = Array.from(resources.entries())
      .filter(([uri]) => isTemplate(uri))
      .map(([uriTemplate, handler]) => ({
        uriTemplate,
        name: handler.name || uriTemplate,
        description: handler.description || '',
        mimeType: handler.mimeType || 'text/plain',
      }));

    const { items, nextCursor } = paginate(templatesList, params.cursor);

    const result = { resourceTemplates: items };
    if (nextCursor) result.nextCursor = nextCursor;

    return result;
  }

  /**
   * Handle resources/read request
   * @param {Object} params - Request params
   * @returns {Promise<Object>} Resource content
   */
  async function handleResourcesRead(params) {
    const { uri } = params;

    if (!uri) {
      throw new Error('Resource URI is required');
    }

    // Find matching resource (try exact match first, then templates)
    let handler = null;
    let extractedParams = {};

    // Try exact match first
    if (resources.has(uri)) {
      handler = resources.get(uri);
    } else {
      // Try template matching using uri.js module
      for (const [registeredUri, h] of resources.entries()) {
        const match = matchUri(registeredUri, uri);
        if (match) {
          handler = h;
          extractedParams = match.params || {};
          break;
        }
      }
    }

    if (!handler) {
      throw new Error(`Resource "${uri}" not found`);
    }

    try {
      // Create ask function (null in HTTP mode)
      const ask = null;

      // Execute handler with extracted params and ask
      const result = await handler(extractedParams, ask);

      // Wrap result as resource content
      const mimeType = handler.mimeType || 'text/plain';

      if (typeof result === 'string') {
        return {
          contents: [{
            uri,
            mimeType,
            text: result,
          }],
        };
      }

      // For binary data (Buffer, Uint8Array)
      if (result instanceof Buffer || result instanceof Uint8Array) {
        const base64 = Buffer.from(result).toString('base64');
        return {
          contents: [{
            uri,
            mimeType,
            blob: base64,
          }],
        };
      }

      // For objects, serialize as JSON
      const serialized = safeSerialize(result);
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: serialized,
        }],
      };

    } catch (error) {
      throw new Error(`Failed to read resource "${uri}": ${sanitizeError(error)}`);
    }
  }

  /**
   * Handle prompts/list request
   * @param {Object} params - Request params
   * @returns {Object} List of prompts with pagination
   */
  function handlePromptsList(params = {}) {
    const promptsList = Array.from(prompts.entries()).map(([name, handler]) => {
      // Build arguments schema from handler.input
      const argumentsList = handler.input
        ? Object.entries(handler.input).map(([argName, schema]) => ({
            name: argName,
            description: schema.description || '',
            required: schema._required === true,
          }))
        : [];

      return {
        name,
        description: handler.description || '',
        arguments: argumentsList,
      };
    });

    const { items, nextCursor } = paginate(promptsList, params.cursor);

    const result = { prompts: items };
    if (nextCursor) result.nextCursor = nextCursor;

    return result;
  }

  /**
   * Handle prompts/get request
   * @param {Object} params - Request params
   * @returns {Promise<Object>} Prompt messages
   */
  async function handlePromptsGet(params) {
    const { name, arguments: args } = params;

    if (!name) {
      throw new Error('Prompt name is required');
    }

    const handler = prompts.get(name);
    if (!handler) {
      throw new Error(`Prompt "${name}" not found`);
    }

    try {
      // Create ask function (null in HTTP mode)
      const ask = null;

      // Execute handler with ask
      const result = await handler(args || {}, ask);

      // If handler returns a string, wrap as user message
      if (typeof result === 'string') {
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: result,
            },
          }],
        };
      }

      // If handler returns messages array, wrap it
      if (Array.isArray(result)) {
        return { messages: result };
      }

      // If handler returns object with messages (from conversation()), pass through
      if (result && result.messages) {
        return result;
      }

      // Otherwise serialize and wrap as user message
      const serialized = safeSerialize(result);
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: serialized,
          },
        }],
      };

    } catch (error) {
      throw new Error(`Failed to get prompt "${name}": ${sanitizeError(error)}`);
    }
  }

  /**
   * Handle completion/complete request
   * @param {Object} params - Request params
   * @returns {Object} Completion suggestions
   */
  function handleCompletionComplete(params) {
    const { ref, argument } = params;

    if (!ref || !ref.type) {
      return {
        completion: {
          values: [],
          hasMore: false,
        },
      };
    }

    // Determine which registry to use based on ref type
    let registeredItems;
    if (ref.type === 'ref/prompt-argument') {
      // Convert prompts Map to object for generateCompletions
      registeredItems = Object.fromEntries(prompts);
    } else if (ref.type === 'ref/resource') {
      // Convert resources Map to object for generateCompletions
      registeredItems = Object.fromEntries(resources);
    } else {
      return {
        completion: {
          values: [],
          hasMore: false,
        },
      };
    }

    return generateCompletions(registeredItems, ref, argument?.value);
  }

  /**
   * Handle logging/setLevel request
   * @param {Object} params - Request params
   * @returns {Object} Empty success result
   */
  function handleLoggingSetLevel(params) {
    const { level } = params;

    if (!level) {
      throw new Error('Log level is required');
    }

    setLogLevel(level);

    return {}; // Success
  }

  /**
   * Route JSON-RPC request to appropriate handler
   * @param {Object} request - JSON-RPC request
   * @returns {Promise<Object>} Response result
   */
  async function route(request) {
    const { method, params, _meta } = request;

    switch (method) {
      case 'tools/list':
        return handleToolsList(params);

      case 'tools/call':
        return await handleToolsCall(params, _meta);

      case 'resources/list':
        return handleResourcesList(params);

      case 'resources/read':
        return await handleResourcesRead(params);

      case 'resources/templates/list':
        return handleResourceTemplatesList(params);

      case 'prompts/list':
        return handlePromptsList(params);

      case 'prompts/get':
        return await handlePromptsGet(params);

      case 'notifications/cancelled':
        // Silent acknowledgment - no response for notifications
        return null;

      case 'completion/complete':
        return handleCompletionComplete(params);

      case 'logging/setLevel':
        return handleLoggingSetLevel(params);

      default:
        throw { code: -32601, message: 'Method not found' };
    }
  }

  /**
   * Cloudflare Worker fetch handler
   * @param {Request} request - HTTP request
   * @param {Object} env - Environment variables
   * @param {Object} ctx - Execution context
   * @returns {Promise<Response>} HTTP response
   */
  async function fetch(request, env, ctx) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request - Only POST method is supported',
          },
          id: null,
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let rpcRequest;

    try {
      // Parse JSON body
      rpcRequest = await request.json();
    } catch (error) {
      // Parse error
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error - Invalid JSON',
          },
          id: null,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate JSON-RPC structure
    if (!rpcRequest.method || typeof rpcRequest.method !== 'string') {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request - Missing or invalid method',
          },
          id: rpcRequest.id || null,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      // Route request
      const result = await route(rpcRequest);

      // Flush log buffer
      // NOTE: In HTTP mode, logs are buffered but can't be sent as notifications
      // mid-request. In a streaming transport (WebSocket/SSE), these would be
      // sent as notifications/message events during handler execution.
      const bufferedLogs = getLogBuffer();
      clearLogBuffer();

      // TODO: When streaming transport is added, send bufferedLogs as notifications
      // For now, just clear them since we can't send them in stateless HTTP mode

      // For notifications (no id), return 204 No Content
      if (rpcRequest.id === undefined || rpcRequest.id === null) {
        return new Response(null, { status: 204 });
      }

      // Return JSON-RPC success response
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: rpcRequest.id,
          result,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      // Check if error is JSON-RPC error (has code and message)
      const isJsonRpcError = error && typeof error === 'object' && 'code' in error;

      const rpcError = isJsonRpcError
        ? error
        : {
            code: -32603,
            message: sanitizeError(error instanceof Error ? error : new Error(String(error))),
          };

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: rpcRequest.id || null,
          error: rpcError,
        }),
        {
          status: 200, // JSON-RPC errors use 200 status with error object
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Create app object
  const app = {
    tool,
    resource,
    prompt,
    fetch,
  };

  return app;
}
