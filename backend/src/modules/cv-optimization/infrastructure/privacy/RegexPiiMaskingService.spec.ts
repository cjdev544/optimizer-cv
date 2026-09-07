import { describe, expect, it } from 'vitest';
import { RegexPiiMaskingService } from './RegexPiiMaskingService';

describe('RegexPiiMaskingService', () => {
  const service = new RegexPiiMaskingService();

  describe('mask / unmask round-trip', () => {
    it('returns the text unchanged when there is no PII', () => {
      const text = 'Resumen profesional\nDesarrollador con experiencia en TypeScript y React.';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).toBe(text);
      expect(mapping).toEqual({});
    });

    it('masks and unmasks back to the exact original text', () => {
      const text = [
        'Juan Pérez',
        'Calle Falsa 123, Madrid',
        'juan.perez@example.com',
        '+34 612 345 678',
        '',
        'Experiencia en desarrollo backend.',
      ].join('\n');

      const { maskedText, mapping } = service.mask(text);
      const restored = service.unmask(maskedText, mapping);

      expect(restored).toBe(text);
    });
  });

  describe('email detection', () => {
    it('masks an email address', () => {
      const text = 'Contáctame en john.doe@example.com para más info.';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).not.toContain('john.doe@example.com');
      expect(Object.values(mapping)).toContain('john.doe@example.com');
    });

    it('masks every occurrence of the same email with the same placeholder', () => {
      const text = 'Email: dev@example.com. Repetir: dev@example.com.';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).not.toContain('dev@example.com');
      expect(Object.values(mapping).filter((value) => value === 'dev@example.com')).toHaveLength(1);
      const placeholders = Object.keys(mapping).filter((key) => mapping[key] === 'dev@example.com');
      expect(placeholders).toHaveLength(1);
      // The single placeholder must appear twice in the masked text (once per occurrence).
      const occurrences = maskedText.split(placeholders[0]!).length - 1;
      expect(occurrences).toBe(2);
    });
  });

  describe('phone detection', () => {
    it('masks a plausible phone number', () => {
      const text = 'Teléfono: +34 612 345 678';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).not.toContain('612 345 678');
      expect(Object.values(mapping)).toContain('+34 612 345 678');
    });

    it('does not mask a candidate with fewer than 7 digits', () => {
      const text = 'Código postal: 12-34-56';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).toBe(text);
      expect(mapping).toEqual({});
    });

    it('does not mask a candidate with more than 15 digits', () => {
      const text = 'Referencia: 1234567890123456789';

      const { maskedText } = service.mask(text);

      expect(maskedText).toBe(text);
    });

    it('does not mask a year range such as "2011 - 2018"', () => {
      const text = 'Experiencia laboral 2011 - 2018 en una empresa de software.';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).toBe(text);
      expect(mapping).toEqual({});
    });

    it('does not let a year range swallow a duration written in parentheses', () => {
      const text = 'Empresa X, 2011 - 2018 (7 años)';

      const { maskedText } = service.mask(text);

      expect(maskedText).toBe(text);
    });
  });

  describe('address detection', () => {
    it('masks a line with an address keyword and a number', () => {
      const text = 'Dirección:\nCalle Falsa 123, Springfield';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).not.toContain('Calle Falsa 123, Springfield');
      expect(Object.values(mapping)).toContain('Calle Falsa 123, Springfield');
    });

    it('does not mask an address keyword without any digit in the line', () => {
      const text = 'Disponible para reubicación, cerca de la avenida principal.';

      const { maskedText } = service.mask(text);

      expect(maskedText).toBe(text);
    });

    it('recognizes address keywords in other languages', () => {
      const text = '123 Main Street, Springfield';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText).not.toContain(text);
      expect(Object.values(mapping)).toContain(text);
    });
  });

  describe('candidate name detection', () => {
    it('masks the first non-empty line when it looks like "Firstname Lastname"', () => {
      const text = 'Juan Pérez\nDesarrollador de software';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText.startsWith('Juan Pérez')).toBe(false);
      expect(Object.values(mapping)).toContain('Juan Pérez');
    });

    it('does not treat a lowercase first line as a name', () => {
      const text = 'curriculum vitae\nJuan Pérez';

      const { maskedText, mapping } = service.mask(text);

      expect(maskedText.startsWith('curriculum vitae')).toBe(true);
      expect(Object.values(mapping)).not.toContain('curriculum vitae');
    });

    it('does not treat a single all-caps word as a name', () => {
      const text = 'DEVELOPER\nResumen profesional';

      const { maskedText } = service.mask(text);

      expect(maskedText.startsWith('DEVELOPER')).toBe(true);
    });

    it('skips leading blank lines to find the first real line', () => {
      const text = '\n\nJuan Pérez\nDesarrollador';

      const { mapping } = service.mask(text);

      expect(Object.values(mapping)).toContain('Juan Pérez');
    });
  });

  describe('unmask', () => {
    it('replaces every placeholder with its original value', () => {
      const masked = 'Hola §0§, tu email es §1§';
      const mapping = { '§0§': 'Juan Pérez', '§1§': 'juan@example.com' };

      const result = service.unmask(masked, mapping);

      expect(result).toBe('Hola Juan Pérez, tu email es juan@example.com');
    });

    it('replaces every occurrence of a repeated placeholder', () => {
      const masked = '§0§ ... firma: §0§';
      const mapping = { '§0§': 'juan@example.com' };

      const result = service.unmask(masked, mapping);

      expect(result).toBe('juan@example.com ... firma: juan@example.com');
    });

    it('returns the text unchanged when the mapping is empty', () => {
      const text = 'Sin datos personales aquí.';

      expect(service.unmask(text, {})).toBe(text);
    });
  });
});
