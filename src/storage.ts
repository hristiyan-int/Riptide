import type { Settings, Summary } from './types';

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  apiProvider: 'openai',
  consentGiven: false,
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...settings } });
}

export async function getSummaries(): Promise<Summary[]> {
  const result = await chrome.storage.local.get('summaries');
  return result.summaries || [];
}

export async function saveSummary(summary: Summary): Promise<void> {
  const summaries = await getSummaries();
  summaries.unshift(summary);
  // Keep only the last 50 summaries
  if (summaries.length > 50) {
    summaries.pop();
  }
  await chrome.storage.local.set({ summaries });
}

export async function deleteSummary(id: string): Promise<void> {
  const summaries = await getSummaries();
  const filtered = summaries.filter(s => s.id !== id);
  await chrome.storage.local.set({ summaries: filtered });
}

export async function clearAllSummaries(): Promise<void> {
  await chrome.storage.local.set({ summaries: [] });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
