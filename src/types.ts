export interface Settings {
  apiKey: string;
  apiProvider: 'openai' | 'anthropic';
  consentGiven: boolean;
}

export interface Summary {
  id: string;
  type: 'page' | 'meeting';
  title: string;
  url: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  transcript?: string;
  createdAt: number;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}

export interface Message {
  type: 'GET_PAGE_CONTENT' | 'START_CAPTURE' | 'STOP_CAPTURE' | 'CAPTURE_STATUS';
  payload?: unknown;
}

export interface PageContent {
  title: string;
  url: string;
  text: string;
}

export interface CaptureState {
  isRecording: boolean;
  duration: number;
}
