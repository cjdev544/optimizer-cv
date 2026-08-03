import { useState } from 'react';

interface CvStorageEditorProps {
  cvText: string;
  onSave: (text: string) => Promise<void>;
}

export function CvStorageEditor({ cvText, onSave }: CvStorageEditorProps) {
  const [isEditing, setIsEditing] = useState(cvText.trim().length === 0);
  const [draft, setDraft] = useState(cvText);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs">
        <span className="text-gray-600">CV guardado ({cvText.trim().length} caracteres)</span>
        <button
          type="button"
          onClick={() => {
            setDraft(cvText);
            setIsEditing(true);
          }}
          className="font-medium text-indigo-600 hover:underline"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="cv-text" className="text-xs font-medium text-gray-700">
        Tu CV
      </label>
      <textarea
        id="cv-text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Pega aquí el texto de tu CV… (se guarda en la extensión, no hace falta pegarlo cada vez)"
        className="h-24 w-full resize-none rounded-md border border-gray-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={draft.trim().length < 50 || isSaving}
        className="self-start rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {isSaving ? 'Guardando…' : 'Guardar CV'}
      </button>
    </div>
  );
}
