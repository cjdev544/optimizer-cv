import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadPdfButton } from './DownloadPdfButton';
import * as buildCvPdfModule from '../services/buildCvPdf';

vi.mock('../services/buildCvPdf');

describe('DownloadPdfButton', () => {
  it('builds and saves the PDF using the CV text when clicked', async () => {
    const save = vi.fn();
    vi.mocked(buildCvPdfModule.buildCvPdf).mockResolvedValue({ save } as never);
    vi.mocked(buildCvPdfModule.buildCvFileName).mockReturnValue('Juan-Perez-optimizado.pdf');
    const user = userEvent.setup();
    render(<DownloadPdfButton cvText="cv text" />);

    await user.click(screen.getByRole('button'));

    expect(buildCvPdfModule.buildCvPdf).toHaveBeenCalledWith('cv text');
    expect(save).toHaveBeenCalledWith('Juan-Perez-optimizado.pdf');
  });

  it('shows a generating label while the PDF is being built', async () => {
    let resolveBuild!: (doc: { save: () => void }) => void;
    vi.mocked(buildCvPdfModule.buildCvPdf).mockReturnValue(
      new Promise((resolve) => {
        resolveBuild = resolve;
      }) as never,
    );
    const user = userEvent.setup();
    render(<DownloadPdfButton cvText="cv text" />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button', { name: 'Generando…' })).toBeDisabled();

    resolveBuild({ save: vi.fn() });
    expect(await screen.findByRole('button', { name: 'Descargar PDF' })).toBeEnabled();
  });
});
