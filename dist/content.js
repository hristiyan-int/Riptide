"use strict";
(() => {
  // src/content.ts
  function extractPageContent() {
    const title = document.title || "Untitled Page";
    const url = window.location.href;
    let text = "";
    const articleSelectors = [
      "article",
      "main",
      '[role="main"]',
      ".post-content",
      ".article-content",
      ".entry-content",
      ".content",
      "#content"
    ];
    for (const selector of articleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 200) {
        text = cleanText(element.textContent);
        break;
      }
    }
    if (!text) {
      const body = document.body.cloneNode(true);
      const noiseSelectors = [
        "script",
        "style",
        "nav",
        "header",
        "footer",
        "aside",
        ".sidebar",
        ".navigation",
        ".menu",
        ".comments",
        ".advertisement",
        ".ad",
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]'
      ];
      noiseSelectors.forEach((selector) => {
        body.querySelectorAll(selector).forEach((el) => el.remove());
      });
      text = cleanText(body.textContent || "");
    }
    return { title, url, text };
  }
  function cleanText(text) {
    return text.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim().substring(0, 5e4);
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_PAGE_CONTENT") {
      try {
        const content = extractPageContent();
        sendResponse({ success: true, data: content });
      } catch (error) {
        sendResponse({ success: false, error: String(error) });
      }
    }
    return true;
  });
})();
