# Building WhatsApp Automation for Windows

This guide will help you create a Windows executable (.exe) installer for non-technical users.

## Prerequisites

- Node.js 18+ installed
- Git (if cloning from repository)

## Building on macOS/Linux (Cross-platform build)

You can build a Windows executable even from macOS or Linux:

### 1. Install Dependencies

```bash
cd electron-app
npm install
```

### 2. Build Windows Installer

```bash
npm run build:win
```

This will create a Windows installer in `electron-app/dist/`.

**Note**: Building Windows executables from macOS requires Wine. If you don't have Wine installed, electron-builder will automatically download it the first time (this takes a few minutes).

## Building on Windows

If you're building on a Windows machine:

### 1. Install Dependencies

```bash
cd electron-app
npm install
```

### 2. Build Windows Installer

```bash
npm run build:win
```

This creates an NSIS installer (.exe) in `electron-app/dist/` folder.

## Build Outputs

After building, you'll find in `electron-app/dist/`:

- **`WhatsApp Automation Setup X.X.X.exe`** - The installer for Windows
  - **This is the file to distribute to non-technical users**
  - Double-click to install
  - Creates desktop and Start Menu shortcuts
  - Users can choose installation directory

## Installation for End Users

1. Download `WhatsApp Automation Setup X.X.X.exe`
2. Double-click the installer
3. Follow the installation wizard
4. Choose installation directory (optional)
5. Click Install
6. Launch from desktop shortcut or Start Menu

## What Gets Packaged

The installer includes:
- Complete Electron app (UI)
- All Node.js automation scripts
- All dependencies (Puppeteer, YAML parser, etc.)
- Default config.yaml and sample files
- Everything needed to run standalone

## First-Time Use for End Users

After installation:

1. Launch "WhatsApp Automation" from desktop/Start Menu
2. Configure CSV file path (browse to your contacts)
3. Configure message template (browse to your template file)
4. Optionally add an image and caption
5. Click "Dry Run" to test
6. Click "Run Automation" to send real messages

The app creates these files in the installation directory:
- `sent_messages.json` - Tracks sent messages
- `whatsapp-session/` - Stores WhatsApp login session
- `screenshots/` - Debug screenshots (if enabled)
- `whatsapp-automation.log` - Log file

## Other Build Options

### Build for macOS
```bash
npm run build:mac
```
Creates a `.dmg` installer for macOS.

### Build for Linux
```bash
npm run build:linux
```
Creates an AppImage for Linux.

### Build for All Platforms
```bash
npm run build
```
Builds for the current platform.

## Customization

### Change App Name or Version

Edit `electron-app/package.json`:
```json
{
  "name": "whatsapp-automation-electron",
  "version": "1.0.0",
  "build": {
    "productName": "WhatsApp Automation"
  }
}
```

### Add App Icon

1. Create icons:
   - `icon.ico` (Windows) - 256x256 px
   - `icon.icns` (macOS)
   - `icon.png` (Linux) - 512x512 px

2. Place in `electron-app/` directory

3. Update `package.json`:
```json
{
  "build": {
    "win": {
      "icon": "icon.ico"
    },
    "mac": {
      "icon": "icon.icns"
    },
    "linux": {
      "icon": "icon.png"
    }
  }
}
```

## Troubleshooting

### Build fails with "Wine not found"
On macOS building for Windows:
```bash
brew install --cask wine-stable
```

### Build is very slow first time
- electron-builder downloads dependencies (Electron binaries, Wine on macOS)
- Subsequent builds are much faster

### "Cannot find module" errors
Make sure all dependencies are installed:
```bash
cd electron-app
npm install
cd ..
npm install
```

### Windows installer won't run
- Make sure you built with `npm run build:win`
- Check that you're distributing the `.exe` from `dist/` folder
- Some antivirus may flag unsigned executables (false positive)

## Code Signing (Optional)

For production apps, consider code signing to avoid Windows SmartScreen warnings:

1. Get a code signing certificate
2. Configure in `package.json`:
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

## Distribution

Share the installer:
- Upload to GitHub Releases
- Share via Google Drive/Dropbox
- Host on your website

Users only need the `.exe` installer file - nothing else!

## File Size

Expected installer size: ~200-250 MB
- Includes Chromium (for Puppeteer)
- All Node.js dependencies
- Electron runtime

This is normal for Electron apps with Puppeteer.
