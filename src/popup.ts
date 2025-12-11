import { summarizeText, transcribeAudio } from './api';
import {
  getSettings,
  saveSettings,
  getSummaries,
  saveSummary,
  deleteSummary,
  clearAllSummaries,
  generateId,
} from './storage';
import type { Settings, Summary, PageContent, SummaryResult } from './types';

// State
let currentSettings: Settings;
let isRecording = false;
let recordingStartTime: number | null = null;
let recordingInterval: number | null = null;
let currentSummary: Summary | null = null;

// DOM Elements
const elements = {
  // Tabs
  tabs: document.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>,
  tabMain: document.getElementById('tab-main')!,
  tabHistory: document.getElementById('tab-history')!,
  tabSettings: document.getElementById('tab-settings')!,

  // Consent modal
  consentModal: document.getElementById('consent-modal')!,
  consentAccept: document.getElementById('consent-accept')!,
  consentDecline: document.getElementById('consent-decline')!,

  // Main tab
  apiKeyWarning: document.getElementById('api-key-warning')!,
  goToSettings: document.getElementById('go-to-settings')!,
  actionButtons: document.getElementById('action-buttons')!,
  summarizePage: document.getElementById('summarize-page')!,
  startRecording: document.getElementById('start-recording')!,
  recordingControls: document.getElementById('recording-controls')!,
  recordingTime: document.getElementById('recording-time')!,
  stopRecording: document.getElementById('stop-recording')!,
  loading: document.getElementById('loading')!,
  loadingText: document.getElementById('loading-text')!,
  error: document.getElementById('error')!,
  errorText: document.getElementById('error-text')!,
  errorDismiss: document.getElementById('error-dismiss')!,

  // Summary result
  summaryResult: document.getElementById('summary-result')!,
  summaryTitle: document.getElementById('summary-title')!,
  copySummary: document.getElementById('copy-summary')!,
  downloadSummary: document.getElementById('download-summary')!,
  closeSummary: document.getElementById('close-summary')!,
  summaryText: document.getElementById('summary-text')!,
  keyPointsSection: document.getElementById('key-points-section')!,
  keyPointsList: document.getElementById('key-points-list')!,
  actionItemsSection: document.getElementById('action-items-section')!,
  actionItemsList: document.getElementById('action-items-list')!,
  decisionsSection: document.getElementById('decisions-section')!,
  decisionsList: document.getElementById('decisions-list')!,
  transcriptSection: document.getElementById('transcript-section')!,
  transcriptText: document.getElementById('transcript-text')!,

  // History tab
  historyEmpty: document.getElementById('history-empty')!,
  historyList: document.getElementById('history-list')!,
  historyActions: document.getElementById('history-actions')!,
  clearHistory: document.getElementById('clear-history')!,

  // Settings tab
  settingsForm: document.getElementById('settings-form') as HTMLFormElement,
  apiProvider: document.getElementById('api-provider') as HTMLSelectElement,
  apiKey: document.getElementById('api-key') as HTMLInputElement,
  settingsSaved: document.getElementById('settings-saved')!,
};

// Initialize
async function init() {
  currentSettings = await getSettings();

  // Check consent
  if (!currentSettings.consentGiven) {
    showConsentModal();
  }

  // Check API key
  updateApiKeyWarning();

  // Load settings into form
  elements.apiProvider.value = currentSettings.apiProvider;
  elements.apiKey.value = currentSettings.apiKey;

  // Load history
  await loadHistory();

  // Check recording status
  await checkRecordingStatus();

  // Set up event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Tab navigation
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab!));
  });

  // Consent modal
  elements.consentAccept.addEventListener('click', acceptConsent);
  elements.consentDecline.addEventListener('click', declineConsent);

  // Main actions
  elements.goToSettings.addEventListener('click', () => switchTab('settings'));
  elements.summarizePage.addEventListener('click', handleSummarizePage);
  elements.startRecording.addEventListener('click', handleStartRecording);
  elements.stopRecording.addEventListener('click', handleStopRecording);
  elements.errorDismiss.addEventListener('click', hideError);

  // Summary actions
  elements.copySummary.addEventListener('click', handleCopySummary);
  elements.downloadSummary.addEventListener('click', handleDownloadSummary);
  elements.closeSummary.addEventListener('click', hideSummaryResult);

  // History
  elements.clearHistory.addEventListener('click', handleClearHistory);

  // Settings
  elements.settingsForm.addEventListener('submit', handleSaveSettings);
}

// Tab Navigation
function switchTab(tabName: string) {
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  elements.tabMain.classList.toggle('hidden', tabName !== 'main');
  elements.tabHistory.classList.toggle('hidden', tabName !== 'history');
  elements.tabSettings.classList.toggle('hidden', tabName !== 'settings');

  if (tabName === 'history') {
    loadHistory();
  }
}

// Consent
function showConsentModal() {
  elements.consentModal.classList.remove('hidden');
}

function hideConsentModal() {
  elements.consentModal.classList.add('hidden');
}

async function acceptConsent() {
  await saveSettings({ consentGiven: true });
  currentSettings.consentGiven = true;
  hideConsentModal();
}

