import "./chunks/modulepreload-polyfill.js";
const SUMMARY_PROMPT = `Analyze the following content and provide a structured summary. Respond ONLY with valid JSON in this exact format, no other text:

{
  "summary": "A concise 2-3 sentence summary",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "actionItems": ["Action item 1", "Action item 2"],
  "decisions": ["Decision 1", "Decision 2"]
}

If there are no action items or decisions, use empty arrays.

Content to analyze:
`;
async function summarizeText(text, settings) {
  if (!settings.apiKey) {
    throw new Error("API key not configured. Please add your API key in settings.");
  }
  const truncatedText = text.length > 1e5 ? text.substring(0, 1e5) + "...[truncated]" : text;
  const prompt = SUMMARY_PROMPT + truncatedText;
  if (settings.apiProvider === "anthropic") {
    return callAnthropic(prompt, settings.apiKey);
  } else {
    return callOpenAI(prompt, settings.apiKey);
  }
}
async function callOpenAI(prompt, apiKey) {
  var _a, _b, _c;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes content. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2e3
    })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(((_a = error.error) == null ? void 0 : _a.message) || `OpenAI API error: ${response.status}`);
  }
  const data = await response.json();
  const content = (_c = (_b = data.choices[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }
  return parseJsonResponse(content);
}
async function callAnthropic(prompt, apiKey) {
  var _a, _b;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2e3,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(((_a = error.error) == null ? void 0 : _a.message) || `Anthropic API error: ${response.status}`);
  }
  const data = await response.json();
  const content = (_b = data.content[0]) == null ? void 0 : _b.text;
  if (!content) {
    throw new Error("No response from Anthropic");
  }
  return parseJsonResponse(content);
}
function parseJsonResponse(content) {
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || "No summary available",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : []
    };
  } catch {
    return {
      summary: content.substring(0, 500),
      keyPoints: [],
      actionItems: [],
      decisions: []
    };
  }
}
async function transcribeAudio(audioBlob, apiKey) {
  var _a;
  if (!apiKey) {
    throw new Error("API key not configured");
  }
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
    body: formData
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(((_a = error.error) == null ? void 0 : _a.message) || `Whisper API error: ${response.status}`);
  }
  return response.text();
}
const DEFAULT_SETTINGS = {
  apiKey: "",
  apiProvider: "openai",
  consentGiven: false
};
async function getSettings() {
  const result = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...result.settings };
}
async function saveSettings(settings) {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...settings } });
}
async function getSummaries() {
  const result = await chrome.storage.local.get("summaries");
  return result.summaries || [];
}
async function saveSummary(summary) {
  const summaries = await getSummaries();
  summaries.unshift(summary);
  if (summaries.length > 50) {
    summaries.pop();
  }
  await chrome.storage.local.set({ summaries });
}
async function clearAllSummaries() {
  await chrome.storage.local.set({ summaries: [] });
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
let currentSettings;
let isRecording = false;
let recordingStartTime = null;
let recordingInterval = null;
let currentSummary = null;
const elements = {
  // Tabs
  tabs: document.querySelectorAll(".tab"),
  tabMain: document.getElementById("tab-main"),
  tabHistory: document.getElementById("tab-history"),
  tabSettings: document.getElementById("tab-settings"),
  // Consent modal
  consentModal: document.getElementById("consent-modal"),
  consentAccept: document.getElementById("consent-accept"),
  consentDecline: document.getElementById("consent-decline"),
  // Main tab
  apiKeyWarning: document.getElementById("api-key-warning"),
  goToSettings: document.getElementById("go-to-settings"),
  actionButtons: document.getElementById("action-buttons"),
  summarizePage: document.getElementById("summarize-page"),
  startRecording: document.getElementById("start-recording"),
  recordingControls: document.getElementById("recording-controls"),
  recordingTime: document.getElementById("recording-time"),
  stopRecording: document.getElementById("stop-recording"),
  loading: document.getElementById("loading"),
  loadingText: document.getElementById("loading-text"),
  error: document.getElementById("error"),
  errorText: document.getElementById("error-text"),
  errorDismiss: document.getElementById("error-dismiss"),
  // Summary result
  summaryResult: document.getElementById("summary-result"),
  summaryTitle: document.getElementById("summary-title"),
  copySummary: document.getElementById("copy-summary"),
  downloadSummary: document.getElementById("download-summary"),
  closeSummary: document.getElementById("close-summary"),
  summaryText: document.getElementById("summary-text"),
  keyPointsSection: document.getElementById("key-points-section"),
  keyPointsList: document.getElementById("key-points-list"),
  actionItemsSection: document.getElementById("action-items-section"),
  actionItemsList: document.getElementById("action-items-list"),
  decisionsSection: document.getElementById("decisions-section"),
  decisionsList: document.getElementById("decisions-list"),
  transcriptSection: document.getElementById("transcript-section"),
  transcriptText: document.getElementById("transcript-text"),
  // History tab
  historyEmpty: document.getElementById("history-empty"),
  historyList: document.getElementById("history-list"),
  historyActions: document.getElementById("history-actions"),
  clearHistory: document.getElementById("clear-history"),
  // Settings tab
  settingsForm: document.getElementById("settings-form"),
  apiProvider: document.getElementById("api-provider"),
  apiKey: document.getElementById("api-key"),
  settingsSaved: document.getElementById("settings-saved")
};
async function init() {
  currentSettings = await getSettings();
  if (!currentSettings.consentGiven) {
    showConsentModal();
  }
  updateApiKeyWarning();
  elements.apiProvider.value = currentSettings.apiProvider;
  elements.apiKey.value = currentSettings.apiKey;
  await loadHistory();
  await checkRecordingStatus();
  setupEventListeners();
}
function setupEventListeners() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
  elements.consentAccept.addEventListener("click", acceptConsent);
  elements.consentDecline.addEventListener("click", declineConsent);
  elements.goToSettings.addEventListener("click", () => switchTab("settings"));
  elements.summarizePage.addEventListener("click", handleSummarizePage);
  elements.startRecording.addEventListener("click", handleStartRecording);
  elements.stopRecording.addEventListener("click", handleStopRecording);
  elements.errorDismiss.addEventListener("click", hideError);
  elements.copySummary.addEventListener("click", handleCopySummary);
  elements.downloadSummary.addEventListener("click", handleDownloadSummary);
  elements.closeSummary.addEventListener("click", hideSummaryResult);
  elements.clearHistory.addEventListener("click", handleClearHistory);
  elements.settingsForm.addEventListener("submit", handleSaveSettings);
}
function switchTab(tabName) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  elements.tabMain.classList.toggle("hidden", tabName !== "main");
  elements.tabHistory.classList.toggle("hidden", tabName !== "history");
  elements.tabSettings.classList.toggle("hidden", tabName !== "settings");
  if (tabName === "history") {
    loadHistory();
  }
}
function showConsentModal() {
  elements.consentModal.classList.remove("hidden");
}
function hideConsentModal() {
  elements.consentModal.classList.add("hidden");
}
async function acceptConsent() {
  await saveSettings({ consentGiven: true });
  currentSettings.consentGiven = true;
  hideConsentModal();
}
function declineConsent() {
  window.close();
}
function updateApiKeyWarning() {
  const hasKey = currentSettings.apiKey.length > 0;
  elements.apiKeyWarning.classList.toggle("hidden", hasKey);
  elements.actionButtons.classList.toggle("hidden", !hasKey);
}
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}
async function handleSummarizePage() {
  try {
    showLoading("Extracting page content...");
    hideError();
    hideSummaryResult();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error("No active tab found");
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT" });
    if (!response.success) {
      throw new Error(response.error || "Failed to extract page content");
    }
    const content = response.data;
    if (!content.text || content.text.trim().length < 50) {
      throw new Error("Not enough content found on this page to summarize");
    }
    showLoading("Generating summary...");
    const result = await summarizeText(content.text, currentSettings);
    const summary = {
      id: generateId(),
      type: "page",
      title: content.title,
      url: content.url,
      summary: result.summary,
      keyPoints: result.keyPoints,
      actionItems: result.actionItems,
      decisions: result.decisions,
      createdAt: Date.now()
    };
    await saveSummary(summary);
    currentSummary = summary;
    hideLoading();
    displaySummary(summary);
  } catch (error) {
    hideLoading();
    showError(error instanceof Error ? error.message : "An error occurred");
  }
}
async function checkRecordingStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATUS" });
    if (response.success && response.data.isRecording) {
      isRecording = true;
      recordingStartTime = Date.now() - response.data.duration * 1e3;
      showRecordingUI();
    }
  } catch {
  }
}
async function handleStartRecording() {
  try {
    showLoading("Starting recording...");
    hideError();
    hideSummaryResult();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error("No active tab found");
    }
    const response = await chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      payload: { tabId: tab.id }
    });
    if (!response.success) {
      throw new Error(response.error || "Failed to start recording");
    }
    isRecording = true;
    recordingStartTime = Date.now();
    hideLoading();
    showRecordingUI();
  } catch (error) {
    hideLoading();
    showError(error instanceof Error ? error.message : "Failed to start recording");
  }
}
async function handleStopRecording() {
  try {
    showLoading("Stopping recording...");
    hideRecordingUI();
    const response = await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
    if (!response.success) {
      throw new Error(response.error || "Failed to stop recording");
    }
    isRecording = false;
    recordingStartTime = null;
    const { audio, mimeType } = response.data;
    if (!audio) {
      throw new Error("No audio recorded");
    }
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: mimeType });
    showLoading("Transcribing audio...");
    let apiKey = currentSettings.apiKey;
    if (currentSettings.apiProvider === "anthropic") {
      throw new Error("Audio transcription requires an OpenAI API key. Please switch to OpenAI provider or add an OpenAI key.");
    }
    const transcript = await transcribeAudio(audioBlob, apiKey);
    if (!transcript || transcript.trim().length < 10) {
      throw new Error("Transcription failed or audio was too short/quiet");
    }
    showLoading("Generating summary...");
    const result = await summarizeText(transcript, currentSettings);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const summary = {
      id: generateId(),
      type: "meeting",
      title: (tab == null ? void 0 : tab.title) || "Meeting Recording",
      url: (tab == null ? void 0 : tab.url) || "",
      summary: result.summary,
      keyPoints: result.keyPoints,
      actionItems: result.actionItems,
      decisions: result.decisions,
      transcript,
      createdAt: Date.now()
    };
    await saveSummary(summary);
    currentSummary = summary;
    hideLoading();
    displaySummary(summary);
  } catch (error) {
    hideLoading();
    hideRecordingUI();
    showError(error instanceof Error ? error.message : "Failed to process recording");
  }
}
function showRecordingUI() {
  elements.actionButtons.classList.add("hidden");
  elements.recordingControls.classList.remove("hidden");
  updateRecordingTime();
  recordingInterval = window.setInterval(updateRecordingTime, 1e3);
}
function hideRecordingUI() {
  elements.recordingControls.classList.add("hidden");
  elements.actionButtons.classList.remove("hidden");
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
}
function updateRecordingTime() {
  if (!recordingStartTime) return;
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1e3);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");
  elements.recordingTime.textContent = `${minutes}:${seconds}`;
}
function displaySummary(summary) {
  elements.summaryTitle.textContent = summary.type === "meeting" ? "Meeting Summary" : "Page Summary";
  elements.summaryText.textContent = summary.summary;
  if (summary.keyPoints.length > 0) {
    elements.keyPointsSection.classList.remove("hidden");
    elements.keyPointsList.innerHTML = summary.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  } else {
    elements.keyPointsSection.classList.add("hidden");
  }
  if (summary.actionItems.length > 0) {
    elements.actionItemsSection.classList.remove("hidden");
    elements.actionItemsList.innerHTML = summary.actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  } else {
    elements.actionItemsSection.classList.add("hidden");
  }
  if (summary.decisions.length > 0) {
    elements.decisionsSection.classList.remove("hidden");
    elements.decisionsList.innerHTML = summary.decisions.map((decision) => `<li>${escapeHtml(decision)}</li>`).join("");
  } else {
    elements.decisionsSection.classList.add("hidden");
  }
  if (summary.transcript) {
    elements.transcriptSection.classList.remove("hidden");
    elements.transcriptText.textContent = summary.transcript;
  } else {
    elements.transcriptSection.classList.add("hidden");
  }
  elements.summaryResult.classList.remove("hidden");
}
function hideSummaryResult() {
  elements.summaryResult.classList.add("hidden");
  currentSummary = null;
}
async function handleCopySummary() {
  if (!currentSummary) return;
  const text = formatSummaryAsText(currentSummary);
  await navigator.clipboard.writeText(text);
  const originalText = elements.copySummary.textContent;
  elements.copySummary.textContent = "Copied!";
  setTimeout(() => {
    elements.copySummary.textContent = originalText;
  }, 2e3);
}
function handleDownloadSummary() {
  if (!currentSummary) return;
  const text = formatSummaryAsText(currentSummary);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `summary-${currentSummary.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
function formatSummaryAsText(summary) {
  let text = `# ${summary.title}
`;
  text += `${summary.type === "meeting" ? "Meeting" : "Page"} Summary
`;
  text += `Date: ${new Date(summary.createdAt).toLocaleString()}
`;
  if (summary.url) text += `URL: ${summary.url}
`;
  text += `
## Summary
${summary.summary}
`;
  if (summary.keyPoints.length > 0) {
    text += `
## Key Points
`;
    summary.keyPoints.forEach((point) => {
      text += `- ${point}
`;
    });
  }
  if (summary.actionItems.length > 0) {
    text += `
## Action Items
`;
    summary.actionItems.forEach((item) => {
      text += `- ${item}
`;
    });
  }
  if (summary.decisions.length > 0) {
    text += `
## Decisions
`;
    summary.decisions.forEach((decision) => {
      text += `- ${decision}
`;
    });
  }
  if (summary.transcript) {
    text += `
## Transcript
${summary.transcript}
`;
  }
  return text;
}
async function loadHistory() {
  const summaries = await getSummaries();
  if (summaries.length === 0) {
    elements.historyEmpty.classList.remove("hidden");
    elements.historyList.classList.add("hidden");
    elements.historyActions.classList.add("hidden");
    return;
  }
  elements.historyEmpty.classList.add("hidden");
  elements.historyList.classList.remove("hidden");
  elements.historyActions.classList.remove("hidden");
  elements.historyList.innerHTML = summaries.map((summary) => `
      <div class="history-item" data-id="${summary.id}">
        <div class="history-item-header">
          <span class="history-item-title">${escapeHtml(summary.title)}</span>
          <span class="history-item-type ${summary.type}">${summary.type}</span>
        </div>
        <div class="history-item-date">${new Date(summary.createdAt).toLocaleString()}</div>
        <div class="history-item-preview">${escapeHtml(summary.summary.substring(0, 100))}...</div>
      </div>
    `).join("");
  elements.historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const summary = summaries.find((s) => s.id === id);
      if (summary) {
        currentSummary = summary;
        switchTab("main");
        displaySummary(summary);
      }
    });
  });
}
async function handleClearHistory() {
  if (confirm("Are you sure you want to delete all summaries? This cannot be undone.")) {
    await clearAllSummaries();
    await loadHistory();
  }
}
async function handleSaveSettings(e) {
  e.preventDefault();
  const newSettings = {
    apiProvider: elements.apiProvider.value,
    apiKey: elements.apiKey.value.trim()
  };
  await saveSettings(newSettings);
  currentSettings = { ...currentSettings, ...newSettings };
  updateApiKeyWarning();
  elements.settingsSaved.classList.remove("hidden");
  setTimeout(() => {
    elements.settingsSaved.classList.add("hidden");
  }, 3e3);
}
function showLoading(text) {
  elements.loadingText.textContent = text;
  elements.loading.classList.remove("hidden");
  elements.actionButtons.classList.add("hidden");
}
function hideLoading() {
  elements.loading.classList.add("hidden");
  if (!isRecording) {
    elements.actionButtons.classList.remove("hidden");
  }
}
function showError(message) {
  elements.errorText.textContent = message;
  elements.error.classList.remove("hidden");
}
function hideError() {
  elements.error.classList.add("hidden");
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
document.addEventListener("DOMContentLoaded", init);
