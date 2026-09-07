import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyToClipboardButton } from './CopyToClipboardButton';

// user-event's own setup() installs a navigator.clipboard stub (jsdom has no
// real one) — spy on THAT object instead of pre-defining our own, or setup()
// silently overwrites whatever we put there first.

describe('CopyToClipboardButton', () => {
  it('copies the given text to the clipboard when clicked', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CopyToClipboardButton text="texto a copiar" />);

    await user.click(screen.getByRole('button'));

    expect(writeText).toHaveBeenCalledWith('texto a copiar');
  });

  it(
    'shows a confirmation label after copying, then reverts after 2 seconds',
    async () => {
      // Real timers: user-event's own click simulation does not play well
      // with fake timers, so the 2s revert is awaited for real instead.
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      render(<CopyToClipboardButton text="texto" />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('button')).toHaveTextContent('Copiado ✓');

      await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Copiar al portapapeles'), {
        timeout: 3000,
      });
    },
    10000,
  );
});
