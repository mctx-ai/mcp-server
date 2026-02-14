/**
 * Logging Module
 *
 * Provides structured logging with RFC 5424 severity levels.
 * Logs are buffered and sent as MCP notifications by the server.
 *
 * @module log
 */

/**
 * RFC 5424 severity levels (highest to lowest)
 * Used for level comparison and filtering
 */
const LEVELS = {
  emergency: 0, // System is unusable
  alert: 1,     // Action must be taken immediately
  critical: 2,  // Critical conditions
  error: 3,     // Error conditions
  warning: 4,   // Warning conditions
  notice: 5,    // Normal but significant condition
  info: 6,      // Informational messages
  debug: 7,     // Debug-level messages
};

/**
 * Maximum log buffer size (FIFO eviction when exceeded)
 * @private
 */
const MAX_LOG_BUFFER_SIZE = 10000;

/**
 * Log buffer - stores notifications until server flushes them
 * @private
 */
let logBuffer = [];

/**
 * Current minimum log level (messages below this are filtered)
 * @private
 */
let currentLogLevel = 'debug'; // Default: log everything

/**
 * Creates a log notification object
 * @private
 * @param {string} level - Log level
 * @param {*} data - Log data (any JSON-serializable value)
 * @returns {Object} Log notification object
 */
function createLogNotification(level, data) {
  // Check if we should log this level
  if (!shouldLog(level, currentLogLevel)) {
    return; // Don't add to buffer if below minimum level
  }

  const notification = {
    type: 'log',
    level,
    data,
  };

  logBuffer.push(notification);

  // Enforce buffer size limit with FIFO eviction
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  return notification;
}

/**
 * Determines if a message should be logged based on severity levels
 *
 * @param {string} messageLevel - The level of the message being logged
 * @param {string} clientLevel - The minimum level configured by client
 * @returns {boolean} True if message should be logged
 *
 * @example
 * shouldLog('error', 'warning')   // true (error >= warning)
 * shouldLog('debug', 'info')      // false (debug < info)
 * shouldLog('info', 'info')       // true (info >= info)
 */
export function shouldLog(messageLevel, clientLevel) {
  const messageSeverity = LEVELS[messageLevel];
  const clientSeverity = LEVELS[clientLevel];

  // If either level is unknown, default to logging
  if (messageSeverity === undefined || clientSeverity === undefined) {
    return true;
  }

  // Lower numeric value = higher severity
  // Message should be logged if its severity >= client's minimum severity
  return messageSeverity <= clientSeverity;
}

/**
 * Sets the minimum log level
 * Messages below this level will be filtered out
 *
 * @param {string} level - Minimum log level (debug, info, notice, warning, error, critical, alert, emergency)
 *
 * @example
 * setLogLevel('warning');  // Only log warning and above
 * log.debug('test');       // Won't be logged
 * log.error('problem');    // Will be logged
 */
export function setLogLevel(level) {
  if (LEVELS[level] === undefined) {
    throw new Error(
      `Invalid log level: "${level}". Must be one of: ${Object.keys(LEVELS).join(', ')}`
    );
  }
  currentLogLevel = level;
}

/**
 * Gets the current log buffer
 * Server uses this to retrieve buffered notifications
 *
 * @returns {Array<Object>} Array of log notification objects
 */
export function getLogBuffer() {
  return [...logBuffer]; // Return copy to prevent external modification
}

/**
 * Clears the log buffer
 * Server calls this after flushing notifications
 */
export function clearLogBuffer() {
  logBuffer = [];
}

/**
 * Log object with methods for each severity level
 *
 * Each method creates a log notification and adds it to the buffer.
 * The server will flush these as MCP notifications.
 *
 * @example
 * log.debug('Variable value:', { x: 42 });
 * log.info('Server started on port 3000');
 * log.warning('Rate limit approaching');
 * log.error('Database connection failed', error);
 * log.critical('System out of memory');
 */
export const log = {
  /**
   * Debug-level message (lowest severity)
   * Used for detailed debugging information
   */
  debug(data) {
    return createLogNotification('debug', data);
  },

  /**
   * Informational message
   * Used for general informational messages
   */
  info(data) {
    return createLogNotification('info', data);
  },

  /**
   * Notice - normal but significant condition
   * Used for important events that are not errors
   */
  notice(data) {
    return createLogNotification('notice', data);
  },

  /**
   * Warning condition
   * Used for warnings that don't prevent operation
   */
  warning(data) {
    return createLogNotification('warning', data);
  },

  /**
   * Error condition
   * Used for errors that affect functionality
   */
  error(data) {
    return createLogNotification('error', data);
  },

  /**
   * Critical condition
   * Used for critical conditions that require immediate attention
   */
  critical(data) {
    return createLogNotification('critical', data);
  },

  /**
   * Alert - action must be taken immediately
   * Used for conditions requiring immediate operator intervention
   */
  alert(data) {
    return createLogNotification('alert', data);
  },

  /**
   * Emergency - system is unusable
   * Used for system-wide failures
   */
  emergency(data) {
    return createLogNotification('emergency', data);
  },
};
