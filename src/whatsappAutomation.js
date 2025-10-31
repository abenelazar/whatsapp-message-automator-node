import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { retryWithBackoff, sleep } from './retryLogic.js';

/**
 * WhatsApp Web automation class
 */
export class WhatsAppAutomation {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser and WhatsApp Web
   */
  async initialize() {
    this.logger.info('Initializing browser...');

    // Ensure session directory exists
    await fs.mkdir(this.config.session_dir, { recursive: true });

    // Launch browser
    const launchOptions = {
      headless: this.config.puppeteer.headless,
      args: this.config.puppeteer.args,
      userDataDir: this.config.session_dir
    };

    // Use Electron's Chromium if running from Electron app
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      this.logger.info(`Using Chromium from: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    }

    this.browser = await puppeteer.launch(launchOptions);

    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({ width: 1280, height: 800 });

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Navigate to WhatsApp Web
    this.logger.info('Navigating to WhatsApp Web...');
    await this.page.goto('https://web.whatsapp.com', {
      waitUntil: 'networkidle2',
      timeout: this.config.timeouts.page_load
    });

    // Wait for WhatsApp to load
    await this.waitForWhatsAppReady();

    this.logger.info('WhatsApp Web is ready');
  }

  /**
   * Wait for WhatsApp to be ready (logged in)
   */
  async waitForWhatsAppReady() {
    this.logger.info('Waiting for WhatsApp to be ready...');

    try {
      // Wait for either QR code or main interface
      await Promise.race([
        // Wait for QR code (not logged in)
        this.page.waitForSelector('canvas[aria-label="Scan this QR code to link a device!"]', {
          timeout: 10000
        }).then(() => {
          this.logger.warn('QR code detected. Please scan the QR code to login.');
        }),
        // Wait for main chat interface (already logged in)
        this.page.waitForSelector('div[aria-label="Chat list"]', {
          timeout: 10000
        }).then(() => {
          this.logger.info('Already logged in');
          return;
        })
      ]);

      // If QR code was shown, wait for login
      const qrExists = await this.page.$('canvas[aria-label="Scan this QR code to link a device!"]');
      if (qrExists) {
        this.logger.info('Waiting for QR code scan...');
        await this.page.waitForSelector('div[aria-label="Chat list"]', {
          timeout: this.config.timeouts.page_load
        });
        this.logger.info('Successfully logged in');
      }

      // Additional wait to ensure everything is loaded
      await sleep(3000);

    } catch (error) {
      throw new Error(`Failed to load WhatsApp Web: ${error.message}`);
    }
  }

  /**
   * Send message to a contact
   * @param {string} phone - Phone number (with country code)
   * @param {string} message - Message to send
   * @param {string|null} imagePath - Optional image path
   * @param {string|null} imageCaption - Optional image caption
   */
  async sendMessage(phone, message, imagePath = null, imageCaption = null) {
    this.logger.info(`Sending message to ${phone}`);

    // Navigate to chat with phone number
    const chatUrl = `https://web.whatsapp.com/send?phone=${phone}`;
    await this.page.goto(chatUrl, {
      waitUntil: 'networkidle2',
      timeout: this.config.timeouts.page_load
    });

    // Wait for chat to load properly
    this.logger.debug('Waiting for chat interface to load...');
    await sleep(5000);

    // Clear any draft messages in the text box to avoid confusion
    try {
      const messageBoxSelector = 'div[contenteditable="true"][data-tab="10"]';
      const messageBox = await this.page.$(messageBoxSelector);
      if (messageBox) {
        await messageBox.click();
        await sleep(300);
        // Select all and delete
        await this.page.keyboard.down('Meta'); // Command on Mac
        await this.page.keyboard.press('A');
        await this.page.keyboard.up('Meta');
        await this.page.keyboard.press('Backspace');
        await sleep(300);
        this.logger.debug('Cleared any draft messages');
      }
    } catch (error) {
      this.logger.debug(`Could not clear draft: ${error.message}`);
    }

    // Check if phone number is invalid
    const invalidNumber = await this.page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Phone number shared via url is invalid');
    });

    if (invalidNumber) {
      throw new Error(`Invalid phone number: ${phone}`);
    }

    // Check if message has content (not empty or only whitespace)
    const hasTextMessage = message && message.trim().length > 0;

    // If image is provided, send it with caption
    if (imagePath) {
      // Type caption FIRST in the message box, then attach image
      // This makes WhatsApp convert the typed text into image caption
      await this.sendImageWithCaption(imagePath, imageCaption);

      // If no text message, we're done after sending the image
      if (!hasTextMessage) {
        this.logger.debug('Image sent, no text message to send (empty template)');
        return;
      }
    }

    // Only proceed with text message if there's content
    if (hasTextMessage) {
      // Wait for message input box
      const messageBoxSelector = 'div[contenteditable="true"][data-tab="10"]';
      await this.page.waitForSelector(messageBoxSelector, {
        timeout: this.config.timeouts.element_wait
      });

      // Type and send message
      await this.page.click(messageBoxSelector);
      await sleep(500);

      // Type message line by line (to preserve line breaks)
      const lines = message.split('\n');
      for (let i = 0; i < lines.length; i++) {
        await this.page.type(messageBoxSelector, lines[i], { delay: 10 });
        if (i < lines.length - 1) {
          await this.page.keyboard.down('Shift');
          await this.page.keyboard.press('Enter');
          await this.page.keyboard.up('Shift');
        }
      }

      await sleep(500);

      // Send message (press Enter)
      await this.page.keyboard.press('Enter');

      // Wait for message to be sent
      await sleep(2000);

      // Verify message was sent
      const messageSent = await this.verifyMessageSent();

      if (!messageSent) {
        throw new Error('Message may not have been sent properly');
      }
    }

