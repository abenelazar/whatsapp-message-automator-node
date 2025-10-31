# WhatsApp Automation Tool

A comprehensive Node.js tool for automating WhatsApp messaging using Puppeteer. This tool provides enterprise-grade features including CSV contact management, personalized message templates, session persistence, retry logic, duplicate prevention, and more.

## Features

- **CSV Contact Management**: Load contacts from CSV with dynamic fields
- **Message Personalization**: Render personalized message templates with placeholder support
- **WhatsApp Web Automation**: Full browser automation with Puppeteer
- **Session Persistence**: Maintain login sessions across runs
- **Retry Logic**: Exponential backoff for failed operations
- **Duplicate Prevention**: SHA256 hashing to track sent messages and prevent duplicates
- **Rate Limiting**: Configurable message rate (default: 1 message/second)
- **Dry-Run Mode**: Test your configuration without sending actual messages
- **YAML Configuration**: Easy-to-edit configuration file
- **Structured Logging**: Multiple log levels (debug, info, warn, error) with file and console output
- **Image Support**: Send images with optional captions
- **Failure Screenshots**: Automatic screenshot capture on errors
- **Comprehensive Error Handling**: Graceful error handling with detailed logging
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Option 1: Desktop App (Recommended)

1. Install dependencies for both the main tool and Electron app:

```bash
# Install main tool dependencies
npm install

# Install Electron app dependencies
cd electron-app
npm install
cd ..
```

2. Launch the desktop app:

```bash
cd electron-app
npm start
```

### Option 2: Command Line

1. Install dependencies:

```bash
npm install
```

2. Run from command line (see CLI Usage below)

## Prerequisites

- Node.js 18 or higher
- A WhatsApp account with access to WhatsApp Web

## Desktop App

The tool includes a beautiful Electron-based desktop app with a graphical interface!

### Features
- 🎨 Modern, intuitive UI
- 📁 Visual file selection (CSV, templates, images)
- 🧪 One-click dry run testing
- 📊 Real-time statistics dashboard
- 📝 Live console output
- ⚙️ Easy configuration management

### Launch
```bash
cd electron-app
npm start
```

See `electron-app/README.md` for detailed desktop app documentation.

## Quick Start (CLI)

1. **Prepare your contacts CSV file** (`contacts.csv`):

```csv
phone,name,company,position
+1234567890,John Doe,Acme Corp,CEO
+1234567891,Jane Smith,Tech Inc,CTO
```

**Important**: Phone numbers must include country code (e.g., +1 for US, +44 for UK)

2. **Create your message template** (`message_template.txt`):

```
Hello {{name}}!

I hope this message finds you well. I wanted to reach out to you regarding {{company}}.

As the {{position}}, I thought you might be interested in our latest offering.

Best regards
```

3. **Configure settings** (`config.yaml`):

The default configuration is already set up. You can customize:
- Input/output file paths
- Rate limiting
- Retry settings
- Logging level
- And more...

4. **Run in dry-run mode first** (recommended):

```bash
npm run dry-run
```

This will show you what messages would be sent without actually sending them.

5. **Run the tool**:

```bash
npm start
```

The first time you run it, you'll need to scan the QR code with your phone to log into WhatsApp Web.

## Configuration

All configuration is done through `config.yaml`:

```yaml
# Input files
contacts_csv: './contacts.csv'
message_template: './message_template.txt'

# Optional image to send with messages
# image_path: './image.jpg'
# image_caption: 'Check this out!'

# Session persistence
session_dir: './whatsapp-session'

# State tracking to prevent duplicates
state_file: './sent_messages.json'

# Rate limiting (messages per second)
rate_limit: 1

# Retry configuration
retry:
  max_attempts: 3
  initial_delay_ms: 1000
  max_delay_ms: 10000
  backoff_multiplier: 2

# Timeouts (in milliseconds)
timeouts:
  page_load: 60000
  message_send: 30000
  element_wait: 10000

# Logging
logging:
  level: 'info'  # debug, info, warn, error
  file: './whatsapp-automation.log'
  console: true

# Screenshots on failure
screenshots:
  enabled: true
  dir: './screenshots'
```

## CSV Format

The CSV file must have a `phone` column (case-insensitive). You can add any additional columns:

```csv
phone,name,company,position,custom_field
+1234567890,John Doe,Acme Corp,CEO,Value1
+1234567891,Jane Smith,Tech Inc,CTO,Value2
```

**Phone Number Format**:
- Must include country code (e.g., +1, +44, +91)
- Can include spaces, dashes, or parentheses (they will be automatically removed)
- Examples: `+1234567890`, `+1 (234) 567-890`, `+1-234-567-890`

## Message Templates

Message templates support multiple placeholder formats:

- `{{fieldName}}` - Standard format (recommended)
- `{fieldName}` - Simple format
- `${fieldName}` - Template literal style

**Example**:

```
Hello {{name}}!

Your order at {{company}} has been confirmed.
Total: ${{amount}}

Thanks for your business!
```

## Sending Images

To send images with your messages:

1. Uncomment the image settings in `config.yaml`:

```yaml
image_path: './image.jpg'
image_caption: 'Check this out!'
```

2. Place your image file in the project directory
3. Run the tool as usual

The image will be sent before the text message. Caption is optional.

## Duplicate Prevention

The tool uses SHA256 hashing to track sent messages and prevent duplicates:

- Each message + phone number combination is hashed
- Hashes are stored in `sent_messages.json`
- Before sending, the tool checks if the exact message was already sent to that number
- Duplicate messages are automatically skipped

To reset and send messages again, delete `sent_messages.json`.

