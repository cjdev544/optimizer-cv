import { JOB_OFFER_EXTRACTION_MESSAGE } from '@/shared/lib/messages';

const MAX_TEXT_LENGTH = 15000;

const LIKELY_JOB_DESCRIPTION_SELECTORS = [
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[id*="job-description"]',
  'article',
  'main',
];

export function extractJobOfferText(): string {
  for (const selector of LIKELY_JOB_DESCRIPTION_SELECTORS) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text && text.length > 200) {
      return text.slice(0, MAX_TEXT_LENGTH);
    }
  }

  return document.body.innerText.trim().slice(0, MAX_TEXT_LENGTH);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === JOB_OFFER_EXTRACTION_MESSAGE) {
    sendResponse({ text: extractJobOfferText() });
  }
  return true;
});
