const { ipcRenderer } = require('electron');

// DOM Elements
const csvPath = document.getElementById('csvPath');
const templatePath = document.getElementById('templatePath');
const imagePath = document.getElementById('imagePath');
const imageCaption = document.getElementById('imageCaption');
const chromePath = document.getElementById('chromePath');
const rateLimit = document.getElementById('rateLimit');
const logLevel = document.getElementById('logLevel');

const selectCsv = document.getElementById('selectCsv');
const selectTemplate = document.getElementById('selectTemplate');
const selectImage = document.getElementById('selectImage');
const clearImage = document.getElementById('clearImage');
const selectChrome = document.getElementById('selectChrome');
const clearChrome = document.getElementById('clearChrome');

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

const sentMessagesList = document.getElementById('sentMessagesList');
const searchMessages = document.getElementById('searchMessages');
const messageCount = document.getElementById('messageCount');
const refreshSentMessages = document.getElementById('refreshSentMessages');
const deleteSelected = document.getElementById('deleteSelected');
const exportMessages = document.getElementById('exportMessages');

// State
let allMessages = {};
let selectedMessages = new Set();

// Initialize
loadConfigFromFile();
updateStats();
loadSentMessages();

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

selectChrome.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-chrome');
  if (result.success) {
    chromePath.value = result.path;
  }
});

clearChrome.addEventListener('click', () => {
  chromePath.value = '';
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

refreshSentMessages.addEventListener('click', () => {
  loadSentMessages();
});

searchMessages.addEventListener('input', (e) => {
  filterMessages(e.target.value);
});

deleteSelected.addEventListener('click', async () => {
  if (selectedMessages.size === 0) return;

  const confirmed = confirm(`Delete ${selectedMessages.size} selected message(s)?`);
  if (!confirmed) return;

  const result = await ipcRenderer.invoke('delete-sent-messages', Array.from(selectedMessages));

  if (result.success) {
    log(`🗑️ Deleted ${result.deletedCount} message(s)`, 'success');
    selectedMessages.clear();
    await loadSentMessages();
    await updateStats();
  } else {
    log(`❌ Failed to delete messages: ${result.error}`, 'error');
  }
});

exportMessages.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('export-sent-messages');

  if (result.success) {
    log(`💾 Messages exported to ${result.path}`, 'success');
  } else {
    log(`❌ Export failed: ${result.error}`, 'error');
  }
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
  loadSentMessages();
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
    chromePath.value = config.chrome_executable_path || '';
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
    chrome_executable_path: chromePath.value || undefined,
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

async function loadSentMessages() {
  const result = await ipcRenderer.invoke('get-sent-messages');

  if (result.success) {
    allMessages = result.messages;
    renderMessages(allMessages);
    updateMessageCount(Object.keys(allMessages).length);
  } else {
    log(`❌ Failed to load sent messages: ${result.error}`, 'error');
  }
}

function renderMessages(messages) {
  const messagesArray = Object.entries(messages).map(([hash, msg]) => ({
    hash,
    ...msg
  }));

  // Sort by timestamp (newest first)
  messagesArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (messagesArray.length === 0) {
    sentMessagesList.innerHTML = '<div class="no-messages">No messages sent yet</div>';
    deleteSelected.disabled = true;
    return;
  }

  sentMessagesList.innerHTML = messagesArray.map(msg => createMessageElement(msg)).join('');

  // Add click handlers
  sentMessagesList.querySelectorAll('.message-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-danger')) return; // Don't toggle if clicking delete
      toggleMessageSelection(item.dataset.hash);
    });
  });

  // Add delete button handlers
  sentMessagesList.querySelectorAll('.delete-single').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const hash = btn.dataset.hash;
      const confirmed = confirm('Delete this message?');
      if (!confirmed) return;

      const result = await ipcRenderer.invoke('delete-sent-message', hash);
      if (result.success) {
        log('🗑️ Message deleted', 'success');
        await loadSentMessages();
        await updateStats();
      } else {
        log(`❌ Failed to delete: ${result.error}`, 'error');
      }
    });
  });

  updateDeleteButtonState();
}

function createMessageElement(msg) {
  const timestamp = new Date(msg.timestamp).toLocaleString();
  const contact = msg.contact || {};
  const isSelected = selectedMessages.has(msg.hash);

  return `
    <div class="message-item ${isSelected ? 'selected' : ''}" data-hash="${msg.hash}">
      <div class="message-header">
        <div class="message-contact">
          <div class="message-contact-name">${escapeHtml(contact.name || 'Unknown')}</div>
          <div class="message-contact-phone">${escapeHtml(msg.phone)}</div>
          ${contact.company ? `<div class="message-contact-company">${escapeHtml(contact.company)}</div>` : ''}
        </div>
        <div class="message-actions">
          <div class="message-timestamp">${timestamp}</div>
          <button class="btn-danger delete-single" data-hash="${msg.hash}">🗑️</button>
        </div>
      </div>
      <div class="message-hash">Hash: ${msg.hash.substring(0, 16)}...</div>
    </div>
  `;
}

function toggleMessageSelection(hash) {
  if (selectedMessages.has(hash)) {
    selectedMessages.delete(hash);
  } else {
    selectedMessages.add(hash);
  }

  // Update UI
  const item = sentMessagesList.querySelector(`[data-hash="${hash}"]`);
  if (item) {
    item.classList.toggle('selected');
  }

  updateDeleteButtonState();
}

function updateDeleteButtonState() {
  deleteSelected.disabled = selectedMessages.size === 0;
  if (selectedMessages.size > 0) {
    deleteSelected.textContent = `🗑️ Delete Selected (${selectedMessages.size})`;
  } else {
    deleteSelected.textContent = '🗑️ Delete Selected';
  }
}

function updateMessageCount(count) {
  messageCount.textContent = count;
}

function filterMessages(searchTerm) {
  if (!searchTerm.trim()) {
    renderMessages(allMessages);
    return;
  }

  const term = searchTerm.toLowerCase();
  const filtered = {};

  for (const [hash, msg] of Object.entries(allMessages)) {
    const contact = msg.contact || {};
    const searchableText = [
      msg.phone,
      contact.name,
      contact.company,
      contact.position
    ].filter(Boolean).join(' ').toLowerCase();

    if (searchableText.includes(term)) {
      filtered[hash] = msg;
    }
  }

  renderMessages(filtered);
  updateMessageCount(Object.keys(filtered).length);
}