function declineConsent() {
  window.close();
}

// API Key Warning
function updateApiKeyWarning() {
  const hasKey = currentSettings.apiKey.length > 0;
  elements.apiKeyWarning.classList.toggle('hidden', hasKey);
  elements.actionButtons.classList.toggle('hidden', !hasKey);
}

// Page Summarization
async function handleSummarizePage() {
  try {
    showLoading('Extracting page content...');
    hideError();
    hideSummaryResult();

    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    // Send message to content script to get page content
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });

    if (!response.success) {
      throw new Error(response.error || 'Failed to extract page content');
    }

    const content: PageContent = response.data;

    if (!content.text || content.text.trim().length < 50) {
      throw new Error('Not enough content found on this page to summarize');
    }

    showLoading('Generating summary...');

    // Call the API to summarize
    const result = await summarizeText(content.text, currentSettings);

    // Create and save summary
    const summary: Summary = {
      id: generateId(),
      type: 'page',
      title: content.title,
      url: content.url,
      summary: result.summary,
      keyPoints: result.keyPoints,
      actionItems: result.actionItems,
      decisions: result.decisions,
      createdAt: Date.now(),
    };

    await saveSummary(summary);
    currentSummary = summary;

    hideLoading();
    displaySummary(summary);
  } catch (error) {
    hideLoading();
    showError(error instanceof Error ? error.message : 'An error occurred');
  }
}

// Audio Recording
async function checkRecordingStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CAPTURE_STATUS' });
    if (response.success && response.data.isRecording) {
      isRecording = true;
      recordingStartTime = Date.now() - (response.data.duration * 1000);
      showRecordingUI();
    }
  } catch {
    // Background script might not be ready yet
  }
}

async function handleStartRecording() {
  try {
    showLoading('Starting recording...');
    hideError();
    hideSummaryResult();

    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    // Request recording from background script
    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      payload: { tabId: tab.id },
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to start recording');
    }

    isRecording = true;
    recordingStartTime = Date.now();
    hideLoading();
    showRecordingUI();
  } catch (error) {
    hideLoading();
    showError(error instanceof Error ? error.message : 'Failed to start recording');
  }
}

async function handleStopRecording() {
  try {
    showLoading('Stopping recording...');
    hideRecordingUI();

    // Stop recording and get the audio
    const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });

    if (!response.success) {
      throw new Error(response.error || 'Failed to stop recording');
    }

    isRecording = false;
    recordingStartTime = null;

    const { audio, mimeType } = response.data;

    if (!audio) {
      throw new Error('No audio recorded');
    }

    // Convert base64 back to blob
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: mimeType });

    showLoading('Transcribing audio...');

    // Get OpenAI API key for transcription (always use OpenAI for Whisper)
    let apiKey = currentSettings.apiKey;
    if (currentSettings.apiProvider === 'anthropic') {
      // For Anthropic users, we still need OpenAI for transcription
      // In a real app, you might want to prompt for an OpenAI key separately
      throw new Error('Audio transcription requires an OpenAI API key. Please switch to OpenAI provider or add an OpenAI key.');
    }

    // Transcribe the audio
    const transcript = await transcribeAudio(audioBlob, apiKey);

    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Transcription failed or audio was too short/quiet');
    }

    showLoading('Generating summary...');

    // Summarize the transcript
    const result = await summarizeText(transcript, currentSettings);

    // Get the current tab for metadata
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Create and save summary
    const summary: Summary = {
      id: generateId(),
      type: 'meeting',
      title: tab?.title || 'Meeting Recording',
      url: tab?.url || '',
      summary: result.summary,
      keyPoints: result.keyPoints,
      actionItems: result.actionItems,
      decisions: result.decisions,
      transcript,
      createdAt: Date.now(),
    };

    await saveSummary(summary);
    currentSummary = summary;

    hideLoading();
    displaySummary(summary);
  } catch (error) {
    hideLoading();
    hideRecordingUI();
    showError(error instanceof Error ? error.message : 'Failed to process recording');
  }
}

function showRecordingUI() {
  elements.actionButtons.classList.add('hidden');
  elements.recordingControls.classList.remove('hidden');

  // Start timer
  updateRecordingTime();
  recordingInterval = window.setInterval(updateRecordingTime, 1000);
}

function hideRecordingUI() {
  elements.recordingControls.classList.add('hidden');
  elements.actionButtons.classList.remove('hidden');

  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
}

function updateRecordingTime() {
  if (!recordingStartTime) return;

  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  elements.recordingTime.textContent = `${minutes}:${seconds}`;
}

