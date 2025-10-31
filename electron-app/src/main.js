const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const YAML = require('yaml');
const { spawn } = require('child_process');

let mainWindow;
let automationProcess = null;

// Helper to get the correct base path for resources
function getBasePath() {
  if (app.isPackaged) {
    // In production, resources are in the app.asar/resources/app folder
    return path.join(process.resourcesPath, 'app');
  } else {
    // In development, go up one level from electron-app/src
    return path.join(__dirname, '../..');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (automationProcess) {
    automationProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Load config
ipcMain.handle('load-config', async () => {
  try {
    const configPath = path.join(getBasePath(), 'config.yaml');
    const configFile = await fs.promises.readFile(configPath, 'utf-8');
    const config = YAML.parse(configFile);
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save config
ipcMain.handle('save-config', async (event, config) => {
  try {
    const configPath = path.join(getBasePath(), 'config.yaml');
    const yamlContent = YAML.stringify(config);
    await fs.promises.writeFile(configPath, yamlContent, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Select CSV file
ipcMain.handle('select-csv', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Select image file
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Select Chrome/Chromium executable
ipcMain.handle('select-chrome', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: process.platform === 'win32' ? ['exe'] : ['app', '*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Select template file
ipcMain.handle('select-template', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Load CSV preview
ipcMain.handle('load-csv-preview', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, 6); // Header + 5 rows
    return { success: true, preview: lines.join('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load template content
ipcMain.handle('load-template-content', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Run automation (dry run)
ipcMain.handle('run-dry-run', async () => {
  return runAutomation(true);
});

// Run automation (real)
ipcMain.handle('run-automation', async () => {
  return runAutomation(false);
});

// Stop automation
ipcMain.handle('stop-automation', async () => {
  if (automationProcess) {
    automationProcess.kill();
    automationProcess = null;
    return { success: true };
  }
  return { success: false, error: 'No process running' };
});

// Helper function to run automation
async function runAutomation(dryRun) {
  return new Promise(async (resolve) => {
    if (automationProcess) {
      resolve({ success: false, error: 'Automation already running' });
      return;
    }

    const basePath = getBasePath();
    const scriptPath = path.join(basePath, 'src/index.js');
    const args = dryRun ? ['--dry-run'] : [];

    console.log('[AUTOMATION]:', 'Starting automation process');
    console.log('[AUTOMATION]:', 'Base path:', basePath);
    console.log('[AUTOMATION]:', 'Script path:', scriptPath);
    console.log('[AUTOMATION]:', 'Executable:', process.execPath);
    console.log('[AUTOMATION]:', 'Dry run:', dryRun);

    // Log to UI immediately
    mainWindow.webContents.send('automation-log', `Starting automation process...\n`);
    mainWindow.webContents.send('automation-log', `Base path: ${basePath}\n`);
    mainWindow.webContents.send('automation-log', `Script: ${scriptPath}\n`);

    // Verify script exists
    try {
      await fs.promises.access(scriptPath);
    } catch (error) {
      const errorMsg = `Script not found at ${scriptPath}`;
      console.error('[AUTOMATION]:', errorMsg);
      mainWindow.webContents.send('automation-log', `[ERROR] ${errorMsg}\n`);
      resolve({ success: false, error: errorMsg });
      return;
    }

    // Load config to check for custom Chrome path
    let chromePath = undefined; // Let Puppeteer find Chrome/Chromium by default
    try {
      const configPath = path.join(basePath, 'config.yaml');
      const configFile = await fs.promises.readFile(configPath, 'utf-8');
      const config = YAML.parse(configFile);
      if (config.chrome_executable_path) {
        chromePath = config.chrome_executable_path;
        console.log('[AUTOMATION]:', 'Using custom Chrome path:', chromePath);
        mainWindow.webContents.send('automation-log', `Using custom Chrome: ${chromePath}\n`);
      } else {
        console.log('[AUTOMATION]:', 'Using system Chrome/Chromium (auto-detect)');
        mainWindow.webContents.send('automation-log', `Using system Chrome/Chromium (auto-detect)\n`);
      }
    } catch (error) {
      console.log('[AUTOMATION]:', 'Could not load config, will auto-detect Chrome:', error.message);
      mainWindow.webContents.send('automation-log', `Config load warning: ${error.message}\n`);
    }

    // Build environment variables
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', // Run Electron as Node.js
      NODE_ENV: 'production' // Ensure production mode
    };

    // Only set PUPPETEER_EXECUTABLE_PATH if a custom Chrome path is configured
    if (chromePath) {
      env.PUPPETEER_EXECUTABLE_PATH = chromePath;
    }

    console.log('[AUTOMATION]:', 'Environment variables set:', Object.keys(env).filter(k => k.startsWith('ELECTRON') || k.startsWith('PUPPETEER') || k.startsWith('NODE')));
    mainWindow.webContents.send('automation-log', `Spawning process...\n`);

    // Try to find Node.js executable
    let nodeExecutable = process.execPath;
    let useElectron = true;

    // On Windows, try to find node.exe in common locations
    if (process.platform === 'win32') {
      const possibleNodePaths = [
        'C:\\Program Files\\nodejs\\node.exe',
        'C:\\Program Files (x86)\\nodejs\\node.exe',
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs', 'node.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
      ];

      for (const nodePath of possibleNodePaths) {
        try {
          await fs.promises.access(nodePath);
          nodeExecutable = nodePath;
          useElectron = false;
          console.log('[AUTOMATION]:', 'Found Node.js at:', nodePath);
          mainWindow.webContents.send('automation-log', `Using Node.js: ${nodePath}\n`);
          break;
        } catch (err) {
          // Continue searching
        }
      }
    }

    if (useElectron) {
      console.log('[AUTOMATION]:', 'Using Electron as Node.js');
      mainWindow.webContents.send('automation-log', `Using Electron as Node.js\n`);
      env.ELECTRON_RUN_AS_NODE = '1';
    } else {
      // Don't need ELECTRON_RUN_AS_NODE if using actual Node.js
      delete env.ELECTRON_RUN_AS_NODE;
    }

    // Spawn the automation process
    automationProcess = spawn(nodeExecutable, [scriptPath, ...args], {
      cwd: basePath,
      env
    });

    let output = '';

    automationProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('[AUTOMATION STDOUT]:', message);
      mainWindow.webContents.send('automation-log', message);
    });

    automationProcess.stderr.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.error('[AUTOMATION STDERR]:', message);
      mainWindow.webContents.send('automation-log', `[ERROR] ${message}`);
    });

    automationProcess.on('error', (error) => {
      const message = `Process error: ${error.message}`;
      output += message;
      console.error('[AUTOMATION ERROR]:', error);
      mainWindow.webContents.send('automation-log', `[ERROR] ${message}`);
    });

    automationProcess.on('close', (code) => {
      console.log('[AUTOMATION]:', `Process exited with code ${code}`);

      // If process exits with code 0 but no output, something went wrong
      if (code === 0 && output.trim().length === 0) {
        const errorMsg = 'Process exited successfully but produced no output. Check if Node.js modules are correctly bundled.';
        console.error('[AUTOMATION]:', errorMsg);
        mainWindow.webContents.send('automation-log', `[ERROR] ${errorMsg}`);
        mainWindow.webContents.send('automation-complete', { code: 1, output: errorMsg });
      } else if (code !== 0 && output.trim().length === 0) {
        const errorMsg = `Process failed with exit code ${code} but produced no output. This might indicate a module loading error.`;
        console.error('[AUTOMATION]:', errorMsg);
        mainWindow.webContents.send('automation-log', `[ERROR] ${errorMsg}`);
        mainWindow.webContents.send('automation-complete', { code, output: errorMsg });
      } else {
        mainWindow.webContents.send('automation-complete', { code, output });
      }

      automationProcess = null;
    });

    resolve({ success: true });
  });
}

// Get stats
ipcMain.handle('get-stats', async () => {
  try {
    const stateFilePath = path.join(getBasePath(), 'sent_messages.json');

    try {
      await fs.promises.access(stateFilePath);
      const stateContent = await fs.promises.readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(stateContent);

      const messages = Object.values(state.sentMessages || {});
      const uniquePhones = new Set(messages.map(m => m.phone));

      return {
        success: true,
        stats: {
          totalMessages: messages.length,
          uniqueContacts: uniquePhones.size,
          lastUpdated: state.lastUpdated
        }
      };
    } catch {
      return {
        success: true,
        stats: {
          totalMessages: 0,
          uniqueContacts: 0,
          lastUpdated: null
        }
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear state
ipcMain.handle('clear-state', async () => {
  try {
    const stateFilePath = path.join(getBasePath(), 'sent_messages.json');
    await fs.promises.unlink(stateFilePath);
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true }; // File doesn't exist, that's fine
    }
    return { success: false, error: error.message };
  }
});

// Get sent messages
ipcMain.handle('get-sent-messages', async () => {
  try {
    const stateFilePath = path.join(getBasePath(), 'sent_messages.json');

    try {
      await fs.promises.access(stateFilePath);
      const stateContent = await fs.promises.readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(stateContent);

      return {
        success: true,
        messages: state.sentMessages || {},
        lastUpdated: state.lastUpdated
      };
    } catch {
      return {
        success: true,
        messages: {},
        lastUpdated: null
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete sent message
ipcMain.handle('delete-sent-message', async (event, messageHash) => {
  try {
    const stateFilePath = path.join(getBasePath(), 'sent_messages.json');
    const stateContent = await fs.promises.readFile(stateFilePath, 'utf-8');
    const state = JSON.parse(stateContent);

    if (state.sentMessages && state.sentMessages[messageHash]) {
      delete state.sentMessages[messageHash];
      state.lastUpdated = new Date().toISOString();

      await fs.promises.writeFile(
        stateFilePath,
        JSON.stringify(state, null, 2),
        'utf-8'
      );

      return { success: true };
    }

    return { success: false, error: 'Message not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete multiple sent messages
ipcMain.handle('delete-sent-messages', async (event, messageHashes) => {
  try {
    const stateFilePath = path.join(getBasePath(), 'sent_messages.json');
    const stateContent = await fs.promises.readFile(stateFilePath, 'utf-8');
    const state = JSON.parse(stateContent);

    let deletedCount = 0;
    for (const hash of messageHashes) {
      if (state.sentMessages && state.sentMessages[hash]) {
        delete state.sentMessages[hash];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      state.lastUpdated = new Date().toISOString();
      await fs.promises.writeFile(
        stateFilePath,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
    }

    return { success: true, deletedCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export sent messages
ipcMain.handle('export-sent-messages', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `whatsapp-sent-messages-${Date.now()}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (!result.canceled && result.filePath) {
      const stateFilePath = path.join(getBasePath(), 'sent_messages.json');
      const stateContent = await fs.promises.readFile(stateFilePath, 'utf-8');
      await fs.promises.writeFile(result.filePath, stateContent, 'utf-8');
      return { success: true, path: result.filePath };
    }

    return { success: false, error: 'Export canceled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
