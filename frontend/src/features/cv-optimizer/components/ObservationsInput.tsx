interface ObservationsInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ObservationsInput({ value, onChange }: ObservationsInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="observaciones" className="text-xs font-medium text-gray-700">
        Observaciones / Instrucciones personalizadas{' '}
        <span className="font-normal text-gray-400">(opcional)</span>
      </label>
      <textarea
        id="observaciones"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ej: Enfoca mi perfil hacia el liderazgo de equipos o no menciones mi experiencia con Angular…"
        className="h-16 w-full resize-none rounded-md border border-gray-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}
