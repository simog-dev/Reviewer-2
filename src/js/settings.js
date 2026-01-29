const DEFAULT_PROMPT = `You are a thorough academic paper reviewer. Based on the annotations below from a paper I'm reviewing, generate a comprehensive written review. Group findings by severity (Critical first, then Major, Minor, Suggestion, Question). For each finding, reference the page number and quoted text. Be specific, constructive, and actionable. End with a brief summary of overall quality. Output plain text, no markdown.`;

const SETTING_KEYS = ['llm_api_key', 'llm_provider', 'llm_model', 'llm_temperature', 'llm_prompt'];

let showingKey = false;

async function init() {
  setupEventListeners();
  await loadSettings();
}

async function loadSettings() {
  const apiKey = await window.api.getSetting('llm_api_key') || '';
  const provider = await window.api.getSetting('llm_provider') || 'google';
  const model = await window.api.getSetting('llm_model') || '';
  const temperature = await window.api.getSetting('llm_temperature') || '0.7';
  const prompt = await window.api.getSetting('llm_prompt') || DEFAULT_PROMPT;

  document.getElementById('api-key-input').value = apiKey;
  document.getElementById('provider-select').value = provider;
  document.getElementById('model-input').value = model;

  const tempSlider = document.getElementById('temperature-slider');
  tempSlider.value = temperature;
  document.getElementById('temperature-value').textContent = parseFloat(temperature).toFixed(1);

  document.getElementById('prompt-input').value = prompt;
}

async function saveSettings() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  const provider = document.getElementById('provider-select').value;
  const model = document.getElementById('model-input').value.trim();
  const temperature = document.getElementById('temperature-slider').value;
  const prompt = document.getElementById('prompt-input').value;

  await window.api.setSetting('llm_api_key', apiKey);
  await window.api.setSetting('llm_provider', provider);
  await window.api.setSetting('llm_model', model);
  await window.api.setSetting('llm_temperature', temperature);
  await window.api.setSetting('llm_prompt', prompt);

  showToast('Settings saved successfully');
}

function toggleKeyVisibility() {
  const input = document.getElementById('api-key-input');
  showingKey = !showingKey;
  input.type = showingKey ? 'text' : 'password';

  const eyeIcon = document.getElementById('eye-icon');
  const slashIcon = document.getElementById('eye-slash-icon');
  eyeIcon.style.display = showingKey ? 'none' : 'block';
  slashIcon.style.display = showingKey ? 'block' : 'none';
}

function setupEventListeners() {
  document.getElementById('btn-back').addEventListener('click', () => {
    window.api.navigateToHome();
  });

  document.getElementById('btn-save').addEventListener('click', saveSettings);

  document.getElementById('btn-toggle-key').addEventListener('click', toggleKeyVisibility);

  document.getElementById('temperature-slider').addEventListener('input', (e) => {
    document.getElementById('temperature-value').textContent = parseFloat(e.target.value).toFixed(1);
  });
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

init();
