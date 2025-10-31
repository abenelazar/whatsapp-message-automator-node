# Electron Desktop App - Quick Guide

## What is it?

A beautiful desktop application that wraps the WhatsApp Automation Tool in an easy-to-use graphical interface. No more editing YAML files or running terminal commands!

## Features

### 🎨 Beautiful Interface
- Modern gradient design
- Intuitive layout
- Responsive controls

### 📁 Easy File Management
- Browse for CSV files visually
- Select message templates with preview
- Choose images with file picker
- See previews of your files before running

### 🧪 Safe Testing
- Dry Run button to test without sending
- See exactly what would be sent
- Verify configuration before going live

### 📊 Live Dashboard
- Real-time statistics
- Messages sent counter
- Unique contacts tracker
- Last updated timestamp

### 📝 Console Output
- Live logging as automation runs
- Color-coded messages (info, success, warning, error)
- Timestamps for each entry
- Scrollable history

### ⚙️ Configuration Manager
- Edit all settings in the UI
- Save configuration button
- Load saved configuration
- No YAML editing required

## How to Use

### 1. Install
```bash
cd electron-app
npm install
```

### 2. Launch
```bash
npm start
```

### 3. Configure
1. Click "Browse" next to **Contacts CSV** and select your contacts file
2. Click "Browse" next to **Message Template** and select your template
3. (Optional) Add an image and caption
4. Adjust rate limit and log level as needed
5. Click "Save Configuration"

### 4. Test
Click **Dry Run** to see what would be sent without actually sending messages.

### 5. Run
When ready, click **Run Automation** to send real messages.

## UI Sections

### Configuration Panel (Left)
- **Contacts CSV File**: Your contacts with phone, name, etc.
- **Message Template File**: Template with {{placeholders}}
- **Image**: Optional image to send
- **Image Caption**: Caption for the image (supports placeholders!)
- **Rate Limit**: Messages per second (default: 1)
- **Log Level**: How detailed the logging should be

### Actions Panel (Top Right)
- **🧪 Dry Run**: Test without sending
- **🚀 Run Automation**: Send real messages (asks for confirmation)
- **⏹️ Stop**: Cancel running automation
- **🗑️ Clear State**: Reset sent messages tracking

### Statistics (Middle Right)
- **Messages Sent**: Total tracked
- **Unique Contacts**: Unique phone numbers
- **Last Updated**: When state was last modified
- **🔄 Refresh**: Update statistics

### Console Output (Bottom Right)
- Live logging of all automation activity
- Color-coded for easy reading
- Clear button to clean up

## Tips & Tricks

### Before Running
1. **Always dry run first** - Test your configuration
2. **Check file previews** - Verify CSV and template look correct
3. **Save configuration** - Don't lose your settings

### While Running
1. **Watch the console** - Monitor progress in real-time
2. **Check statistics** - See how many messages sent
3. **Don't close browser** - Let WhatsApp Web stay open

### After Running
1. **Review console** - Check for any errors
2. **Check statistics** - Verify counts
3. **Clear state if needed** - To resend to same contacts

## Keyboard Shortcuts

- **Cmd/Ctrl + R**: Reload the app
- **Cmd/Ctrl + Q**: Quit
- **Cmd/Ctrl + W**: Close window

## Troubleshooting

### App Won't Start
```bash
# Make sure you're in the electron-app directory
cd electron-app

# Reinstall dependencies
rm -rf node_modules
npm install

# Try again
npm start
```

### Can't Select Files
- Make sure files exist at the specified paths
- Check file permissions
- Try using absolute paths

### Automation Not Running
- Verify main tool is installed (`npm install` in parent directory)
- Check console output for errors
- Make sure WhatsApp Web can load

### Changes Not Saving
- Click "Save Configuration" after making changes
- Configuration is saved to `../config.yaml`

## Architecture

```
Electron App
│
├── Main Process (main.js)
│   ├── Window management
│   ├── File dialogs
│   ├── IPC handlers
│   └── Spawns automation process
│
├── Renderer Process (renderer.js)
│   ├── UI logic
│   ├── Event handlers
│   ├── IPC calls
│   └── DOM manipulation
│
├── UI (index.html + styles.css)
│   └── Beautiful interface
│
└── Automation Process
    └── Runs src/index.js with config
```

## What Happens When You Click Run?

1. **Configuration Saved**: Current UI settings saved to `config.yaml`
2. **Process Spawned**: Node.js process starts running `src/index.js`
3. **Live Logging**: Output streamed to console in real-time
4. **WhatsApp Opens**: Browser window opens with WhatsApp Web
5. **Messages Sent**: Automation runs according to configuration
6. **Statistics Updated**: Stats refresh when complete

## Development Mode

Want to see developer tools?

```bash
npm run dev
```

This opens the app with DevTools for debugging.

## File Locations

- **Config**: `../config.yaml`
- **State**: `../sent_messages.json`
- **Logs**: `../whatsapp-automation.log`
- **Screenshots**: `../screenshots/`
- **Session**: `../whatsapp-session/`

## Next Steps

1. Launch the app: `npm start`
2. Configure your files
3. Run a dry-run to test
4. Send real messages when ready!

Enjoy your WhatsApp automation with a beautiful UI! 🎉