// Summary Display
function displaySummary(summary: Summary) {
  elements.summaryTitle.textContent = summary.type === 'meeting' ? 'Meeting Summary' : 'Page Summary';
  elements.summaryText.textContent = summary.summary;

  // Key points
  if (summary.keyPoints.length > 0) {
    elements.keyPointsSection.classList.remove('hidden');
    elements.keyPointsList.innerHTML = summary.keyPoints
      .map(point => `<li>${escapeHtml(point)}</li>`)
      .join('');
  } else {
    elements.keyPointsSection.classList.add('hidden');
  }

  // Action items
  if (summary.actionItems.length > 0) {
    elements.actionItemsSection.classList.remove('hidden');
    elements.actionItemsList.innerHTML = summary.actionItems
      .map(item => `<li>${escapeHtml(item)}</li>`)
      .join('');
  } else {
    elements.actionItemsSection.classList.add('hidden');
  }

  // Decisions
  if (summary.decisions.length > 0) {
    elements.decisionsSection.classList.remove('hidden');
    elements.decisionsList.innerHTML = summary.decisions
      .map(decision => `<li>${escapeHtml(decision)}</li>`)
      .join('');
  } else {
    elements.decisionsSection.classList.add('hidden');
  }

  // Transcript
  if (summary.transcript) {
    elements.transcriptSection.classList.remove('hidden');
    elements.transcriptText.textContent = summary.transcript;
  } else {
    elements.transcriptSection.classList.add('hidden');
  }

  elements.summaryResult.classList.remove('hidden');
}

function hideSummaryResult() {
  elements.summaryResult.classList.add('hidden');
  currentSummary = null;
}

async function handleCopySummary() {
  if (!currentSummary) return;

  const text = formatSummaryAsText(currentSummary);
  await navigator.clipboard.writeText(text);

  // Show feedback
  const originalText = elements.copySummary.textContent;
  elements.copySummary.textContent = 'Copied!';
  setTimeout(() => {
    elements.copySummary.textContent = originalText;
  }, 2000);
}

function handleDownloadSummary() {
  if (!currentSummary) return;

  const text = formatSummaryAsText(currentSummary);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-${currentSummary.id}.txt`;
  a.click();

  URL.revokeObjectURL(url);
}

function formatSummaryAsText(summary: Summary): string {
  let text = `# ${summary.title}\n`;
  text += `${summary.type === 'meeting' ? 'Meeting' : 'Page'} Summary\n`;
  text += `Date: ${new Date(summary.createdAt).toLocaleString()}\n`;
  if (summary.url) text += `URL: ${summary.url}\n`;
  text += `\n## Summary\n${summary.summary}\n`;

  if (summary.keyPoints.length > 0) {
    text += `\n## Key Points\n`;
    summary.keyPoints.forEach(point => {
      text += `- ${point}\n`;
    });
  }

  if (summary.actionItems.length > 0) {
    text += `\n## Action Items\n`;
    summary.actionItems.forEach(item => {
      text += `- ${item}\n`;
    });
  }

  if (summary.decisions.length > 0) {
    text += `\n## Decisions\n`;
    summary.decisions.forEach(decision => {
      text += `- ${decision}\n`;
    });
  }

  if (summary.transcript) {
    text += `\n## Transcript\n${summary.transcript}\n`;
  }

  return text;
}

// History
async function loadHistory() {
  const summaries = await getSummaries();

  if (summaries.length === 0) {
    elements.historyEmpty.classList.remove('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyActions.classList.add('hidden');
    return;
  }

  elements.historyEmpty.classList.add('hidden');
  elements.historyList.classList.remove('hidden');
  elements.historyActions.classList.remove('hidden');

  elements.historyList.innerHTML = summaries
    .map(summary => `
      <div class="history-item" data-id="${summary.id}">
        <div class="history-item-header">
          <span class="history-item-title">${escapeHtml(summary.title)}</span>
          <span class="history-item-type ${summary.type}">${summary.type}</span>
        </div>
        <div class="history-item-date">${new Date(summary.createdAt).toLocaleString()}</div>
        <div class="history-item-preview">${escapeHtml(summary.summary.substring(0, 100))}...</div>
      </div>
    `)
    .join('');

  // Add click handlers
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = (item as HTMLElement).dataset.id!;
      const summary = summaries.find(s => s.id === id);
      if (summary) {
        currentSummary = summary;
        switchTab('main');
        displaySummary(summary);
      }
    });
  });
}

async function handleClearHistory() {
  if (confirm('Are you sure you want to delete all summaries? This cannot be undone.')) {
    await clearAllSummaries();
    await loadHistory();
  }
}

// Settings
async function handleSaveSettings(e: Event) {
  e.preventDefault();

  const newSettings: Partial<Settings> = {
    apiProvider: elements.apiProvider.value as 'openai' | 'anthropic',
    apiKey: elements.apiKey.value.trim(),
  };

  await saveSettings(newSettings);
  currentSettings = { ...currentSettings, ...newSettings };

  updateApiKeyWarning();

  // Show success message
  elements.settingsSaved.classList.remove('hidden');
  setTimeout(() => {
    elements.settingsSaved.classList.add('hidden');
  }, 3000);
}

// UI Helpers
function showLoading(text: string) {
  elements.loadingText.textContent = text;
  elements.loading.classList.remove('hidden');
  elements.actionButtons.classList.add('hidden');
}

function hideLoading() {
  elements.loading.classList.add('hidden');
  if (!isRecording) {
    elements.actionButtons.classList.remove('hidden');
  }
}

function showError(message: string) {
  elements.errorText.textContent = message;
  elements.error.classList.remove('hidden');
}

function hideError() {
  elements.error.classList.add('hidden');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