## Retry Logic

The tool implements exponential backoff for failed operations:

1. First attempt fails → wait 1 second
2. Second attempt fails → wait 2 seconds
3. Third attempt fails → wait 4 seconds
4. Maximum wait time: 10 seconds

Configure in `config.yaml`:

```yaml
retry:
  max_attempts: 3
  initial_delay_ms: 1000
  max_delay_ms: 10000
  backoff_multiplier: 2
```

## Rate Limiting

By default, the tool sends 1 message per second to avoid rate limits. Adjust in `config.yaml`:

```yaml
rate_limit: 1  # messages per second
```

**Recommendations**:
- Keep at 1 message/second for safety
- For large batches, consider even slower rates (0.5 = 1 message every 2 seconds)

## Logging

Logs are written to both console and file:

- **Console**: Colored, human-readable format
- **File**: JSON format for parsing and analysis

**Log Levels**:
- `debug`: Detailed debugging information
- `info`: General information (default)
- `warn`: Warning messages
- `error`: Error messages

Change log level in `config.yaml`:

```yaml
logging:
  level: 'debug'  # Show all logs including debug
```

## Session Persistence

WhatsApp login sessions are saved in the `whatsapp-session/` directory:

- First run: Scan QR code to login
- Subsequent runs: Automatically logged in
- Sessions typically last 2-4 weeks

If you need to login with a different account:
1. Delete the `whatsapp-session/` directory
2. Run the tool again and scan the QR code

## Error Handling

The tool includes comprehensive error handling:

- **Invalid phone numbers**: Logged and skipped
- **Missing CSV fields**: Warnings logged
- **Network errors**: Automatic retry with exponential backoff
- **WhatsApp Web issues**: Screenshots captured for debugging
- **Template errors**: Validation before sending

When errors occur:
1. Error details are logged
2. Screenshot is saved (if enabled)
3. Process continues with next contact

## Dry-Run Mode

Always test your configuration first:

```bash
npm run dry-run
```

or

```bash
node src/index.js --dry-run
```

This will:
- Load and validate all files
- Check CSV format
- Validate template placeholders
- Show what messages would be sent
- NOT actually send any messages

## Troubleshooting

### QR Code Not Appearing

1. Check that headless mode is `false` in `config.yaml`
2. Delete `whatsapp-session/` directory and try again
3. Ensure you have a stable internet connection

### Messages Not Sending

1. Check phone number format (must include country code)
2. Verify WhatsApp Web is still logged in (browser window)
3. Check logs for specific error messages
4. Review screenshots in `screenshots/` directory

### Rate Limit Errors

1. Reduce `rate_limit` in config.yaml (try 0.5)
2. Add delays between batches
3. WhatsApp may temporarily block automated behavior - wait 24 hours

### Template Variables Not Replaced

1. Check CSV column names match template placeholders exactly
2. Column names are case-sensitive
3. Run in dry-run mode to validate

### Memory Issues

For large contact lists (1000+):
1. Process in smaller batches
2. Close and restart browser between batches
3. Increase Node.js memory: `node --max-old-space-size=4096 src/index.js`

## Project Structure

```
whatsapp-node/
├── src/
│   ├── index.js              # Main application
│   ├── csvParser.js          # CSV parsing and validation
│   ├── templateRenderer.js   # Message template rendering
│   ├── logger.js             # Logging configuration
│   ├── stateTracker.js       # Duplicate prevention with SHA256
│   ├── retryLogic.js         # Retry logic and rate limiting
│   └── whatsappAutomation.js # Puppeteer WhatsApp automation
├── config.yaml               # Configuration file
├── contacts.csv              # Your contacts (not in git)
├── message_template.txt      # Your message template (not in git)
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## Best Practices

1. **Always run dry-run first**: Test your configuration before sending
2. **Start small**: Test with 2-3 contacts first
3. **Respect rate limits**: Keep at 1 message/second or slower
4. **Backup your data**: Keep copies of contacts and templates
5. **Monitor logs**: Check logs regularly for errors
6. **Use meaningful templates**: Personalize messages for better engagement
7. **Clean up session data**: Delete old sessions if switching accounts
8. **Handle personal data carefully**: Respect privacy and GDPR compliance

## Security Considerations

- **Session files**: Contain WhatsApp login credentials - keep secure
- **Contact data**: Contains personal information - handle responsibly
- **Logs**: May contain phone numbers - secure appropriately
- **Never commit**: Don't commit contacts.csv, session data, or sent_messages.json to git

## Limitations

- Requires active WhatsApp Web connection
- WhatsApp may rate limit or block automated behavior
- Large images may take longer to send
- Browser must remain open during operation
- Some WhatsApp features may not be supported

## WhatsApp Terms of Service

This tool automates WhatsApp Web. Make sure you:
- Comply with WhatsApp's Terms of Service
- Don't spam or send unsolicited messages
- Respect recipients' privacy
- Use for legitimate business purposes only

**Disclaimer**: This tool is for educational and legitimate business use only. The authors are not responsible for misuse.

## Support

For issues, questions, or contributions:
1. Check the troubleshooting section
2. Review logs for error details
3. Check screenshots for visual debugging

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Changelog

### Version 1.0.0
- Initial release
- CSV contact management
- Message template personalization
- WhatsApp Web automation
- Session persistence
- Retry logic with exponential backoff
- Duplicate prevention with SHA256
- Rate limiting
- Dry-run mode
- Structured logging
- Image support
- Screenshot capture on failures
- Cross-platform support

---

Made with ❤️ for legitimate WhatsApp automation
