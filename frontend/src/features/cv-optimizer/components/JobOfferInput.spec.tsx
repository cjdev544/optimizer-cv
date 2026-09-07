import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobOfferInput } from './JobOfferInput';

describe('JobOfferInput', () => {
  it('shows the current value', () => {
    render(<JobOfferInput value="texto de la oferta" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Oferta de empleo')).toHaveValue('texto de la oferta');
  });

  it('calls onChange when the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<JobOfferInput value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Oferta de empleo'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });
});
