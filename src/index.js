#!/usr/bin/env node

import YAML from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { parseContactsCSV, validateContacts, getAvailableFields } from './csvParser.js';
import { loadTemplate, renderTemplate, validateTemplate, extractPlaceholders } from './templateRenderer.js';
import { createLogger } from './logger.js';
import { StateTracker } from './stateTracker.js';
import { retryWithBackoff, RateLimiter } from './retryLogic.js';
import { WhatsAppAutomation } from './whatsappAutomation.js';

/**
 * Main application class
 */
class WhatsAppAutomationApp {
  constructor() {
    this.config = null;
    this.logger = null;
    this.stateTracker = null;
    this.rateLimiter = null;
    this.whatsapp = null;
    this.dryRun = false;
  }

  /**
   * Load configuration from YAML file
   */
  async loadConfig(configPath = './config.yaml') {
    try {
      const configFile = await fs.readFile(configPath, 'utf-8');
      this.config = YAML.parse(configFile);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Initialize all components
   */
  async initialize(configPath = './config.yaml') {
    // Load configuration
    await this.loadConfig(configPath);

    // Initialize logger
    this.logger = createLogger(this.config.logging);
    this.logger.info('=== WhatsApp Automation Tool Started ===');

    // Check for dry-run mode
    if (process.argv.includes('--dry-run')) {
      this.dryRun = true;
      this.logger.warn('DRY RUN MODE - No messages will be sent');
    }

    // Initialize state tracker
    this.stateTracker = new StateTracker(this.config.state_file, this.logger);
    await this.stateTracker.load();

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.config.rate_limit, this.logger);

    // Initialize WhatsApp automation (only if not dry run)
    if (!this.dryRun) {
      this.whatsapp = new WhatsAppAutomation(this.config, this.logger);
    }

    this.logger.info('Initialization complete');
  }

  /**
   * Process contacts and send messages
   */
  async run() {
    try {
      // Load and parse CSV
      this.logger.info(`Loading contacts from ${this.config.contacts_csv}`);
      const contacts = await parseContactsCSV(this.config.contacts_csv);
      this.logger.info(`Loaded ${contacts.length} contacts`);

      // Validate contacts
      const { valid, invalid } = validateContacts(contacts);

      if (invalid.length > 0) {
        this.logger.warn(`Found ${invalid.length} invalid contacts:`);
        invalid.forEach(({ index, reason }) => {
          this.logger.warn(`  Row ${index}: ${reason}`);
        });
      }

      if (valid.length === 0) {
        this.logger.error('No valid contacts found');
        return;
      }

      this.logger.info(`Processing ${valid.length} valid contacts`);

      // Load message template (optional if only sending images)
      let template = '';
      if (this.config.message_template && this.config.message_template.trim() !== '') {
        this.logger.info(`Loading message template from ${this.config.message_template}`);
        template = await loadTemplate(this.config.message_template);
      } else {
        this.logger.info('No message template specified (image-only mode)');
        template = '';
      }

      // Validate template
      const availableFields = getAvailableFields(valid);
      const templateValidation = validateTemplate(template, availableFields);

      if (!templateValidation.valid) {
        this.logger.warn(
          `Template contains placeholders not found in CSV: ${templateValidation.missingFields.join(', ')}`
        );
      }

      this.logger.info(`Template placeholders: ${templateValidation.placeholders.join(', ')}`);

      // Initialize WhatsApp (if not dry run)
      if (!this.dryRun) {
        await this.whatsapp.initialize();
      }

      // Process each contact
      const stats = {
        total: valid.length,
        sent: 0,
        skipped: 0,
        failed: 0
      };

      for (let i = 0; i < valid.length; i++) {
        const contact = valid[i];
        const progress = `[${i + 1}/${valid.length}]`;

        this.logger.info(`${progress} Processing contact: ${contact.phone}`);

        try {
          // Render message for this contact
          const message = renderTemplate(template, contact);

          // Check if already sent
          if (this.stateTracker.wasMessageSent(contact.phone, message)) {
            const info = this.stateTracker.getMessageInfo(contact.phone, message);
            this.logger.info(
              `${progress} Skipping ${contact.phone} - already sent on ${info.timestamp}`
            );
            stats.skipped++;
            continue;
          }

          // Dry run mode - just log what would be sent
          if (this.dryRun) {
            this.logger.info(`${progress} [DRY RUN] Would send to ${contact.phone}:`);
            this.logger.info(`Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
            if (this.config.image_path) {
              this.logger.info(`Image: ${this.config.image_path}`);
              if (this.config.image_caption) {
                this.logger.info(`Caption: ${this.config.image_caption}`);
              }
            }
            stats.sent++;
            continue;
          }

          // Apply rate limiting
          await this.rateLimiter.wait();

          // Render caption if provided
          const renderedCaption = this.config.image_caption
            ? renderTemplate(this.config.image_caption, contact)
            : null;

          // Send message with retry logic
          await retryWithBackoff(
            async () => {
              await this.whatsapp.sendMessage(
                contact.phone,
                message,
                this.config.image_path || null,
                renderedCaption
              );
            },
            this.config.retry,
            this.logger
          );

          // Mark as sent
          await this.stateTracker.markAsSent(contact.phone, message, {
            contact: contact
          });

          stats.sent++;
          this.logger.info(`${progress} Successfully sent to ${contact.phone}`);

        } catch (error) {
          stats.failed++;
          this.logger.error(
            `${progress} Failed to send to ${contact.phone}: ${error.message}`
          );

          // Take screenshot on failure
          if (this.whatsapp && !this.dryRun) {
            await this.whatsapp.takeScreenshot(`error_${contact.phone}`);
          }

          // Continue with next contact
          continue;
        }
      }

      // Print summary
      this.logger.info('=== Summary ===');
      this.logger.info(`Total contacts: ${stats.total}`);
      this.logger.info(`Messages sent: ${stats.sent}`);
      this.logger.info(`Skipped (duplicates): ${stats.skipped}`);
      this.logger.info(`Failed: ${stats.failed}`);

      // Print state tracker stats
      const stateStats = this.stateTracker.getStats();
      this.logger.info(`\n=== State Tracker Stats ===`);
      this.logger.info(`Total tracked messages: ${stateStats.totalMessages}`);
      this.logger.info(`Unique contacts: ${stateStats.uniqueContacts}`);

    } catch (error) {
      this.logger.error(`Application error: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down...');

    if (this.whatsapp && this.whatsapp.isRunning()) {
      await this.whatsapp.close();
    }

    this.logger.info('=== WhatsApp Automation Tool Stopped ===');
  }
}

/**
 * Main entry point
 */
async function main() {
  const app = new WhatsAppAutomationApp();

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\n\nReceived SIGINT, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });

  try {
    // Initialize and run
    await app.initialize();
    await app.run();

    // Shutdown
    await app.shutdown();

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error.message);

    if (app.logger) {
      app.logger.error(`Fatal error: ${error.message}`);
      app.logger.error(error.stack);
    }

    await app.shutdown();
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { WhatsAppAutomationApp };
