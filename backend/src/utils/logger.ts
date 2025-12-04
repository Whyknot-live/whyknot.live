/**
 * Logger Utility
 * 
 * Environment-aware structured logging with support for:
 * - Debug logs (only in development or when LOG_LEVEL=debug)
 * - Info logs (always in development, in production when LOG_LEVEL >= info)
 * - Warn logs (always enabled)
 * - Error logs (always enabled)
 * 
 * Log levels: debug < info < warn < error
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
    [key: string]: unknown
}

interface LoggerOptions {
    service?: string
    context?: LogContext
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
}

function getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
        return envLevel
    }
    // Default: debug in development, info in production
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

function shouldLog(level: LogLevel): boolean {
    const currentLevel = getLogLevel()
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatTimestamp(): string {
    return new Date().toISOString()
}

function formatMessage(
    level: LogLevel,
    service: string,
    message: string,
    context?: LogContext
): string {
    const timestamp = formatTimestamp()
    const contextStr = context && Object.keys(context).length > 0
        ? ` ${JSON.stringify(context)}`
        : ''

    // In production, use JSON format for easier parsing
    if (process.env.NODE_ENV === 'production') {
        return JSON.stringify({
            timestamp,
            level,
            service,
            message,
            ...context
        })
    }

    // In development, use human-readable format with colors
    const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m'  // Red
    }
    const reset = '\x1b[0m'
    const dim = '\x1b[2m'

    return `${dim}${timestamp}${reset} ${levelColors[level]}[${level.toUpperCase()}]${reset} ${dim}[${service}]${reset} ${message}${contextStr}`
}

class Logger {
    private service: string
    private defaultContext: LogContext

    constructor(options: LoggerOptions = {}) {
        this.service = options.service || 'backend'
        this.defaultContext = options.context || {}
    }

    private log(level: LogLevel, message: string, context?: LogContext): void {
        if (!shouldLog(level)) {
            return
        }

        const mergedContext = { ...this.defaultContext, ...context }
        const formattedMessage = formatMessage(level, this.service, message, mergedContext)

        switch (level) {
            case 'debug':
            case 'info':
                console.log(formattedMessage)
                break
            case 'warn':
                console.warn(formattedMessage)
                break
            case 'error':
                console.error(formattedMessage)
                break
        }
    }

    /**
     * Debug level logging - only shown in development or when LOG_LEVEL=debug
     * Use for detailed debugging information
     */
    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context)
    }

    /**
     * Info level logging - shown in development and production (when LOG_LEVEL >= info)
     * Use for general operational messages
     */
    info(message: string, context?: LogContext): void {
        this.log('info', message, context)
    }

    /**
     * Warn level logging - always shown
     * Use for potentially harmful situations
     */
    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context)
    }

    /**
     * Error level logging - always shown
     * Use for error events that might still allow the app to continue
     */
    error(message: string, context?: LogContext): void {
        this.log('error', message, context)
    }

    /**
     * Create a child logger with additional context
     */
    child(options: LoggerOptions): Logger {
        return new Logger({
            service: options.service || this.service,
            context: { ...this.defaultContext, ...options.context }
        })
    }
}

// Default logger instance
const defaultLogger = new Logger({ service: 'backend' })

// Create service-specific loggers
export const logger = defaultLogger
export const dbLogger = new Logger({ service: 'mongodb' })
export const redisLogger = new Logger({ service: 'redis' })
export const emailLogger = new Logger({ service: 'email' })
export const authLogger = new Logger({ service: 'auth' })
export const apiLogger = new Logger({ service: 'api' })
export const securityLogger = new Logger({ service: 'security' })
export const healthLogger = new Logger({ service: 'health' })

/**
 * Create a custom logger for a specific service
 */
export function createLogger(service: string, context?: LogContext): Logger {
    return new Logger({ service, context })
}

/**
 * Request logging middleware helper
 * Returns timing information for request logging
 */
export function createRequestTimer(): { getDuration: () => number } {
    const start = Date.now()
    return {
        getDuration: () => Date.now() - start
    }
}

export default logger
