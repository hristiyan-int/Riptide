// src/background.ts
var offscreenDocumentExists = false;
var recordingState = {
  isRecording: false,
  tabId: null,
  startTime: null
};
async function ensureOffscreenDocument() {
  if (offscreenDocumentExists)
    return;
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
    });
    if (existingContexts.length > 0) {
      offscreenDocumentExists = true;
      return;
    }
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Recording audio from tab for transcription"
    });
    offscreenDocumentExists = true;
  } catch (error) {
    console.error("Failed to create offscreen document:", error);
    throw error;
  }
}
async function closeOffscreenDocument() {
  if (!offscreenDocumentExists)
    return;
  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentExists = false;
  } catch (error) {
    console.error("Failed to close offscreen document:", error);
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});
async function handleMessage(message, _sender, sendResponse) {
  try {
    switch (message.type) {
      case "START_CAPTURE": {
        const { tabId } = message.payload;
        const streamId = await new Promise((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId(
            { targetTabId: tabId },
            (id) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(id);
              }
            }
          );
        });
        await ensureOffscreenDocument();
        const startResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: "OFFSCREEN_START_RECORDING",
            payload: { streamId }
          }, resolve);
        });
        recordingState.isRecording = true;
        recordingState.tabId = tabId;
        recordingState.startTime = Date.now();
        sendResponse({ success: true });
        break;
      }
      case "STOP_CAPTURE": {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: "OFFSCREEN_STOP_RECORDING"
          }, resolve);
        });
        recordingState.isRecording = false;
        recordingState.tabId = null;
        recordingState.startTime = null;
        await closeOffscreenDocument();
        sendResponse(response);
        break;
      }
      case "GET_CAPTURE_STATUS": {
        const duration = recordingState.startTime ? Math.floor((Date.now() - recordingState.startTime) / 1e3) : 0;
        sendResponse({
          success: true,
          data: {
            isRecording: recordingState.isRecording,
            duration
          }
        });
        break;
      }
      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }
  } catch (error) {
    console.error("Background script error:", error);
    sendResponse({ success: false, error: String(error) });
  }
}
chrome.runtime.onSuspend.addListener(() => {
  closeOffscreenDocument();
});
