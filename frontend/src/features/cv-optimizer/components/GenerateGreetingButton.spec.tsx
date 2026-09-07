import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GenerateGreetingButton } from './GenerateGreetingButton';

describe('GenerateGreetingButton', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<GenerateGreetingButton onClick={onClick} isLoading={false} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalled();
  });

  it('shows a loading label and disables the button while loading', () => {
    render(<GenerateGreetingButton onClick={vi.fn()} isLoading={true} />);

    expect(screen.getByRole('button', { name: /Generando saludo/ })).toBeDisabled();
  });

  it('is disabled when disabled is true', () => {
    render(<GenerateGreetingButton onClick={vi.fn()} isLoading={false} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
