/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} config - Retry configuration
 * @param {winston.Logger} logger - Logger instance
 * @returns {Promise<any>} Result of the function
 */
export async function retryWithBackoff(fn, config, logger) {
  const {
    max_attempts = 3,
    initial_delay_ms = 1000,
    max_delay_ms = 10000,
    backoff_multiplier = 2
  } = config;

  let lastError;
  let delay = initial_delay_ms;

  for (let attempt = 1; attempt <= max_attempts; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${max_attempts}`);
      const result = await fn();

      if (attempt > 1) {
        logger.info(`Operation succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < max_attempts) {
        logger.warn(
          `Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`
        );

        await sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * backoff_multiplier, max_delay_ms);
      } else {
        logger.error(
          `All ${max_attempts} attempts failed. Last error: ${error.message}`
        );
      }
    }
  }

  // If we get here, all attempts failed
  throw new Error(
    `Operation failed after ${max_attempts} attempts. Last error: ${lastError.message}`
  );
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  constructor(messagesPerSecond, logger) {
    this.messagesPerSecond = messagesPerSecond;
    this.minDelayMs = 1000 / messagesPerSecond;
    this.lastMessageTime = 0;
    this.logger = logger;
  }

  /**
   * Wait if necessary to maintain rate limit
   */
  async wait() {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;

    if (timeSinceLastMessage < this.minDelayMs) {
      const delayNeeded = this.minDelayMs - timeSinceLastMessage;
      this.logger.debug(`Rate limiting: waiting ${delayNeeded}ms`);
      await sleep(delayNeeded);
    }

    this.lastMessageTime = Date.now();
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.lastMessageTime = 0;
  }
}
