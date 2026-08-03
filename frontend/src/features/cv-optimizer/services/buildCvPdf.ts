const PAGE_MARGIN = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const ACCENT_COLOR: [number, number, number] = [79, 70, 229];
const TEXT_COLOR: [number, number, number] = [30, 30, 30];

function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '');
}

export async function buildCvPdf(cvText: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let cursorY = PAGE_MARGIN;
  const ensureSpace = (lineHeight: number) => {
    if (cursorY + lineHeight > PAGE_HEIGHT - PAGE_MARGIN) {
      doc.addPage();
      cursorY = PAGE_MARGIN;
    }
  };

  const lines = cvText.split('\n');
  let isFirstNonEmptyLine = true;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      cursorY += 3;
      continue;
    }

    if (isFirstNonEmptyLine) {
      isFirstNonEmptyLine = false;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...ACCENT_COLOR);
      ensureSpace(9);
      doc.text(stripInlineMarkdown(line), PAGE_MARGIN, cursorY);
      cursorY += 8;
      doc.setDrawColor(...ACCENT_COLOR);
      doc.setLineWidth(0.5);
      doc.line(PAGE_MARGIN, cursorY, PAGE_WIDTH - PAGE_MARGIN, cursorY);
      cursorY += 6;
      continue;
    }

    const headerMatch = line.match(/^\*\*(.+)\*\*$/);
    if (headerMatch) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...ACCENT_COLOR);
      ensureSpace(8);
      doc.text((headerMatch[1] ?? '').toUpperCase(), PAGE_MARGIN, cursorY);
      cursorY += 6;
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const text = stripInlineMarkdown(bulletMatch ? (bulletMatch[1] ?? '') : line);
    const indent = bulletMatch ? PAGE_MARGIN + 4 : PAGE_MARGIN;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_COLOR);

    const wrapped: string[] = doc.splitTextToSize(text, CONTENT_WIDTH - (bulletMatch ? 4 : 0));
    wrapped.forEach((wrappedLine, index) => {
      ensureSpace(5);
      if (bulletMatch && index === 0) {
        doc.text('•', PAGE_MARGIN, cursorY);
      }
      doc.text(wrappedLine, indent, cursorY);
      cursorY += 5;
    });
  }

  return doc;
}

// \p{M} matches Unicode combining marks, which is what accented letters
// decompose into after normalize('NFD') (e.g. "é" -> "e" + combining acute).
const DIACRITIC_MARKS_REGEX = /\p{M}/gu;

export function buildCvFileName(cvText: string): string {
  const firstLine = cvText.split('\n').find((line) => line.trim().length > 0) ?? 'CV';
  const slug = firstLine
    .trim()
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_REGEX, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'CV'}-optimizado.pdf`;
}
