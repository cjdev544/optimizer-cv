import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GreetingResultPanel } from './GreetingResultPanel';

describe('GreetingResultPanel', () => {
  it('shows the greeting text in the textarea', () => {
    render(<GreetingResultPanel greetingText="Hola, vi la oferta..." onChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('Hola, vi la oferta...');
  });

  it('calls onChange when the user edits the text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<GreetingResultPanel greetingText="" onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders a copy button', () => {
    render(<GreetingResultPanel greetingText="saludo" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Copiar/ })).toBeInTheDocument();
  });
});
