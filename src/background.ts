// Background service worker for Meeting Summarizer

let offscreenDocumentExists = false;

interface AppRecordingState {
  isRecording: boolean;
  tabId: number | null;
  startTime: number | null;
}

const recordingState: AppRecordingState = {
  isRecording: false,
  tabId: null,
  startTime: null,
};

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenDocumentExists) return;

  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });

    if (existingContexts.length > 0) {
      offscreenDocumentExists = true;
      return;
    }

    // Create the offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Recording audio from tab for transcription',
    });

    offscreenDocumentExists = true;
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
    throw error;
  }
}

async function closeOffscreenDocument(): Promise<void> {
  if (!offscreenDocumentExists) return;

  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentExists = false;
  } catch (error) {
    console.error('Failed to close offscreen document:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(
  message: { type: string; payload?: unknown },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case 'START_CAPTURE': {
        const { tabId } = message.payload as { tabId: number };

        // Get the media stream ID for the tab
        const streamId = await new Promise<string>((resolve, reject) => {
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

        // Ensure offscreen document exists
        await ensureOffscreenDocument();

        // Send message to offscreen document to start recording
        // Use a promise wrapper for the response
        const startResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'OFFSCREEN_START_RECORDING',
            payload: { streamId },
          }, resolve);
        });

        recordingState.isRecording = true;
        recordingState.tabId = tabId;
        recordingState.startTime = Date.now();

        sendResponse({ success: true });
        break;
      }

      case 'STOP_CAPTURE': {
        // Send message to offscreen document to stop recording
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'OFFSCREEN_STOP_RECORDING',
          }, resolve);
        });

        recordingState.isRecording = false;
        recordingState.tabId = null;
        recordingState.startTime = null;

        // Close offscreen document after getting the recording
        await closeOffscreenDocument();

        sendResponse(response);
        break;
      }

      case 'GET_CAPTURE_STATUS': {
        const duration = recordingState.startTime
          ? Math.floor((Date.now() - recordingState.startTime) / 1000)
          : 0;

        sendResponse({
          success: true,
          data: {
            isRecording: recordingState.isRecording,
            duration,
          },
        });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Background script error:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  closeOffscreenDocument();
});
