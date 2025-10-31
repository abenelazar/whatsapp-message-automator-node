import winston from 'winston';
import path from 'path';
import fs from 'fs';

/**
 * Create and configure logger
 * @param {Object} config - Logging configuration
 * @returns {winston.Logger} Configured logger instance
 */
export function createLogger(config) {
  const logDir = path.dirname(config.file);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Custom format for console output
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  );

  // Custom format for file output
  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  // Create transports array
  const transports = [];

  // Add console transport if enabled
  if (config.console) {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat
      })
    );
  }

  // Add file transport
  transports.push(
    new winston.transports.File({
      filename: config.file,
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );

  // Create logger
  const logger = winston.createLogger({
    level: config.level || 'info',
    transports
  });

  return logger;
}

/**
 * Create a child logger with additional context
 * @param {winston.Logger} logger - Parent logger
 * @param {Object} context - Additional context to include in logs
 * @returns {winston.Logger} Child logger
 */
export function createChildLogger(logger, context) {
  return logger.child(context);
}
