import { JOB_OFFER_EXTRACTION_MESSAGE, JobOfferExtractionResponse } from './messages';

export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

export async function extractJobOfferFromActiveTab(): Promise<string> {
  if (!isExtensionContext()) {
    throw new Error(
      'La captura automática solo está disponible dentro de la extensión de Chrome.',
    );
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    throw new Error('No se encontró una pestaña activa.');
  }

  const response = (await chrome.tabs.sendMessage(activeTab.id, {
    type: JOB_OFFER_EXTRACTION_MESSAGE,
  })) as JobOfferExtractionResponse | undefined;

  if (!response?.text) {
    throw new Error('No se pudo extraer el contenido de la oferta en esta página.');
  }

  return response.text;
}
