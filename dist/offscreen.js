import "./chunks/modulepreload-polyfill.js";
let mediaRecorder = null;
let audioChunks = [];
let mediaStream = null;
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  processMessage(message, sendResponse);
  return true;
});
async function processMessage(message, sendResponse) {
  try {
    switch (message.type) {
      case "OFFSCREEN_START_RECORDING": {
        const { streamId } = message.payload;
        await startRecording(streamId);
        sendResponse({ success: true });
        break;
      }
      case "OFFSCREEN_STOP_RECORDING": {
        const audioBlob = await stopRecording();
        if (audioBlob) {
          const base64 = await blobToBase64(audioBlob);
          sendResponse({
            success: true,
            data: {
              audio: base64,
              mimeType: audioBlob.type
            }
          });
        } else {
          sendResponse({ success: false, error: "No recording available" });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Offscreen error:", error);
    sendResponse({ success: false, error: String(error) });
  }
}
async function startRecording(streamId) {
  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  audioChunks = [];
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
  mediaRecorder = new MediaRecorder(mediaStream, {
    mimeType,
    audioBitsPerSecond: 128e3
  });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };
  mediaRecorder.onerror = (event) => {
    console.error("MediaRecorder error:", event);
  };
  mediaRecorder.start(1e4);
}
async function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      resolve(audioChunks.length > 0 ? new Blob(audioChunks, { type: "audio/webm" }) : null);
      return;
    }
    mediaRecorder.onstop = () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      const blob = audioChunks.length > 0 ? new Blob(audioChunks, { type: (mediaRecorder == null ? void 0 : mediaRecorder.mimeType) || "audio/webm" }) : null;
      mediaRecorder = null;
      audioChunks = [];
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
