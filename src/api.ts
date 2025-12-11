import type { Settings, SummaryResult } from './types';

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

export async function summarizeText(
  text: string,
  settings: Settings
): Promise<SummaryResult> {
  if (!settings.apiKey) {
    throw new Error('API key not configured. Please add your API key in settings.');
  }

  // Truncate text if too long (roughly 100k chars for safety)
  const truncatedText = text.length > 100000 ? text.substring(0, 100000) + '...[truncated]' : text;
  const prompt = SUMMARY_PROMPT + truncatedText;

  if (settings.apiProvider === 'anthropic') {
    return callAnthropic(prompt, settings.apiKey);
  } else {
    return callOpenAI(prompt, settings.apiKey);
  }
}

async function callOpenAI(prompt: string, apiKey: string): Promise<SummaryResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes content. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return parseJsonResponse(content);
}

async function callAnthropic(prompt: string, apiKey: string): Promise<SummaryResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  if (!content) {
    throw new Error('No response from Anthropic');
  }

  return parseJsonResponse(content);
}

function parseJsonResponse(content: string): SummaryResult {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // If wrapped in markdown code blocks, extract
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || 'No summary available',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    };
  } catch {
    // If JSON parsing fails, return a basic structure with the raw text
    return {
      summary: content.substring(0, 500),
      keyPoints: [],
      actionItems: [],
      decisions: [],
    };
  }
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Whisper API error: ${response.status}`);
  }

  return response.text();
}
