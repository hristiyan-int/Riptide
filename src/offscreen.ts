// Offscreen document for audio recording

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let mediaStream: MediaStream | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  processMessage(message, sendResponse);
  return true;
});

async function processMessage(
  message: { type: string; payload?: unknown },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case 'OFFSCREEN_START_RECORDING': {
        const { streamId } = message.payload as { streamId: string };
        await startRecording(streamId);
        sendResponse({ success: true });
        break;
      }

      case 'OFFSCREEN_STOP_RECORDING': {
        const audioBlob = await stopRecording();
        if (audioBlob) {
          // Convert blob to base64 for transfer
          const base64 = await blobToBase64(audioBlob);
          sendResponse({
            success: true,
            data: {
              audio: base64,
              mimeType: audioBlob.type,
            },
          });
        } else {
          sendResponse({ success: false, error: 'No recording available' });
        }
        break;
      }

      default:
        // Ignore unknown messages
        break;
    }
  } catch (error) {
    console.error('Offscreen error:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function startRecording(streamId: string): Promise<void> {
  // Clean up any existing recording
  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  audioChunks = [];

  // Get the media stream from the tab
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    } as MediaTrackConstraints,
    video: false,
  });

  // Create media recorder
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(mediaStream, {
    mimeType,
    audioBitsPerSecond: 128000,
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error('MediaRecorder error:', event);
  };

  // Start recording with 10 second chunks
  mediaRecorder.start(10000);
}

async function stopRecording(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(audioChunks.length > 0 ? new Blob(audioChunks, { type: 'audio/webm' }) : null);
      return;
    }

    mediaRecorder.onstop = () => {
      // Stop all tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }

      // Create the final blob
      const blob = audioChunks.length > 0
        ? new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
        : null;

      mediaRecorder = null;
      audioChunks = [];

      resolve(blob);
    };

    mediaRecorder.stop();
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
