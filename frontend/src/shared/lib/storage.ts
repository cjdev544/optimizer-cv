import { isExtensionContext } from './chromeRuntime';

export async function getStorageItem(key: string): Promise<string | null> {
  if (isExtensionContext()) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  }
  return window.localStorage.getItem(key);
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  if (isExtensionContext()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  window.localStorage.setItem(key, value);
}
