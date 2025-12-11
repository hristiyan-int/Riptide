import type { PageContent } from './types';

function extractPageContent(): PageContent {
  // Get the page title
  const title = document.title || 'Untitled Page';
  const url = window.location.href;

  // Try to get the main content
  let text = '';

  // Priority 1: Look for article or main content
  const articleSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
  ];

  for (const selector of articleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 200) {
      text = cleanText(element.textContent);
      break;
    }
  }

  // Priority 2: Fall back to body content, excluding noise
  if (!text) {
    const body = document.body.cloneNode(true) as HTMLElement;

    // Remove noise elements
    const noiseSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      '.sidebar',
      '.navigation',
      '.menu',
      '.comments',
      '.advertisement',
      '.ad',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="complementary"]',
    ];

    noiseSelectors.forEach(selector => {
      body.querySelectorAll(selector).forEach(el => el.remove());
    });

    text = cleanText(body.textContent || '');
  }

  return { title, url, text };
}

function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim()
    // Limit length to avoid huge payloads
    .substring(0, 50000);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, data: content });
    } catch (error) {
      sendResponse({ success: false, error: String(error) });
    }
  }
  return true; // Keep message channel open for async response
});
