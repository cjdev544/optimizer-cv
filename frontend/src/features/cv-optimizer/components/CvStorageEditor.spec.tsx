import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CvStorageEditor } from './CvStorageEditor';

// `cvText` is a controlled prop: the real parent (useStoredCv) re-renders the
// editor with the new value after a save. This wrapper mirrors that so the
// "returns to read-only mode" test sees the post-save length, not the stale prop.
function StatefulCvStorageEditor({ onSave }: { onSave: (text: string) => Promise<void> }) {
  const [cvText, setCvText] = useState('');
  return (
    <CvStorageEditor
      cvText={cvText}
      onSave={async (text) => {
        await onSave(text);
        setCvText(text);
      }}
    />
  );
}

describe('CvStorageEditor', () => {
  it('starts in edit mode when there is no stored CV', () => {
    render(<CvStorageEditor cvText="" onSave={vi.fn()} />);

    expect(screen.getByLabelText('Tu CV')).toBeInTheDocument();
  });

  it('starts in read-only mode when there is already a stored CV, showing its length', () => {
    render(<CvStorageEditor cvText={'a'.repeat(120)} onSave={vi.fn()} />);

    expect(screen.getByText('CV guardado (120 caracteres)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu CV')).not.toBeInTheDocument();
  });

  it('switches to edit mode when "Editar" is clicked', async () => {
    const user = userEvent.setup();
    render(<CvStorageEditor cvText={'a'.repeat(120)} onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByLabelText('Tu CV')).toHaveValue('a'.repeat(120));
  });

  it('disables the save button while the draft is under 50 characters', async () => {
    const user = userEvent.setup();
    render(<CvStorageEditor cvText="" onSave={vi.fn()} />);

    await user.type(screen.getByLabelText('Tu CV'), 'muy corto');

    expect(screen.getByRole('button', { name: 'Guardar CV' })).toBeDisabled();
  });

  it('enables the save button once the draft reaches 50 characters', async () => {
    const user = userEvent.setup();
    render(<CvStorageEditor cvText="" onSave={vi.fn()} />);

    await user.type(screen.getByLabelText('Tu CV'), 'a'.repeat(50));

    expect(screen.getByRole('button', { name: 'Guardar CV' })).toBeEnabled();
  });

  it('calls onSave with the draft and returns to read-only mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StatefulCvStorageEditor onSave={onSave} />);

    await user.type(screen.getByLabelText('Tu CV'), 'a'.repeat(50));
    await user.click(screen.getByRole('button', { name: 'Guardar CV' }));

    expect(onSave).toHaveBeenCalledWith('a'.repeat(50));
    expect(await screen.findByText('CV guardado (50 caracteres)')).toBeInTheDocument();
  });
});
