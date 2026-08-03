import { IPiiMaskingService, PiiMaskingResult } from '../../domain/ports/IPiiMaskingService';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Amplio a propósito (heurística): captura secuencias con al menos un dígito
// y separadores típicos de teléfono. Se valida por cantidad de dígitos después,
// no solo por la forma, para reducir falsos positivos con fechas o porcentajes.
const PHONE_CANDIDATE_REGEX = /\+?\d[\d\s().-]{6,}\d/g;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

// Palabras clave de dirección en varios idiomas, ya que el motor de IA es multilingüe.
const ADDRESS_KEYWORD_REGEX =
  /\b(calle|avenida|av\.|address|street|st\.|stra(ß|ss)e|rue|rua|direcci[oó]n)\b/i;

// Convención ya usada en el generador de PDF: la primera línea no vacía del CV
// es, por convención, el nombre del candidato.
const NAME_LINE_REGEX = /^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'-]+(\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'-]+){1,4}$/;

/**
 * Enmascarado de PII basado en heurísticas (regex + convenciones de formato de CV),
 * pensado como capa de defensa en profundidad antes de enviar texto a un proveedor
 * de IA de terceros. No reemplaza una revisión legal ni un motor de NER real: nombres
 * de terceros mencionados en el cuerpo del CV, o direcciones con formatos atípicos,
 * pueden no detectarse.
 */
export class RegexPiiMaskingService implements IPiiMaskingService {
  mask(text: string): PiiMaskingResult {
    const mapping: Record<string, string> = {};
    let counter = 0;
    const nextPlaceholder = () => `§${counter++}§`;

    let maskedText = text;
    maskedText = this.applyMasking(maskedText, this.detectCandidateName(text), nextPlaceholder, mapping);
    maskedText = this.applyMasking(maskedText, maskedText.match(EMAIL_REGEX) ?? [], nextPlaceholder, mapping);
    maskedText = this.applyMasking(maskedText, this.detectPhones(maskedText), nextPlaceholder, mapping);
    maskedText = this.applyMasking(maskedText, this.detectAddresses(maskedText), nextPlaceholder, mapping);

    return { maskedText, mapping };
  }

  unmask(text: string, mapping: Record<string, string>): string {
    return Object.entries(mapping).reduce(
      (result, [placeholder, original]) => result.split(placeholder).join(original),
      text,
    );
  }

  /**
   * Los placeholders son símbolos opacos (§0§, §1§, ...) en vez de palabras
   * entre corchetes como [DIRECCION]. Se probó ese formato legible y, con el
   * motor multilingüe, el modelo a veces lo "traducía" (ej. [DIRECCION] -> [ADDRESS]),
   * rompiendo la restauración exacta. Un símbolo sin contenido lingüístico no
   * le da al modelo nada que "traducir".
   */
  private applyMasking(
    text: string,
    values: string[],
    nextPlaceholder: () => string,
    mapping: Record<string, string>,
  ): string {
    const uniqueValues = Array.from(new Set(values.filter((value) => value.trim().length > 0)));
    if (uniqueValues.length === 0) return text;

    let result = text;
    uniqueValues.forEach((value) => {
      const placeholder = nextPlaceholder();
      mapping[placeholder] = value;
      result = result.split(value).join(placeholder);
    });

    return result;
  }

  private detectCandidateName(text: string): string[] {
    const firstLine = text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!firstLine || !NAME_LINE_REGEX.test(firstLine)) return [];
    return [firstLine];
  }

  private detectPhones(text: string): string[] {
    const candidates = text.match(PHONE_CANDIDATE_REGEX) ?? [];
    return candidates.filter((candidate) => {
      const digitCount = candidate.replace(/\D/g, '').length;
      return digitCount >= MIN_PHONE_DIGITS && digitCount <= MAX_PHONE_DIGITS;
    });
  }

  private detectAddresses(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && ADDRESS_KEYWORD_REGEX.test(line) && /\d/.test(line));
  }
}
