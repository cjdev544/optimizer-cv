import { useCallback, useEffect, useState } from 'react';
import { getStorageItem, setStorageItem } from '@/shared/lib/storage';

const CV_STORAGE_KEY = 'cv-optimizer:cv-text';

export function useStoredCv() {
  const [cvText, setCvText] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStorageItem(CV_STORAGE_KEY).then((stored) => {
      if (!cancelled) {
        setCvText(stored ?? '');
        setIsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCvText = useCallback(async (text: string) => {
    await setStorageItem(CV_STORAGE_KEY, text);
    setCvText(text);
  }, []);

  return { cvText, saveCvText, isLoaded };
}
