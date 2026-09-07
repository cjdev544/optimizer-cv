import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorageItem, setStorageItem } from './storage';
import * as chromeRuntime from './chromeRuntime';

vi.mock('./chromeRuntime');

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('outside of an extension context', () => {
  beforeEach(() => {
    vi.mocked(chromeRuntime.isExtensionContext).mockReturnValue(false);
  });

  it('getStorageItem reads from localStorage', async () => {
    localStorage.setItem('my-key', 'my-value');

    expect(await getStorageItem('my-key')).toBe('my-value');
  });

  it('getStorageItem returns null when the key is not set', async () => {
    expect(await getStorageItem('missing-key')).toBeNull();
  });

  it('setStorageItem writes to localStorage', async () => {
    await setStorageItem('my-key', 'my-value');

    expect(localStorage.getItem('my-key')).toBe('my-value');
  });
});

describe('inside an extension context', () => {
  beforeEach(() => {
    vi.mocked(chromeRuntime.isExtensionContext).mockReturnValue(true);
  });

  it('getStorageItem reads from chrome.storage.local', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn().mockResolvedValue({ 'my-key': 'my-value' }) } } });

    expect(await getStorageItem('my-key')).toBe('my-value');
  });

  it('getStorageItem returns null when chrome.storage.local has no value for the key', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn().mockResolvedValue({}) } } });

    expect(await getStorageItem('missing-key')).toBeNull();
  });

  it('setStorageItem writes to chrome.storage.local', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { set } } });

    await setStorageItem('my-key', 'my-value');

    expect(set).toHaveBeenCalledWith({ 'my-key': 'my-value' });
  });

  it('does not touch localStorage when in an extension context', async () => {
    vi.stubGlobal('chrome', { storage: { local: { set: vi.fn().mockResolvedValue(undefined) } } });

    await setStorageItem('my-key', 'my-value');

    expect(localStorage.getItem('my-key')).toBeNull();
  });
});
