# WhatsApp Automation - Electron UI

A beautiful desktop application for the WhatsApp Automation Tool.

## Features

- 🎨 **Modern UI**: Clean, intuitive interface with gradient design
- 📁 **File Browser**: Easy file selection for CSV, templates, and images
- 🧪 **Dry Run Mode**: Test your configuration without sending messages
- 📊 **Live Stats**: Real-time statistics on sent messages
- 📝 **Console Output**: Live logging of automation progress
- ⚙️ **Configuration Manager**: Save and load settings easily

## Installation

```bash
cd electron-app
npm install
```

## Usage

Start the Electron app:

```bash
npm start
```

Or run in development mode with DevTools:

```bash
npm run dev
```

## How to Use

1. **Configure Files**:
   - Select your contacts CSV file
   - Select your message template
   - (Optional) Select an image and add a caption

2. **Adjust Settings**:
   - Set rate limit (messages per second)
   - Choose log level
   - Save configuration

3. **Run**:
   - Click **Dry Run** to test without sending
   - Click **Run Automation** to send real messages
   - Monitor progress in the console

4. **Manage State**:
   - View statistics on sent messages
   - Clear state to reset tracking

## UI Overview

### Configuration Section
- **Contacts CSV**: Path to your CSV file with contact information
- **Message Template**: Path to your message template with placeholders
- **Image**: Optional image to send with messages
- **Image Caption**: Caption for the image (supports placeholders)
- **Rate Limit**: How many messages per second to send
- **Log Level**: Verbosity of logging (debug, info, warn, error)

### Actions Section
- **Dry Run**: Test the automation without sending messages
- **Run Automation**: Execute the automation and send real messages
- **Stop**: Cancel a running automation process
- **Clear State**: Reset the sent messages tracking

### Statistics
- **Messages Sent**: Total number of messages tracked
- **Unique Contacts**: Number of unique phone numbers messaged
- **Last Updated**: When the state was last modified

### Console Output
- Real-time logging of automation progress
- Color-coded messages (info, success, warning, error)
- Timestamps for each log entry

## Tips

- Always run a **Dry Run** first to verify your configuration
- The app automatically saves configuration when you run automation
- Use the file previews to verify CSV and template content
- Monitor the console for detailed progress and errors
- Clear state if you want to resend messages to the same contacts

## Keyboard Shortcuts

- `Cmd/Ctrl + R`: Reload the app
- `Cmd/Ctrl + Q`: Quit the app

## Troubleshooting

**App won't start:**
- Make sure you've run `npm install` in the electron-app directory
- Check that Node.js is installed

**Can't select files:**
- Make sure file paths are valid
- Check file permissions

**Automation not running:**
- Verify the main automation tool is installed (`npm install` in parent directory)
- Check console output for error messages

## Development

The app uses:
- **Electron**: Desktop app framework
- **Node.js IPC**: Communication between UI and automation
- **Vanilla JS**: No frameworks for simplicity
- **CSS Grid**: Modern layout system

## File Structure

```
electron-app/
├── src/
│   ├── main.js       # Electron main process
│   ├── renderer.js   # UI logic
│   ├── index.html    # App interface
│   └── styles.css    # Styling
├── package.json
└── README.md
```
