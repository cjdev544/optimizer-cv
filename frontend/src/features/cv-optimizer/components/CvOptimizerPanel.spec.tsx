import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CvOptimizerPanel } from './CvOptimizerPanel';
import * as chromeRuntime from '@/shared/lib/chromeRuntime';
import * as useStoredCvModule from '../hooks/useStoredCv';
import * as useOptimizeCvModule from '../hooks/useOptimizeCv';
import * as useGenerateGreetingModule from '../hooks/useGenerateGreeting';

vi.mock('@/shared/lib/chromeRuntime');
vi.mock('../hooks/useStoredCv');
vi.mock('../hooks/useOptimizeCv');
vi.mock('../hooks/useGenerateGreeting');

function mockStoredCv(overrides: Partial<ReturnType<typeof useStoredCvModule.useStoredCv>> = {}) {
  vi.mocked(useStoredCvModule.useStoredCv).mockReturnValue({
    cvText: 'a'.repeat(60),
    saveCvText: vi.fn(),
    isLoaded: true,
    ...overrides,
  });
}

function mockOptimizeCv(overrides: Partial<ReturnType<typeof useOptimizeCvModule.useOptimizeCv>> = {}) {
  vi.mocked(useOptimizeCvModule.useOptimizeCv).mockReturnValue({
    status: 'idle',
    data: null,
    error: null,
    optimize: vi.fn(),
    reset: vi.fn(),
    isLoading: false,
    ...overrides,
  });
}

function mockGenerateGreeting(overrides: Partial<ReturnType<typeof useGenerateGreetingModule.useGenerateGreeting>> = {}) {
  vi.mocked(useGenerateGreetingModule.useGenerateGreeting).mockReturnValue({
    data: null,
    error: null,
    generate: vi.fn(),
    isLoading: false,
    ...overrides,
  });
}

describe('CvOptimizerPanel', () => {
  beforeEach(() => {
    mockStoredCv();
    mockOptimizeCv();
    mockGenerateGreeting();
    vi.mocked(chromeRuntime.isExtensionContext).mockReturnValue(false);
  });

  it('does not render the CV editor until the stored CV has loaded', () => {
    mockStoredCv({ isLoaded: false });

    render(<CvOptimizerPanel />);

    expect(screen.queryByText(/CV guardado/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tu CV')).not.toBeInTheDocument();
  });

  it('shows the manual job-offer textarea outside of the extension', () => {
    render(<CvOptimizerPanel />);

    expect(screen.getByLabelText('Oferta de empleo')).toBeInTheDocument();
  });

  it('hides the manual job-offer textarea inside the extension', () => {
    vi.mocked(chromeRuntime.isExtensionContext).mockReturnValue(true);

    render(<CvOptimizerPanel />);

    expect(screen.queryByLabelText('Oferta de empleo')).not.toBeInTheDocument();
  });

  it('disables the action buttons when there is no stored CV of at least 50 characters', () => {
    mockStoredCv({ cvText: 'muy corto' });

    render(<CvOptimizerPanel />);

    expect(screen.getByRole('button', { name: /Optimizar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Generar Saludo/ })).toBeDisabled();
  });

  it('shows a capture error and does not call optimize when the manual job offer is too short', async () => {
    const optimize = vi.fn();
    mockOptimizeCv({ optimize });
    const user = userEvent.setup();
    render(<CvOptimizerPanel />);

    await user.click(screen.getByRole('button', { name: /Optimizar/ }));

    expect(await screen.findByText(/Pega el texto de la oferta de empleo/)).toBeInTheDocument();
    expect(optimize).not.toHaveBeenCalled();
  });

  it('calls optimize with the stored CV, manual job offer, and observaciones', async () => {
    const optimize = vi.fn();
    mockOptimizeCv({ optimize });
    const user = userEvent.setup();
    render(<CvOptimizerPanel />);

    await user.type(screen.getByLabelText('Oferta de empleo'), 'b'.repeat(40));
    await user.type(screen.getByLabelText(/Observaciones/), 'nota');
    await user.click(screen.getByRole('button', { name: /Optimizar/ }));

    expect(optimize).toHaveBeenCalledWith({
      cvText: 'a'.repeat(60),
      jobOfferText: 'b'.repeat(40),
      observaciones: 'nota',
    });
  });

  it('extracts the job offer from the active tab inside the extension before optimizing', async () => {
    vi.mocked(chromeRuntime.isExtensionContext).mockReturnValue(true);
    vi.mocked(chromeRuntime.extractJobOfferFromActiveTab).mockResolvedValue('oferta extraída de la pestaña');
    const optimize = vi.fn();
    mockOptimizeCv({ optimize });
    const user = userEvent.setup();
    render(<CvOptimizerPanel />);

    await user.click(screen.getByRole('button', { name: /Optimizar/ }));

    expect(optimize).toHaveBeenCalledWith(
      expect.objectContaining({ jobOfferText: 'oferta extraída de la pestaña' }),
    );
  });

  it('shows the capture error when extracting the job offer fails inside the extension', async () => {
    vi.mocked(chromeRuntime.isExtensionContext).mockReturnValue(true);
    vi.mocked(chromeRuntime.extractJobOfferFromActiveTab).mockRejectedValue(
      new Error('No se pudo extraer el contenido de la oferta en esta página.'),
    );
    const optimize = vi.fn();
    mockOptimizeCv({ optimize });
    const user = userEvent.setup();
    render(<CvOptimizerPanel />);

    await user.click(screen.getByRole('button', { name: /Optimizar/ }));

    expect(
      await screen.findByText('No se pudo extraer el contenido de la oferta en esta página.'),
    ).toBeInTheDocument();
    expect(optimize).not.toHaveBeenCalled();
  });

  it('shows the optimize error message returned by the hook', () => {
    mockOptimizeCv({ error: 'El proveedor de IA no devolvió contenido.' });

    render(<CvOptimizerPanel />);

    expect(screen.getByText('El proveedor de IA no devolvió contenido.')).toBeInTheDocument();
  });

  it('shows the ATS score panel and the optimized result once optimization succeeds', async () => {
    // The ATS panel needs both the optimized text (from the hook) AND a
    // score snapshot, which the component only captures at the moment the
    // user submits — so the flow has to be driven through a real click.
    mockOptimizeCv({ status: 'success', data: 'cv optimizado con react y typescript' });
    const user = userEvent.setup();
    render(<CvOptimizerPanel />);

    await user.type(screen.getByLabelText('Oferta de empleo'), 'b'.repeat(40));
    await user.click(screen.getByRole('button', { name: /Optimizar/ }));

    expect(screen.getByText('Score de Coincidencia ATS')).toBeInTheDocument();
    expect(screen.getByText('CV Optimizado')).toBeInTheDocument();
  });

  it('shows the greeting result once a greeting is generated', () => {
    mockGenerateGreeting({ data: 'Hola, vi la oferta...' });

    render(<CvOptimizerPanel />);

    expect(screen.getByText('Saludo Personalizado')).toBeInTheDocument();
  });

  it('calls generate with the stored CV and manual job offer', async () => {
    const generate = vi.fn();
    mockGenerateGreeting({ generate });
    const user = userEvent.setup();
    render(<CvOptimizerPanel />);

    await user.type(screen.getByLabelText('Oferta de empleo'), 'b'.repeat(40));
    await user.click(screen.getByRole('button', { name: /Generar Saludo/ }));

    expect(generate).toHaveBeenCalledWith({ cvText: 'a'.repeat(60), jobOfferText: 'b'.repeat(40) });
  });
});
