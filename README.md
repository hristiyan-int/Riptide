# Meeting Summarizer Chrome Extension

A Chrome extension that summarizes web pages and meeting audio using AI.

## Features

- **Page Summarization**: Extract and summarize text from any web page
- **Meeting Recording**: Capture audio from browser tabs (Google Meet, Teams web, Zoom web, etc.)
- **AI-Powered Summaries**: Get structured summaries with key points, action items, and decisions
- **Local History**: View and manage past summaries
- **Multiple AI Providers**: Support for OpenAI and Anthropic APIs

## Installation

### 1. Build the Extension

```bash
cd meeting-summarizer
npm install
npm run build
```

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

### 3. Configure API Key

1. Click the extension icon in your toolbar
2. Go to the "Settings" tab
3. Select your AI provider (OpenAI or Anthropic)
4. Enter your API key
5. Click "Save Settings"

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

## Usage

### Summarize a Web Page

1. Navigate to any web page you want to summarize
2. Click the extension icon
3. Accept the consent modal (first time only)
4. Click "Summarize This Page"
5. Wait for the AI to process and display the summary

### Record and Summarize a Meeting

1. Join a web-based meeting (Google Meet, Teams, Zoom, etc.)
2. Click the extension icon
3. Click "Record Meeting"
4. The extension will capture tab audio
5. When done, click "Stop & Summarize"
6. The audio will be transcribed and summarized

**Note:** Audio transcription requires an OpenAI API key (uses Whisper API).

### View History

1. Click the extension icon
2. Go to the "History" tab
3. Click any summary to view it again
4. Use "Clear All History" to delete all summaries

## Project Structure

```
meeting-summarizer/
├── src/
│   ├── api.ts          # API calls to OpenAI/Anthropic
│   ├── background.ts   # Service worker for audio capture
│   ├── content.ts      # Content script for page extraction
│   ├── offscreen.ts    # Offscreen document for recording
│   ├── popup.ts        # Main popup UI logic
│   ├── popup.html      # Popup HTML structure
│   ├── popup.css       # Popup styles
│   ├── storage.ts      # Chrome storage utilities
│   └── types.ts        # TypeScript type definitions
├── public/
│   ├── manifest.json   # Chrome extension manifest
│   └── icon*.png       # Extension icons
├── dist/               # Built extension (load this in Chrome)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Clean build artifacts
npm run clean
```

## API Costs (Estimated)

| Service | Cost | Notes |
|---------|------|-------|
| OpenAI Whisper | ~$0.006/min | Audio transcription |
| GPT-4o-mini | ~$0.01-0.05 | Per summary |
| Claude Haiku | ~$0.01-0.03 | Per summary |

A 30-minute meeting costs approximately $0.20-0.25 to transcribe and summarize.

## Privacy & Security

- All data is stored locally in your browser
- API keys are stored in Chrome's local storage
- Audio is transcribed and then discarded (not stored)
- No data is sent to any servers other than your chosen AI provider
- Consent is required before any capture begins

## Limitations

- Audio capture only works for browser tabs (not desktop apps)
- Maximum audio file size for Whisper API is 25MB
- Some websites may block content extraction
- Requires user interaction to start capture (Chrome security requirement)

## Troubleshooting

**"API key not configured" error**
- Go to Settings and add your API key

**Page summarization returns no content**
- Some pages (PDFs, heavily JS-rendered) may not extract well
- Try refreshing the page before summarizing

**Audio recording not working**
- Ensure you're on a tab with audio playing
- Check that the tab isn't muted
- Make sure you have an OpenAI API key configured

**Extension icon not appearing**
- Click the puzzle piece icon in Chrome toolbar
- Pin the Meeting Summarizer extension

## License

MIT
