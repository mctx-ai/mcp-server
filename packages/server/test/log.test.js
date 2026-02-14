/**
 * Log Module Tests
 *
 * Tests structured logging with RFC 5424 severity levels.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { log, shouldLog, getLogBuffer, clearLogBuffer, setLogLevel } from '../src/log.js';

describe('log levels', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug'); // Reset to default
  });

  it('log.debug() creates debug notification', () => {
    log.debug('Debug message');
    const buffer = getLogBuffer();

    expect(buffer).toHaveLength(1);
    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'debug',
      data: 'Debug message',
    });
  });

  it('log.info() creates info notification', () => {
    log.info('Info message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'info',
      data: 'Info message',
    });
  });

  it('log.notice() creates notice notification', () => {
    log.notice('Notice message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'notice',
      data: 'Notice message',
    });
  });

  it('log.warning() creates warning notification', () => {
    log.warning('Warning message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'warning',
      data: 'Warning message',
    });
  });

  it('log.error() creates error notification', () => {
    log.error('Error message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'error',
      data: 'Error message',
    });
  });

  it('log.critical() creates critical notification', () => {
    log.critical('Critical message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'critical',
      data: 'Critical message',
    });
  });

  it('log.alert() creates alert notification', () => {
    log.alert('Alert message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'alert',
      data: 'Alert message',
    });
  });

  it('log.emergency() creates emergency notification', () => {
    log.emergency('Emergency message');
    const buffer = getLogBuffer();

    expect(buffer[0]).toEqual({
      type: 'log',
      level: 'emergency',
      data: 'Emergency message',
    });
  });
});

describe('log data types', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug');
  });

  it('logs string data', () => {
    log.info('String message');
    const buffer = getLogBuffer();

    expect(buffer[0].data).toBe('String message');
  });

  it('logs object data', () => {
    log.info({ key: 'value', count: 42 });
    const buffer = getLogBuffer();

    expect(buffer[0].data).toEqual({ key: 'value', count: 42 });
  });

  it('logs number data', () => {
    log.info(12345);
    const buffer = getLogBuffer();

    expect(buffer[0].data).toBe(12345);
  });

  it('logs boolean data', () => {
    log.info(true);
    const buffer = getLogBuffer();

    expect(buffer[0].data).toBe(true);
  });

  it('logs array data', () => {
    log.info([1, 2, 3]);
    const buffer = getLogBuffer();

    expect(buffer[0].data).toEqual([1, 2, 3]);
  });

  it('logs null data', () => {
    log.info(null);
    const buffer = getLogBuffer();

    expect(buffer[0].data).toBeNull();
  });

  it('logs undefined data', () => {
    log.info(undefined);
    const buffer = getLogBuffer();

    expect(buffer[0].data).toBeUndefined();
  });
});

describe('shouldLog()', () => {
  it('logs message when severity equals client level', () => {
    expect(shouldLog('error', 'error')).toBe(true);
    expect(shouldLog('info', 'info')).toBe(true);
    expect(shouldLog('debug', 'debug')).toBe(true);
  });

  it('logs message when severity higher than client level', () => {
    expect(shouldLog('error', 'warning')).toBe(true);
    expect(shouldLog('error', 'info')).toBe(true);
    expect(shouldLog('critical', 'error')).toBe(true);
  });

  it('does not log message when severity lower than client level', () => {
    expect(shouldLog('debug', 'info')).toBe(false);
    expect(shouldLog('info', 'warning')).toBe(false);
    expect(shouldLog('warning', 'error')).toBe(false);
  });

  it('handles emergency (highest severity)', () => {
    expect(shouldLog('emergency', 'debug')).toBe(true);
    expect(shouldLog('emergency', 'error')).toBe(true);
    expect(shouldLog('emergency', 'emergency')).toBe(true);
  });

  it('handles debug (lowest severity)', () => {
    expect(shouldLog('debug', 'debug')).toBe(true);
    expect(shouldLog('debug', 'info')).toBe(false);
    expect(shouldLog('debug', 'emergency')).toBe(false);
  });

  it('handles unknown levels gracefully', () => {
    expect(shouldLog('unknown', 'info')).toBe(true);
    expect(shouldLog('info', 'unknown')).toBe(true);
  });

  it('respects RFC 5424 severity ordering', () => {
    const levels = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'];

    for (let i = 0; i < levels.length; i++) {
      for (let j = i; j < levels.length; j++) {
        expect(shouldLog(levels[i], levels[j])).toBe(true);
      }
      for (let j = 0; j < i; j++) {
        expect(shouldLog(levels[i], levels[j])).toBe(false);
      }
    }
  });
});

describe('setLogLevel()', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug');
  });

  it('filters messages below minimum level', () => {
    setLogLevel('warning');

    log.debug('Should not appear');
    log.info('Should not appear');
    log.warning('Should appear');
    log.error('Should appear');

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(2);
    expect(buffer[0].level).toBe('warning');
    expect(buffer[1].level).toBe('error');
  });

  it('allows all messages with debug level', () => {
    setLogLevel('debug');

    log.debug('Debug');
    log.info('Info');
    log.error('Error');

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(3);
  });

  it('only allows emergency messages with emergency level', () => {
    setLogLevel('emergency');

    log.debug('No');
    log.error('No');
    log.critical('No');
    log.emergency('Yes');

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].level).toBe('emergency');
  });

  it('throws on invalid log level', () => {
    expect(() => setLogLevel('invalid')).toThrow(/Invalid log level/);
    expect(() => setLogLevel('DEBUG')).toThrow(/Invalid log level/);
    expect(() => setLogLevel('')).toThrow(/Invalid log level/);
  });

  it('accepts all valid RFC 5424 levels', () => {
    const levels = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'];

    for (const level of levels) {
      expect(() => setLogLevel(level)).not.toThrow();
    }
  });
});

describe('getLogBuffer()', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug');
  });

  it('returns empty array when no logs', () => {
    const buffer = getLogBuffer();
    expect(buffer).toEqual([]);
  });

  it('returns all buffered logs', () => {
    log.info('Message 1');
    log.error('Message 2');
    log.debug('Message 3');

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(3);
  });

  it('returns copy of buffer (not reference)', () => {
    log.info('Original');

    const buffer1 = getLogBuffer();
    buffer1.push({ type: 'log', level: 'info', data: 'Modified' });

    const buffer2 = getLogBuffer();
    expect(buffer2).toHaveLength(1);
    expect(buffer2[0].data).toBe('Original');
  });

  it('preserves log order (FIFO)', () => {
    log.info('First');
    log.info('Second');
    log.info('Third');

    const buffer = getLogBuffer();
    expect(buffer[0].data).toBe('First');
    expect(buffer[1].data).toBe('Second');
    expect(buffer[2].data).toBe('Third');
  });
});

describe('clearLogBuffer()', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug');
  });

  it('empties the buffer', () => {
    log.info('Message 1');
    log.info('Message 2');

    clearLogBuffer();

    const buffer = getLogBuffer();
    expect(buffer).toEqual([]);
  });

  it('allows new logs after clearing', () => {
    log.info('Old message');
    clearLogBuffer();

    log.info('New message');

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].data).toBe('New message');
  });

  it('can be called multiple times', () => {
    clearLogBuffer();
    clearLogBuffer();

    const buffer = getLogBuffer();
    expect(buffer).toEqual([]);
  });
});

describe('log buffer capacity', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug');
  });

  it('enforces 10000 entry limit with FIFO eviction', () => {
    // Add 10001 entries
    for (let i = 0; i < 10001; i++) {
      log.info(`Message ${i}`);
    }

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(10000);

    // First message should be evicted
    expect(buffer[0].data).toBe('Message 1');
    expect(buffer[9999].data).toBe('Message 10000');
  });

  it('handles exactly 10000 entries', () => {
    for (let i = 0; i < 10000; i++) {
      log.info(`Message ${i}`);
    }

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(10000);
    expect(buffer[0].data).toBe('Message 0');
    expect(buffer[9999].data).toBe('Message 9999');
  });

  it('does not evict when under limit', () => {
    for (let i = 0; i < 100; i++) {
      log.info(`Message ${i}`);
    }

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(100);
    expect(buffer[0].data).toBe('Message 0');
  });
});

describe('log integration', () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogLevel('debug');
  });

  it('handles multiple log calls in sequence', () => {
    log.debug({ step: 1 });
    log.info({ step: 2 });
    log.warning({ step: 3 });
    log.error({ step: 4 });

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(4);
    expect(buffer.map(l => l.data.step)).toEqual([1, 2, 3, 4]);
  });

  it('respects log level filtering across multiple calls', () => {
    setLogLevel('warning');

    log.debug('No');
    log.info('No');
    log.notice('No');
    log.warning('Yes 1');
    log.error('Yes 2');
    log.critical('Yes 3');

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(3);
    expect(buffer.map(l => l.data)).toEqual(['Yes 1', 'Yes 2', 'Yes 3']);
  });

  it('buffers logs during handler execution', () => {
    function handler() {
      log.info('Handler started');
      log.debug('Processing...');
      log.info('Handler completed');
    }

    handler();

    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(3);
  });

  it('can be flushed and cleared after each request', () => {
    log.info('Request 1');
    let buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);

    clearLogBuffer();

    log.info('Request 2');
    buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].data).toBe('Request 2');
  });
});
