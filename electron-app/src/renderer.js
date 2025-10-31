const { ipcRenderer } = require('electron');

// DOM Elements
const csvPath = document.getElementById('csvPath');
const templatePath = document.getElementById('templatePath');
const imagePath = document.getElementById('imagePath');
const imageCaption = document.getElementById('imageCaption');
const rateLimit = document.getElementById('rateLimit');
const logLevel = document.getElementById('logLevel');

const selectCsv = document.getElementById('selectCsv');
const selectTemplate = document.getElementById('selectTemplate');
const selectImage = document.getElementById('selectImage');
const clearImage = document.getElementById('clearImage');

const saveConfig = document.getElementById('saveConfig');
const loadConfig = document.getElementById('loadConfig');

const runDryRun = document.getElementById('runDryRun');
const runAutomation = document.getElementById('runAutomation');
const stopAutomation = document.getElementById('stopAutomation');
const clearState = document.getElementById('clearState');

const consoleOutput = document.getElementById('console');
const clearConsole = document.getElementById('clearConsole');

const csvPreview = document.getElementById('csvPreview');
const templatePreview = document.getElementById('templatePreview');

const statMessages = document.getElementById('statMessages');
const statContacts = document.getElementById('statContacts');
const statUpdated = document.getElementById('statUpdated');
const refreshStats = document.getElementById('refreshStats');

// Initialize
loadConfigFromFile();
updateStats();

// Event Listeners

selectCsv.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-csv');
  if (result.success) {
    csvPath.value = result.path;
    loadCsvPreview(result.path);
  }
});

selectTemplate.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-template');
  if (result.success) {
    templatePath.value = result.path;
    loadTemplatePreview(result.path);
  }
});

selectImage.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-image');
  if (result.success) {
    imagePath.value = result.path;
  }
});

clearImage.addEventListener('click', () => {
  imagePath.value = '';
  imageCaption.value = '';
});

saveConfig.addEventListener('click', async () => {
  const config = getConfigFromUI();
  const result = await ipcRenderer.invoke('save-config', config);

  if (result.success) {
    log('✅ Configuration saved successfully', 'success');
  } else {
    log(`❌ Failed to save configuration: ${result.error}`, 'error');
  }
});

loadConfig.addEventListener('click', async () => {
  await loadConfigFromFile();
});

runDryRun.addEventListener('click', async () => {
  // Save config first
  const config = getConfigFromUI();
  await ipcRenderer.invoke('save-config', config);

  log('🧪 Starting dry run...', 'info');
  setRunningState(true);

  const result = await ipcRenderer.invoke('run-dry-run');
  if (!result.success) {
    log(`❌ Failed to start: ${result.error}`, 'error');
    setRunningState(false);
  }
});

runAutomation.addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to send messages? This will send real WhatsApp messages.');
  if (!confirmed) return;

  // Save config first
  const config = getConfigFromUI();
  await ipcRenderer.invoke('save-config', config);

  log('🚀 Starting automation...', 'info');
  setRunningState(true);

  const result = await ipcRenderer.invoke('run-automation');
  if (!result.success) {
    log(`❌ Failed to start: ${result.error}`, 'error');
    setRunningState(false);
  }
});

stopAutomation.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('stop-automation');
  if (result.success) {
    log('⏹️ Automation stopped', 'warning');
  }
  setRunningState(false);
});

clearState.addEventListener('click', async () => {
  const confirmed = confirm('Clear all sent message tracking? This will allow re-sending to previous contacts.');
  if (!confirmed) return;

  const result = await ipcRenderer.invoke('clear-state');
  if (result.success) {
    log('🗑️ State cleared successfully', 'success');
    updateStats();
  } else {
    log(`❌ Failed to clear state: ${result.error}`, 'error');
  }
});

clearConsole.addEventListener('click', () => {
  consoleOutput.innerHTML = '';
});

refreshStats.addEventListener('click', () => {
  updateStats();
});

// IPC Listeners

ipcRenderer.on('automation-log', (event, message) => {
  log(message, 'log');
});

ipcRenderer.on('automation-complete', (event, data) => {
  setRunningState(false);
  if (data.code === 0) {
    log('✅ Automation completed successfully', 'success');
  } else {
    log(`❌ Automation failed with code ${data.code}`, 'error');
  }
  updateStats();
});

// Helper Functions

async function loadConfigFromFile() {
  const result = await ipcRenderer.invoke('load-config');

  if (result.success) {
    const config = result.config;

    csvPath.value = config.contacts_csv || '';
    templatePath.value = config.message_template || '';
    imagePath.value = config.image_path || '';
    imageCaption.value = config.image_caption || '';
    rateLimit.value = config.rate_limit || 1;
    logLevel.value = config.logging?.level || 'info';

    log('📂 Configuration loaded', 'success');

    // Load previews
    if (csvPath.value) loadCsvPreview(csvPath.value);
    if (templatePath.value) loadTemplatePreview(templatePath.value);
  } else {
    log(`❌ Failed to load config: ${result.error}`, 'error');
  }
}

function getConfigFromUI() {
  // Load current config structure to preserve all settings
  return {
    contacts_csv: csvPath.value,
    message_template: templatePath.value,
    image_path: imagePath.value || undefined,
    image_caption: imageCaption.value || undefined,
    rate_limit: parseFloat(rateLimit.value),
    logging: {
      level: logLevel.value,
      file: './whatsapp-automation.log',
      console: true
    },
    session_dir: './whatsapp-session',
    state_file: './sent_messages.json',
    retry: {
      max_attempts: 3,
      initial_delay_ms: 1000,
      max_delay_ms: 10000,
      backoff_multiplier: 2
    },
    timeouts: {
      page_load: 60000,
      message_send: 30000,
      element_wait: 10000
    },
    screenshots: {
      enabled: true,
      dir: './screenshots'
    },
    puppeteer: {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  };
}

async function loadCsvPreview(filePath) {
  const result = await ipcRenderer.invoke('load-csv-preview', filePath);

  if (result.success) {
    csvPreview.innerHTML = `<pre>${escapeHtml(result.preview)}</pre>`;
  } else {
    csvPreview.innerHTML = `<div class="error">Error: ${escapeHtml(result.error)}</div>`;
  }
}

async function loadTemplatePreview(filePath) {
  const result = await ipcRenderer.invoke('load-template-content', filePath);

  if (result.success) {
    templatePreview.innerHTML = `<pre>${escapeHtml(result.content)}</pre>`;
  } else {
    templatePreview.innerHTML = `<div class="error">Error: ${escapeHtml(result.error)}</div>`;
  }
}

async function updateStats() {
  const result = await ipcRenderer.invoke('get-stats');

  if (result.success) {
    const stats = result.stats;
    statMessages.textContent = stats.totalMessages;
    statContacts.textContent = stats.uniqueContacts;
    statUpdated.textContent = stats.lastUpdated
      ? new Date(stats.lastUpdated).toLocaleString()
      : 'Never';
  }
}

function setRunningState(running) {
  runDryRun.disabled = running;
  runAutomation.disabled = running;
  stopAutomation.disabled = !running;
  saveConfig.disabled = running;
}

function log(message, type = 'log') {
  const entry = document.createElement('div');
  entry.className = `console-entry console-${type}`;

  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${escapeHtml(message)}`;

  consoleOutput.appendChild(entry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
