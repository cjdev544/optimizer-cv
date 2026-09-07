import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptimizedResultPanel } from './OptimizedResultPanel';

describe('OptimizedResultPanel', () => {
  it('shows the optimized CV text in the textarea', () => {
    render(<OptimizedResultPanel optimizedCvText="cv optimizado" onChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('cv optimizado');
  });

  it('calls onChange when the user edits the text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OptimizedResultPanel optimizedCvText="" onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders a copy button and a download button', () => {
    render(<OptimizedResultPanel optimizedCvText="cv" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Copiar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeInTheDocument();
  });
});
