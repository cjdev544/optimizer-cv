import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptimizeButton } from './OptimizeButton';

describe('OptimizeButton', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<OptimizeButton onClick={onClick} isLoading={false} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalled();
  });

  it('shows a loading label and disables the button while loading', () => {
    render(<OptimizeButton onClick={vi.fn()} isLoading={true} />);

    expect(screen.getByRole('button', { name: /Optimizando/ })).toBeDisabled();
  });

  it('is disabled when disabled is true, even if not loading', () => {
    render(<OptimizeButton onClick={vi.fn()} isLoading={false} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is enabled by default when not loading and not disabled', () => {
    render(<OptimizeButton onClick={vi.fn()} isLoading={false} />);

    expect(screen.getByRole('button')).toBeEnabled();
  });
});
