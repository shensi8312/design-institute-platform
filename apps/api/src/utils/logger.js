/**
 * Logger Utility
 * Simple logging utility for the application
 */

const winston = require('winston');

// Create a simple console logger if winston is not available
class SimpleLogger {
    info(...args) {
        console.log('[INFO]', new Date().toISOString(), ...args);
    }
    
    error(...args) {
        console.error('[ERROR]', new Date().toISOString(), ...args);
    }
    
    warn(...args) {
        console.warn('[WARN]', new Date().toISOString(), ...args);
    }
    
    debug(...args) {
        if (process.env.NODE_ENV === 'development') {
            console.log('[DEBUG]', new Date().toISOString(), ...args);
        }
    }
}

// Try to use winston if available, otherwise use simple logger
let logger;

try {
    // Try to create winston logger
    logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json()
        ),
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            })
        ]
    });
} catch (error) {
    // Fallback to simple logger
    logger = new SimpleLogger();
}

module.exports = logger;