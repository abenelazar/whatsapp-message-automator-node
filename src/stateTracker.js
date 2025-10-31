import fs from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

/**
 * State tracker for managing sent messages and preventing duplicates
 */
export class StateTracker {
  constructor(stateFilePath, logger) {
    this.stateFilePath = stateFilePath;
    this.logger = logger;
    this.state = {
      sentMessages: {},
      lastUpdated: null
    };
  }

  /**
   * Generate SHA256 hash for a message
   * @param {string} phone - Phone number
   * @param {string} message - Message content
   * @returns {string} SHA256 hash
   */
  generateHash(phone, message) {
    const content = `${phone}:${message}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Load state from file
   */
  async load() {
    try {
      // Check if file exists
      try {
        await fs.access(this.stateFilePath);
      } catch {
        // File doesn't exist, create directory if needed
        const dir = path.dirname(this.stateFilePath);
        await fs.mkdir(dir, { recursive: true });
        await this.save();
        this.logger.info('Created new state file');
        return;
      }

      // Load existing state
      const data = await fs.readFile(this.stateFilePath, 'utf-8');
      this.state = JSON.parse(data);
      this.logger.info(`Loaded state with ${Object.keys(this.state.sentMessages).length} tracked messages`);
    } catch (error) {
      this.logger.error(`Failed to load state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save state to file
   */
  async save() {
    try {
      this.state.lastUpdated = new Date().toISOString();
      const dir = path.dirname(this.stateFilePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.stateFilePath,
        JSON.stringify(this.state, null, 2),
        'utf-8'
      );
      this.logger.debug('State saved successfully');
    } catch (error) {
      this.logger.error(`Failed to save state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if message was already sent
   * @param {string} phone - Phone number
   * @param {string} message - Message content
   * @returns {boolean} True if already sent
   */
  wasMessageSent(phone, message) {
    const hash = this.generateHash(phone, message);
    return hash in this.state.sentMessages;
  }

  /**
   * Get message info if it was sent
   * @param {string} phone - Phone number
   * @param {string} message - Message content
   * @returns {Object|null} Message info or null
   */
  getMessageInfo(phone, message) {
    const hash = this.generateHash(phone, message);
    return this.state.sentMessages[hash] || null;
  }

  /**
   * Mark message as sent
   * @param {string} phone - Phone number
   * @param {string} message - Message content
   * @param {Object} metadata - Additional metadata
   */
  async markAsSent(phone, message, metadata = {}) {
    const hash = this.generateHash(phone, message);
    this.state.sentMessages[hash] = {
      phone,
      messageHash: hash,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    await this.save();
    this.logger.debug(`Marked message as sent for ${phone}`);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const messages = Object.values(this.state.sentMessages);
    const uniquePhones = new Set(messages.map(m => m.phone));

    return {
      totalMessages: messages.length,
      uniqueContacts: uniquePhones.size,
      lastUpdated: this.state.lastUpdated
    };
  }

  /**
   * Clear old entries (older than specified days)
   * @param {number} days - Number of days to keep
   */
  async cleanup(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const originalCount = Object.keys(this.state.sentMessages).length;
    const newSentMessages = {};

    Object.entries(this.state.sentMessages).forEach(([hash, data]) => {
      const messageDate = new Date(data.timestamp);
      if (messageDate >= cutoffDate) {
        newSentMessages[hash] = data;
      }
    });

    this.state.sentMessages = newSentMessages;
    const removedCount = originalCount - Object.keys(newSentMessages).length;

    if (removedCount > 0) {
      await this.save();
      this.logger.info(`Cleaned up ${removedCount} old entries`);
    }

    return removedCount;
  }
}