    this.logger.info(`Message sent successfully to ${phone}`);
  }

  /**
   * Send image with optional caption
   * NEW APPROACH: Type caption first, then attach image (WhatsApp auto-converts to caption)
   * @param {string} imagePath - Path to image file
   * @param {string|null} caption - Optional caption
   */
  async sendImageWithCaption(imagePath, caption = null) {
    this.logger.debug(`Sending image: ${imagePath}`);

    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const absolutePath = path.resolve(imagePath);

    // STEP 1: Type caption in message box FIRST (if provided)
    if (caption && caption.trim().length > 0) {
      this.logger.debug(`Typing caption before attaching image: ${caption}`);

      const messageBoxSelector = 'div[contenteditable="true"][data-tab="10"]';
      await this.page.waitForSelector(messageBoxSelector, { timeout: 5000 });
      const messageBox = await this.page.$(messageBoxSelector);

      if (messageBox) {
        await messageBox.click();
        await sleep(300);

        // Type caption line by line, using Shift+Enter for line breaks
        // This prevents sending multiple messages
        const lines = caption.split('\n');
        for (let i = 0; i < lines.length; i++) {
          await this.page.keyboard.type(lines[i], { delay: 10 });

          // Add line break with Shift+Enter (not just Enter which would send)
          if (i < lines.length - 1) {
            await this.page.keyboard.down('Shift');
            await this.page.keyboard.press('Enter');
            await this.page.keyboard.up('Shift');
          }
        }

        await sleep(500);
        this.logger.debug('Caption typed in message box with line breaks');

        // Take screenshot after typing
        await this.takeScreenshot('caption_typed_first', true);
      }
    }

    // STEP 2: Attach the image (caption should auto-transfer)
    // Click attach button to reveal file input
    const attachSelector = 'div[aria-label="Attach"], span[data-icon="plus"], span[data-icon="clip"]';
    try {
      const attachBtn = await this.page.$(attachSelector);
      if (attachBtn) {
        await attachBtn.click();
        await sleep(500);
        this.logger.debug('Clicked attach button');
      }
    } catch (err) {
      this.logger.debug(`Could not click attach button: ${err.message}`);
    }

    // Find the file input
    const photoSelector = 'input[accept="image/*,video/mp4,video/3gpp,video/quicktime"]';
    await this.page.waitForSelector(photoSelector, { timeout: 5000 });

    // Upload to the FIRST file input only
    const input = await this.page.$(photoSelector);
    await input.uploadFile(absolutePath);
    this.logger.debug(`Image uploaded`);

    // Wait for image preview modal to appear
    await sleep(3000);

    // Take screenshot of preview with caption
    await this.takeScreenshot('image_preview_with_caption', true);

    // STEP 3: Send immediately
    const sendButtonSelectors = [
      'span[data-icon="send"]',
      'button[aria-label="Send"]',
      'div[aria-label="Send"]'
    ];

    let sendButton = null;
    for (const selector of sendButtonSelectors) {
      sendButton = await this.page.$(selector);
      if (sendButton) {
        this.logger.debug(`Found send button with selector: ${selector}`);
        break;
      }
    }

    if (sendButton) {
      // Take screenshot before sending
      await this.takeScreenshot('before_send', true);

      await sendButton.click();
      this.logger.debug('Clicked send button');
    } else {
      throw new Error('Could not find send button');
    }

    // Wait for image to be sent
    await sleep(3000);

    // Take screenshot after sending
    await this.takeScreenshot('after_send', true);

    this.logger.info('Image with caption sent successfully');
  }

  /**
   * Verify message was sent successfully
   * @returns {boolean} True if message was sent
   */
  async verifyMessageSent() {
    try {
      // Look for checkmarks (single or double) indicating message was sent
      const sent = await this.page.evaluate(() => {
        const checkmarks = document.querySelectorAll('span[data-icon="msg-check"], span[data-icon="msg-dblcheck"]');
        return checkmarks.length > 0;
      });

      return sent;
    } catch {
      return false;
    }
  }

  /**
   * Take screenshot for debugging
   * @param {string} filename - Screenshot filename
   * @param {boolean} force - Force screenshot even if disabled in config
   */
  async takeScreenshot(filename, force = false) {
    if (!force && !this.config.screenshots.enabled) {
      return;
    }

    try {
      // Ensure screenshot directory exists
      await fs.mkdir(this.config.screenshots.dir, { recursive: true });

      const filepath = path.join(
        this.config.screenshots.dir,
        `${filename}_${Date.now()}.png`
      );

      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });

      this.logger.info(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      this.logger.error(`Failed to take screenshot: ${error.message}`);
      return null;
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Browser closed');
    }
  }

  /**
   * Check if browser is still running
   * @returns {boolean}
   */
  isRunning() {
    return this.browser && this.browser.isConnected();
  }
}
