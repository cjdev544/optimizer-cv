import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObservationsInput } from './ObservationsInput';

describe('ObservationsInput', () => {
  it('shows the current value', () => {
    render(<ObservationsInput value="no menciones Angular" onChange={vi.fn()} />);

    expect(screen.getByLabelText(/Observaciones/)).toHaveValue('no menciones Angular');
  });

  it('calls onChange when the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ObservationsInput value="" onChange={onChange} />);

    await user.type(screen.getByLabelText(/Observaciones/), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });
});
