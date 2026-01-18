import log from 'loglevel';

/**
 * Configure log level from environment variable.
 *
 * Levels (from most to least verbose): trace, debug, info, warn, error, silent
 *
 * Set via VITE_LOG_LEVEL environment variable.
 * Defaults to 'debug' in development, 'warn' in production.
 *
 * @example
 * VITE_LOG_LEVEL=debug npm run dev  // Show all logs
 * VITE_LOG_LEVEL=warn npm run dev   // Only warnings and errors
 * VITE_LOG_LEVEL=silent npm run dev // No logs
 */
const level = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.DEV ? 'debug' : 'warn');
log.setLevel(level as log.LogLevelDesc);

/**
 * Logger interface for module-specific loggers
 */
export interface Logger {
    trace: (msg: string, ...args: unknown[]) => void;
    debug: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Creates a logger with a module name prefix.
 *
 * @param module - Name of the module (e.g., 'useEdgeManagement', 'Datatable')
 * @returns A logger instance
 *
 * @example
 * const log = createLogger('useEdgeManagement');
 * log.debug('Processing cell', { cell });
 * log.warn('No formula found');
 * log.error('Failed to parse', error);
 */
export function createLogger(module: string): Logger {
    const childLog = log.getLogger(module);
    childLog.setLevel(log.getLevel());

    return {
        trace: (msg: string, ...args: unknown[]) => childLog.trace(`[${module}] ${msg}`, ...args),
        debug: (msg: string, ...args: unknown[]) => childLog.debug(`[${module}] ${msg}`, ...args),
        info: (msg: string, ...args: unknown[]) => childLog.info(`[${module}] ${msg}`, ...args),
        warn: (msg: string, ...args: unknown[]) => childLog.warn(`[${module}] ${msg}`, ...args),
        error: (msg: string, ...args: unknown[]) => childLog.error(`[${module}] ${msg}`, ...args),
    };
}

/**
 * Root logger instance
 */
export const logger = log;
